import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, companyId, triggerSource } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch employee capabilities with gaps
    const { data: capabilities, error: capError } = await supabaseClient
      .from('employee_capabilities')
      .select(`
        id,
        current_level,
        target_level,
        priority,
        capability:capabilities(
          id,
          name,
          category,
          description
        )
      `)
      .eq('profile_id', employeeId)
      .order('priority', { ascending: true });

    if (capError) throw capError;

    // Fetch personal goals
    const { data: goals, error: goalsError } = await supabaseClient
      .from('personal_goals')
      .select('one_year_vision, three_year_vision')
      .eq('profile_id', employeeId)
      .maybeSingle();

    if (goalsError && goalsError.code !== 'PGRST116') throw goalsError;

    // Fetch 90-day targets
    const { data: targets, error: targetsError } = await supabaseClient
      .from('ninety_day_targets')
      .select('goal_text, category')
      .eq('profile_id', employeeId)
      .not('goal_text', 'is', null);

    if (targetsError) throw targetsError;

    // Build context for AI
    const capabilitiesContext = capabilities?.map(cap => ({
      name: cap.capability.name,
      category: cap.capability.category,
      current: cap.current_level,
      target: cap.target_level,
      gap: `${cap.current_level} → ${cap.target_level}`,
    })) || [];

    const goalsContext = {
      oneYear: goals?.one_year_vision || null,
      threeYear: goals?.three_year_vision || null,
      quarterlyGoals: targets?.map(t => t.goal_text) || [],
    };

    // Fetch existing recommendations to avoid duplicates and expired ones
    const { data: existingRecs } = await supabaseClient
      .from('content_recommendations')
      .select('resource_id, status, expires_at')
      .eq('profile_id', employeeId);

    // Get IDs of completed resources and non-expired active recommendations
    const completedResourceIds = new Set(
      existingRecs?.filter(r => r.status === 'completed').map(r => r.resource_id) || []
    );
    const activeRecommendedIds = new Set(
      existingRecs?.filter(r => 
        r.status !== 'completed' && 
        (!r.expires_at || new Date(r.expires_at) > new Date())
      ).map(r => r.resource_id) || []
    );

    // Fetch available resources for matching (exclude already completed/recommended)
    const { data: allResources, error: resourcesError } = await supabaseClient
      .from('resources')
      .select(`
        id,
        title,
        description,
        capability_id,
        capability_level,
        content_type,
        rating
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .not('id', 'in', `(${[...completedResourceIds, ...activeRecommendedIds].join(',') || 'null'})`);

    if (resourcesError) throw resourcesError;

    // Use AI to analyze and recommend
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are Jericho, a personal growth and development coach. Analyze the employee's capabilities, goals, and available resources to recommend the most relevant learning materials.

Consider:
- Capability gaps (current level vs target level) - prioritize high-priority capabilities
- Personal vision and quarterly goals alignment
- Resource relevance to capability categories
- Resource level matching the employee's current skill level
- Resource ratings (prefer highly-rated content)
- Limit to 3-5 recommendations per capability to avoid overwhelming

For each recommended resource, provide:
- match_score (0-100): How well this resource matches their needs
- reasoning: Brief, personalized explanation of why this resource will help them close their capability gap

Return ONLY a JSON array of recommendations in this exact format:
[
  {
    "resource_id": "uuid-here",
    "employee_capability_id": "uuid-here or null",
    "match_score": 85,
    "reasoning": "This resource addresses your leadership gap and aligns with your 1-year goal."
  }
]

Recommend 5-15 total resources, distributed across their priority capabilities. Focus on quality over quantity.`;

    const userPrompt = `Employee Context:
Capabilities: ${JSON.stringify(capabilitiesContext, null, 2)}

Goals:
- 1-Year Vision: ${goalsContext.oneYear || 'Not set'}
- 3-Year Vision: ${goalsContext.threeYear || 'Not set'}
- 90-Day Goals: ${goalsContext.quarterlyGoals.join(', ') || 'None set'}

Available Resources:
${JSON.stringify(allResources, null, 2)}

Employee Capabilities IDs for reference:
${JSON.stringify(capabilities?.map(c => ({ id: c.id, capability: c.capability.name })), null, 2)}

Provide recommendations now:`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) throw new Error('No AI response received');

    // Parse AI response
    let recommendations;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      recommendations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Insert recommendations into database with 45-day expiration
    const recommendationsToInsert = recommendations.map((rec: any) => {
      const sentAt = new Date();
      const expiresAt = new Date(sentAt);
      expiresAt.setDate(expiresAt.getDate() + 45); // 45 days expiration

      return {
        profile_id: employeeId,
        resource_id: rec.resource_id,
        employee_capability_id: rec.employee_capability_id || null,
        match_score: rec.match_score,
        ai_reasoning: rec.reasoning,
        status: 'pending',
        sent_at: sentAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };
    });

    const { data: inserted, error: insertError } = await supabaseClient
      .from('content_recommendations')
      .insert(recommendationsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting recommendations:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: inserted?.length || 0,
        recommendations: inserted,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in recommend-resources:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
