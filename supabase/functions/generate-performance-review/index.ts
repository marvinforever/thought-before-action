import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type RoutingContext } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MULTI-STEP PERFORMANCE REVIEW GENERATION
 * 
 * This function uses Claude Opus 4.5 for comprehensive performance reviews.
 * The multi-step workflow includes:
 * 1. Evidence Synthesis - Pattern analysis across all data sources
 * 2. Draft Generation - Comprehensive review with specific examples
 * 3. Bias Check - Self-review for fairness and balance
 * 4. Final Polish - Manager-ready output
 */

interface ReviewContext {
  employee: { name: string; role: string };
  reviewPeriod: string;
  oneOnOneNotes: any[];
  recognition: any[];
  capabilities: any[];
  goals: { all: any[]; completed: any[]; inProgress: any[] };
  professionalVision: { oneYear: string | null; threeYear: string | null };
  capabilityAdjustments: any[];
  habits: any[];
  habitCompletions: any[];
}

// Step 1: Synthesize evidence and identify patterns
async function synthesizeEvidence(context: ReviewContext, routingContext: RoutingContext): Promise<string> {
  const prompt = `Analyze this employee's performance data and identify key patterns, themes, and trends.

EMPLOYEE: ${context.employee.name} (${context.employee.role})
REVIEW PERIOD: ${context.reviewPeriod}

DATA SOURCES:

1. 1-ON-1 MEETING NOTES (${context.oneOnOneNotes.length} meetings):
${context.oneOnOneNotes.map(note => `
- ${note.meeting_date}:
  Wins: ${note.wins || 'None'}
  Concerns: ${note.concerns || 'None'}
  Notes: ${note.notes || 'No notes'}`).join('\n')}

2. RECOGNITION RECEIVED (${context.recognition.length} items):
${context.recognition.map((rec: any) => `
- "${rec.title}" (${rec.impact_level || 'standard'} impact)
  ${rec.description}
  ${rec.capability?.name ? `Related capability: ${rec.capability.name}` : ''}`).join('\n')}

3. GOAL PROGRESS:
Completed (${context.goals.completed.length}/${context.goals.all.length}):
${context.goals.completed.map(g => `✓ ${g.goal_text}`).join('\n')}

In Progress:
${context.goals.inProgress.map(g => `○ ${g.goal_text}`).join('\n')}

4. CAPABILITY DEVELOPMENT:
${context.capabilities.map((cap: any) => `
- ${cap.capability.name} (${cap.capability.category}): ${cap.current_level} → ${cap.target_level}`).join('\n')}

5. MANAGER FEEDBACK (Level Adjustments):
${context.capabilityAdjustments.map(adj => `
- ${adj.previous_level} → ${adj.new_level}: ${adj.adjustment_reason || 'No reason given'}`).join('\n')}

6. DAILY HABITS (Greatness Tracker):
${context.habits.map((h: any) => `
- ${h.habit_name}: ${h.current_streak} day streak (best: ${h.longest_streak})`).join('\n')}

TASK: Identify and synthesize:
1. Top 3-5 performance themes (positive patterns across data)
2. Top 2-3 areas needing development (consistent gaps or concerns)
3. Notable achievements with specific evidence
4. Consistency patterns (what habits reveal about work ethic)
5. Growth trajectory (improving, stable, or declining)

Be specific. Reference dates and examples. This synthesis will inform the full review.`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 2000,
    temperature: 0.5,
  });

  return result.content;
}

// Step 2: Generate comprehensive review draft
async function generateDraft(
  context: ReviewContext, 
  evidenceSynthesis: string,
  routingContext: RoutingContext
): Promise<string> {
  const prompt = `You are an expert HR advisor helping a manager write a comprehensive, fair, and constructive performance review.

EMPLOYEE: ${context.employee.name}
ROLE: ${context.employee.role}
REVIEW PERIOD: ${context.reviewPeriod}

EVIDENCE SYNTHESIS FROM ANALYSIS:
${evidenceSynthesis}

PROFESSIONAL VISION (Their stated career goals):
- 1-Year: ${context.professionalVision.oneYear || 'Not set'}
- 3-Year: ${context.professionalVision.threeYear || 'Not set'}

Write a comprehensive performance review with these sections:

## 1. Overall Performance Summary (2-3 paragraphs)
Synthesize the overall performance and growth trajectory. Be specific with examples.

## 2. Key Strengths (3-5 bullet points)
Each strength should have a concrete example from the evidence.

## 3. Areas for Growth (2-3 bullet points)  
Frame constructively with actionable suggestions. These are opportunities, not failures.

## 4. Goal Achievement Analysis
Comment on completion rate, quality of work, and any standout achievements.

## 5. Daily Excellence & Consistency
Assess their Greatness Tracker habits. What does their streak performance reveal about their commitment to improvement?

## 6. Capability Development Progress
Where have they grown? Where do they still need to develop?

## 7. Alignment with Professional Vision
How well is their current trajectory supporting their stated career goals?

## 8. Recommendations for Next Period
2-3 specific, actionable focus areas for the upcoming review period.

IMPORTANT GUIDELINES:
- Use specific examples and dates wherever possible
- Balance positive feedback with constructive growth areas
- Be honest but supportive - this should help the employee grow
- Avoid vague statements like "good job" - be specific
- Consider their professional vision when making recommendations`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 4000,
    temperature: 0.7,
  });

  return result.content;
}

// Step 3: Check for bias and improve fairness
async function checkForBias(
  reviewDraft: string,
  context: ReviewContext,
  routingContext: RoutingContext
): Promise<{ improvements: string[]; revisedReview: string }> {
  const prompt = `You are an HR fairness reviewer. Analyze this performance review for common biases and suggest improvements.

REVIEW TO ANALYZE:
${reviewDraft}

Check for these common biases:
1. **Recency Bias**: Are recent events given disproportionate weight vs. the full review period?
2. **Halo/Horn Effect**: Does one trait (good or bad) color the entire review?
3. **Central Tendency**: Is the review too vague or middle-of-the-road, avoiding specific feedback?
4. **Contrast Effect**: Are comparisons to other employees implied?
5. **Attribution Errors**: Are successes attributed to luck but failures to character (or vice versa)?
6. **Subjective Language**: Are there unmeasurable claims without evidence?

INSTRUCTIONS:
1. List any biases found with specific examples from the text
2. Provide the complete revised review with improvements applied

Format your response as:

## BIAS CHECK FINDINGS
[List each issue found with the problematic text quoted]

## REVISED REVIEW
[The complete improved review]`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 5000,
    temperature: 0.3,
  });

  // Parse the response
  const content = result.content;
  const findingsMatch = content.match(/## BIAS CHECK FINDINGS\n([\s\S]*?)## REVISED REVIEW/);
  const revisedMatch = content.match(/## REVISED REVIEW\n([\s\S]*)/);

  const improvements = findingsMatch 
    ? findingsMatch[1].trim().split('\n').filter(line => line.trim())
    : [];
  
  const revisedReview = revisedMatch 
    ? revisedMatch[1].trim()
    : reviewDraft;

  return { improvements, revisedReview };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, reviewPeriod } = await req.json();

    console.log("Generating multi-step performance review for employee:", employeeId);

    // Get employee details
    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name, email, role, company_id")
      .eq("id", employeeId)
      .single();

    // Gather all data in parallel
    const [
      oneOnOnesResult,
      recognitionResult,
      capabilitiesResult,
      goalsResult,
      adjustmentsResult,
      personalGoalsResult,
      habitsResult,
      habitCompletionsResult,
    ] = await Promise.all([
      // 1-on-1 notes
      supabase
        .from("one_on_one_notes")
        .select("meeting_date, notes, wins, concerns, action_items")
        .eq("employee_id", employeeId)
        .order("meeting_date", { ascending: false })
        .limit(20), // Increased for better analysis

      // Recognition
      supabase
        .from("recognition_notes")
        .select(`
          title, description, category, recognition_date, impact_level,
          is_quick_kudos, capability:capabilities(name)
        `)
        .eq("given_to", employeeId)
        .order("recognition_date", { ascending: false })
        .limit(50),

      // Capabilities
      supabase
        .from("employee_capabilities")
        .select(`current_level, target_level, capability:capabilities(name, category)`)
        .eq("profile_id", employeeId),

      // Goals - ONLY professional (personal goals cannot legally be used)
      supabase
        .from("ninety_day_targets")
        .select("goal_text, completed, category, goal_type")
        .eq("profile_id", employeeId)
        .neq("goal_type", "personal")
        .order("created_at", { ascending: false })
        .limit(15),

      // Capability adjustments (manager feedback)
      supabase
        .from("capability_adjustments")
        .select("previous_level, new_level, adjustment_reason, created_at")
        .eq("profile_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(15),

      // Professional vision
      supabase
        .from("personal_goals")
        .select("one_year_vision, three_year_vision")
        .eq("profile_id", employeeId)
        .single(),

      // Habits (ONLY professional - personal habits cannot legally be used)
      supabase
        .from("leading_indicators")
        .select("habit_name, habit_description, current_streak, longest_streak, target_frequency, habit_type")
        .eq("profile_id", employeeId)
        .eq("is_active", true)
        .neq("habit_type", "personal"),

      // Habit completions
      supabase
        .from("habit_completions")
        .select("habit_id, completed_date, leading_indicators!inner(habit_name)")
        .eq("profile_id", employeeId)
        .order("completed_date", { ascending: false })
        .limit(200),
    ]);

    // Construct context
    const context: ReviewContext = {
      employee: {
        name: employee?.full_name || "Employee",
        role: employee?.role || "Team Member",
      },
      reviewPeriod,
      oneOnOneNotes: oneOnOnesResult.data || [],
      recognition: recognitionResult.data || [],
      capabilities: capabilitiesResult.data || [],
      goals: {
        all: goalsResult.data || [],
        completed: (goalsResult.data || []).filter((g: any) => g.completed),
        inProgress: (goalsResult.data || []).filter((g: any) => !g.completed),
      },
      professionalVision: {
        oneYear: personalGoalsResult.data?.one_year_vision || null,
        threeYear: personalGoalsResult.data?.three_year_vision || null,
      },
      capabilityAdjustments: adjustmentsResult.data || [],
      habits: habitsResult.data || [],
      habitCompletions: habitCompletionsResult.data || [],
    };

    // Set up routing context for Opus
    const routingContext: RoutingContext = {
      taskType: 'performance-review',
      companyId: employee?.company_id,
      profileId: employeeId,
      functionName: 'generate-performance-review',
    };

    console.log("Step 1: Synthesizing evidence...");
    const evidenceSynthesis = await synthesizeEvidence(context, routingContext);

    console.log("Step 2: Generating comprehensive draft...");
    const draftReview = await generateDraft(context, evidenceSynthesis, routingContext);

    console.log("Step 3: Checking for bias and improving fairness...");
    const { improvements, revisedReview } = await checkForBias(draftReview, context, routingContext);

    console.log("Review generated successfully with", improvements.length, "improvements applied");

    return new Response(
      JSON.stringify({
        success: true,
        review: revisedReview,
        metadata: {
          steps: ['evidence_synthesis', 'draft_generation', 'bias_check'],
          biasImprovements: improvements,
          evidenceSummary: evidenceSynthesis.substring(0, 500) + '...',
        },
        context: {
          oneOnOneCount: context.oneOnOneNotes.length,
          recognitionCount: context.recognition.length,
          goalsCompleted: context.goals.completed.length,
          goalsTotal: context.goals.all.length,
          habitsTracked: context.habits.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
