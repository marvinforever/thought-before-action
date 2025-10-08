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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { timeframe_years = 3, force_regenerate = false } = await req.json();

    // Get user's company
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) throw new Error("Admin access required");

    const companyId = profile.company_id;

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

    // Cluster employees by capability gaps (minimum 4 people per cohort)
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

    // Filter cohorts with minimum 4 people
    const validCohorts: Cohort[] = [];
    capabilityGroups.forEach((employeeSet, key) => {
      if (employeeSet.size >= 4) {
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
          cohort_name: `${capName} Training Cohort`,
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
      throw new Error("No training cohorts with minimum 4 employees found");
    }

    // Fetch available training solutions
    const { data: freeResources } = await supabase
      .from("resources")
      .select("*")
      .eq("type", "free");

    const { data: vendors } = await supabase
      .from("training_vendors")
      .select("*, vendor_courses(*)")
      .eq("is_active", true);

    // Match solutions to cohorts
    for (const cohort of validCohorts) {
      const solutions = [];

      // Option A: Conservative (Free resources)
      const matchingFree = freeResources?.filter((r: any) =>
        r.title?.toLowerCase().includes(cohort.capability_name.toLowerCase()) ||
        r.description?.toLowerCase().includes(cohort.capability_name.toLowerCase())
      );

      if (matchingFree && matchingFree.length > 0) {
        solutions.push({
          type: "free",
          title: `Free Resources (${matchingFree.length} items)`,
          vendor: "Internal Library",
          cost_per_person: 0,
          total_cost: 0,
          link: "",
        });
      }

      // Option B: Moderate (Online courses)
      const matchingCourses = vendors?.flatMap((v: any) =>
        v.vendor_courses?.filter((c: any) =>
          c.capability_tags?.some((tag: string) =>
            tag.toLowerCase().includes(cohort.capability_name.toLowerCase())
          )
        ) || []
      );

      if (matchingCourses && matchingCourses.length > 0) {
        const course = matchingCourses[0];
        solutions.push({
          type: "paid",
          title: course.title,
          vendor: vendors?.find((v: any) => v.id === course.vendor_id)?.name || "Unknown",
          cost_per_person: course.cost_per_person || 500,
          total_cost: (course.cost_per_person || 500) * cohort.employee_count,
          link: course.course_url,
          delivery_format: course.delivery_format,
          duration_hours: course.duration_hours,
        });
      } else {
        // Generic online course estimate
        solutions.push({
          type: "paid",
          title: `${cohort.capability_name} Online Course`,
          vendor: "To Be Determined",
          cost_per_person: 500,
          total_cost: 500 * cohort.employee_count,
          link: "",
        });
      }

      // Option C: Aggressive (Premium in-person training)
      solutions.push({
        type: "premium",
        title: `${cohort.capability_name} Premium Training`,
        vendor: "Momentum Company / External Facilitator",
        cost_per_person: 2000,
        total_cost: 2000 * cohort.employee_count,
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

    // Generate AI narrative using Lovable AI
    const narrativePrompt = `You are an executive leadership consultant analyzing organizational training needs. Generate a compelling narrative for a Strategic Learning Design report.

Company Context:
- Total Employees: ${employees.length}
- Training Cohorts Identified: ${validCohorts.length}
- Total employees needing training: ${new Set(validCohorts.flatMap(c => c.employee_ids)).size}

Training Cohorts:
${validCohorts.map((c, i) => `${i + 1}. ${c.cohort_name}: ${c.employee_count} employees (Priority: ${c.priority}/5, Gap: ${c.current_level} → ${c.target_level})`).join("\n")}

Budget Scenarios:
- Conservative (Free Resources): $${totalConservative.toLocaleString()}
- Moderate (Online Courses): $${totalModerate.toLocaleString()}
- Aggressive (Premium Training): $${totalAggressive.toLocaleString()}

Write a 300-400 word executive narrative that:
1. Summarizes the critical skill gaps identified
2. Links these gaps to business outcomes (retention, productivity, revenue)
3. Uses industry research to justify ROI (cite sources like Work Institute, ATD, Gallup)
4. Explains the formula: ROI = (Retention Savings + Productivity Gains) - Training Investment
5. Recommends the optimal budget scenario
6. Mentions that Jericho will track the actual value of these investments

Be specific with numbers and cite research where applicable. Use a confident, data-driven tone suitable for CEOs and executive teams.`;

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
            content: "You are an executive leadership consultant specializing in organizational development and training ROI.",
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

    // Calculate ROI projections
    const avgTurnoverCost = 50000; // Industry average
    const estimatedRetentionImpact = 0.15; // 15% reduction in turnover
    const retentionSavings = employees.length * avgTurnoverCost * estimatedRetentionImpact;
    const productivityGains = employees.length * 5000; // $5k per employee productivity gain
    const roiModerate = retentionSavings + productivityGains - totalModerate;
    const breakEvenMonths = Math.ceil((totalModerate / (retentionSavings + productivityGains)) * 12);

    const executiveSummary = {
      total_employees: employees.length,
      employees_analyzed: employees.length,
      employees_needing_training: new Set(validCohorts.flatMap((c) => c.employee_ids)).size,
      total_cohorts: validCohorts.length,
      total_investment_conservative: totalConservative,
      total_investment_moderate: totalModerate,
      total_investment_aggressive: totalAggressive,
      narrative,
      top_priorities: validCohorts
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3)
        .map((c) => `${c.cohort_name} (${c.employee_count} people)`),
    };

    const budgetScenarios = {
      conservative: {
        total: totalConservative,
        description: "Free resources and internal training",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_conservative,
        })),
      },
      moderate: {
        total: totalModerate,
        description: "Online courses and blended learning",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_moderate,
        })),
      },
      aggressive: {
        total: totalAggressive,
        description: "Premium in-person training and coaching",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_aggressive,
        })),
      },
    };

    const roiProjections = {
      retention_savings: retentionSavings,
      productivity_gains: productivityGains,
      total_roi_moderate: roiModerate,
      break_even_months: breakEvenMonths,
      formulas: {
        retention_savings: "Employees × Avg Turnover Cost × Estimated Retention Impact",
        productivity_gains: "Employees × $5,000 (industry benchmark)",
        total_roi: "(Retention Savings + Productivity Gains) - Training Investment",
      },
      sources: [
        "Work Institute 2023 Retention Report",
        "ATD State of the Industry 2023",
        "Gallup Workplace Research",
      ],
    };

    // Insert report into database
    const { data: newReport, error: insertError } = await supabase
      .from("strategic_learning_reports")
      .insert({
        company_id: companyId,
        timeframe_years,
        executive_summary: executiveSummary,
        budget_scenarios: budgetScenarios,
        roi_projections: roiProjections,
        total_budget_conservative: totalConservative,
        total_budget_moderate: totalModerate,
        total_budget_aggressive: totalAggressive,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert cohorts
    const cohortInserts = validCohorts.map((c) => ({
      report_id: newReport.id,
      ...c,
    }));

    const { error: cohortError } = await supabase
      .from("training_cohorts")
      .insert(cohortInserts);

    if (cohortError) console.error("Cohort insert error:", cohortError);

    // Create notification
    await supabase.from("strategic_learning_notifications").insert({
      company_id: companyId,
      report_id: newReport.id,
      notification_type: "refresh_completed",
      message: "Strategic Learning Design report has been generated",
      sent_to: user.id,
    });

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
