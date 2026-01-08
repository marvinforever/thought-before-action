import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapCapabilityLevel, MISSING_PLAN_GUIDANCE } from "../_shared/jericho-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log('Building OpenAI voice agent context for:', profile.full_name);

    // Fetch context data in parallel
    const [
      completenessData,
      capabilitiesData,
      goalsData,
      allTargetsData,
      habitsData,
      achievementsData,
      coachingInsightsData,
      recentSummariesData,
      pendingFollowUpsData,
    ] = await Promise.all([
      supabase.from('user_data_completeness').select('*').eq('profile_id', user.id).single(),
      supabase.from('employee_capabilities').select('*, capabilities(name, description, category)').eq('profile_id', user.id),
      supabase.from('personal_goals').select('*').eq('profile_id', user.id).single(),
      supabase.from('ninety_day_targets').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leading_indicators').select('*').eq('profile_id', user.id).eq('is_active', true),
      supabase.from('achievements').select('*').eq('profile_id', user.id).order('achieved_date', { ascending: false }).limit(10),
      supabase.from('coaching_insights').select('*').eq('profile_id', user.id).eq('is_active', true).order('last_reinforced_at', { ascending: false }).limit(30),
      supabase.from('conversation_summaries').select('*, conversations(title, source)').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('coaching_follow_ups').select('*').eq('profile_id', user.id).is('completed_at', null).is('skipped_at', null).lte('scheduled_for', new Date().toISOString()).order('scheduled_for', { ascending: true }).limit(5),
    ]);

    const completeness = completenessData.data;
    const capabilities = capabilitiesData.data || [];
    const goals = goalsData.data;
    const allTargets = allTargetsData.data || [];
    const habits = habitsData.data || [];
    const achievements = achievementsData.data || [];
    const coachingInsights = coachingInsightsData.data || [];
    const recentSummaries = recentSummariesData.data || [];
    const pendingFollowUps = pendingFollowUpsData.data || [];

    // Build missing data list
    const missingData: string[] = [];
    if (!completeness?.has_personal_vision) missingData.push('personal_vision');
    if (!completeness?.has_90_day_goals) missingData.push('90_day_goals');
    if (!completeness?.has_active_habits) missingData.push('habits');
    if (!completeness?.has_self_assessed_capabilities) missingData.push('self_assessment');
    if (!completeness?.has_recent_achievements) missingData.push('achievements');

    const hasData: string[] = [];
    if (completeness?.has_personal_vision) hasData.push('personal_vision');
    if (completeness?.has_90_day_goals) hasData.push('90_day_goals');
    if (completeness?.has_active_habits) hasData.push('habits');
    if (completeness?.has_completed_diagnostic) hasData.push('diagnostic');
    if (capabilities.length > 0) hasData.push('capabilities');

    // Current 90-day targets
    const currentTargets = allTargets.filter((t: any) => !t.completed).slice(0, 5);

    // Build the system instructions for OpenAI Realtime
    const firstName = profile.full_name?.split(' ')[0] || 'there';
    
    const instructions = `You are Jericho, an elite AI career coach. You're warm, direct, and action-oriented.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 WHO YOU'RE TALKING TO: ${profile.full_name || 'there'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Role: ${profile.role || 'Not specified'}
- Company: ${profile.companies?.name || 'Unknown'}
- Profile Completeness: ${Math.round(((hasData.length) / 6) * 100)}%

${coachingInsights.length > 0 ? `
🧠 WHAT I REMEMBER ABOUT ${profile.full_name?.toUpperCase() || 'THEM'}:
${coachingInsights.slice(0, 10).map((i: any) => `• [${i.insight_type}] ${i.insight_text}`).join('\n')}
` : ''}

${recentSummaries.length > 0 ? `
📝 RECENT CONVERSATIONS:
${recentSummaries.slice(0, 5).map((s: any) => `• ${s.conversations?.title || 'Chat'} (${s.conversations?.source || 'text'}): ${s.summary_text?.substring(0, 100)}...`).join('\n')}
` : ''}

${pendingFollowUps.length > 0 ? `
⏰ FOLLOW-UPS DUE:
${pendingFollowUps.map((f: any) => `• ${f.context?.topic || f.follow_up_type}`).join('\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 THEIR CURRENT GROWTH PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISION:
• Professional 1-Year: ${goals?.one_year_vision || 'Not set'}
• Professional 3-Year: ${goals?.three_year_vision || 'Not set'}
• Personal 1-Year: ${goals?.personal_one_year_vision || 'Not set'}

CURRENT 90-DAY GOALS (${currentTargets.length}):
${currentTargets.length > 0 ? currentTargets.map((t: any) => `• ${t.goal_text} (${t.category || 'general'}${t.by_when ? `, due: ${t.by_when}` : ''})`).join('\n') : '• No active goals yet'}

ACTIVE HABITS (${habits.length}):
${habits.length > 0 ? habits.map((h: any) => `• ${h.habit_name} - ${h.current_streak} day streak`).join('\n') : '• No habits tracking yet'}

RECENT ACHIEVEMENTS:
${achievements.length > 0 ? achievements.slice(0, 5).map((a: any) => `• ${a.achievement_text} (${a.achieved_date})`).join('\n') : '• None recorded yet'}

CAPABILITIES (${capabilities.length} tracked):
${capabilities.slice(0, 5).map((c: any) => `• ${c.capabilities?.name}: ${mapCapabilityLevel(c.current_level)} → ${mapCapabilityLevel(c.target_level)}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎤 YOUR VOICE STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Warm but direct - you care AND you challenge
• Keep responses SHORT - this is voice, not an essay
• Use their name occasionally: "${firstName}"
• Reference past conversations naturally: "Last time you mentioned..."
• Celebrate wins enthusiastically
• Notice patterns: "I've noticed you tend to..."
• Ask follow-up questions to go deeper
• Be encouraging but honest - don't be a pushover
• ALWAYS refer to capability levels as Level 1, 2, 3, 4

${MISSING_PLAN_GUIDANCE}

${missingData.length > 0 ? `
If they don't know what to discuss, help them complete: ${missingData.map(d => d.replace('_', ' ')).join(', ')}
` : ''}

Remember: You're not just chatting - you're coaching. Push them to grow while making them feel supported.`;

    // Generate dynamic first message
    let firstMessage = `Hey ${firstName}! What's on your mind today?`;
    
    if (pendingFollowUps.length > 0) {
      const followUpTopic = pendingFollowUps[0]?.context?.topic || 'what we discussed';
      firstMessage = `Hey ${firstName}! I wanted to check in on ${followUpTopic} from last time - how's that going?`;
    } else if (currentTargets.length > 0) {
      firstMessage = `Hey ${firstName}! Ready to make some progress on your goals? What's on your mind?`;
    } else if (habits.some((h: any) => h.current_streak >= 7)) {
      firstMessage = `Hey ${firstName}! I'm loving those streaks you've got going. What can I help you with today?`;
    } else if (missingData.length > 0 && missingData.includes('personal_vision')) {
      firstMessage = `Hey ${firstName}! Good to hear from you. I noticed you haven't set up your vision yet - want to work on that, or is there something else on your mind?`;
    }

    console.log('Creating OpenAI Realtime ephemeral token...');

    // Create ephemeral token for WebRTC session
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'shimmer', // Using shimmer for consistency with podcasts
        instructions: instructions,
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session error:', sessionResponse.status, errorText);
      throw new Error(`Failed to create OpenAI session: ${sessionResponse.status}`);
    }

    const sessionData = await sessionResponse.json();
    console.log('OpenAI session created, token expires:', sessionData.expires_at);

    // Create conversation record
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        profile_id: user.id,
        company_id: profile.company_id,
        title: 'Voice Chat with Jericho (OpenAI)',
        source: 'voice_openai',
      })
      .select()
      .single();

    if (convError) {
      console.error('Error creating conversation:', convError);
    }

    // Create voice session record
    if (conv) {
      await supabase.from('voice_sessions').insert({
        conversation_id: conv.id,
        profile_id: user.id,
        started_at: new Date().toISOString(),
      });
    }

    // Build context summary for UI
    const contextSummary = {
      coachingInsightsCount: coachingInsights.length,
      pendingFollowUpsCount: pendingFollowUps.length,
      recentConversationsCount: recentSummaries.length,
      goalCompletionRate: allTargets.length > 0 
        ? Math.round((allTargets.filter((t: any) => t.completed).length / allTargets.length) * 100) 
        : null,
      currentGoalsCount: currentTargets.length,
      activeHabitsCount: habits.length,
    };

    return new Response(
      JSON.stringify({
        clientSecret: sessionData.client_secret.value,
        expiresAt: sessionData.expires_at,
        conversationId: conv?.id,
        firstMessage,
        contextSummary,
        completeness: {
          percentage: Math.round(((hasData.length) / 6) * 100),
          missingItems: missingData,
          onboardingPhase: completeness?.onboarding_phase || 'new',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('OpenAI voice agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice agent';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
