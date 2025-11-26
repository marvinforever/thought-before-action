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

    // Fetch diagnostics AND normalized scores
    const { data: diagnostics } = await supabase
      .from("diagnostic_responses")
      .select("*")
      .eq("company_id", companyId);
    
    const { data: diagnosticScores } = await supabase
      .from("diagnostic_scores")
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
    
    // Calculate diagnostic score averages across company
    const calculateScoreAverage = (field: string) => {
      if (!diagnosticScores || diagnosticScores.length === 0) return 0;
      const validScores = diagnosticScores
        .map((d: any) => d[field])
        .filter((score: any) => score !== null && score !== undefined);
      if (validScores.length === 0) return 0;
      return Math.round(validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length);
    };
    
    const orgRetentionScore = calculateScoreAverage('retention_score');
    const orgEngagementScore = calculateScoreAverage('engagement_score');
    const orgBurnoutScore = calculateScoreAverage('burnout_score');
    const orgManagerScore = calculateScoreAverage('manager_score');
    const orgCareerScore = calculateScoreAverage('career_score');
    const orgClarityScore = calculateScoreAverage('clarity_score');
    const orgLearningScore = calculateScoreAverage('learning_score');
    const orgSkillsScore = calculateScoreAverage('skills_score');
    
    const hasDiagnosticData = diagnosticScores && diagnosticScores.length > 0 && orgRetentionScore > 0;

    // Generate AI narrative using Gemini
    const narrativePrompt = `You are creating a comprehensive Strategic Learning Design Report for an organization.

CONTEXT AND DATA:
Company: Analyzing ${employees.length} employees currently enrolled in Jericho (NOTE: This is NOT total company size, only those using the platform)
Capability Gaps Identified: ${validCohorts.length} distinct capability development opportunities
Total Employees Needing Development: ${new Set(validCohorts.flatMap(c => c.employee_ids)).size}

${hasDiagnosticData ? `
ORGANIZATIONAL DIAGNOSTIC SCORES (0-100 scale):
- Retention: ${orgRetentionScore}
- Engagement: ${orgEngagementScore}
- Burnout (low risk = high score): ${orgBurnoutScore}
- Manager Support: ${orgManagerScore}
- Career Development: ${orgCareerScore}
- Role Clarity: ${orgClarityScore}
- Learning Engagement: ${orgLearningScore}
- Skills Application: ${orgSkillsScore}

These scores provide critical context for capability development priorities and urgency.` : ''}

DATA MATURITY PHASE: ${dataPhase.toUpperCase()}
${dataPhaseDescription}

Data Sources Available:
- Job Descriptions: ${hasJobDescriptions ? `${jobDescriptions.length} employees` : 'None'}
- Self-Assessments: ${selfAssessmentRate.toFixed(0)}% complete
- Manager Assessments: ${managerAssessmentRate.toFixed(0)}% complete
- Employee Goals: ${hasGoals ? `${targets.length} active goals` : 'Not yet collected'}
- Diagnostic Surveys: ${hasDiagnosticData ? `${diagnosticScores.length} employees` : 'Not yet collected'}
${businessGoalsContext}
${goalsContext}

DETAILED CAPABILITY GAP DATA (WHO NEEDS WHAT):
${validCohorts.map((c, i) => {
  const cohortEmployees = c.employee_ids.map(id => employeeDataMap.get(id));
  const employeeNames = cohortEmployees.map(e => e?.full_name || 'Unknown').join(', ');
  return `${i + 1}. ${c.cohort_name}
   - WHO: ${employeeNames}
   - CURRENT: ${c.current_level} → TARGET: ${c.target_level}
   - URGENCY: ${c.gap_severity}`;
}).join("\n\n")}

YOUR TASK: Create a comprehensive Strategic Learning Design Report following the EXACT structure below. This should be a detailed consulting-quality document (25+ pages worth of content) that provides extensive analysis and actionable recommendations.

REQUIRED REPORT STRUCTURE:

========================================
STRATEGIC LEARNING DESIGN REPORT
========================================

A Comprehensive Plan for Organizational Capability Development

Prepared by The Momentum Company in partnership with Organizational Leadership

EXECUTIVE SUMMARY

[Write 4-5 detailed paragraphs that:]
- Open with a powerful statement about this being a roadmap of potential, not a list of deficiencies
- Reference the ${validCohorts.length} distinct capability development opportunities across ${employees.length} employees enrolled in Jericho
- Explain this is derived from multi-layered analysis: job descriptions, diagnostic survey, and Jericho platform assessments
- Describe the three-year learning design that systematically cultivates capabilities from foundation to strategic application
- Frame this as positioning the organization at the forefront of strategic talent development
- End with optimism about organizational agility, resilience, and market leadership

UNDERSTANDING OUR CAPABILITY FRAMEWORK

What Are Capabilities?

[2-3 paragraphs explaining that capabilities are the specific skills, knowledge, and behaviors that enable people to perform effectively and advance. Explain that all ${validCohorts.length} capability gaps have been systematically identified and organized by competencies they represent.]

The Four Proficiency Levels

LEVEL 1: FOUNDATIONAL
[Detailed paragraph: Beginning of development journey, acquiring foundational knowledge, building understanding, just starting to apply. Need structured learning, guided practice, regular feedback to progress.]

LEVEL 2: ADVANCING  
[Detailed paragraph: Progressing in development, have basic proficiency, building toward higher skill levels. Can apply with some consistency, may need coaching for complex situations. Ready for more responsibility.]

LEVEL 3: INDEPENDENT
[Detailed paragraph: Full competency and autonomy. Operate without close supervision, make sound decisions, handle complex or novel situations effectively.]

LEVEL 4: MASTERY
[Detailed paragraph: Deeply embodied capability, represent excellence. Set examples, mentor others, continuously refine approach. Recognized as go-to experts, help establish organizational standards.]

DATA MATURITY AND METHODOLOGY

Current Assessment Phase: ${dataPhase.charAt(0).toUpperCase() + dataPhase.slice(1)}

[Copy the phase description verbatim and expand with context about data sources]

This analysis is based on ${dataPhase === 'initial' ? 'three' : 'multiple'} data sources:
- Job Descriptions: ${hasJobDescriptions ? 'Complete analysis of all current role descriptions to identify capability requirements' : 'Not yet available'}
- Diagnostic Survey: ${hasDiagnosticData ? `Comprehensive ${diagnosticScores.length}-person survey assessing role clarity, confidence, workload, wellbeing, learning preferences, manager support, and growth barriers` : 'Not yet administered'}
- Initial Jericho Assessment: Employees baseline capability self-assessments (${selfAssessmentRate.toFixed(0)}% complete)

${dataPhase === 'initial' ? `Important Context: This analysis represents initial estimates derived from job description analysis ${hasDiagnosticData ? 'and diagnostic survey data' : ''}, not yet validated by complete capability self-assessments from employees or manager assessments. Current and target levels shown reflect the organizations capability requirements based on role analysis. As employees complete capability self-assessments inside the Jericho platform and managers provide their capability assessments through Jericho, the data will mature significantly and recommendations will become increasingly precise. This initial phase provides a strategic starting point with the understanding that recommendations will become more targeted as assessment data matures.` : ''}

What to Expect as Data Matures:
- Capability self-assessments will reveal where employees feel strongest and where they recognize growth needs
- Manager capability assessments will provide calibrated, validated capability levels across the team
- Goal data will help prioritize development based on career aspirations and business needs
- Diagnostic insights will uncover motivation, learning preferences, engagement drivers, and retention risks
- The combination of these data sources will enable highly personalized, targeted development plans

${hasDiagnosticData ? `
KEY FINDINGS FROM DIAGNOSTIC SURVEY

A comprehensive diagnostic survey was administered to ${diagnosticScores.length} team members across 8 key dimensions. The findings validate the capability gaps identified through job analysis and provide critical context for development strategy.

1. RETENTION AND ENGAGEMENT (Score: ${orgRetentionScore}/100)
[2-3 paragraphs analyzing retention intent. If score below 70, call this MATERIAL CONCERN. Discuss flight risk, what percentage represents high/moderate/low risk. Connect to capability development as retention strategy.]

2. EMPLOYEE ENGAGEMENT (Score: ${orgEngagementScore}/100)  
[2-3 paragraphs on engagement levels. Discuss energy, motivation, connection to work. Acknowledge engagement present but note constraints if score moderate.]

3. BURNOUT AND WELLBEING (Score: ${orgBurnoutScore}/100)
[2-3 paragraphs. If score below 60, mark as CRITICAL FINDING. Discuss mental drain, personal sacrifice, exhaustion patterns. Frame as systemic issue affecting capacity for development.]

4. MANAGER SUPPORT FOR GROWTH (Score: ${orgManagerScore}/100)
[2-3 paragraphs. If score below 70, mark as KEY GAP. Discuss manager effectiveness in supporting development. Connect directly to Leadership & People Management priority.]

5. CAREER DEVELOPMENT CLARITY (Score: ${orgCareerScore}/100)
[2-3 paragraphs on growth path visibility. Note variance across organization. Discuss career conversations and advancement clarity.]

6. ROLE CLARITY (Score: ${orgClarityScore}/100)
[2-3 paragraphs on role expectations clarity. High score is strength. Lower score indicates confusion about responsibilities.]

7. LEARNING ENGAGEMENT (Score: ${orgLearningScore}/100)
[2-3 paragraphs on time dedicated to development. Discuss learning capacity, constraints, preferences for in-person vs. digital.]

8. SKILLS APPLICATION (Score: ${orgSkillsScore}/100)  
[2-3 paragraphs on how frequently employees apply key capabilities. High score shows active practice. Lower score shows opportunity for application.]

DIAGNOSTIC IMPLICATIONS FOR LEARNING DESIGN

The survey findings validate and deepen the capability gaps identified through job analysis. ${hasDiagnosticData ? 'Six' : 'Several'} critical implications:

[Number each implication 1-6 and provide 2-3 sentences each:]
1. [Wellbeing as prerequisite - if burnout low, address workload before heavy development]
2. [Manager development criticality - connect to manager scores]
3. [Time-efficient delivery - reference learning score and available hours]
4. [Modality preferences - in-person vs digital based on data]
5. [Retention urgency - if retention low, emphasize growth visibility]
6. [Engagement leverage - how to unlock full engagement through development]
` : ''}

ORGANIZATIONAL CAPABILITY ASSESSMENT

Based on ${hasDiagnosticData ? 'the diagnostic survey and' : ''} job description analysis, the ${employees.length}-person cohort demonstrates ${hasDiagnosticData && orgEngagementScore >= 75 ? 'solid operational competence' : 'foundational capabilities'}. The organizations core strengths include:

[Bullet list of 4-6 organizational strengths based on data]

SIX STRATEGIC FOCUS AREAS

[For EACH of 6 focus areas, create this detailed structure:]

[NUMBER]. [FOCUS AREA NAME - e.g., LEADERSHIP AND PEOPLE DEVELOPMENT]

Why It Matters:  
[2-3 paragraphs on strategic importance and multiplier effect]

Primary Capabilities:
[Comma-separated list of all capabilities in this domain]

Who Is Impacted:
[List all employee names who need development in this area]

Current State:
[2-3 sentences describing current capability levels across the group]

Desired State:
[2-3 sentences painting picture of target state]

Potential Cost of Inaction:
[Bullet list of 4-5 specific negative outcomes if not addressed]

How Well Know Its Working:
[Bullet list of 4-5 measurable indicators of success]

[Repeat for all 6 focus areas - typical areas: Leadership & People Development, Communication & Stakeholder Engagement, Commercial Growth & Client Strategy, Operational Excellence & Execution, Analytical Rigor & Financial Management, Technical/Domain Expertise]

YEAR 1 DEVELOPMENT PRIORITIES

Priority 1: [Name]
Priority 2: [Name]  
Priority 3: [Name]
Priority 4: [Name]
Priority 5: [Name]

[For EACH priority, provide this structure:]

PRIORITY [NUMBER]: [NAME IN ALL CAPS]

Target Audience:
[List specific employee names]

Why This Priority:
[2-3 paragraphs connecting to diagnostic findings, business needs, foundational importance]

Desired State:
[2-3 sentences of target outcomes]

How Well Know Its Working:
[Bullet list of success metrics]

Potential Training Options:
[Bullet list of 4-6 specific development approaches, including Momentum 360 elements, vendor options, internal approaches, digital resources via Jericho]

YEAR 1 LEARNING PATHWAY: MOMENTUM 360 AS STRATEGIC FOUNDATION

Momentum 360 is recommended as the strategic backbone of Year 1 development. Rather than listing specific package pricing, the recommendation focuses on what capabilities organizations need across three leadership tiers:

EXECUTIVE SUPPORT (C-Suite/Senior Leadership)
[Detailed paragraph describing executive coaching, roundtable seats, retreat experiences, digital library access, people analytics dashboard]

MID-LEVEL SUPPORT (VP/Director Level)  
[Detailed paragraph on champion coaching, mastermind sessions, virtual roundtables, intensive experiences, training tracks]

TEAM-LEVEL SUPPORT (Frontline Leaders and Individual Contributors)
[Detailed paragraph on Thriving Leader program, coaching seats, accelerator workshops, intensive team experiences, Academy digital vault]

Why This Approach:
[2-3 paragraphs explaining flexibility - can use M360 exclusively, use for exec/mid-level and source team training elsewhere, or supplement with specialized vendors]

YEAR 1 IMPLEMENTATION: PHASE-BASED APPROACH

[Note: If organization is agriculture/seasonal, adapt to agricultural cycles. Otherwise use quarterly structure]

PHASE 1: Foundation and Enrollment (Winter/Early Spring OR Q1)
[Detailed paragraph listing 6-8 specific initiatives with timeline]

PHASE 2: Skill Building and Application (Spring/Early Summer OR Q2)
[Detailed paragraph listing 6-8 specific initiatives with timeline]

PHASE 3: Momentum and Integration (Summer/Early Fall OR Q3)  
[Detailed paragraph listing 6-8 specific initiatives with timeline]

PHASE 4: Assessment and Planning (Fall/Early Winter OR Q4)
[Detailed paragraph listing 6-8 specific initiatives with timeline]

MOMENTUM 360 PLUS OTHER OPTIONS MODEL

While Momentum 360 is recommended as the strategic foundation, it is not the only option. Organizations can implement this learning design using multiple sources:

[Bullet list with detailed sub-bullets:]
- Momentum 360 components: [list]
- Vendor partnerships: [list]
- Internal resources: [list]
- Digital/Self-Directed: [list]
- Community College: [list]  
- Jericho AI and Resources: [list]

[Closing paragraph on flexibility and commitment to systematic development]

YEAR 2: ADVANCEMENT AND SCALE

Building on Year 1 foundation, Year 2 shifts focus from individual skill-building to strategic application and organizational integration. With common language and foundational capabilities established, Year 2 develops advanced capabilities and crosses the threshold into organizational transformation.

YEAR 2 FOCUS AREAS

[For EACH of 4 focus areas, write detailed subsection:]

[FOCUS AREA NAME]
[2-3 detailed paragraphs on what this focus area entails, who participates, development approach, expected results]

YEAR 3: MASTERY AND SUSTAINABILITY  

Year 3 focuses on embedding developed capabilities into organizational DNA and creating self-sustaining development culture. Goal: organizational excellence becomes self-perpetuating without reliance on external resources.

[For EACH of 3-4 programs, write detailed subsection:]

[PROGRAM NAME]
[2-3 detailed paragraphs on structure, participants, how it creates sustainability]

CRITICAL SUCCESS FACTORS

[Bullet list of 8 factors with 1-2 sentences each:]
- Leadership Commitment: [detail]
- Manager Accountability: [detail]
- Time Protection: [detail]
- Clear Metrics: [detail]
- Jericho Integration: [detail]
- Peer Accountability: [detail]
- Flexibility: [detail]
- Recognition: [detail]

EXPECTED ORGANIZATIONAL IMPACT

Systematic capability development generates impact across multiple dimensions:

Individual Level
[Bullet list of 4 specific outcomes]

Team Level  
[Bullet list of 4 specific outcomes]

Organizational Level
[Bullet list of 6 specific outcomes]

[Final paragraph citing research: Research from the Association for Talent Development shows organizations with comprehensive training programs have 218% higher income per employee and 24% higher profit margins...]

CONCLUSION

[4-5 paragraphs wrapping up:]
- The ${validCohorts.length} identified capability gaps represent ${validCohorts.length} distinct opportunities to invest in people
- Diagnostic survey confirms foundation is strong
- Current constraints are addressable through intentional development
- Three-year roadmap is ambitious yet pragmatic
- Provides blueprint for immediate Year 1 impact while building toward long-term sustainable growth
- Close with powerful statement about organizational transformation and competitive positioning

CRITICAL FORMATTING REQUIREMENTS:
- ABSOLUTELY NO MARKDOWN SYNTAX - no asterisks, hash symbols, underscores, bold/italic markers, brackets
- Use ALL CAPS for section headers only
- Double line breaks between major sections  
- Single line breaks for paragraphs and bullets
- Professional consulting report style
- Name specific individuals throughout  
- Extremely detailed - this should be 8000-12000 words minimum

TONE REQUIREMENTS:
- Warm, supportive, encouraging
- Frame gaps as "opportunities for growth" not problems
- Balance firmness with friendliness
- Acknowledge this may be first detailed capability analysis
- Professional but approachable
- Strategic clarity with optimism
- McKinsey-level depth but accessible language
- NEVER include cost projections or budget recommendations

Remember: This is a comprehensive strategic document, not a brief summary. Provide extensive detail in every section. Be thorough, specific, and actionable while maintaining supportive tone.`;

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
