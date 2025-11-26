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
  development_type: "self_serve" | "self_directed" | "high_touch";
  development_approach: string;
  jericho_resources: string[];
  requires_facilitation: boolean;
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

    // Analyze data maturity to understand what phase we're in
    let selfAssessmentCount = 0;
    let managerAssessmentCount = 0;
    let totalCapabilities = 0;
    
    capabilities?.forEach((cap: any) => {
      totalCapabilities++;
      if (cap.self_assessed_at) selfAssessmentCount++;
      if (cap.manager_assessed_at) managerAssessmentCount++;
    });
    
    const hasGoals = targets && targets.length > 0;
    const hasDiagnostics = diagnostics && diagnostics.length > 0;
    const hasJobDescriptions = jobDescriptions && jobDescriptions.length > 0;
    
    const selfAssessmentRate = totalCapabilities > 0 ? (selfAssessmentCount / totalCapabilities) * 100 : 0;
    const managerAssessmentRate = totalCapabilities > 0 ? (managerAssessmentCount / totalCapabilities) * 100 : 0;
    
    // Determine data maturity phase
    let dataPhase = "initial";
    let dataPhaseDescription = "";
    
    if (selfAssessmentRate === 0 && managerAssessmentRate === 0 && !hasGoals && !hasDiagnostics) {
      dataPhase = "initial";
      dataPhaseDescription = "Job Description Analysis Only - Capabilities have been identified from job descriptions but await employee and manager validation.";
    } else if (selfAssessmentRate > 0 && selfAssessmentRate < 50 && managerAssessmentRate < 30) {
      dataPhase = "early";
      dataPhaseDescription = "Early Data Collection - Some self-assessments are underway. Findings will become more precise as assessment completion increases.";
    } else if (selfAssessmentRate >= 50 && managerAssessmentRate >= 30) {
      dataPhase = "maturing";
      dataPhaseDescription = "Maturing Dataset - Self and manager assessments are substantially complete. Additional goal and diagnostic data will further refine priorities.";
    } else if (selfAssessmentRate >= 80 && managerAssessmentRate >= 80 && hasGoals && hasDiagnostics) {
      dataPhase = "comprehensive";
      dataPhaseDescription = "Comprehensive Analysis - Full assessment cycle complete with goals, diagnostics, and validated capability levels.";
    }

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
          development_type: "self_directed", // Will be determined by AI
          development_approach: "",
          jericho_resources: [],
          requires_facilitation: false,
          delivery_quarter: "", // Will be calculated
        });
      }
    });

    if (validCohorts.length === 0) {
      console.warn("No cohorts found; continuing with empty cohorts for pilot report");
    }

    // Assign delivery quarter based on gap severity
    for (const cohort of validCohorts) {
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

    // Organize cohorts BY YEAR for phased planning
    // Year 1 (2026): FOUNDATION (5 cohorts)
    const year1CapabilityNames = new Set([
      "Leadership",
      "People Management", 
      "CRM System Proficiency",
      "Agronomy Sales Excellence",
      "Written Communication"
    ]);
    
    // Year 2 (2027): SCALE
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

DATA MATURITY ASSESSMENT:
Current Phase: ${dataPhase.toUpperCase()}
${dataPhaseDescription}

Data Completeness:
- Job Descriptions: ${hasJobDescriptions ? `${jobDescriptions.length} employees` : 'None'}
- Self-Assessments: ${selfAssessmentRate.toFixed(0)}% complete (${selfAssessmentCount} of ${totalCapabilities} capabilities)
- Manager Assessments: ${managerAssessmentRate.toFixed(0)}% complete (${managerAssessmentCount} of ${totalCapabilities} capabilities)
- Employee Goals: ${hasGoals ? `${targets.length} active goals` : 'None yet'}
- Diagnostic Responses: ${hasDiagnostics ? `${diagnostics.length} employees` : 'None yet'}

CRITICAL CONTEXT FOR YOUR ANALYSIS:
The capabilities you're analyzing were identified through job description analysis. ${
  dataPhase === 'initial' 
    ? 'Employees have NOT yet validated these capabilities through self-assessment, and managers have NOT yet confirmed them. This means current capability levels are ESTIMATES based on job requirements, not validated assessments. Your recommendations should acknowledge this early phase and explain that priorities and gaps will become more precise as self-assessments and manager assessments are completed.'
    : dataPhase === 'early'
    ? 'Some employees have begun self-assessments, but the dataset is incomplete. Your recommendations should note that findings will sharpen significantly as assessment completion increases.'
    : dataPhase === 'maturing'
    ? 'Most assessments are complete, providing a solid foundation for recommendations. Additional goal and diagnostic data will further refine priorities.'
    : 'You have comprehensive data including validated assessments, goals, and diagnostics. Your recommendations can be highly specific and personalized.'
}

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

DEVELOPMENT APPROACHES AND AVAILABLE SOLUTIONS:

You must categorize each capability into ONE of these three development approaches:

1. SELF-SERVE DEVELOPMENT (Experience & Internal Coaching)
Many capabilities develop most effectively through on-the-job experience, stretch assignments, internal mentoring relationships, manager coaching, and time. Not everything requires formal training. This approach is appropriate for:
- Domain expertise that builds naturally through work
- Industry-specific knowledge gained through exposure
- Many technical skills that develop through practice
- Capabilities where the organization has internal expertise

Development approach: Internal coaching, mentoring, stretch assignments, shadowing, project-based learning

2. SELF-DIRECTED LEARNING (Jericho Platform)
Jericho provides curated learning resources matched to each capability gap. These capabilities benefit from structured resources but don't require facilitation or coaching:
- Books, videos, podcasts, and articles available 24/7
- Personalized to each employee's development needs
- Self-paced learning that accelerates organic development
- Appropriate for foundational knowledge, tool proficiency, communication basics, and technical skills

Development approach: Curated resources through Jericho, self-paced consumption, optional peer discussion

3. HIGH-TOUCH DEVELOPMENT (Structured Programs & Momentum 360)
Some capabilities—particularly leadership, people management, executive communication, and complex team dynamics—benefit from coached facilitation, peer cohorts, and structured intervention. These require more than reading or self-study.

Organizations can source high-touch development through:
- Individual executive coaching engagements (multiple vendors, varied approaches)
- Workshop facilitation from various providers (inconsistent quality, different methodologies)
- Peer roundtables or mastermind groups (requires coordination)
- Leadership development programs (various vendors with different frameworks)

OR through comprehensive membership programs like Momentum 360 that consolidate these elements:
- Complete Leadership Operating System (year-round sustainable support, not one-off workshops)
- Executive Coaching and Alignment for C-suite leaders
- Leadership Multiplication for VPs/Directors and mid-level managers
- Team Development and Culture Systems for frontline teams
- Structure: 2 Executive Sessions, 2 Manager Sessions, 2 Team Leader Sessions per year
- Peer Roundtables and Cross-Company Learning throughout the year
- Ongoing coaching and on-demand learning library
- The 5Es Framework: Enlist, Equip, Empower, Evaluate, Evolve
- Single methodology, consistent quality, integrated approach

Note: Sourcing high-touch development across multiple vendors requires coordination across different methodologies, managing multiple relationships, scheduling complexity, and varied quality standards. Comprehensive membership programs simplify this significantly.

YOUR TASK: Write an executive-level strategic learning design following a professional consulting report format with McKinsey-level depth and clarity.

CRITICAL STRUCTURAL APPROACH:
Before writing the report, you must:
1. Analyze all capability gaps and identify 6-8 KEY FOCUS AREAS that represent the major development domains
2. For EACH capability, determine which development approach is most appropriate (Self-Serve, Self-Directed Jericho, or High-Touch)
3. Organize all capabilities under the appropriate focus area
4. Be honest about what can be developed organically (builds credibility)
5. Show Jericho's value for self-directed learning
6. Position high-touch solutions (including M360) strategically without being pushy
7. Let the complexity of à la carte high-touch sourcing speak for itself

Examples of focus areas: "Leadership & People Management", "Technical & Operational Excellence", "Communication & Stakeholder Engagement", "Strategic Business Acumen", etc.

EXACT STRUCTURE REQUIRED:

STRATEGIC CAPABILITY ASSESSMENT
Strategic Learning Design Overview

EXECUTIVE SUMMARY
[3-4 powerful paragraphs that frame the situation positively. End by introducing "Six Core Development Domains" or "Eight Strategic Focus Areas" (whatever number you identify). Always reference "employees enrolled in Jericho" not total company size. Balance acknowledgment of current state with optimism about potential.]

DATA MATURITY AND METHODOLOGY

Current Assessment Phase: ${dataPhase.charAt(0).toUpperCase() + dataPhase.slice(1)}

${dataPhaseDescription}

Data Sources:
Job Descriptions: ${hasJobDescriptions ? 'Complete' : 'Not available'}
Self-Assessments: ${selfAssessmentRate.toFixed(0)}% complete
Manager Assessments: ${managerAssessmentRate.toFixed(0)}% complete
Employee Goals: ${hasGoals ? 'Available' : 'Not yet collected'}
Diagnostic Surveys: ${hasDiagnostics ? 'Complete' : 'Not yet collected'}

${dataPhase === 'initial' ? `Important Context: This analysis is based on job description requirements and represents the capabilities needed for each role. Current and target levels shown are initial estimates derived from job analysis, not yet validated by employee self-assessments or manager reviews. As employees complete self-assessments and managers provide their evaluations, capability levels and priorities will be refined to reflect actual proficiency more accurately. This initial phase provides a strategic starting point, with the understanding that recommendations will become increasingly precise as assessment data matures.

What to Expect as Data Matures:
- Self-assessments will reveal where employees feel strongest and where they recognize growth needs
- Manager assessments will provide calibrated, validated capability levels
- Goal data will help prioritize development based on career aspirations
- Diagnostic responses will uncover motivation, learning preferences, and retention risks
- The combination of these data sources will enable highly personalized, targeted development plans

For now, this report provides a foundational roadmap based on role requirements. Think of it as identifying the "playing field" - the capabilities each role demands. As assessments come in, we'll see where individuals actually stand on that field and can fine-tune development approaches accordingly.` : 
dataPhase === 'early' ? `Assessment Progress: Self-assessment and manager validation are underway. Current findings blend job description analysis with emerging assessment data. As assessment completion increases, capability levels will become more accurate and development priorities will sharpen. Expect this report to evolve significantly as the remaining assessments are completed.` :
dataPhase === 'maturing' ? `Dataset Quality: With substantial assessment completion, this analysis reflects validated capability levels rather than estimates. The addition of goal and diagnostic data will further refine priorities and enable more personalized recommendations.` :
`Comprehensive Analysis: This report draws from complete assessment cycles, employee goals, and diagnostic data, providing highly accurate capability levels and personalized development recommendations.`}

STRATEGIC FOCUS AREAS

[For EACH of the 6-8 focus areas you identified, create a detailed section:]

[NUMBER]. [FOCUS AREA NAME IN ALL CAPS]

Overview: [2-3 paragraphs explaining why this domain matters, what capabilities fall under it, and the strategic importance]

Capabilities Included:
[For each capability under this focus area, specify:]
- [Capability Name]: [Employee Names] - currently at [level], targeting [level]
  Development Type: [Self-Serve | Self-Directed (Jericho) | High-Touch]

Development Priorities:
[Detailed breakdown of what needs to happen in this domain, sequencing considerations, dependencies between capabilities]

Recommended Development Approach:

Self-Serve Development (if applicable):
[List capabilities that can develop through experience, internal coaching, and time. Explain the internal approach: stretch assignments, mentoring, project work, etc.]

Self-Directed Learning (Jericho):
[List capabilities supported by Jericho resources. Name specific books, videos, podcasts by title when possible. Explain how these accelerate organic learning.]

High-Touch Development (if applicable):
[List capabilities requiring coaching, facilitation, or structured programs. Detail what high-touch elements are needed and why self-study alone isn't sufficient. Then note: Organizations can source these through individual vendors and coaches (note coordination complexity) OR through comprehensive programs like Momentum 360 that consolidate executive coaching, leadership development, peer roundtables, and learning resources under a single membership.]

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

Development Approach by Type:
[Break down the program by development type:
- Self-Serve: What internal approaches will be used
- Self-Directed (Jericho): Specific resources by title
- High-Touch: Detail what's needed, mention à la carte complexity, then position integrated solutions like M360 as simplifying alternative]

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
2. For EACH capability, determine the appropriate development type (Self-Serve, Self-Directed Jericho, or High-Touch)
3. Provide extensive detail on Year 1, 2, and 3 programs - not just lists but detailed descriptions
4. Frame capability gaps as GROWTH OPPORTUNITIES not problems or deficits
5. Acknowledge what can be developed organically through experience (builds tremendous credibility)
6. Acknowledge this may be the organization's first detailed capability assessment
7. Name specific people and their current capability levels with supportive framing
8. Explain positive business impact when development is achieved
9. Show Jericho's role in providing curated self-directed learning resources
10. For high-touch needs, detail the complexity of à la carte sourcing (multiple vendors, coordination, varied methodologies) then position comprehensive membership programs like M360 as integrated alternatives
11. Cite specific books/videos/podcasts by title from Jericho for self-directed learning
12. Detail sequencing, dependencies, and implementation considerations
13. Include research-backed metrics in Expected Impact section
14. Professional, warm, supportive yet strategic advisory tone
15. Balance clarity about priorities with optimism about outcomes
16. Think McKinsey-level depth but written for practical business leaders
17. DO NOT include any cost projections, budget scenarios, or financial recommendations
18. Let the reader conclude that Jericho + M360 is the natural solution through the structure of your analysis

Remember: Be honest about what can develop organically. Show Jericho's value for self-directed learning. Position high-touch solutions strategically by showing à la carte complexity. Let the integrated solution (M360 for high-touch) become obviously attractive without explicitly pushing it.`;

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
            content: "You are Jericho, an expert Chief Learning Officer and organizational development strategist. You write executive-level strategic capability assessments in the style of top-tier management consulting firms like McKinsey—comprehensive, detailed, deeply analytical, yet accessible and honest.\n\nYour unique approach to development categorization:\n- FIRST identify 6-8 overarching strategic focus areas that capture the major development domains\n- THEN for each capability, determine whether it's best developed through: Self-Serve (experience/coaching), Self-Directed (Jericho resources), or High-Touch (M360/structured programs)\n- Be HONEST about what can develop organically through experience—this builds tremendous credibility\n- Show Jericho's value as the self-directed learning engine (books, videos, podcasts)\n- For high-touch needs, detail the à la carte complexity (multiple vendors, coordination, varied methodologies) then position comprehensive membership programs like M360 as integrated alternatives\n- Let the reader conclude the \"killer combo\" (Jericho + M360) naturally through your analysis structure\n\nCore principles:\n- Frame capability gaps as GROWTH OPPORTUNITIES and natural next steps in the organization's development journey\n- Acknowledge that detailed capability analysis may be new territory for many organizations\n- Balance firmness with approachability—be clear about priorities while remaining supportive and optimistic\n- Name specific individuals and their current capability levels throughout\n- Connect development needs to positive business outcomes (growth, enhanced performance, competitive advantage)\n- Present findings as stepping stones rather than problems or deficiencies\n- Provide McKinsey-level depth: extensive detail on programs, sequencing, dependencies, implementation considerations\n- Write SUBSTANTIALLY MORE than a typical executive summary—this should be a comprehensive strategic document\n- Detail Year 1, Year 2, and Year 3 with specific programs, not just high-level lists\n- DO NOT include any cost projections, budget scenarios, or ROI calculations\n- Write with professional warmth and strategic clarity\n\nFORMATTING IS CRITICAL: Your output will be displayed in a web interface with plain text rendering.\n\nRequired structure using PLAIN TEXT only:\n- Section headers in ALL CAPS on their own line\n- Double line breaks between major sections\n- Single line breaks within sections\n- No markdown symbols ever (no *, #, _, [], or **)\n- Use clear spacing to create hierarchy\n\nYour tone is professional yet approachable, strategic yet supportive, and refreshingly honest. You acknowledge what can develop naturally (unlike typical training vendors who want to sell everything). You focus on possibility and progress rather than deficiency. You provide the depth and analytical rigor of a McKinsey report but write it in a style that resonates with practical business leaders."
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

    // Calculate employee at-risk count from diagnostics (for context only, no cost calculations)
    const retentionScores = diagnostics?.map(d => parseInt(d.would_stay_if_offered_similar) || 5) || [];
    const atRiskCount = retentionScores.filter(s => s < 7).length;
    const employeesTrained = new Set(validCohorts.flatMap(c => c.employee_ids)).size;
    
    // Count capabilities by development type
    const selfServeCount = validCohorts.filter(c => c.development_type === "self_serve").length;
    const selfDirectedCount = validCohorts.filter(c => c.development_type === "self_directed").length;
    const highTouchCount = validCohorts.filter(c => c.development_type === "high_touch").length;

    const executiveSummary = {
      total_employees: employees.length,
      employees_analyzed: employees.length,
      employees_at_risk: atRiskCount,
      employees_needing_training: employeesTrained,
      total_cohorts: validCohorts.length,
      year1_cohorts: year1Cohorts.length,
      year2_cohorts: year2Cohorts.length,
      year3_cohorts: year3Cohorts.length,
      capabilities_self_serve_count: selfServeCount,
      capabilities_self_directed_count: selfDirectedCount,
      capabilities_high_touch_count: highTouchCount,
      narrative,
      heavy_load_employees: heavyLoadEmployees,
      top_priorities: validCohorts
        .sort((a, b) => {
          const severityOrder: Record<string, number> = { "critical": 1, "high": 2, "medium": 3 };
          return (severityOrder[a.gap_severity] || 3) - (severityOrder[b.gap_severity] || 3);
        })
        .slice(0, 3)
        .map((c) => `${c.cohort_name} (${c.employee_count} people)`),
      data_maturity: {
        phase: dataPhase,
        phase_description: dataPhaseDescription,
        self_assessment_rate: Math.round(selfAssessmentRate),
        manager_assessment_rate: Math.round(managerAssessmentRate),
        has_job_descriptions: hasJobDescriptions,
        has_goals: hasGoals,
        has_diagnostics: hasDiagnostics,
        total_capabilities: totalCapabilities,
        self_assessed_count: selfAssessmentCount,
        manager_assessed_count: managerAssessmentCount,
      },
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
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting report:", insertError);
      throw insertError;
    }
    
    console.log("Report inserted successfully, ID:", newReport.id);

    // Insert cohorts (map to table schema) - Note: cohort table inserts removed as schema may not support new fields yet
    // const cohortInserts = validCohorts.map((c) => ({
    //   report_id: newReport.id,
    //   cohort_name: c.cohort_name,
    //   capability_name: c.capability_name,
    //   employee_ids: c.employee_ids,
    //   employee_count: c.employee_count,
    //   gap_severity: c.gap_severity,
    //   development_type: c.development_type,
    //   development_approach: c.development_approach,
    //   jericho_resources: c.jericho_resources,
    //   requires_facilitation: c.requires_facilitation,
    //   timeline_weeks: 8,
    // }));

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
