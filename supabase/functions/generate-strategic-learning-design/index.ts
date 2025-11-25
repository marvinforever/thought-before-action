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
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

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

    // Get user's company and check if they have admin access
    // Check if user has admin or super_admin role using the user_roles table
    const { data: hasAdminRole, error: adminRoleError } = await supabaseWithAuth
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    const { data: hasSuperAdminRole, error: superAdminRoleError } = await supabaseWithAuth
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (adminRoleError || superAdminRoleError) {
      throw new Error('Failed to verify user roles');
    }

    if (!hasAdminRole && !hasSuperAdminRole) {
      throw new Error("Admin access required");
    }

    // Get user's company_id for non-super admins
    const { data: profile } = await supabaseWithAuth
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

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

    // Filter cohorts with minimum 4 people (training hotspot threshold)
    const validCohorts: Cohort[] = [];
    capabilityGroups.forEach((employeeSet, key) => {
      if (employeeSet.size >= 4) {
        const [capName, currentLevel, targetLevel] = key.split("_");
        const employeeIds = Array.from(employeeSet);

        // Find capability ID
        const firstEmp = employeeDataMap.get(employeeIds[0]);
        const capInfo = firstEmp?.capabilities.find((c) => c.capability_name === capName);

        // Determine gap severity (based on level difference)
        const levelMap: Record<string, number> = {
          'foundational': 1,
          'advancing': 2,
          'independent': 3,
          'mastery': 4
        };
        const currentIdx = levelMap[currentLevel] || 1;
        const targetIdx = levelMap[targetLevel] || 4;
        const gapSize = targetIdx - currentIdx;

        validCohorts.push({
          cohort_name: capName,
          capability_id: capInfo?.capability_id || "",
          capability_name: capName,
          employee_ids: employeeIds,
          employee_count: employeeIds.length,
          current_level: currentLevel,
          target_level: targetLevel,
          gap_severity: gapSize >= 3 ? "critical" : gapSize >= 2 ? "high" : "medium",
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

      // Assign delivery quarter based on gap severity
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
      const severityOffset = cohort.gap_severity === "critical" ? 0 : cohort.gap_severity === "high" ? 1 : 2;
      let targetQuarter = currentQuarter + severityOffset;
      let targetYear = currentYear;
      if (targetQuarter > 4) {
        targetYear += Math.floor(targetQuarter / 4);
        targetQuarter = targetQuarter % 4 || 4;
      }
      cohort.delivery_quarter = `Q${targetQuarter} ${targetYear}`;
    }

    // Calculate budget scenarios BY YEAR - SPECIFIC COHORTS PER YEAR
    // Year 1 (2026): FOUNDATION — $165K (ONLY 5 cohorts)
    const year1CapabilityNames = new Set([
      "Leadership",
      "People Management", 
      "CRM System Proficiency",
      "Agronomy Sales Excellence",
      "Written Communication"
    ]);
    
    // Year 2 (2027): SCALE — $120K
    const year2CapabilityNames = new Set([
      "Project Management",
      "Coaching & Mentoring",
      "Domain Expertise",
      "Data Analysis",
      "Stakeholder Communication",
      "Strategic Business Thinking",
      "Tool Proficiency",
      "Verbal Communication",
      "Problem Solving",
      "Training & Development",
      "Performance Management"
    ]);
    
    // Everything else goes to Year 3 (2028)
    
    console.log('Total cohorts:', validCohorts.length);
    console.log('Cohort names:', validCohorts.map(c => c.capability_name));
    
    const year1Cohorts = validCohorts.filter(c => 
      year1CapabilityNames.has(c.capability_name)
    );
    const year2Cohorts = validCohorts.filter(c => 
      year2CapabilityNames.has(c.capability_name)
    );
    const year3Cohorts = validCohorts.filter(c => 
      !year1CapabilityNames.has(c.capability_name) && !year2CapabilityNames.has(c.capability_name)
    );
    
    console.log('Year 1 cohorts:', year1Cohorts.length, year1Cohorts.map(c => c.capability_name));
    console.log('Year 2 cohorts:', year2Cohorts.length);
    console.log('Year 3 cohorts:', year3Cohorts.length);
    
    const year1Conservative = year1Cohorts.reduce((sum, c) => sum + c.estimated_cost_conservative, 0);
    const year1Moderate = year1Cohorts.reduce((sum, c) => sum + c.estimated_cost_moderate, 0);
    const year1Aggressive = year1Cohorts.reduce((sum, c) => sum + c.estimated_cost_aggressive, 0);
    
    const year2Conservative = year2Cohorts.reduce((sum, c) => sum + c.estimated_cost_conservative, 0);
    const year2Moderate = year2Cohorts.reduce((sum, c) => sum + c.estimated_cost_moderate, 0);
    const year2Aggressive = year2Cohorts.reduce((sum, c) => sum + c.estimated_cost_aggressive, 0);
    
    const year3Conservative = year3Cohorts.reduce((sum, c) => sum + c.estimated_cost_conservative, 0);
    const year3Moderate = year3Cohorts.reduce((sum, c) => sum + c.estimated_cost_moderate, 0);
    const year3Aggressive = year3Cohorts.reduce((sum, c) => sum + c.estimated_cost_aggressive, 0);
    
    const totalConservative = year1Conservative + year2Conservative + year3Conservative;
    const totalModerate = year1Moderate + year2Moderate + year3Moderate;
    const totalAggressive = year1Aggressive + year2Aggressive + year3Aggressive;
    
    // Identify "Heavy Load" employees (in 3+ Year 1 cohorts)
    const employeeLoadMap = new Map<string, number>();
    year1Cohorts.forEach(cohort => {
      cohort.employee_ids.forEach(empId => {
        employeeLoadMap.set(empId, (employeeLoadMap.get(empId) || 0) + 1);
      });
    });
    
    const heavyLoadEmployees = Array.from(employeeLoadMap.entries())
      .filter(([_, count]) => count >= 3)
      .map(([empId, count]) => ({
        id: empId,
        name: employeeDataMap.get(empId)?.full_name || 'Unknown',
        cohort_count: count
      }));

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

    // Generate AI narrative using Claude
    const narrativePrompt = `You are analyzing capability development needs for a strategic learning design. This organization has ${validCohorts.length} identified capability gaps across ${employees.length} employees.

Company Context:
- Total Employees: ${employees.length}
- Capability Gaps Identified: ${validCohorts.length}
- Total employees needing development: ${new Set(validCohorts.flatMap(c => c.employee_ids)).size}
${businessGoalsContext}
${goalsContext}

DETAILED CAPABILITY GAP DATA (WHO NEEDS WHAT):
${validCohorts.map((c, i) => {
  const cohortEmployees = c.employee_ids.map(id => employeeDataMap.get(id));
  const employeeNames = cohortEmployees.map(e => e?.full_name || 'Unknown').join(', ');
  const employeeRoles = cohortEmployees.map(e => e?.role || 'No role specified').join(', ');
  const cohortGoals = cohortEmployees.flatMap(e => e?.goals || []).filter(g => g);
  const goalsText = cohortGoals.length > 0 
    ? ` Personal goals: ${cohortGoals.slice(0, 2).map(g => g.goal_text).join('; ')}` 
    : '';
  return `${i + 1}. ${c.cohort_name}
   - WHO: ${employeeNames}
   - ROLES: ${employeeRoles}
   - CURRENT STATE: ${c.current_level}
   - TARGET STATE: ${c.target_level}
   - URGENCY: ${c.gap_severity}
   ${goalsText ? `- ${goalsText}` : ''}`;
}).join("\n\n")}

YOUR TASK: Write a narrative-focused strategic learning design that tells the story of this organization's capability development needs.

WRITING APPROACH:
- Focus on PEOPLE first - use actual names and describe who needs what and why
- Tell the story of capability gaps in context of business impact
- Weave in employee goals and aspirations where relevant
- Make it feel like a strategic advisor's report to leadership
- Be specific about individuals and their development journeys
- Connect capability needs to business outcomes

OUTPUT STRUCTURE (2500-3500 words):

1. EXECUTIVE OVERVIEW (3-4 paragraphs):
   Start with the big picture - what patterns emerged when you analyzed the ${validCohorts.length} capability gaps? Who are the key people involved? What are the most critical development needs? Paint a clear picture of the organization's current state and where strategic investment will have the most impact.

2. CAPABILITY DEVELOPMENT PRIORITIES (Main section - tell the story of each key area):
   For each major capability area, write a narrative section that covers:
   - WHO specifically needs this capability (use actual names)
   - WHY it matters for the business (connect to goals, revenue, risk, efficiency)
   - WHAT the current state is vs. where they need to be
   - HOW you recommend addressing it (approach, not budget line items)
   - WHEN this should happen in the development timeline
   
   Write this as connected prose, not bullet points. Make it read like a strategic advisor explaining the situation. For example: "Sarah, Mike, and Jennifer all need to develop their Leadership capability from advancing to independent level. This is critical because they're managing teams but lack the frameworks for effective delegation and performance management. Sarah mentioned in her goals that she wants to build her coaching skills, which aligns perfectly with this development need..."

3. CONSOLIDATION AND STRATEGIC CHOICES:
   Explain how you grouped related capabilities and why. Describe which skills can be addressed through self-directed learning vs. formal programs. Be candid about trade-offs and sequencing decisions.

4. IMPLEMENTATION NARRATIVE:
   Describe the phased approach over 3 years. Year 1 focus areas, Year 2 scaling, Year 3 optimization. Write this as a roadmap story, not a project plan.

5. IMPACT AND ROI CONTEXT:
   Conversationally discuss the expected business impact. Reference industry benchmarks naturally. Connect specific capability development to business outcomes.

CRITICAL FORMATTING REQUIREMENTS - ABSOLUTELY NO EXCEPTIONS:
- This document will be displayed directly to executives. It MUST be clean prose with ZERO markdown.
- NEVER EVER use asterisks (*) for ANY reason - not for emphasis, not for lists, not for anything
- NEVER use hash symbols (#) for headers - use plain text with a colon instead
- NEVER use underscores (_) for emphasis or any other purpose
- NEVER use bold, italic, or any markdown formatting markers
- Section headings: Use plain text followed by a colon (e.g., "Executive Overview:" not "## Executive Overview")
- For emphasis: Use capital letters or careful word choice, NEVER markdown
- Lists: Use numbered lists (1., 2., 3.) or write as narrative prose
- DO NOT mention budget recommendations or implementation quarters
- Focus on WHO needs WHAT and WHY in narrative form

Tone: Strategic, advisory, people-focused. Write like a trusted consultant who knows these individuals and their business. Evidence-based but conversational. Clear and engaging.`;

    console.log("Generating AI narrative with Claude...");
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: "You are Jericho, an expert Chief Learning Officer and organizational development strategist. You're evidence-based, strategic, and RUTHLESSLY PRIORITIZED. You understand that small-to-medium organizations (20-200 employees) can only execute 5-8 major learning initiatives per year. Your job is to help organizations FOCUS by choosing what NOT to do as much as what TO do. You filter every training cohort through: Business Criticality (blocks revenue/creates risk), Urgency (needed in 12 months), and Leverage (multiplier effect). You consolidate related skills, defer non-critical items to Year 2-3, and move universal skills to self-serve. You speak like a confident strategic advisor who demonstrates wisdom through constraint. ABSOLUTE REQUIREMENT: Your output will be displayed directly to executives with NO post-processing. You MUST write in completely clean professional prose with ZERO markdown characters. This means: ZERO asterisks (*), ZERO hash symbols (#), ZERO underscores (_), ZERO brackets, ZERO bold/italic markers of any kind. Use plain text with colons for headings (not ## or #). For lists, use numbers (1., 2., 3.) or narrative prose. This is NON-NEGOTIABLE.",
        messages: [
          { role: "user", content: narrativePrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Claude API error:", errorText);
      throw new Error(`Failed to generate narrative: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let narrative = aiData.content[0]?.text || "Narrative generation failed.";
    
    // AGGRESSIVE post-processing to remove ALL markdown formatting
    narrative = narrative
      // Remove all asterisks in any combination
      .replace(/\*+/g, '')
      // Remove all underscores in any combination
      .replace(/_+/g, '')
      // Remove hash symbols (headers)
      .replace(/#+\s*/g, '')
      // Remove any markdown-like patterns with brackets/parens
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Clean up multiple spaces that might result
      .replace(/\s{2,}/g, ' ')
      // Clean up extra newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();

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
      year1_cohorts: year1Cohorts.length,
      year2_cohorts: year2Cohorts.length,
      year3_cohorts: year3Cohorts.length,
      total_investment_conservative: totalConservative,
      total_investment_moderate: totalModerate,
      total_investment_aggressive: totalAggressive,
      year1_investment_moderate: year1Moderate,
      year2_investment_moderate: year2Moderate,
      year3_investment_moderate: year3Moderate,
      expected_roi_moderate: roiModerate,
      expected_roi_percentage: roiPercentage,
      break_even_months: breakEvenMonths,
      narrative,
      heavy_load_employees: heavyLoadEmployees,
      top_priorities: validCohorts
        .sort((a, b) => {
          const severityOrder: Record<string, number> = { "critical": 1, "high": 2, "medium": 3 };
          return (severityOrder[a.gap_severity] || 3) - (severityOrder[b.gap_severity] || 3);
        })
        .slice(0, 3)
        .map((c) => `${c.cohort_name} (${c.employee_count} people)`),
    };

    const budgetScenarios = {
      conservative: {
        total: totalConservative,
        year1: year1Conservative,
        year2: year2Conservative,
        year3: year3Conservative,
        range: "$0-$150 per person",
        description: "Free resources and low-cost materials",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_conservative,
        })),
      },
      moderate: {
        total: totalModerate,
        year1: year1Moderate,
        year2: year2Moderate,
        year3: year3Moderate,
        range: "$500-$2,000 per person",
        description: "Online courses and blended learning",
        cohorts: validCohorts.map((c) => ({
          name: c.cohort_name,
          cost: c.estimated_cost_moderate,
        })),
      },
      aggressive: {
        total: totalAggressive,
        year1: year1Aggressive,
        year2: year2Aggressive,
        year3: year3Aggressive,
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
        gap_severity: c.gap_severity,
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
