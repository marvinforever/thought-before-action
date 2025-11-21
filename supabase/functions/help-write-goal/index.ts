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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { draftGoal, category, quarter, type = 'goal' } = await req.json();

    // Get user context
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    const { data: goals } = await supabase
      .from('personal_goals')
      .select('one_year_vision, three_year_vision')
      .eq('profile_id', user.id)
      .single();

    // Build concise system prompt based on type
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'goal') {
      systemPrompt = `You are Jericho, a direct career coach helping write clear, actionable 90-day goals.

USER: ${profile?.full_name || 'User'} (${profile?.role || 'Professional'})
${category.toUpperCase()} GOAL for ${quarter}

${goals?.one_year_vision ? `1-Year Vision: ${goals.one_year_vision}` : ''}

Keep it SHORT and ACTIONABLE. Your response should be:
- 2-3 sentences max
- One clear goal suggestion
- Specific and measurable
- No fluff or explanations

Format: Just give them the refined goal directly.`;

      userPrompt = draftGoal 
        ? `Help me refine this goal: "${draftGoal}"`
        : `Suggest a ${category} goal for ${quarter} that aligns with my career vision.`;
    } else if (type === 'benchmarks') {
      systemPrompt = `You are Jericho, a strategic coach helping break down 90-day goals into 30-day benchmarks.

USER: ${profile?.full_name || 'User'} (${profile?.role || 'Professional'})

Keep it CONCISE and SPECIFIC. Your response should be:
- 2-3 key milestones for the 30-day mark
- Measurable progress indicators
- Clear checkpoints

Format: List the benchmarks directly, one per line.`;

      userPrompt = draftGoal 
        ? `Given this 90-day goal: "${draftGoal}", what should the 30-day benchmarks be?`
        : `Suggest 30-day benchmarks for a ${category} goal in ${quarter}.`;
    } else if (type === 'sprints') {
      systemPrompt = `You are Jericho, an action-focused coach helping define immediate next steps for goals.

USER: ${profile?.full_name || 'User'} (${profile?.role || 'Professional'})

Keep it ACTIONABLE and IMMEDIATE. Your response should be:
- 3-5 specific actions for the next 7 days
- Concrete tasks, not abstract concepts
- Things they can start TODAY

Format: List the sprint tasks directly, one per line.`;

      userPrompt = draftGoal 
        ? `Given this 90-day goal: "${draftGoal}", what should I focus on in the next 7 days?`
        : `Suggest a 7-day sprint plan for a ${category} goal in ${quarter}.`;
    }

    // Call Lovable AI with streaming
    console.log('Calling Lovable AI for goal writing assistance');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    // Stream the response back to client
    return new Response(aiResponse.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in help-write-goal:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});