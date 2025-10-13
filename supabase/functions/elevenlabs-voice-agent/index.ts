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
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const elevenLabsAgentId = Deno.env.get('ELEVENLABS_AGENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!elevenLabsApiKey || !elevenLabsAgentId) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs credentials not configured' }),
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
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Refresh and fetch user data completeness
    const { error: refreshError } = await supabase.rpc('refresh_user_completeness', { user_id: user.id });
    if (refreshError) {
      console.error('Error refreshing completeness:', refreshError);
    }

    const { data: completeness } = await supabase
      .from('user_data_completeness')
      .select('*')
      .eq('profile_id', user.id)
      .single();

    // Fetch additional context for building conversation primer
    const { data: capabilities } = await supabase
      .from('employee_capabilities')
      .select('*, capabilities(*)')
      .eq('profile_id', user.id);

    const { data: goals } = await supabase
      .from('ninety_day_targets')
      .select('*')
      .eq('profile_id', user.id)
      .eq('completed', false);

    const { data: habits } = await supabase
      .from('leading_indicators')
      .select('*')
      .eq('profile_id', user.id)
      .eq('is_active', true);

    // Build dynamic conversation primer
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
    if (capabilities && capabilities.length > 0) hasData.push('capabilities');

    // Generate conversation priorities
    const priorities: string[] = [];
    if (missingData.includes('personal_vision')) {
      priorities.push("🎯 PRIORITY 1: Help them articulate their 1-year vision");
    }
    if (missingData.includes('90_day_goals')) {
      priorities.push("📅 PRIORITY 2: Guide them to set 3 quarterly goals (currently: " + (goals?.length || 0) + ")");
    }
    if (missingData.includes('habits')) {
      priorities.push("💪 PRIORITY 3: Create their first daily habit");
    }
    if (missingData.includes('self_assessment')) {
      priorities.push("📊 PRIORITY 4: Self-assess at least 5 capabilities");
    }

    // Always available actions
    priorities.push("📖 AVAILABLE: Read their current capabilities and progress");
    priorities.push("🎓 AVAILABLE: Teach them how to use platform features");
    priorities.push("🎉 AVAILABLE: Celebrate and record recent achievements");

    // Build voice-optimized system prompt
    const voiceSystemPrompt = `You are Jericho, an AI leadership coach in voice conversation mode.

YOUR PRIORITIES IN THIS CONVERSATION:
1. **Be a Platform Guide**: Teach users HOW to use the platform effectively
2. **Collect Missing Data**: If they don't have something specific to discuss, help them complete their profile
3. **Read Back Current State**: Show them what they've accomplished and where they're going
4. **Make it Conversational**: This is a voice conversation - be warm, natural, and engaging

WHAT YOU KNOW ABOUT ${profile.full_name || 'this user'}:
- Onboarding Phase: ${completeness?.onboarding_phase || 'new'}
- Has Data: ${hasData.join(', ') || 'none yet'}
- Missing Data: ${missingData.join(', ') || 'profile is complete!'}
- Current Capabilities: ${capabilities?.length || 0} tracked
- Active Goals: ${goals?.length || 0}
- Active Habits: ${habits?.length || 0}

CONVERSATION PRIORITIES (in order):
${priorities.join('\n')}

HOW TO GUIDE USERS:
- **Teaching Capabilities**: "Let me read you your current capabilities. You have ${capabilities?.length || 0} capabilities being tracked..."
- **Creating 90-Day Goals**: "Let's set up a 90-day goal. What's one thing you want to accomplish this quarter?"
- **Adding Habits**: "Want to track a daily habit? What's one small action that would move you forward?"
- **Platform Navigation**: "You can check your progress anytime in your dashboard. Let me show you what you have set up..."
- **Recording Achievements**: "Tell me about something you accomplished recently that you're proud of."

TOOLS YOU CAN USE:
- add_90_day_goal: Create a new quarterly goal
- add_habit: Set up a daily habit to track
- add_achievement: Record a recent win
- update_vision: Capture their 1-year or 3-year vision
- request_capability: Request a capability level increase
- mark_goal_complete: Celebrate completed goals

YOUR VOICE STYLE:
- Conversational and warm, not robotic
- Ask follow-up questions to understand context
- Celebrate progress, even small wins
- Make platform guidance feel natural: "By the way, did you know you can..."
- Keep responses concise - this is voice, not an essay
- Use their name occasionally to keep it personal

IF THEY DON'T KNOW WHAT TO TALK ABOUT:
${missingData.length > 0 ? `1. You should help them with: ${missingData[0].replace('_', ' ')}
2. Offer: "I noticed you haven't ${missingData[0].includes('vision') ? 'set a personal vision' : missingData[0].includes('goals') ? 'set any 90-day goals' : missingData[0].includes('habits') ? 'created any habits to track' : 'self-assessed your capabilities'} yet. Want me to help you with that?"` : `1. Great! Their profile is quite complete.
2. Offer: "Let me read you what you've accomplished so far, or I can help you refine your goals."`}
3. Or: "Would you like to learn how to use any of the platform features?"

Remember: You're not just a coach - you're a GUIDE who helps them get the most out of the platform. Make them feel supported and empowered.`;

    // Get signed URL for ElevenLabs conversation
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${elevenLabsAgentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        }
      }
    );

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      console.error('ElevenLabs error:', signedUrlResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize voice agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { signed_url } = await signedUrlResponse.json();

    // Create or get conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        profile_id: user.id,
        company_id: profile.company_id,
        title: 'Voice conversation with Jericho',
        source: 'voice',
      })
      .select()
      .single();

    if (convError) throw convError;

    // Create voice session record
    await supabase
      .from('voice_sessions')
      .insert({
        profile_id: user.id,
        conversation_id: conversation.id,
        started_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({
        signedUrl: signed_url,
        conversationId: conversation.id,
        completeness: {
          percentage: Math.round(((hasData.length) / 6) * 100),
          missingItems: missingData,
          onboardingPhase: completeness?.onboarding_phase || 'new',
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in elevenlabs-voice-agent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
