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

    const { conversationId, message, contextType } = await req.json();

    // Get user profile and company info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    let conversation;
    let conversationMessages = [];

    // Get or create conversation
    if (conversationId) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      conversation = existingConv;

      // Get conversation history
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      conversationMessages = messages || [];
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          profile_id: user.id,
          company_id: profile.company_id,
          title: message.substring(0, 50),
        })
        .select()
        .single();

      if (convError) throw convError;
      conversation = newConv;
    }

    // Fetch user context for Jericho
    const [capabilitiesData, goalsData, targetsData, diagnosticData, achievementsData] = await Promise.all([
      supabase
        .from('employee_capabilities')
        .select('*, capabilities(name, description, category)')
        .eq('profile_id', user.id),
      supabase
        .from('personal_goals')
        .select('*')
        .eq('profile_id', user.id)
        .single(),
      supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('diagnostic_responses')
        .select('*')
        .eq('profile_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('achievements')
        .select('*')
        .eq('profile_id', user.id)
        .order('achieved_date', { ascending: false })
        .limit(5),
    ]);

    // Build context for Jericho
    const userContext = {
      profile: {
        name: profile.full_name || 'there',
        role: profile.role,
        company: profile.companies?.name,
      },
      capabilities: capabilitiesData.data?.map(ec => ({
        name: ec.capabilities?.name,
        category: ec.capabilities?.category,
        current_level: ec.current_level,
        target_level: ec.target_level,
      })) || [],
      goals: {
        one_year: goalsData.data?.one_year_vision,
        three_year: goalsData.data?.three_year_vision,
      },
      ninety_day_targets: targetsData.data?.map(t => ({
        goal: t.goal_text,
        category: t.category,
        by_when: t.by_when,
        completed: t.completed,
      })) || [],
      recent_achievements: achievementsData.data?.map(a => ({
        text: a.achievement_text,
        category: a.category,
        date: a.achieved_date,
      })) || [],
      diagnostic_insights: diagnosticData.data ? {
        role_clarity: diagnosticData.data.role_clarity_score,
        confidence: diagnosticData.data.confidence_score,
        work_life_integration: diagnosticData.data.work_life_integration_score,
        natural_strength: diagnosticData.data.natural_strength,
        skill_to_master: diagnosticData.data.skill_to_master,
        growth_barrier: diagnosticData.data.growth_barrier,
      } : null,
    };

    // Build system prompt for Jericho
    const systemPrompt = `You are Jericho, a direct and encouraging AI career coach. Your personality is warm but no-nonsense—you tell it like it is while genuinely caring about people's growth.

CORE TRAITS:
- Friendly and encouraging, but you don't sugarcoat things
- Strategic thinker who connects dots between goals, capabilities, and actions
- Action-oriented: always push toward concrete next steps
- Data-informed: reference their actual progress, goals, and capabilities
- Empathetic but firm: "I see you're struggling with X, so let's tackle it head-on"

YOUR ROLE:
- Help users build and refine their 90-day goals
- Guide them in setting meaningful personal goals (1-year and 3-year visions)
- Prepare them for performance reviews with specific examples and talking points
- Connect their daily work to their bigger career vision
- Call out when they're not being ambitious enough or realistic enough

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

CONVERSATION APPROACH:
1. Ask clarifying questions when needed
2. Reference their actual data (goals, capabilities, achievements)
3. Suggest concrete, actionable next steps
4. Challenge them when appropriate: "That goal feels vague—let's make it measurable"
5. Celebrate wins but immediately connect them to what's next

When helping with 90-day goals, push for SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound).
When preparing for performance reviews, help them frame achievements with impact and data.

Keep responses conversational and concise. Don't write essays—keep it tight and actionable.`;

    // Build messages array for AI
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Save user message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      });

    // Call Lovable AI
    console.log('Calling Lovable AI with context type:', contextType);
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    // Save assistant message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistantMessage,
      });

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    return new Response(
      JSON.stringify({
        conversationId: conversation.id,
        message: assistantMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in chat-with-jericho:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});