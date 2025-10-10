import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeData {
  id: string;
  full_name: string;
  email: string;
  role?: string;
  capabilities: Array<{
    capability_id: string;
    capability_name: string;
    current_level: string;
    target_level: string;
    priority: number;
  }>;
  diagnostic?: any;
  goals?: any;
}

interface Cohort {
  cohort_name: string;
  capability_id: string;
  capability_name: string;
  employee_ids: string[];
  employee_count: number;
  priority: number;
  current_level: string;
  target_level: string;
  gap_severity: string;
  recommended_solutions: Array<{
    type: string;
    title: string;
    vendor?: string;
    cost_per_person: number;
    total_cost: number;
    link?: string;
    delivery_format?: string;
    duration_hours?: number;
  }>;
  estimated_cost_conservative: number;
  estimated_cost_moderate: number;
  estimated_cost_aggressive: number;
  delivery_quarter: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    
    // Create a client with user auth for user verification
    const supabaseWithAuth = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create a service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user } } = await supabaseWithAuth.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { timeframe_years = 3, force_regenerate = false, viewAsCompanyId } = await req.json();

    // Get user's company and determine effective company ID
    const { data: profile } = await supabaseWithAuth
      .from("profiles")
      .select("company_id, is_admin, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin && !profile?.is_super_admin) throw new Error("Admin access required");

    // Use viewAsCompanyId if provided (for super admins), otherwise use user's company
    const companyId = viewAsCompanyId || profile.company_id;

    // Check for existing valid report
    if (!force_regenerate) {
      const { data: existingReport } = await supabase
        .from("strategic_learning_reports")
        .select("*")
        .eq("company_id", companyId)
        .gt("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      if (existingReport) {
        return new Response(JSON.stringify({ report: existingReport, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Aggregating employee data for company:", companyId);

    // Fetch all employees in company
    const { data: employees } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", companyId);

    if (!employees || employees.length === 0) {
      throw new Error("No employees found in company");
    }

    // Fetch employee capabilities
    const { data: capabilities } = await supabase
      .from("employee_capabilities")
      .select(`
        profile_id,
        capability_id,
        current_level,
        target_level,
        priority,
        capabilities(name, category)
      `)
      .in("profile_id", employees.map((e) => e.id));

    // Fetch diagnostics
    const { data: diagnostics } = await supabase
      .from("diagnostic_responses")
      .select("*")
      .eq("company_id", companyId);

    // Fetch 90-day targets
    const { data: targets } = await supabase
      .from("ninety_day_targets")
      .select("*")
      .eq("company_id", companyId)
      .eq("completed", false);

    // Fetch job descriptions
    const { data: jobDescriptions } = await supabase
      .from("job_descriptions")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_current", true);

    // Aggregate employee data
    const employeeDataMap: Map<string, EmployeeData> = new Map();
    employees.forEach((emp) => {
      employeeDataMap.set(emp.id, {
        id: emp.id,
        full_name: emp.full_name || "",
        email: emp.email || "",
        capabilities: [],
        diagnostic: diagnostics?.find((d) => d.profile_id === emp.id),
        goals: targets?.filter((t) => t.profile_id === emp.id) || [],
      });
    });

    capabilities?.forEach((cap: any) => {
      const empData = employeeDataMap.get(cap.profile_id);
      if (empData) {
        empData.capabilities.push({
          capability_id: cap.capability_id,
          capability_name: cap.capabilities?.name || "Unknown",
          current_level: cap.current_level,
          target_level: cap.target_level,
          priority: cap.priority || 5,
        });
      }
    });

    // Cluster employees by capability gaps (minimum 2 people per cohort for testing)
    const capabilityGroups = new Map<string, Set<string>>();
    employeeDataMap.forEach((empData) => {
      empData.capabilities.forEach((cap) => {
        if (cap.current_level !== cap.target_level) {
          const key = `${cap.capability_name}_${cap.current_level}_${cap.target_level}`;
          if (!capabilityGroups.has(key)) {
            capabilityGroups.set(key, new Set());
          }
          capabilityGroups.get(key)!.add(empData.id);
        }
      });
    });

    // Filter cohorts with minimum 2 people
    const validCohorts: Cohort[] = [];
    capabilityGroups.forEach((employeeSet, key) => {
      if (employeeSet.size >= 2) {
        const [capName, currentLevel, targetLevel] = key.split("_");
        const employeeIds = Array.from(employeeSet);

        // Find capability ID
        const firstEmp = employeeDataMap.get(employeeIds[0]);
        const capInfo = firstEmp?.capabilities.find((c) => c.capability_name === capName);

        // Determine priority (average of employee priorities)
        const avgPriority = Math.round(
          employeeIds.reduce((sum, id) => {
            const emp = employeeDataMap.get(id);
            const cap = emp?.capabilities.find((c) => c.capability_name === capName);
            return sum + (cap?.priority || 5);
          }, 0) / employeeIds.length
        );

        validCohorts.push({
          cohort_name: `${capName} Training Hotspot`,
          capability_id: capInfo?.capability_id || "",
          capability_name: capName,
          employee_ids: employeeIds,
          employee_count: employeeIds.length,
          priority: avgPriority,
          current_level: currentLevel,
          target_level: targetLevel,
          gap_severity: avgPriority <= 2 ? "critical" : avgPriority <= 3 ? "high" : "medium",
          recommended_solutions: [],
          estimated_cost_conservative: 0,
          estimated_cost_moderate: 0,
          estimated_cost_aggressive: 0,
          delivery_quarter: "", // Will be calculated
        });
      }
    });

    if (validCohorts.length === 0) {
      console.warn("No cohorts found; continuing with empty cohorts for pilot report");
    }

    // Fetch available training solutions
    const { data: freeResources } = await supabase
      .from("resources")
      .select("*")
      .eq("type", "free");

    const { data: vendors } = await supabase
      .from("training_vendors")
      .select("*, vendor_courses(*)");

    // Match solutions to cohorts
    for (const cohort of validCohorts) {
      const solutions = [];

      // Option A: Conservative ($0-$150 per person)
      const matchingFree = freeResources?.filter((r: any) =>
        r.title?.toLowerCase().includes(cohort.capability_name.toLowerCase()) ||
        r.description?.toLowerCase().includes(cohort.capability_name.toLowerCase())
      );

      const conservativeCostPer = matchingFree && matchingFree.length > 0 ? 0 : 75; // $0 if resources exist, else midpoint of $0-$150
      solutions.push({
        type: "conservative",
        title: matchingFree && matchingFree.length > 0 
          ? `Free Resources (${matchingFree.length} items)` 
          : `Low-Cost Training Materials`,
        vendor: "Internal Library / Free Resources",
        cost_per_person: conservativeCostPer,
        cost_range: "$0-$150",
        total_cost: conservativeCostPer * cohort.employee_count,
        link: "",
      });

      // Option B: Moderate ($500-$2,000 per person)
      const matchingCourses = vendors?.flatMap((v: any) =>
        v.vendor_courses?.filter((c: any) =>
          c.capability_tags?.some((tag: string) =>
            tag.toLowerCase().includes(cohort.capability_name.toLowerCase())
          )
        ) || []
      );

      let moderateCostPer = 1250; // Midpoint of $500-$2,000
      if (matchingCourses && matchingCourses.length > 0) {
        const course = matchingCourses[0];
        const courseCost = Number(course.cost) || 1250;
        // Ensure it's within the moderate range
        moderateCostPer = Math.max(500, Math.min(2000, courseCost));
      }

      solutions.push({
        type: "moderate",
        title: matchingCourses && matchingCourses.length > 0 
          ? matchingCourses[0].title 
          : `${cohort.capability_name} Online Course`,
        vendor: matchingCourses && matchingCourses.length > 0
          ? vendors?.find((v: any) => v.id === matchingCourses[0].vendor_id)?.name || "Online Provider"
          : "Online Provider",
        cost_per_person: moderateCostPer,
        cost_range: "$500-$2,000",
        total_cost: moderateCostPer * cohort.employee_count,
        link: matchingCourses?.[0]?.course_url || "",
        duration_hours: matchingCourses?.[0]?.duration_hours,
      });

      // Option C: Premium ($2,000-$5,000 per person)
      const premiumCostPer = 3500; // Midpoint of $2,000-$5,000
      solutions.push({
        type: "premium",
        title: `${cohort.capability_name} Premium Training`,
        vendor: "Momentum Company / External Facilitator",
        cost_per_person: premiumCostPer,
        cost_range: "$2,000-$5,000",
        total_cost: premiumCostPer * cohort.employee_count,
        link: "",
        delivery_format: "in-person",
      });

      cohort.recommended_solutions = solutions;
      cohort.estimated_cost_conservative = solutions[0]?.total_cost || 0;
      cohort.estimated_cost_moderate = solutions[1]?.total_cost || 0;
      cohort.estimated_cost_aggressive = solutions[2]?.total_cost || 0;

      // Assign delivery quarter based on priority
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
      let targetQuarter = currentQuarter + (5 - cohort.priority);
      let targetYear = currentYear;
      if (targetQuarter > 4) {
        targetYear += Math.floor(targetQuarter / 4);
        targetQuarter = targetQuarter % 4 || 4;
      }
      cohort.delivery_quarter = `Q${targetQuarter} ${targetYear}`;
    }

    // Calculate budget scenarios
    const totalConservative = validCohorts.reduce((sum, c) => sum + c.estimated_cost_conservative, 0);
    const totalModerate = validCohorts.reduce((sum, c) => sum + c.estimated_cost_moderate, 0);
    const totalAggressive = validCohorts.reduce((sum, c) => sum + c.estimated_cost_aggressive, 0);

    // Fetch business goals conversation for context
    let businessGoalsContext = "";
    const { data: businessGoalsConv } = await supabase
      .from("conversations")
      .select("id, conversation_messages(role, content)")
      .eq("company_id", companyId)
      .ilike("title", "%business goals%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (businessGoalsConv && businessGoalsConv.conversation_messages) {
      const messages = businessGoalsConv.conversation_messages as any[];
      businessGoalsContext = "\n\n**Business Goals Context:**\nBased on our conversation about your business goals:\n" +
        messages
          .filter((m: any) => m.role === "user")
          .map((m: any) => `- ${m.content}`)
          .join("\n");
    }

    // Build context about employee goals
    const goalsContext = targets && targets.length > 0
      ? `\n\n**Employee 90-Day Goals:**\n${targets.map(t => `- ${t.goal_text} (${employeeDataMap.get(t.profile_id)?.full_name || 'Unknown'})`).join('\n')}`
      : '';

    // Generate AI narrative using Lovable AI
    const narrativePrompt = `Hey! I'm Jericho, your AI leadership coach. I just analyzed your team's capability data, 90-day goals, and diagnostic responses. I'm genuinely excited to share what I found—there are some incredible growth opportunities here.

Company Context:
- Total Employees: ${employees.length}
- Training Hotspots Identified: ${validCohorts.length}
- Total employees needing training: ${new Set(validCohorts.flatMap(c => c.employee_ids)).size}
${businessGoalsContext}
${goalsContext}

Training Hotspots:
${validCohorts.map((c, i) => {
  const cohortEmployees = c.employee_ids.map(id => employeeDataMap.get(id));
  const cohortGoals = cohortEmployees.flatMap(e => e?.goals || []).filter(g => g);
  const goalsText = cohortGoals.length > 0 
    ? ` (Related goals: ${cohortGoals.slice(0, 2).map(g => g.goal_text).join('; ')})` 
    : '';
  return `${i + 1}. ${c.cohort_name}: ${c.employee_count} employees (Priority: ${c.priority}/5, Gap: ${c.current_level} → ${c.target_level})${goalsText}`;
}).join("\n")}

Budget Scenarios:
- Conservative (Free Resources): $${totalConservative.toLocaleString()}
- Moderate (Online Courses): $${totalModerate.toLocaleString()}
- Aggressive (Premium Training): $${totalAggressive.toLocaleString()}

Write a 300-400 word narrative that is warm, direct, and action-oriented—professional but approachable. Here's what to include:

1. **Open with excitement and context:** Start by acknowledging what you see—both the opportunities and the potential impact. Frame the gaps as growth edges, not failures. ${businessGoalsContext ? "**IMPORTANT: Connect the training hotspots to the business goals mentioned above.**" : ""}

2. **Identify critical gaps and their impact:** Talk about the 2-3 most important skill gaps you identified. Connect each to real business outcomes—what happens if we close these gaps vs. what we risk if we don't (retention, productivity, innovation, revenue). ${businessGoalsContext ? "**Show how closing these gaps will help achieve their business goals.**" : ""} ${goalsContext ? "**CRITICAL: When recommending training, explicitly reference the employees' 90-day goals and explain HOW the training will help them achieve those specific goals. For example, if someone wants to become a better fiddle player, explain why fiddle lessons are recommended.**" : ""}

3. **Bring in the research—naturally:** Reference industry data (Work Institute, ATD, Gallup, etc.) but weave it in conversationally. For example: "Research from the Work Institute shows that..." or "ATD found that..." Keep it evidence-based but not academic.

4. **Explain ROI simply:** Show how the math works—basically: ROI = (what we save in retention + what we gain in productivity) - what we invest in training. Use real numbers from the scenarios above.

5. **Recommend a budget approach:** Based on the data, which scenario makes the most sense right now? Be direct but flexible—explain your recommendation and why.

6. **End with momentum and accountability:** Wrap up by reminding them that you'll be tracking the actual value of these investments together. Use "we" and "let's" language. Make it feel like a partnership.

Tone: Upbeat, optimistic, evidence-based, action-oriented. You deeply believe in human potential and you're here to help leaders unlock it. Keep it conversational but credible—like a trusted advisor who genuinely cares about their success.`;

    console.log("Generating AI narrative...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are Jericho, an upbeat and optimistic AI leadership coach who partners with leaders to unlock their team's potential. You're evidence-based, action-oriented, and genuinely excited about organizational growth. You speak warmly and directly, like a trusted advisor who deeply believes in human potential.",
          },
          { role: "user", content: narrativePrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      throw new Error("Failed to generate narrative");
    }

    const aiData = await aiResponse.json();
    const narrative = aiData.choices[0]?.message?.content || "Narrative generation failed.";

    // Calculate ROI projections based on actual data
    const avgTurnoverCost = 75000; // Includes recruiting, training, productivity loss
    
    // Calculate actual retention risk from diagnostics
    const retentionScores = diagnostics?.map(d => parseInt(d.would_stay_if_offered_similar) || 5) || [];
    const avgRetentionScore = retentionScores.length > 0 
      ? retentionScores.reduce((a, b) => a + b, 0) / retentionScores.length 
      : 5;
    
    // Employees at risk (score < 7 out of 10)
    const atRiskCount = retentionScores.filter(s => s < 7).length;
    
    // Retention savings: Training prevents 40% of at-risk turnover
    const retentionImpactRate = 0.4; // 40% of at-risk employees retained
    const employeesRetained = Math.max(1, Math.round(atRiskCount * retentionImpactRate));
    const retentionSavings = employeesRetained * avgTurnoverCost;
    
    // Productivity ROI: Industry research shows $2 return for every $1 invested in training
    // This is a CONSERVATIVE baseline (many studies show 200-300% ROI)
    const productivityReturnMultiplier = 2.0; // 200% ROI
    const productivityGains = totalModerate * productivityReturnMultiplier;
    
    // Total benefits = Productivity gains + Retention savings
    const totalBenefits = productivityGains + retentionSavings;
    const roiModerate = totalBenefits - totalModerate;
    const roiPercentage = totalModerate > 0 ? Math.round((roiModerate / totalModerate) * 100) : 0;
    const breakEvenMonths = totalModerate > 0 && totalBenefits > 0
      ? Math.ceil((totalModerate / (totalBenefits / 12)))
      : null;
    
    const employeesTrained = new Set(validCohorts.flatMap(c => c.employee_ids)).size;

    const executiveSummary = {
      total_employees: employees.length,
      employees_analyzed: employees.length,
      employees_at_risk: atRiskCount,
      employees_needing_training: employeesTrained,
      total_cohorts: validCohorts.length,
      total_investment_conservative: totalConservative,
      total_investment_moderate: totalModerate,
      total_investment_aggressive: totalAggressive,
      expected_roi_moderate: roiModerate,
      expected_roi_percentage: roiPercentage,
      break_even_months: breakEvenMonths,
      narrative,
      top_priorities: validCohorts
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3)
        .map((c) => `${c.cohort_name} (${c.employee_count} people)`),
    };

    const budgetScenarios = {
      conservative: {
        total: totalConservative,
        range: "$0-$150 per person",
        description: "Free resources and low-cost materials",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_conservative,
        })),
      },
      moderate: {
        total: totalModerate,
        range: "$500-$2,000 per person",
        description: "Online courses and blended learning",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_moderate,
        })),
      },
      aggressive: {
        total: totalAggressive,
        range: "$2,000-$5,000 per person",
        description: "Premium in-person training and coaching",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_aggressive,
        })),
      },
    };

    const roiProjections = {
      at_risk_employees: atRiskCount,
      employees_retained: employeesRetained,
      retention_savings: retentionSavings,
      employees_trained: employeesTrained,
      training_investment: totalModerate,
      productivity_roi_multiplier: productivityReturnMultiplier,
      productivity_gains: productivityGains,
      total_benefits: totalBenefits,
      net_roi: roiModerate,
      roi_percentage: roiPercentage,
      break_even_months: breakEvenMonths,
      formulas: {
        retention_savings: `${employeesRetained} employees retained × $${avgTurnoverCost.toLocaleString()} turnover cost`,
        productivity_gains: `Training investment ($${totalModerate.toLocaleString()}) × ${productivityReturnMultiplier} ROI multiplier = $${productivityGains.toLocaleString()}`,
        total_benefits: "Productivity Gains + Retention Savings",
        net_roi: "Total Benefits - Training Investment",
        roi_percentage: "(Net ROI ÷ Training Investment) × 100",
      },
      assumptions: {
        avg_turnover_cost: avgTurnoverCost,
        retention_impact_rate: `${Math.round(retentionImpactRate * 100)}% of at-risk employees retained`,
        productivity_roi_baseline: "200% return on training investment (conservative industry standard)",
      },
      sources: [
        "Society for Human Resource Management (SHRM) 2024",
        "Work Institute 2023 Retention Report",
        "ATD State of the Industry 2023 - Training ROI benchmarks",
        "Association for Talent Development Research",
      ],
    };

    // Insert report into database
    const { data: newReport, error: insertError } = await supabase
      .from("strategic_learning_reports")
      .insert({
        company_id: companyId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        executive_summary: executiveSummary,
        cohorts: validCohorts,
        narrative: narrative,
        budget_scenarios: budgetScenarios,
        roi_projections: roiProjections,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error in generate-strategic-learning-design:", insertError);
      throw insertError;
    }

    // Insert cohorts (map to table schema)
    const cohortInserts = validCohorts.map((c) => {
      const moderateSolution = c.recommended_solutions?.find((s: any) => s.type === "moderate");
      const estPer = moderateSolution?.cost_per_person ?? 1250;
      const totalEst = moderateSolution?.total_cost ?? estPer * c.employee_count;
      const expectedRoiPct = totalModerate > 0
        ? Math.round(((retentionSavings + productivityGains - totalModerate) / totalModerate) * 100)
        : null;

      return {
        report_id: newReport.id,
        cohort_name: c.cohort_name,
        capability_name: c.capability_name,
        employee_ids: c.employee_ids,
        employee_count: c.employee_count,
        priority: c.priority,
        recommended_solutions: c.recommended_solutions,
        estimated_cost_per_employee: estPer,
        total_estimated_cost: totalEst,
        estimated_cost_conservative: c.estimated_cost_conservative,
        estimated_cost_moderate: c.estimated_cost_moderate,
        estimated_cost_aggressive: c.estimated_cost_aggressive,
        expected_roi_percentage: expectedRoiPct,
        timeline_weeks: 8,
      };
    });

    // Note: Cohort and notification inserts removed - those tables can be added later if needed
    // if (cohortInserts.length > 0) {
    //   const { error: cohortError } = await supabase
    //     .from("training_cohorts")
    //     .insert(cohortInserts);
    //   if (cohortError) console.error("Cohort insert error:", cohortError);
    // }

    // await supabase.from("strategic_learning_notifications").insert({
    //   company_id: companyId,
    //   report_id: newReport.id,
    //   notification_type: "report_generated",
    //   message: "Strategic Learning Design report has been generated",
    //   sent_to: [user.id],
    // });

    console.log("Report generated successfully:", newReport.id);

    return new Response(
      JSON.stringify({ report: newReport, cohorts: validCohorts, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-strategic-learning-design:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
