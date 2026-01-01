import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PodcastContext {
  userName: string;
  habitStreak: number;
  habitName: string | null;
  recentAchievement: string | null;
  priorityCapability: string | null;
  capabilityLevel: string | null;
  targetLevel: string | null;
  activeGoal: string | null;
  goalProgress: number | null;
  learningPreference: string | null;
  dayOfWeek: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, companyId } = await req.json();

    if (!profileId || !companyId) {
      throw new Error('profileId and companyId are required');
    }

    console.log(`Generating podcast script for profile: ${profileId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile including podcast duration preference
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, podcast_duration_minutes')
      .eq('id', profileId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    // Extract first name from full_name
    const fullName = profile.full_name || '';
    const userName = fullName.split(' ')[0] || 'there';
    const durationMinutes = profile.podcast_duration_minutes || 2;

    // Fetch habit data with current streak
    const { data: habits } = await supabase
      .from('leading_indicators')
      .select('habit_name, current_streak, longest_streak')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('current_streak', { ascending: false })
      .limit(1);

    const topHabit = habits?.[0];

    // Fetch recent achievement (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: achievements } = await supabase
      .from('achievements')
      .select('achievement_text, category')
      .eq('profile_id', profileId)
      .gte('achieved_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('achieved_date', { ascending: false })
      .limit(1);

    const recentAchievement = achievements?.[0]?.achievement_text;

    // Fetch priority capability
    const { data: capabilities } = await supabase
      .from('employee_capabilities')
      .select(`
        current_level,
        target_level,
        priority,
        capabilities (name, description)
      `)
      .eq('profile_id', profileId)
      .not('marked_not_relevant', 'eq', true)
      .order('priority', { ascending: true })
      .limit(1);

    const priorityCap = capabilities?.[0];
    const capabilityName = (priorityCap?.capabilities as any)?.name;
    const capabilityDesc = (priorityCap?.capabilities as any)?.description;

    // Fetch active 90-day goal
    const { data: goals } = await supabase
      .from('ninety_day_targets')
      .select('goal_text, completed, benchmarks')
      .eq('profile_id', profileId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const activeGoal = goals?.[0];

    // Fetch learning preference from diagnostic
    const { data: diagnostic } = await supabase
      .from('diagnostic_responses')
      .select('learning_preference, learning_motivation')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    const learningPref = diagnostic?.[0]?.learning_preference;

    // Get day of week for personalized greeting
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[new Date().getDay()];

    const context: PodcastContext = {
      userName,
      habitStreak: topHabit?.current_streak || 0,
      habitName: topHabit?.habit_name || null,
      recentAchievement: recentAchievement || null,
      priorityCapability: capabilityName || null,
      capabilityLevel: priorityCap?.current_level || null,
      targetLevel: priorityCap?.target_level || null,
      activeGoal: activeGoal?.goal_text || null,
      goalProgress: null, // Could calculate from benchmarks
      learningPreference: learningPref || null,
      dayOfWeek,
    };

    console.log('Podcast context:', JSON.stringify(context, null, 2));

    // Duration-based parameters
    const durationConfig: Record<number, { words: string; structure: string; maxTokens: number }> = {
      2: {
        words: '300-350 words',
        structure: `Structure (keep to ~300-350 words total for 2-minute audio):
1. Opening (15 sec, ~30 words): Greet by name, acknowledge the day
2. Personal Win (30 sec, ~60 words): Celebrate a specific achievement, streak, or progress
3. Growth Insight (60 sec, ~120 words): One educational nugget related to their priority capability
4. Daily Challenge (30 sec, ~60 words): Specific, actionable micro-challenge for today
5. Closing (15 sec, ~30 words): Encouraging sign-off`,
        maxTokens: 1000
      },
      5: {
        words: '700-800 words',
        structure: `Structure (keep to ~700-800 words total for 5-minute audio):
1. Opening (20 sec, ~40 words): Warm greeting by name, acknowledge the day and set the tone
2. Progress Review (60 sec, ~120 words): Celebrate achievements, streaks, and recent wins in detail
3. Capability Deep-Dive (90 sec, ~180 words): In-depth educational content on their priority capability with practical examples
4. Goal Check-In (60 sec, ~120 words): Review their 90-day goal progress and provide strategic guidance
5. Daily Challenge (45 sec, ~90 words): Specific, actionable challenge with clear steps
6. Mindset Moment (30 sec, ~60 words): A brief motivational insight or quote
7. Closing (15 sec, ~30 words): Encouraging sign-off`,
        maxTokens: 2000
      },
      10: {
        words: '1400-1600 words',
        structure: `Structure (keep to ~1400-1600 words total for 10-minute audio):
1. Opening (30 sec, ~60 words): Warm, personal greeting with day acknowledgment and preview
2. Weekly Wins Recap (90 sec, ~180 words): Comprehensive celebration of achievements and progress
3. Habit & Streak Analysis (60 sec, ~120 words): Deep dive into habit performance and streak psychology
4. Capability Masterclass (3 min, ~360 words): Extensive educational content with frameworks, examples, and application tips
5. Goal Strategy Session (90 sec, ~180 words): Detailed goal review with milestone tracking and adjustments
6. Skill-Building Exercise (60 sec, ~120 words): Interactive thought exercise or reflection prompt
7. Daily Challenge (45 sec, ~90 words): Well-defined actionable challenge with success criteria
8. Mindset & Motivation (60 sec, ~120 words): Deeper motivational content with practical wisdom
9. Preview & Planning (30 sec, ~60 words): What to focus on for the rest of the week
10. Closing (30 sec, ~60 words): Inspiring sign-off with personal encouragement`,
        maxTokens: 4000
      }
    };

    const config = durationConfig[durationMinutes] || durationConfig[2];

    // Generate script using Lovable AI
    const systemPrompt = `You are a warm, motivating podcast host creating a personalized ${durationMinutes}-minute daily growth brief. Your tone is:
- Conversational and friendly, like a supportive mentor
- Energetic but not over-the-top
- Specific and personal, using the user's actual data
- Action-oriented with a clear daily challenge

${config.structure}

Rules:
- Write for spoken audio - use contractions, simple sentences, natural pauses
- Include [pause] markers for dramatic effect or transitions
- If data is missing, gracefully skip or generalize that section
- Never say "according to your data" or "based on your profile" - just state things naturally
- Make the educational insight genuinely useful, not generic
- Target approximately ${config.words}`;

    const userPrompt = `Create today's ${durationMinutes}-minute podcast script for this user:

User Context:
- Name: ${context.userName}
- Day: ${context.dayOfWeek}
- Habit streak: ${context.habitStreak > 0 ? `${context.habitStreak} days on "${context.habitName}"` : 'No active streak yet'}
- Recent achievement: ${context.recentAchievement || 'None in last week'}
- Priority capability: ${context.priorityCapability || 'Not set'} (currently ${context.capabilityLevel || 'unassessed'}, targeting ${context.targetLevel || 'growth'})
- Active 90-day goal: ${context.activeGoal || 'Not set'}
- Learning preference: ${context.learningPreference || 'Not specified'}

Generate the complete podcast script. Use natural speech patterns and include [pause] markers where appropriate.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const script = aiData.choices?.[0]?.message?.content;

    if (!script) {
      throw new Error('No script generated from AI');
    }

    console.log('Script generated successfully, length:', script.length);

    // Generate title
    const title = `Your ${context.dayOfWeek} Growth Brief`;

    // Determine topics covered
    const topicsCovered = [];
    if (context.habitStreak > 0) topicsCovered.push('habits');
    if (context.recentAchievement) topicsCovered.push('achievements');
    if (context.priorityCapability) topicsCovered.push(context.priorityCapability);
    if (context.activeGoal) topicsCovered.push('goals');

    return new Response(
      JSON.stringify({
        success: true,
        script,
        title,
        topicsCovered,
        context,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating podcast script:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
