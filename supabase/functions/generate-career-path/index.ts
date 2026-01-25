import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type RoutingContext } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * OPUS-POWERED CAREER PATH GENERATION
 * 
 * Multi-step career planning workflow:
 * 1. Capability Graph Analysis - Map current capabilities to potential paths
 * 2. Aspiration Integration - Pull career interests from conversations
 * 3. Gap Assessment - Identify specific skill gaps with timelines
 * 4. Roadmap Generation - Create phased development plan
 * 5. Promotion Readiness Score - Calculate percentage ready for each path
 */

interface EmployeeData {
  profile: any;
  capabilities: any[];
  goals: any[];
  achievements: any[];
  aspirations: any[];
  recognition: any[];
  diagnosticScores: any[];
  habits: any[];
  oneOnOnes: any[];
}

// Step 1: Analyze capability graph and identify potential paths
async function analyzeCapabilityGraph(
  data: EmployeeData,
  companyPaths: any[],
  routingContext: RoutingContext
): Promise<{ analysis: string; suggestedPaths: string[] }> {
  const prompt = `Analyze this employee's capabilities and identify the most suitable career paths.

EMPLOYEE: ${data.profile.full_name}
CURRENT ROLE: ${data.profile.role || 'Not specified'}
TENURE: ${data.profile.created_at ? Math.floor((Date.now() - new Date(data.profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)) + ' months' : 'Unknown'}

CURRENT CAPABILITIES (${data.capabilities.length} total):
${data.capabilities.map((c: any) => `- ${c.capabilities?.name || 'Unknown'} (${c.capabilities?.category || 'General'}): Current Level ${c.current_level}, Target Level ${c.target_level}`).join('\n')}

AVAILABLE CAREER PATHS IN COMPANY:
${companyPaths.length > 0 ? companyPaths.map(p => `
- ${p.name} (${p.path_type})
  From: ${p.from_role || 'Entry'} → To: ${p.to_role}
  Timeline: ${p.typical_timeline_months || 'Not specified'} months
  Required capabilities: ${JSON.stringify(p.required_capabilities)}
`).join('\n') : 'No predefined paths - analyze based on capabilities and suggest logical progressions.'}

RECENT ACHIEVEMENTS (last 10):
${data.achievements.map((a: any) => `- ${a.achievement_text} (${a.category})`).join('\n') || 'None recorded'}

RECOGNITION RECEIVED:
${data.recognition.slice(0, 10).map((r: any) => `- "${r.title}" - ${r.impact_level || 'standard'} impact`).join('\n') || 'None'}

TASK:
1. Identify 2-4 potential career paths that align with their capability profile
2. For each path, note which capabilities are strong and which need development
3. Consider their achievements and recognition patterns
4. If company paths exist, match to the most suitable; if not, suggest logical progressions

Output format:
## Capability Profile Summary
[Brief assessment of their current capability landscape]

## Recommended Career Paths
1. [Path Name]: [Why this fits] - Strong in: [capabilities], Needs: [capabilities]
2. [Path Name]: [Why this fits] - Strong in: [capabilities], Needs: [capabilities]
3. [Path Name]: [Why this fits] - Strong in: [capabilities], Needs: [capabilities]

## Top Recommendation
[Which path is the best fit and why]`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 2500,
    temperature: 0.6,
  });

  // Extract suggested path names from the response
  const pathMatches = result.content.match(/\d\.\s*\*?\*?([^:*]+)\*?\*?:/g) || [];
  const suggestedPaths = pathMatches.map(m => m.replace(/^\d\.\s*\*?\*?/, '').replace(/\*?\*?:$/, '').trim());

  return { analysis: result.content, suggestedPaths };
}

// Step 2: Integrate career aspirations from conversations
async function integrateAspirations(
  data: EmployeeData,
  capabilityAnalysis: string,
  routingContext: RoutingContext
): Promise<{ aspirationSummary: string; targetRoles: string[] }> {
  const prompt = `Analyze this employee's career aspirations and integrate with their capability analysis.

EMPLOYEE: ${data.profile.full_name}
CURRENT ROLE: ${data.profile.role}

DETECTED CAREER ASPIRATIONS (from conversations):
${data.aspirations.length > 0 ? data.aspirations.map((a: any) => `
- "${a.aspiration_text}"
  Type: ${a.aspiration_type}
  Target Role: ${a.target_role || 'Not specified'}
  Confidence: ${a.confidence_score || 'N/A'}
  Sentiment: ${a.sentiment || 'N/A'}
  Date: ${new Date(a.created_at).toLocaleDateString()}
`).join('\n') : 'No formal aspirations detected yet. Look at goals and achievements for implicit signals.'}

THEIR PROFESSIONAL VISION:
${data.goals.length > 0 ? `
- 1-Year Vision: ${data.goals[0]?.one_year_vision || 'Not set'}
- 3-Year Vision: ${data.goals[0]?.three_year_vision || 'Not set'}
` : 'No professional vision set yet.'}

90-DAY GOALS (Patterns):
${data.goals.slice(0, 5).map((g: any) => `- ${g.goal_text} (${g.category || 'General'}) - ${g.completed ? 'Completed' : 'In Progress'}`).join('\n') || 'None'}

CAPABILITY ANALYSIS:
${capabilityAnalysis.substring(0, 2000)}

TASK:
1. Synthesize what this person WANTS in their career (stated aspirations, vision, goal patterns)
2. Compare what they want vs what their capabilities support
3. Identify any misalignment between aspirations and current trajectory
4. Suggest how to bridge the gap if misalignment exists

Output:
## Aspiration Summary
[What do they want? What patterns emerge?]

## Alignment Analysis
[How well do aspirations match capabilities?]

## Target Roles Identified
[List 2-3 specific roles they're aspiring toward, either stated or implied]

## Gap Bridge Recommendations
[If misaligned, how can they get from current state to aspiration?]`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 2000,
    temperature: 0.5,
  });

  // Extract target roles
  const roleMatches = result.content.match(/## Target Roles Identified\n([\s\S]*?)(?=##|$)/);
  const targetRoles = roleMatches 
    ? roleMatches[1].split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d\./))
        .map(line => line.replace(/^[-\d.]*\s*/, '').trim())
        .filter(r => r.length > 0)
    : [];

  return { aspirationSummary: result.content, targetRoles };
}

// Step 3: Generate detailed gap assessment
async function assessGaps(
  data: EmployeeData,
  targetRoles: string[],
  routingContext: RoutingContext
): Promise<{ gaps: any[]; strengths: any[] }> {
  const prompt = `Generate a detailed capability gap assessment for career progression.

EMPLOYEE: ${data.profile.full_name}
CURRENT ROLE: ${data.profile.role}
TARGET ROLES: ${targetRoles.join(', ') || 'Leadership/Senior IC progression'}

CURRENT CAPABILITIES:
${data.capabilities.map((c: any) => `
- ${c.capabilities?.name} (${c.capabilities?.category})
  Current: Level ${c.current_level}
  Target: Level ${c.target_level}
  ${c.self_assessed_at ? 'Self-assessed' : 'Manager-assessed'}
`).join('\n')}

RECENT DIAGNOSTIC SCORES:
${data.diagnosticScores.map((d: any) => `- ${d.question_text || d.question_id}: ${d.score}/5`).join('\n') || 'No diagnostic data'}

HABITS & CONSISTENCY (Greatness Tracker):
${data.habits.map((h: any) => `- ${h.habit_name}: ${h.current_streak} day streak`).join('\n') || 'No active habits'}

RECENT 1-ON-1 FEEDBACK:
${data.oneOnOnes.slice(0, 5).map((o: any) => `
- ${o.meeting_date}: 
  Wins: ${o.wins || 'None noted'}
  Concerns: ${o.concerns || 'None'}
`).join('\n') || 'No 1-on-1 data'}

TASK:
For each target role, identify:
1. CRITICAL GAPS - Capabilities that MUST improve before promotion
2. DEVELOPMENT AREAS - Capabilities that would strengthen candidacy
3. STRENGTHS - Capabilities that already support the progression

Rate each gap:
- Severity: critical | moderate | minor
- Estimated time to close: 3mo | 6mo | 12mo | 18mo+
- Recommended actions

Output as structured JSON:
{
  "gaps": [
    {
      "capability": "string",
      "current_level": "string",
      "required_level": "string",
      "severity": "critical|moderate|minor",
      "estimated_months_to_close": number,
      "recommended_actions": ["action1", "action2"]
    }
  ],
  "strengths": [
    {
      "capability": "string",
      "level": "string",
      "why_relevant": "string"
    }
  ]
}`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 3000,
    temperature: 0.3,
  });

  // Parse JSON from response
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { gaps: parsed.gaps || [], strengths: parsed.strengths || [] };
    }
  } catch (e) {
    console.error('Failed to parse gap assessment JSON:', e);
  }

  return { gaps: [], strengths: [] };
}

// Step 4: Generate phased roadmap
async function generateRoadmap(
  data: EmployeeData,
  targetRole: string,
  gaps: any[],
  strengths: any[],
  routingContext: RoutingContext
): Promise<{ roadmap: any; readinessScore: number }> {
  const prompt = `Create a detailed, phased career development roadmap.

EMPLOYEE: ${data.profile.full_name}
CURRENT ROLE: ${data.profile.role}
TARGET ROLE: ${targetRole}

IDENTIFIED GAPS:
${JSON.stringify(gaps, null, 2)}

IDENTIFIED STRENGTHS:
${JSON.stringify(strengths, null, 2)}

THEIR CURRENT HABITS (showing discipline):
${data.habits.map((h: any) => `- ${h.habit_name}: ${h.current_streak} day streak, ${h.longest_streak} best`).join('\n') || 'No habits tracked'}

TASK:
Create a phased development roadmap with specific milestones:

1. PHASE 1 (0-90 days): Quick wins and foundation
2. PHASE 2 (90-180 days): Core skill development  
3. PHASE 3 (180-365 days): Advanced capabilities
4. PHASE 4 (12-24 months): Leadership/mastery

For each phase include:
- Specific capabilities to develop
- Concrete actions (not vague "improve X")
- Measurable milestones
- Resources/learning needed

Also calculate a PROMOTION READINESS SCORE (0-100) based on:
- Capability coverage (40%)
- Gap severity (30%)
- Track record (achievements, goal completion) (15%)
- Consistency (habit streaks) (15%)

Output as JSON:
{
  "roadmap": {
    "phase1": {
      "name": "Foundation",
      "duration_days": 90,
      "focus_capabilities": ["cap1", "cap2"],
      "milestones": [
        {"milestone": "description", "measurable": "how to verify", "target_date_offset_days": 30}
      ],
      "resources": ["book/course/etc"]
    },
    "phase2": { ... },
    "phase3": { ... },
    "phase4": { ... }
  },
  "readiness_score": number,
  "readiness_breakdown": {
    "capability_coverage": number,
    "gap_severity_score": number,
    "track_record_score": number,
    "consistency_score": number
  },
  "estimated_ready_date": "YYYY-MM-DD",
  "summary": "One paragraph executive summary"
}`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 4000,
    temperature: 0.4,
  });

  // Parse JSON from response
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { 
        roadmap: parsed, 
        readinessScore: parsed.readiness_score || 0 
      };
    }
  } catch (e) {
    console.error('Failed to parse roadmap JSON:', e);
  }

  return { roadmap: {}, readinessScore: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, targetRole } = await req.json();

    console.log("Generating career path for employee:", employeeId);

    // Fetch employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, companies(name, industry)")
      .eq("id", employeeId)
      .single();

    if (!profile) {
      throw new Error("Employee not found");
    }

    // Fetch all relevant data in parallel
    const [
      capabilitiesResult,
      goalsResult,
      aspirationsResult,
      achievementsResult,
      recognitionResult,
      diagnosticResult,
      habitsResult,
      oneOnOnesResult,
      companyPathsResult,
    ] = await Promise.all([
      supabase
        .from("employee_capabilities")
        .select("*, capabilities(name, description, category)")
        .eq("profile_id", employeeId),

      supabase
        .from("personal_goals")
        .select("*")
        .eq("profile_id", employeeId),

      supabase
        .from("career_aspirations")
        .select("*")
        .eq("profile_id", employeeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("achievements")
        .select("*")
        .eq("profile_id", employeeId)
        .order("achieved_date", { ascending: false })
        .limit(20),

      supabase
        .from("recognition_notes")
        .select("title, description, category, impact_level, recognition_date")
        .eq("given_to", employeeId)
        .order("recognition_date", { ascending: false })
        .limit(20),

      supabase
        .from("diagnostic_scores")
        .select("*")
        .eq("profile_id", employeeId),

      supabase
        .from("leading_indicators")
        .select("*")
        .eq("profile_id", employeeId)
        .eq("is_active", true),

      supabase
        .from("one_on_one_notes")
        .select("meeting_date, wins, concerns, notes")
        .eq("employee_id", employeeId)
        .order("meeting_date", { ascending: false })
        .limit(10),

      supabase
        .from("career_paths")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true),
    ]);

    const employeeData: EmployeeData = {
      profile,
      capabilities: capabilitiesResult.data || [],
      goals: goalsResult.data || [],
      aspirations: aspirationsResult.data || [],
      achievements: achievementsResult.data || [],
      recognition: recognitionResult.data || [],
      diagnosticScores: diagnosticResult.data || [],
      habits: habitsResult.data || [],
      oneOnOnes: oneOnOnesResult.data || [],
    };

    const companyPaths = companyPathsResult.data || [];

    // Set up routing context for Opus
    const routingContext: RoutingContext = {
      taskType: 'career-pathing',
      companyId: profile.company_id,
      profileId: employeeId,
      functionName: 'generate-career-path',
    };

    console.log("Step 1: Analyzing capability graph...");
    const { analysis, suggestedPaths } = await analyzeCapabilityGraph(
      employeeData, 
      companyPaths, 
      routingContext
    );

    console.log("Step 2: Integrating aspirations...");
    const { aspirationSummary, targetRoles } = await integrateAspirations(
      employeeData,
      analysis,
      routingContext
    );

    // Use specified target role or first identified one
    const primaryTarget = targetRole || targetRoles[0] || suggestedPaths[0] || 'Senior/Leadership';

    console.log("Step 3: Assessing gaps for target:", primaryTarget);
    const { gaps, strengths } = await assessGaps(
      employeeData,
      [primaryTarget],
      routingContext
    );

    console.log("Step 4: Generating roadmap...");
    const { roadmap, readinessScore } = await generateRoadmap(
      employeeData,
      primaryTarget,
      gaps,
      strengths,
      routingContext
    );

    // Save promotion readiness to database
    const { error: saveError } = await supabase
      .from("promotion_readiness")
      .upsert({
        profile_id: employeeId,
        company_id: profile.company_id,
        target_role: primaryTarget,
        overall_readiness_pct: readinessScore,
        capability_readiness_pct: roadmap.readiness_breakdown?.capability_coverage || null,
        experience_readiness_pct: roadmap.readiness_breakdown?.track_record_score || null,
        performance_readiness_pct: roadmap.readiness_breakdown?.consistency_score || null,
        capability_gaps: gaps,
        strengths: strengths,
        readiness_summary: roadmap.summary || null,
        recommended_actions: roadmap.roadmap?.phase1?.milestones || [],
        estimated_ready_date: roadmap.estimated_ready_date || null,
        assessed_at: new Date().toISOString(),
        assessed_by: 'ai',
      }, {
        onConflict: 'profile_id,career_path_id',
      });

    if (saveError) {
      console.error("Failed to save promotion readiness:", saveError);
    }

    console.log("Career path generated successfully. Readiness:", readinessScore);

    return new Response(
      JSON.stringify({
        success: true,
        targetRole: primaryTarget,
        readinessScore,
        capabilityAnalysis: analysis,
        aspirationSummary,
        targetRoles,
        gaps,
        strengths,
        roadmap,
        suggestedPaths,
        metadata: {
          stepsCompleted: ['capability_analysis', 'aspiration_integration', 'gap_assessment', 'roadmap_generation'],
          employeeName: profile.full_name,
          currentRole: profile.role,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating career path:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
