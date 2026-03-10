import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Push all heavy work into the background
    const promise = processGrowthPlan(profile_id);
    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(promise);

    // Return immediately with 202 Accepted
    return new Response(JSON.stringify({ status: 'processing', profile_id }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error initiating growth plan:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processGrowthPlan(profile_id: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`[growth-plan] Background processing started for ${profile_id}`);

    const [profileRes, capabilitiesRes, capLevelsRes, diagnosticRes, visionRes, goalsRes, habitsRes, achievementsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, job_title, company_id, role").eq("id", profile_id).single(),
      supabase.from("employee_capabilities")
        .select("current_level, target_level, self_assessed_level, priority, capability_id, marked_not_relevant, capabilities(name, category, description)")
        .eq("profile_id", profile_id)
        .neq("marked_not_relevant", true)
        .order("priority", { ascending: true }),
      supabase.from("capability_levels").select("capability_id, level, description"),
      supabase.from("diagnostic_scores").select("*").eq("profile_id", profile_id).maybeSingle(),
      supabase.from("personal_goals").select("one_year_vision, three_year_vision").eq("profile_id", profile_id).maybeSingle(),
      supabase.from("ninety_day_targets").select("goal_text, category, completed, by_when").eq("profile_id", profile_id).eq("category", "professional").order("created_at", { ascending: false }),
      supabase.from("leading_indicators").select("habit_name, target_frequency, current_streak").eq("profile_id", profile_id).neq("habit_type", "personal").eq("is_active", true),
      supabase.from("achievements").select("achievement_text, achieved_date").eq("profile_id", profile_id).eq("category", "professional").order("achieved_date", { ascending: false }).limit(10),
    ]);

    const profile = profileRes.data;
    const capabilities = capabilitiesRes.data || [];
    const capLevels = capLevelsRes.data || [];
    const diagnostic = diagnosticRes.data;
    const vision = visionRes.data;
    const goals = goalsRes.data || [];
    const habits = habitsRes.data || [];
    const achievements = achievementsRes.data || [];

    let companyName = "";
    if (profile?.company_id) {
      const { data: company } = await supabase.from("companies").select("name").eq("id", profile.company_id).single();
      companyName = company?.name || "";
    }

    const levelDefsMap: Record<string, Record<string, string>> = {};
    for (const cl of capLevels) {
      if (!levelDefsMap[cl.capability_id]) levelDefsMap[cl.capability_id] = {};
      levelDefsMap[cl.capability_id][cl.level] = cl.description;
    }

    const allCapDetails = capabilities.map((cap: any) => {
      const defs = levelDefsMap[cap.capability_id] || {};
      const allLevels = ['foundational', 'advancing', 'independent', 'mastery'];
      const currentIdx = allLevels.indexOf(cap.current_level || 'foundational');
      const remainingLevels = allLevels.slice(currentIdx + 1).map(l => ({
        level: l,
        definition: defs[l] || `${l.charAt(0).toUpperCase() + l.slice(1)} level`
      }));

      return {
        name: cap.capabilities?.name || 'Unknown',
        category: cap.capabilities?.category || '',
        description: cap.capabilities?.description || '',
        current_level: cap.current_level || 'not assessed',
        target_level: cap.target_level || 'not set',
        self_assessed: cap.self_assessed_level || null,
        priority: cap.priority,
        remaining_levels: remainingLevels,
        level_definitions: defs,
      };
    });

    const capDetails = allCapDetails.slice(0, 15);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const prompt = buildPrompt(profile, capDetails, diagnostic, companyName);

    console.log('[growth-plan] Calling AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[growth-plan] AI API error:', aiResponse.status, errorText);
      await saveError(supabase, profile_id, `AI API error: ${aiResponse.status} - ${errorText.substring(0, 500)}`);
      return;
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';

    let parsed = tryParseJSON(aiContent);

    if (!parsed) {
      console.log('[growth-plan] First parse failed, retrying...');
      const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown fences. Keep responses concise.' }],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });
      if (!retryResponse.ok) {
        const retryErr = await retryResponse.text();
        await saveError(supabase, profile_id, `Retry AI error: ${retryResponse.status} - ${retryErr.substring(0, 500)}`);
        return;
      }
      const retryData = await retryResponse.json();
      const retryContent = retryData.choices?.[0]?.message?.content || '{}';
      parsed = tryParseJSON(retryContent);
      if (!parsed) {
        await saveError(supabase, profile_id, 'Failed to parse AI response after retry');
        return;
      }
    }

    // Store the result in user_active_context for the client to poll
    const resultPayload = {
      success: true,
      profile: {
        full_name: profile?.full_name,
        job_title: profile?.job_title || profile?.role,
        company_name: companyName,
      },
      capabilities: allCapDetails,
      diagnostic,
      vision,
      goals: goals.length > 0 ? goals : null,
      habits: habits.length > 0 ? habits : null,
      achievements: achievements.length > 0 ? achievements : null,
      ai_recommendations: parsed,
      generated_at: new Date().toISOString(),
    };

    await supabase.from("user_active_context").upsert({
      profile_id,
      onboarding_data: resultPayload,
      error_log: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    console.log(`[growth-plan] Background processing complete for ${profile_id}`);
  } catch (error: any) {
    console.error('[growth-plan] Background error:', error);
    await saveError(supabase, profile_id, error.message);
  }
}

async function saveError(supabase: any, profile_id: string, errorMsg: string) {
  try {
    await supabase.from("user_active_context").upsert({
      profile_id,
      error_log: `growth-plan error: ${errorMsg.substring(0, 1000)}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
  } catch (e) {
    console.error('[growth-plan] Failed to save error:', e);
  }
}

function tryParseJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
    }
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

function buildPrompt(profile: any, capDetails: any[], diagnostic: any, companyName: string): string {
  return `You are generating a comprehensive Individual Growth Plan (IGP) document.

EMPLOYEE: ${profile?.full_name || 'Unknown'}
ROLE: ${profile?.job_title || profile?.role || 'Not specified'}
COMPANY: ${companyName}

CAPABILITIES WITH LEVEL DEFINITIONS:
${JSON.stringify(capDetails, null, 2)}

DIAGNOSTIC SCORES:
${diagnostic ? JSON.stringify({
  engagement: diagnostic.engagement_score,
  clarity: diagnostic.clarity_score,
  career: diagnostic.career_score,
  learning: diagnostic.learning_score,
  manager: diagnostic.manager_score,
  skills: diagnostic.skills_score,
  retention: diagnostic.retention_score,
  burnout: diagnostic.burnout_score,
}) : 'No diagnostic data available'}

CRITICAL INSTRUCTIONS:
1. For EVERY capability (not just the first few), provide EQUAL depth and specificity
2. Reference the employee's specific role "${profile?.job_title || profile?.role || 'their role'}" in every assessment
3. Every capability MUST have exactly 5 training_items with a diverse mix of types
4. Every training item MUST include cost_indicator ("free" or "paid") and cost_detail if paid
5. For paid resources, include a free_alternative field with a specific free option
6. Include why_this_matters connecting the capability to their business impact
7. Include estimated_timeline for each capability (e.g., "3-6 months with focused effort")
8. Level progression MUST include ALL remaining levels with both definition AND how_to_achieve
9. FREE resources: YouTube, TED Talks, podcasts, OSHA resources, HBR podcasts, university extensions
10. PAID resources: Books ($15-$30), certifications, formal courses. Always include cost range.

COST RULES:
- YouTube videos = free
- TED Talks = free
- Podcasts = free
- OSHA official resources = free
- HBR articles/podcasts = free
- LinkedIn Learning = free (note "FREE with LinkedIn subscription")
- Books = paid ($15-$30)
- Certifications (PMP, SAMA, OSHA Trainer, APICS) = paid (include estimated cost)
- Formal courses (Dale Carnegie, Miller Heiman, Harvard) = paid (include estimated cost)

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "recommendations": [
    {
      "capability_name": "string",
      "current_assessment": "2-3 sentences specific to this employee and their role",
      "why_this_matters": "1-2 sentences on business impact",
      "advancement_approach": "natural" | "training_needed" | "mixed",
      "advancement_reasoning": "Why this approach",
      "estimated_timeline": "e.g. 3-6 months with focused effort",
      "training_items": [
        {
          "type": "book" | "video" | "podcast" | "course" | "exercise" | "mentorship",
          "title": "Specific real recommendation",
          "description": "Why this helps",
          "target_level": "which level this helps achieve",
          "cost_indicator": "free" | "paid",
          "cost_detail": "$15-$30 for books, ~$500-$2000 for courses, etc.",
          "free_alternative": "Only for paid items - a specific free alternative"
        }
      ],
      "level_progression": [
        {
          "level": "advancing | independent | mastery",
          "definition": "What demonstrating this level looks like",
          "how_to_achieve": "Specific steps to get here"
        }
      ]
    }
  ],
  "overall_summary": "2-3 sentence summary of growth trajectory",
  "strengths_statement": "2-3 sentences on what this employee does well",
  "primary_development_focus": "1 sentence summary of the development theme",
  "top_priority_actions": [
    { "action": "Specific actionable step", "capability_name": "Which capability this develops" }
  ],
  "roadmap": {
    "month_1": [
      { "action": "What to do", "capability": "Which capability", "resource_type": "Type of resource", "time_per_week": "e.g. 2 hours" }
    ],
    "month_2_3": [
      { "action": "What to do", "capability": "Which capability", "resource_type": "Type of resource", "time_per_week": "e.g. 1.5 hours" }
    ],
    "month_3_plus": [
      { "action": "What to do", "capability": "Which capability", "resource_type": "Type of resource", "time_per_week": "e.g. 1 hour" }
    ]
  },
  "at_a_glance": {
    "total_capabilities": number,
    "by_level": { "foundational": number, "advancing": number, "independent": number, "mastery": number },
    "gap_1_count": number,
    "gap_2_plus_count": number,
    "on_target_count": number
  }
}`;
}
