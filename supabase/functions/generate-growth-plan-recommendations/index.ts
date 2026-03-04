import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch all data in parallel
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

    // Build capability level definitions map
    const levelDefsMap: Record<string, Record<string, string>> = {};
    for (const cl of capLevels) {
      if (!levelDefsMap[cl.capability_id]) levelDefsMap[cl.capability_id] = {};
      levelDefsMap[cl.capability_id][cl.level] = cl.description;
    }

    // Build capability context for AI
    const capDetails = capabilities.map((cap: any) => {
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

    // Call AI for training recommendations
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const prompt = `You are generating training recommendations for an Individual Growth Plan (IGP).

EMPLOYEE: ${profile?.full_name || 'Unknown'} 
ROLE: ${profile?.job_title || profile?.role || 'Not specified'}
COMPANY: ${companyName}

CAPABILITIES WITH LEVEL DEFINITIONS:
${JSON.stringify(capDetails, null, 2)}

DIAGNOSTIC SCORES (if available):
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

For EACH capability, provide:
1. A brief assessment of where they stand
2. Whether advancement will happen naturally through on-the-job experience or requires deliberate training
3. Specific, actionable training recommendations. Be specific — suggest actual:
   - YouTube channels or types of videos to watch
   - Podcast recommendations (by name or topic)
   - Book titles when possible (use real, well-known books)
   - Online courses or certifications
   - Practical exercises or on-the-job activities
4. For each remaining level they can achieve, describe what demonstrating that level looks like

Keep recommendations practical and varied. Not everything needs formal training — some skills advance through practice, mentorship, or exposure.

Return ONLY valid JSON (no markdown) in this format:
{
  "recommendations": [
    {
      "capability_name": "string",
      "current_assessment": "1-2 sentence assessment",
      "advancement_approach": "natural" | "training_needed" | "mixed",
      "advancement_reasoning": "Why this approach",
      "training_items": [
        {
          "type": "book" | "video" | "podcast" | "course" | "exercise" | "mentorship",
          "title": "Specific recommendation",
          "description": "Brief why this helps",
          "target_level": "which level this helps achieve"
        }
      ],
      "level_progression": [
        {
          "level": "advancing",
          "definition": "What this level looks like",
          "how_to_achieve": "Specific steps to get here"
        }
      ]
    }
  ],
  "overall_summary": "2-3 sentence summary of the employee's growth trajectory",
  "top_priority_actions": ["action 1", "action 2", "action 3"]
}`;

    console.log('Calling AI for growth plan recommendations...');
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
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = aiContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse AI response');
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        full_name: profile?.full_name,
        job_title: profile?.job_title || profile?.role,
        company_name: companyName,
      },
      capabilities: capDetails,
      diagnostic,
      vision,
      goals: goals.length > 0 ? goals : null,
      habits: habits.length > 0 ? habits : null,
      achievements: achievements.length > 0 ? achievements : null,
      ai_recommendations: parsed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating growth plan:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
