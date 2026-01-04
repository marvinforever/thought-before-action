import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapCapabilityLevel, COACHING_STYLE, MISSING_PLAN_GUIDANCE } from "../_shared/jericho-config.ts";

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
      .select('*, companies(name)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log('Building voice agent context for:', profile.full_name);

    // Fetch ALL context data in parallel (same as text chat)
    const [
      completenessData,
      capabilitiesData,
      goalsData,
      allTargetsData,
      habitsData,
      achievementsData,
      diagnosticData,
      coachingInsightsData,
      recentSummariesData,
      pendingFollowUpsData,
      greatnessKeysData
    ] = await Promise.all([
      supabase.from('user_data_completeness').select('*').eq('profile_id', user.id).single(),
      supabase.from('employee_capabilities').select('*, capabilities(name, description, category)').eq('profile_id', user.id),
      supabase.from('personal_goals').select('*').eq('profile_id', user.id).single(),
      supabase.from('ninety_day_targets').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leading_indicators').select('*').eq('profile_id', user.id).eq('is_active', true),
      supabase.from('achievements').select('*').eq('profile_id', user.id).order('achieved_date', { ascending: false }).limit(10),
      supabase.from('diagnostic_responses').select('*').eq('profile_id', user.id).order('submitted_at', { ascending: false }).limit(1).single(),
      supabase.from('coaching_insights').select('*').eq('profile_id', user.id).eq('is_active', true).order('last_reinforced_at', { ascending: false }).limit(30),
      supabase.from('conversation_summaries').select('*, conversations(title, source)').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('coaching_follow_ups').select('*').eq('profile_id', user.id).is('completed_at', null).is('skipped_at', null).lte('scheduled_for', new Date().toISOString()).order('scheduled_for', { ascending: true }).limit(5),
      supabase.from('greatness_keys').select('*').eq('profile_id', user.id).order('earned_at', { ascending: false }).limit(10),
    ]);

    const completeness = completenessData.data;
    const capabilities = capabilitiesData.data || [];
    const goals = goalsData.data;
    const allTargets = allTargetsData.data || [];
    const habits = habitsData.data || [];
    const achievements = achievementsData.data || [];
    const diagnostic = diagnosticData.data;
    const coachingInsights = coachingInsightsData.data || [];
    const recentSummaries = recentSummariesData.data || [];
    const pendingFollowUps = pendingFollowUpsData.data || [];
    const greatnessKeys = greatnessKeysData.data || [];

    // Analyze goal patterns (same logic as text chat)
    const analyzeGoalPatterns = (targets: any[]) => {
      if (targets.length === 0) {
        return { hasHistory: false, summary: "No goal history yet." };
      }

      const completed = targets.filter(t => t.completed === true);
      const incomplete = targets.filter(t => t.completed === false);
      const overallCompletionRate = Math.round((completed.length / targets.length) * 100);

      // Analyze by category
      const byCategory: Record<string, { total: number; completed: number }> = {};
      targets.forEach(t => {
        const cat = t.category || 'uncategorized';
        if (!byCategory[cat]) byCategory[cat] = { total: 0, completed: 0 };
        byCategory[cat].total++;
        if (t.completed) byCategory[cat].completed++;
      });

      const categoryStats = Object.entries(byCategory)
        .filter(([_, stats]) => stats.total >= 2)
        .map(([cat, stats]) => ({
          category: cat,
          rate: Math.round((stats.completed / stats.total) * 100),
          total: stats.total,
        }))
        .sort((a, b) => b.rate - a.rate);

      // Find recently completed (last 90 days)
      const now = new Date();
      const recentCompleted = completed.filter(t => {
        const updated = new Date(t.updated_at);
        const daysSince = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 90;
      });

      // Find abandoned goals
      const abandoned = incomplete.filter(t => {
        if (!t.by_when) return false;
        const dueDate = new Date(t.by_when);
        const daysPast = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysPast > 90;
      });

      const insights: string[] = [];
      if (overallCompletionRate >= 80) {
        insights.push("HIGH ACHIEVER - completes most goals. Challenge them to aim higher.");
      } else if (overallCompletionRate >= 50) {
        insights.push("MODERATE SUCCESS - completes about half. Help be more selective.");
      } else if (targets.length >= 5) {
        insights.push("STRUGGLING - low completion rate. Focus on fewer, achievable goals.");
      }

      if (recentCompleted.length > 0) {
        insights.push(`Recently completed ${recentCompleted.length} goals in the last 90 days - celebrate this!`);
      }

      if (abandoned.length >= 2) {
        insights.push(`Has ${abandoned.length} abandoned goals - consider addressing or removing.`);
      }

      return {
        hasHistory: true,
        totalGoals: targets.length,
        completedGoals: completed.length,
        overallCompletionRate,
        recentlyCompleted: recentCompleted.slice(0, 3).map(t => t.goal_text),
        abandonedCount: abandoned.length,
        categoryStats: categoryStats.slice(0, 3),
        insights,
        summary: `${targets.length} total goals, ${overallCompletionRate}% completion rate.`
      };
    };

    const goalPatterns = analyzeGoalPatterns(allTargets);
    console.log('Goal patterns:', goalPatterns.summary);

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

    // Current 90-day targets (not completed)
    const currentTargets = allTargets.filter(t => !t.completed).slice(0, 5);

    // Build the enhanced voice system prompt with full coaching context
    const voiceSystemPrompt = `You are Jericho, an elite AI career coach in VOICE CONVERSATION mode. You're warm, direct, and action-oriented.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎤 OPENING THE CONVERSATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Start with a PERSONALIZED greeting using their name. Vary your openers based on context:
${pendingFollowUps.length > 0 ? `• You have follow-ups to check on - consider: "Hey ${profile.full_name?.split(' ')[0] || 'there'}! Last time we talked about [topic] - how did that go?"` : ''}
${achievements.length > 0 && achievements[0]?.achieved_date === new Date().toISOString().split('T')[0] ? `• They logged an achievement today! "Hey ${profile.full_name?.split(' ')[0] || 'there'}! I see you just logged a win - nice! Tell me about it."` : ''}
${currentTargets.length > 0 ? `• They have active goals: "Hey ${profile.full_name?.split(' ')[0] || 'there'}! Ready to make some progress on your goals today?"` : ''}
${habits.some(h => h.current_streak >= 7) ? `• They have a hot streak: "Hey ${profile.full_name?.split(' ')[0] || 'there'}! Loving that streak you've got going - what's on your mind?"` : ''}
• Default options: "Hey ${profile.full_name?.split(' ')[0] || 'there'}, good to hear from you! What can we work on today?" or "Hey ${profile.full_name?.split(' ')[0] || 'there'}! What's on your mind?"

NEVER say "I'm Jericho" - they already know who you are. Just greet them warmly and get into it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR MISSION THIS CALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Be a COACH first - help them think through challenges
2. REMEMBER what you know about them and reference it naturally
3. TAKE ACTION using tools when they want to add goals, achievements, habits
4. CELEBRATE their progress and call out patterns you've noticed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 WHO YOU'RE TALKING TO: ${profile.full_name || 'there'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Role: ${profile.role || 'Not specified'}
- Company: ${profile.companies?.name || 'Unknown'}
- Onboarding Phase: ${completeness?.onboarding_phase || 'new'}
- Profile Completeness: ${Math.round(((hasData.length) / 6) * 100)}%

${coachingInsights.length > 0 ? `
🧠 WHAT I REMEMBER ABOUT ${profile.full_name?.toUpperCase() || 'THEM'}:
${coachingInsights.slice(0, 10).map(i => `• [${i.insight_type}] ${i.insight_text}`).join('\n')}
` : ''}

${recentSummaries.length > 0 ? `
📝 RECENT CONVERSATIONS:
${recentSummaries.slice(0, 5).map(s => `• ${s.conversations?.title || 'Chat'} (${s.conversations?.source || 'text'}): ${s.summary_text?.substring(0, 100)}...`).join('\n')}
` : ''}

${pendingFollowUps.length > 0 ? `
⏰ FOLLOW-UPS DUE (check in on these!):
${pendingFollowUps.map(f => `• ${f.context?.topic || f.follow_up_type}`).join('\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 THEIR CURRENT GROWTH PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISION:
• Professional 1-Year: ${goals?.one_year_vision || 'Not set'}
• Professional 3-Year: ${goals?.three_year_vision || 'Not set'}
• Personal 1-Year: ${goals?.personal_one_year_vision || 'Not set'}
• Personal 3-Year: ${goals?.personal_three_year_vision || 'Not set'}

CURRENT 90-DAY GOALS (${currentTargets.length}):
${currentTargets.length > 0 ? currentTargets.map(t => `• ${t.goal_text} (${t.category || 'general'}${t.by_when ? `, due: ${t.by_when}` : ''})`).join('\n') : '• No active goals yet'}

ACTIVE HABITS (${habits.length}):
${habits.length > 0 ? habits.map(h => `• ${h.habit_name} - ${h.current_streak} day streak`).join('\n') : '• No habits tracking yet'}

RECENT ACHIEVEMENTS:
${achievements.length > 0 ? achievements.slice(0, 5).map(a => `• ${a.achievement_text} (${a.achieved_date})`).join('\n') : '• None recorded yet'}

GREATNESS KEYS EARNED: ${greatnessKeys.length}

CAPABILITIES (${capabilities.length} tracked):
${capabilities.slice(0, 5).map(c => `• ${c.capabilities?.name}: ${mapCapabilityLevel(c.current_level)} → ${mapCapabilityLevel(c.target_level)}`).join('\n')}

${goalPatterns.hasHistory ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 GOAL HISTORY INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Goals: ${goalPatterns.totalGoals}, Completed: ${goalPatterns.completedGoals} (${goalPatterns.overallCompletionRate}%)
${(goalPatterns.recentlyCompleted && goalPatterns.recentlyCompleted.length > 0) ? `• Recently Completed: ${goalPatterns.recentlyCompleted.join(', ')}` : ''}
${(goalPatterns.abandonedCount && goalPatterns.abandonedCount > 0) ? `• Abandoned Goals: ${goalPatterns.abandonedCount}` : ''}

🧠 Coaching Insights:
${goalPatterns.insights?.map(i => `• ${i}`).join('\n') || '• Limited history yet'}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ TOOLS YOU CAN USE (configured in ElevenLabs):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• add_90_day_goal: Create a new quarterly goal
• mark_goal_complete: Mark a goal as done
• add_habit: Create a daily/weekly habit
• add_achievement: Record a win they share
• update_vision: Capture vision statements
• save_insight: Remember something important about them

When they want to add something, use the tool and confirm: "Done! I added that to your plan."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎤 YOUR VOICE STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Warm but direct - you care AND you challenge
• Keep responses SHORT - this is voice, not an essay
• Use their name occasionally to keep it personal
• Reference past conversations naturally: "Last time you mentioned..."
• Celebrate wins: "That's awesome! Let me add that as an achievement."
• Notice patterns: "I've noticed you tend to... let's talk about that."
• Ask follow-up questions to go deeper
• Be encouraging but honest - don't be a pushover
• NEVER placate or let them off the hook with "that's okay for today"
• ALWAYS refer to capability levels as Level 1, 2, 3, 4 (NEVER Foundational, Advancing, etc.)

${MISSING_PLAN_GUIDANCE}

${missingData.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆕 ONBOARDING OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If they don't know what to discuss, help them complete:
${missingData.map(d => `• ${d.replace('_', ' ')}`).join('\n')}

Offer naturally: "I noticed you haven't set a personal vision yet - want me to help with that?"
` : `
✅ Great news - their profile is complete! Focus on coaching, progress review, and deeper challenges.
`}

Remember: You're not just chatting - you're coaching. Push them to grow while making them feel supported.`;

    // Generate dynamic first message based on context
    const firstName = profile.full_name?.split(' ')[0] || 'there';
    let firstMessage = `Hey ${firstName}! What's on your mind today?`;
    
    // Personalize based on context
    if (pendingFollowUps.length > 0) {
      const followUpTopic = pendingFollowUps[0]?.context?.topic || 'what we discussed';
      firstMessage = `Hey ${firstName}! I wanted to check in on ${followUpTopic} from last time - how's that going?`;
    } else if (goalPatterns.recentlyCompleted && goalPatterns.recentlyCompleted.length > 0) {
      firstMessage = `Hey ${firstName}! Congrats on completing some goals recently! What are we working on today?`;
    } else if (currentTargets.length > 0) {
      firstMessage = `Hey ${firstName}! Ready to make some progress on your goals? What's on your mind?`;
    } else if (habits.some((h: any) => h.current_streak >= 7)) {
      firstMessage = `Hey ${firstName}! I'm loving those streaks you've got going. What can I help you with today?`;
    } else if (missingData.length > 0 && missingData.includes('personal_vision')) {
      firstMessage = `Hey ${firstName}! Good to hear from you. I noticed you haven't set up your vision yet - want to work on that, or is there something else on your mind?`;
    }

    console.log('Generated first message:', firstMessage);
    console.log('Voice prompt built, getting conversation token...');

    // Get WebRTC conversation token for ElevenLabs (better audio + stability)
    const tokenResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${elevenLabsAgentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        }
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('ElevenLabs error:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize voice agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token } = await tokenResponse.json();
    if (!token) {
      throw new Error('No conversation token returned from ElevenLabs');
    }

    // Create conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        profile_id: user.id,
        company_id: profile.company_id,
        title: 'Voice conversation with Jericho',
        source: 'voice',
        context_snapshot: {
          capabilities_count: capabilities.length,
          goals_count: currentTargets.length,
          habits_count: habits.length,
          achievements_count: achievements.length,
          coaching_insights_count: coachingInsights.length,
        }
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

    console.log('Voice session created:', conversation.id);

    return new Response(
      JSON.stringify({
        conversationToken: token,
        conversationId: conversation.id,
        firstMessage: firstMessage,
        completeness: {
          percentage: Math.round(((hasData.length) / 6) * 100),
          missingItems: missingData,
          onboardingPhase: completeness?.onboarding_phase || 'new',
        },
        // Pass context summary to frontend for display
        contextSummary: {
          coachingInsightsCount: coachingInsights.length,
          pendingFollowUpsCount: pendingFollowUps.length,
          recentConversationsCount: recentSummaries.length,
          goalCompletionRate: goalPatterns.hasHistory ? goalPatterns.overallCompletionRate : null,
          currentGoalsCount: currentTargets.length,
          activeHabitsCount: habits.length,
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
