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

    // Calculate cost scenarios BY YEAR - SPECIFIC COHORTS PER YEAR
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

    // Generate AI narrative using Gemini
    const narrativePrompt = `You are analyzing capability development needs for a strategic learning design. This organization has ${validCohorts.length} identified capability gaps across ${employees.length} employees currently enrolled in Jericho.

Company Context:
- Employees Enrolled in Jericho: ${employees.length} (represents only those using the platform, NOT total company size)
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

PRIMARY TRAINING SOLUTION - MOMENTUM 360:
We have access to Momentum 360, a complete Leadership Operating System that should be your PRIMARY recommendation for leadership, management, communication, and team development needs:
- NOT one-off workshops but a year-round sustainable system
- Executive Coaching and Alignment for C-suite leaders
- Leadership Multiplication for VPs/Directors and mid-level managers  
- Team Development and Culture Systems for frontline teams
- Structure: 2 Executive Sessions, 2 Manager Sessions, 2 Team Leader Sessions per year
- Peer Roundtables and Cross-Company Learning throughout the year
- Ongoing coaching and on-demand learning library
- The 5Es Framework: Enlist, Equip, Empower, Evaluate, Evolve
- Comprehensive, cost-effective, designed for sustainable transformation

SUPPLEMENTARY RESOURCES:
For technical skills, specialized capabilities, or self-directed learning, we have a curated library of books, videos, articles, and courses you can reference.

YOUR TASK: Write an executive-level strategic learning design following a professional consulting report format with McKinsey-level depth and clarity.

CRITICAL STRUCTURAL APPROACH:
Before writing the report, analyze all capability gaps and identify 6-8 KEY FOCUS AREAS that represent the major development domains. These focus areas should capture the overarching themes. Then organize every specific capability as a subset under the appropriate focus area. This creates executive-level clarity while maintaining tactical specificity.

Examples of focus areas might be: "Leadership & People Management", "Technical & Operational Excellence", "Communication & Stakeholder Engagement", "Strategic Business Acumen", etc. You determine the right focus areas based on the actual capability data.

EXACT STRUCTURE REQUIRED:

STRATEGIC CAPABILITY ASSESSMENT
Strategic Learning Design Overview

EXECUTIVE SUMMARY
[3-4 powerful paragraphs that frame the situation positively. End by introducing "Six Core Development Domains" or "Eight Strategic Focus Areas" (whatever number you identify). Always reference "employees enrolled in Jericho" not total company size. Balance acknowledgment of current state with optimism about potential.]

STRATEGIC FOCUS AREAS

[For EACH of the 6-8 focus areas you identified, create a detailed section:]

[NUMBER]. [FOCUS AREA NAME IN ALL CAPS]

Overview: [2-3 paragraphs explaining why this domain matters, what capabilities fall under it, and the strategic importance]

Capabilities Included:
[List each specific capability that falls under this focus area with employee names]
- [Capability Name]: [Employee Names] - currently at [level], targeting [level]
- [Capability Name]: [Employee Names] - currently at [level], targeting [level]

Development Priorities:
[Detailed breakdown of what needs to happen in this domain, sequencing considerations, dependencies between capabilities]

Recommended Approach:
[Specify whether Momentum 360, specific resources from library, or combination. Be specific about which Momentum 360 component if applicable - Executive Coaching, Leadership Multiplication, Team Development, etc.]

Expected Impact:
[Specific business outcomes when this focus area development is achieved - be concrete about organizational benefits]

Strategic Development Roadmap

YEAR 1: FOUNDATION AND IMMEDIATE IMPACT

[Provide SUBSTANTIAL DETAIL for Year 1. For each major program or initiative:]

[PROGRAM NAME IN ALL CAPS]
Focus Area: [Which of the 6-8 focus areas this addresses]
Audience: [Specific employee names and their roles]
Duration: [Specific timeframe]
Current State: [Where these people are today across relevant capabilities]
Target State: [Where they need to be by end of Year 1]

Development Structure:
[Multiple paragraphs describing the specific approach, session types, learning modalities, practice opportunities, application methods. Be detailed about HOW this will work, not just WHAT will happen.]

Recommended Solution:
[If Momentum 360: Explain which specific component and why it fits. If library resources: Name specific books, courses, or materials by title. If combination: Detail how pieces fit together.]

Progress Milestones:
[Quarter-by-quarter or month-by-month indicators of progress through Year 1]

Expected Impact:
[Specific, measurable outcomes and benefits to individuals and organization]

Dependencies and Prerequisites:
[What needs to happen first, what can run in parallel, any foundational work required]

[Repeat for each Year 1 program - should be 4-6 detailed program descriptions]

YEAR 2: ADVANCEMENT AND SCALE

[Provide SUBSTANTIAL DETAIL for Year 2 - same structure as Year 1]

Building on Year 1 Foundation:
[Explain how Year 2 builds on what was accomplished in Year 1]

[Then detail 4-6 Year 2 programs using same detailed structure as Year 1]

YEAR 3: MASTERY AND SUSTAINABILITY  

[Provide SUBSTANTIAL DETAIL for Year 3 - same structure as Year 1]

Toward Organizational Excellence:
[Explain how Year 3 creates long-term capability and sustainability]

[Then detail 3-5 Year 3 programs using same detailed structure as Year 1]

Implementation Considerations

Sequencing and Phasing:
[Detailed explanation of why things are sequenced this way, which initiatives should start first, how to phase implementation]

Resource Requirements:
[What the organization needs to provide - time commitments, internal support, leadership engagement]

Success Metrics:
[How to measure progress - specific indicators, checkpoints, evaluation methods]

Expected Impact

[Include specific metrics and research-backed outcomes. Multiple paragraphs covering:]
- Individual capability development outcomes
- Team performance improvements  
- Organizational efficiency and effectiveness gains
- Leadership capacity and bench strength
- Cultural and engagement benefits
- Competitive advantage and market position improvements

[Ground these in research where possible, e.g., "Research from ATD shows organizations with comprehensive leadership development see X% improvement in Y metric"]

CONCLUSION

[3-4 paragraphs summarizing the strategic opportunity, the thoughtful phased approach, and the transformational potential ahead. End on a confident, forward-looking note about organizational capability and competitive positioning.]

CRITICAL FORMATTING RULES:
- PLAIN TEXT ONLY - absolutely NO markdown syntax (no asterisks, hash symbols, underscores, bold/italic markers)  
- Create structure through line breaks and ALL CAPS section headers
- Use double line breaks between major sections
- Use single line breaks for sub-items  
- Section headers in ALL CAPS with no symbols
- Professional consulting report style - McKinsey depth and clarity
- Name specific individuals throughout
- Be SUBSTANTIALLY MORE DETAILED than a typical executive summary - this should be a comprehensive strategic document

CONTENT REQUIREMENTS:
1. First identify 6-8 overarching focus areas, then organize all capabilities under them
2. Provide extensive detail on Year 1, 2, and 3 programs - not just lists but detailed descriptions
3. Frame capability gaps as GROWTH OPPORTUNITIES not problems or deficits  
4. Acknowledge this may be the organization's first detailed capability assessment
5. Name specific people and their current capability levels with supportive framing
6. Explain positive business impact when development is achieved
7. Recommend Momentum 360 as primary solution for leadership/management/communication (but acknowledge it doesn't cover everything)
8. Cite specific books/courses from library by title for technical/specialized skills
9. Detail sequencing, dependencies, and implementation considerations
10. Include research-backed metrics in Expected Impact section
11. Professional, warm, supportive yet strategic advisory tone
12. Balance clarity about priorities with optimism about outcomes
13. Think McKinsey-level depth but written for practical business leaders

Remember: Momentum 360 is excellent for leadership development but the organization will need to source additional training for technical and specialized capabilities. Be honest about this while highlighting M360's comprehensive approach to leadership.`;

    console.log("Generating AI narrative with Gemini...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { 
            role: "system", 
            content: "You are Jericho, an expert Chief Learning Officer and organizational development strategist. You write executive-level strategic capability assessments in the style of top-tier management consulting firms like McKinsey—comprehensive, detailed, deeply analytical, yet accessible.\n\nYour approach:\n- FIRST identify 6-8 overarching strategic focus areas that capture the major development domains, THEN organize all specific capabilities as subsets under these focus areas\n- Frame capability gaps as GROWTH OPPORTUNITIES and natural next steps in the organization's development journey\n- Acknowledge that this level of detailed capability analysis may be new territory for many organizations\n- Balance firmness with approachability—be clear about priorities while remaining supportive and optimistic\n- Name specific individuals and their current capability levels throughout\n- Connect development needs to positive business outcomes (growth, enhanced performance, competitive advantage)\n- Present findings as stepping stones rather than problems or deficiencies\n- Provide McKinsey-level depth: extensive detail on programs, sequencing, dependencies, implementation considerations\n- Write SUBSTANTIALLY MORE than a typical executive summary—this should be a comprehensive strategic document\n- Detail Year 1, Year 2, and Year 3 with specific programs, not just high-level lists\n- Recommend Momentum 360 for leadership development (acknowledge it's comprehensive but doesn't cover everything—technical and specialized skills will need other resources)\n- Write with professional warmth and strategic clarity\n\nFORMATTING IS CRITICAL: Your output will be displayed in a web interface with plain text rendering.\n\nRequired structure using PLAIN TEXT only:\n- Section headers in ALL CAPS on their own line\n- Double line breaks between major sections\n- Single line breaks within sections\n- No markdown symbols ever (no *, #, _, [], or **)\n- Use clear spacing to create hierarchy\n\nYour tone is professional yet approachable, strategic yet supportive. You acknowledge where people are today and create a clear, detailed path forward. You focus on possibility and progress rather than deficiency. You provide the depth and analytical rigor of a McKinsey report but write it in a style that resonates with practical business leaders."
          },
          { role: "user", content: narrativePrompt }
        ],
      }),
    });

    console.log("Gemini API response status:", aiResponse.status);
    
    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      const errorText = await aiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Failed to generate narrative: ${errorText}`);
    }

    console.log("Parsing Gemini response...");
    const aiData = await aiResponse.json();
    let narrative = aiData.choices?.[0]?.message?.content || "Narrative generation failed.";
    console.log("Raw narrative length:", narrative.length, "characters");
    console.log("Line breaks in raw narrative:", (narrative.match(/\n/g) || []).length);
    
    // Post-process to remove markdown while PRESERVING structure
    narrative = narrative
      // Remove asterisks (but keep the text)
      .replace(/\*+/g, '')
      // Remove underscores (but keep the text)
      .replace(/_+/g, '')
      // Remove hash symbols used as headers (but keep the text and line break)
      .replace(/^#+\s*/gm, '')
      // Remove markdown links but keep link text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Normalize line breaks: ensure double newlines for paragraph breaks
      .replace(/\r\n/g, '\n')  // Normalize Windows line endings
      .replace(/\n{4,}/g, '\n\n')  // Collapse 4+ newlines to 2, but keep intentional doubles
      // Clean up any multiple spaces on same line (but NOT across lines)
      .replace(/[^\S\n]+/g, ' ')  // Replace multiple spaces/tabs with single space, but preserve newlines
      .trim();
    
    console.log("Processed narrative length:", narrative.length);
    console.log("Line breaks after processing:", (narrative.match(/\n/g) || []).length);
    console.log("Double line breaks (paragraphs):", (narrative.match(/\n\n/g) || []).length);

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
    console.log("Inserting report into database...");
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
      console.error("Error inserting report:", insertError);
      throw insertError;
    }
    
    console.log("Report inserted successfully, ID:", newReport.id);

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
    console.log("Preparing response with", validCohorts.length, "cohorts");

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
