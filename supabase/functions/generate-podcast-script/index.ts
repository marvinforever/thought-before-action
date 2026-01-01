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
  recentAchievements: { text: string; category: string }[];
  priorityCapability: string | null;
  capabilityLevel: string | null;
  targetLevel: string | null;
  capabilityDescription: string | null;
  activeGoal: string | null;
  goalBenchmarks: string[] | null;
  completedBenchmarks: number;
  totalBenchmarks: number;
  learningPreference: string | null;
  dayOfWeek: string;
  personalVision: string | null;
  diagnosticStrength: string | null;
  diagnosticGrowthArea: string | null;
  yesterdayChallenge: string | null;
  yesterdayTopics: string[] | null;
  loginStreak: number;
  capabilityFocusIndex: number;
  allPriorityCapabilities: { name: string; level: string; target: string }[];
  // New: Recognition & Manager feedback
  recentRecognitions: {
    title: string;
    description: string | null;
    category: string | null;
    givenByName: string;
    recognitionDate: string;
  }[];
  managerWins: string[] | null;
  lastOneOnOneDate: string | null;
}

interface DayTheme {
  name: string;
  focus: string;
  additionalInstructions: string;
}

const DAY_THEMES: Record<string, DayTheme> = {
  Monday: {
    name: 'Week Launch',
    focus: 'Goal setting and week preview',
    additionalInstructions: `
- Start with energizing "fresh week" energy
- Preview what success looks like this week
- Set one clear intention for the week
- Reference their 90-day goal and how this week moves them closer`
  },
  Tuesday: {
    name: 'Skill Building',
    focus: 'Deep capability development',
    additionalInstructions: `
- Go deeper on their current capability focus
- Provide a specific technique or framework they can apply today
- Include a practice exercise or reflection question`
  },
  Wednesday: {
    name: 'Mid-Week Momentum',
    focus: 'Progress check and recalibration',
    additionalInstructions: `
- Acknowledge we're halfway through the week
- Check in on the week's intention
- Celebrate any mid-week wins
- Adjust course if needed with compassion`
  },
  Thursday: {
    name: 'Growth Edge',
    focus: 'Pushing comfort zones',
    additionalInstructions: `
- Encourage taking a small risk today
- Reference their growth areas with encouragement
- Provide a slightly more challenging daily challenge`
  },
  Friday: {
    name: 'Weekly Wins',
    focus: 'Celebration and reflection',
    additionalInstructions: `
- Lead with celebration and recognition
- Prompt reflection on the week's growth
- Suggest a weekend intention (not work, but restorative)
- End on a high, anticipating the next week`
  },
  Saturday: {
    name: 'Weekend Wisdom',
    focus: 'Lighter, reflective content',
    additionalInstructions: `
- Keep it brief and inspiring
- Share a growth-oriented insight or quote
- Encourage rest and perspective
- Optional: suggest a small personal growth activity`
  },
  Sunday: {
    name: 'Week Prep',
    focus: 'Mindset preparation',
    additionalInstructions: `
- Gentle, reflective tone
- Help them mentally prepare for the coming week
- Connect their bigger vision to the week ahead
- End with confident anticipation`
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, companyId } = await req.json();

    if (!profileId || !companyId) {
      throw new Error('profileId and companyId are required');
    }

    console.log(`Generating enhanced podcast script for profile: ${profileId}`);

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

    const fullName = profile.full_name || '';
    const userName = fullName.split(' ')[0] || 'there';
    const durationMinutes = profile.podcast_duration_minutes || 2;

    // Fetch yesterday's episode for continuity
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: yesterdayEpisode } = await supabase
      .from('podcast_episodes')
      .select('daily_challenge, capability_focus_index')
      .eq('profile_id', profileId)
      .eq('episode_date', yesterdayStr)
      .single();

    const yesterdayChallenge = yesterdayEpisode?.daily_challenge || null;
    const lastCapabilityIndex = yesterdayEpisode?.capability_focus_index ?? -1;

    // Fetch login streak
    const { data: loginStreakData } = await supabase
      .from('login_streaks')
      .select('current_streak')
      .eq('profile_id', profileId)
      .single();

    const loginStreak = loginStreakData?.current_streak || 0;

    // Fetch habit data with current streak
    const { data: habits } = await supabase
      .from('leading_indicators')
      .select('habit_name, current_streak, longest_streak')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('current_streak', { ascending: false })
      .limit(1);

    const topHabit = habits?.[0];

    // Fetch recent achievements (last 7 days, up to 3)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: achievements } = await supabase
      .from('achievements')
      .select('achievement_text, category')
      .eq('profile_id', profileId)
      .gte('achieved_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('achieved_date', { ascending: false })
      .limit(3);

    const recentAchievements = (achievements || []).map(a => ({
      text: a.achievement_text,
      category: a.category || 'general'
    }));

    // Fetch recent recognition notes (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const { data: recognitions } = await supabase
      .from('recognition_notes')
      .select(`
        title,
        description,
        category,
        recognition_date,
        given_by,
        profiles!recognition_notes_given_by_fkey (full_name)
      `)
      .eq('given_to', profileId)
      .gte('recognition_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('recognition_date', { ascending: false })
      .limit(3);

    const recentRecognitions = (recognitions || []).map(r => ({
      title: r.title,
      description: r.description,
      category: r.category,
      givenByName: (r.profiles as any)?.full_name?.split(' ')[0] || 'A colleague',
      recognitionDate: r.recognition_date
    }));

    console.log(`Found ${recentRecognitions.length} recent recognitions`);

    // Fetch recent 1:1 notes with wins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: oneOnOneNotes } = await supabase
      .from('one_on_one_notes')
      .select('wins, meeting_date')
      .eq('employee_id', profileId)
      .not('wins', 'is', null)
      .gte('meeting_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(1);

    const managerWins = oneOnOneNotes?.[0]?.wins 
      ? (Array.isArray(oneOnOneNotes[0].wins) 
          ? oneOnOneNotes[0].wins 
          : [oneOnOneNotes[0].wins])
      : null;
    const lastOneOnOneDate = oneOnOneNotes?.[0]?.meeting_date || null;

    console.log(`Found manager wins: ${managerWins ? managerWins.length : 0}`);

    // Fetch TOP 5 priority capabilities for rotation
    const { data: capabilities } = await supabase
      .from('employee_capabilities')
      .select(`
        id,
        current_level,
        target_level,
        priority,
        capability_id,
        capabilities (id, name, description)
      `)
      .eq('profile_id', profileId)
      .not('marked_not_relevant', 'eq', true)
      .not('priority', 'is', null)
      .order('priority', { ascending: true })
      .limit(5);

    // Build capability rotation
    const allPriorityCapabilities = (capabilities || []).map(cap => ({
      id: (cap.capabilities as any)?.id,
      name: (cap.capabilities as any)?.name || 'Unknown',
      level: cap.current_level || 'unassessed',
      target: cap.target_level || 'growth',
      description: (cap.capabilities as any)?.description || ''
    }));

    // Calculate which capability to focus on today (rotate through top capabilities)
    const capabilityCount = allPriorityCapabilities.length;
    const capabilityFocusIndex = capabilityCount > 0 
      ? (lastCapabilityIndex + 1) % capabilityCount 
      : 0;
    
    const todayCapability = allPriorityCapabilities[capabilityFocusIndex] || null;

    // Fetch active 90-day goal with benchmarks
    const { data: goals } = await supabase
      .from('ninety_day_targets')
      .select('goal_text, completed, benchmarks, sprints')
      .eq('profile_id', profileId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const activeGoal = goals?.[0];
    
    // Parse benchmarks and calculate progress
    let goalBenchmarks: string[] = [];
    let completedBenchmarks = 0;
    let totalBenchmarks = 0;
    
    if (activeGoal?.benchmarks) {
      try {
        const benchmarkData = typeof activeGoal.benchmarks === 'string' 
          ? JSON.parse(activeGoal.benchmarks) 
          : activeGoal.benchmarks;
        
        if (Array.isArray(benchmarkData)) {
          goalBenchmarks = benchmarkData.map((b: any) => 
            typeof b === 'string' ? b : b.text || b.description || String(b)
          );
          totalBenchmarks = goalBenchmarks.length;
          // Assume first N benchmarks are completed based on some logic
          // For now, we'll use a simple heuristic
          completedBenchmarks = benchmarkData.filter((b: any) => 
            typeof b === 'object' && b.completed
          ).length;
        }
      } catch (e) {
        console.log('Could not parse benchmarks:', e);
      }
    }

    // Fetch personal vision
    const { data: personalGoals } = await supabase
      .from('personal_goals')
      .select('one_year_vision, three_year_vision')
      .eq('profile_id', profileId)
      .eq('goal_type', 'professional')
      .order('created_at', { ascending: false })
      .limit(1);

    const personalVision = personalGoals?.[0]?.one_year_vision || 
                          personalGoals?.[0]?.three_year_vision || null;

    // Fetch diagnostic insights (strengths and growth areas)
    const { data: diagnostic } = await supabase
      .from('diagnostic_responses')
      .select('learning_preference, learning_motivation, natural_strength, skill_to_master')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    const learningPref = diagnostic?.[0]?.learning_preference;
    const diagnosticStrength = diagnostic?.[0]?.natural_strength || null;
    const diagnosticGrowthArea = diagnostic?.[0]?.skill_to_master || null;

    // Get day of week for personalized greeting and themes
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[new Date().getDay()];
    const dayTheme = DAY_THEMES[dayOfWeek];

    const context: PodcastContext = {
      userName,
      habitStreak: topHabit?.current_streak || 0,
      habitName: topHabit?.habit_name || null,
      recentAchievements,
      priorityCapability: todayCapability?.name || null,
      capabilityLevel: todayCapability?.level || null,
      targetLevel: todayCapability?.target || null,
      capabilityDescription: todayCapability?.description || null,
      activeGoal: activeGoal?.goal_text || null,
      goalBenchmarks,
      completedBenchmarks,
      totalBenchmarks,
      learningPreference: learningPref || null,
      dayOfWeek,
      personalVision,
      diagnosticStrength,
      diagnosticGrowthArea,
      yesterdayChallenge,
      yesterdayTopics: null,
      loginStreak,
      capabilityFocusIndex,
      allPriorityCapabilities: allPriorityCapabilities.map(c => ({
        name: c.name,
        level: c.level,
        target: c.target
      })),
      recentRecognitions,
      managerWins,
      lastOneOnOneDate,
    };

    console.log('Enhanced podcast context:', JSON.stringify(context, null, 2));

    // Duration-based parameters - INCREASED word counts by ~20%
    const durationConfig: Record<number, { words: string; structure: string; maxTokens: number }> = {
      2: {
        words: '350-420 words',
        structure: `Structure (keep to ~350-420 words total for 2-minute audio):
1. Opening (15 sec, ~35 words): Greet by name, acknowledge the day with energy
2. Accountability Check (20 sec, ~40 words): Reference yesterday's challenge if given, or acknowledge their streak/consistency
3. Personal Win (25 sec, ~50 words): Celebrate a specific achievement, streak, or progress
4. Growth Insight (50 sec, ~100 words): One educational nugget related to today's capability focus
5. Daily Challenge (35 sec, ~70 words): Specific, actionable micro-challenge for today - be clear and measurable
6. Vision Connection (15 sec, ~30 words): Briefly tie today's work to their bigger picture
7. Closing (10 sec, ~25 words): Encouraging, energizing sign-off`,
        maxTokens: 1200
      },
      5: {
        words: '850-1000 words',
        structure: `Structure (keep to ~850-1000 words total for 5-minute audio):
1. Opening (20 sec, ~45 words): Warm greeting by name, set the ${dayTheme.name} theme
2. Accountability Check (30 sec, ~60 words): Reference yesterday's challenge, celebrate follow-through or gently encourage
3. Progress Review (50 sec, ~100 words): Celebrate achievements, streaks, and recent wins
4. Capability Deep-Dive (100 sec, ~200 words): In-depth content on today's focus capability with practical examples
5. Goal Check-In (60 sec, ~120 words): Review their 90-day goal progress (X of Y benchmarks), provide strategic guidance
6. Daily Challenge (50 sec, ~100 words): Specific, actionable challenge with clear success criteria
7. Vision Moment (40 sec, ~80 words): Connect today's growth to their bigger vision and aspirations
8. Mindset Insight (30 sec, ~60 words): Brief wisdom on growth mindset or leadership
9. Closing (20 sec, ~40 words): Encouraging, personalized sign-off`,
        maxTokens: 2500
      },
      10: {
        words: '1700-2000 words',
        structure: `Structure (keep to ~1700-2000 words total for 10-minute audio):
1. Opening (30 sec, ~70 words): Warm, personal greeting with ${dayTheme.name} theme and energy setting
2. Accountability Review (45 sec, ~90 words): Detailed check-in on yesterday's challenge and recent commitments
3. Weekly Wins Recap (90 sec, ~180 words): Comprehensive celebration of achievements and progress
4. Habit & Streak Analysis (60 sec, ~120 words): Deep dive into habit performance with encouragement
5. Capability Masterclass (4 min, ~480 words): Extensive educational content with frameworks, examples, and application tips for today's focus capability
6. Goal Strategy Session (90 sec, ~180 words): Detailed goal review with benchmark tracking and strategic adjustments
7. Skill-Building Exercise (60 sec, ~120 words): Interactive thought exercise or reflection prompt
8. Daily Challenge (60 sec, ~120 words): Well-defined actionable challenge with success criteria and why it matters
9. Vision & Purpose Connection (60 sec, ~120 words): Deep connection to their personal vision and bigger aspirations
10. Mindset & Motivation (45 sec, ~90 words): Practical wisdom on growth and leadership
11. Week Ahead Preview (30 sec, ~60 words): What to focus on and anticipate
12. Closing (30 sec, ~70 words): Inspiring, highly personalized sign-off`,
        maxTokens: 5000
      }
    };

    const config = durationConfig[durationMinutes] || durationConfig[2];

    // Generate script using Lovable AI with enhanced prompts
    const systemPrompt = `You are a warm, insightful podcast host creating a personalized ${durationMinutes}-minute daily growth brief. You're like a supportive mentor who genuinely knows and cares about this person's development journey.

Your tone is:
- Conversational and authentic - like a trusted friend who happens to be a great coach
- Energetic but grounded - enthusiastic without being over-the-top
- Lovingly direct - willing to gently call out when progress isn't happening, always with compassion
- Specific and personal - using the user's actual data and calling things by name
- Action-oriented - every episode ends with a clear, doable challenge
- Vision-connected - helping them see how today's small steps lead to their bigger aspirations

Today's Theme: ${dayTheme.name} - ${dayTheme.focus}
${dayTheme.additionalInstructions}

${config.structure}

Rules:
- Write for spoken audio - use contractions, simple sentences, natural pauses
- Include [pause] markers for dramatic effect or transitions (use sparingly, 2-4 per episode max)
- If data is missing, gracefully skip that section - never call attention to missing data
- Never say "according to your data" or "based on your profile" - just state things naturally as if you know them
- Make educational insights genuinely useful with specific, actionable takeaways
- When referencing their capability journey, acknowledge both where they are AND where they're headed
- If they have a personal vision, occasionally weave it in naturally
- If yesterday's challenge is provided, START with a warm accountability check
- Target approximately ${config.words}
- IMPORTANT: Do NOT include any stage directions, audio cues, or production notes like "intro music fades in", "music plays", etc. Write ONLY the spoken words.
- CRITICAL: Do NOT use asterisks, markdown formatting, or any text emphasis markers. Write plain text only. Instead of *word* or **word**, just write the word naturally - use sentence structure and word choice for emphasis, not formatting.
- CRITICAL: Do NOT use time-of-day greetings like "Good morning", "Good afternoon", or "Good evening". Users listen at various times. Use timeless greetings like "Hey [name]", "Welcome back [name]", or just dive into the content.
- Extract and clearly state the daily challenge in a way that it could be pulled out and stored separately`;

    const userPrompt = `Create today's ${durationMinutes}-minute podcast script for this user:

User Context:
- Name: ${context.userName}
- Day: ${context.dayOfWeek} (${dayTheme.name} theme)
- Login streak: ${context.loginStreak > 0 ? `${context.loginStreak} consecutive days` : 'Just getting started'}

Yesterday's Challenge: ${context.yesterdayChallenge || 'None given (first episode or break)'}

Habits & Streaks:
- Top habit: ${context.habitStreak > 0 ? `"${context.habitName}" with a ${context.habitStreak}-day streak` : 'No active habit streak yet - opportunity to encourage starting one'}

Recent Achievements (last 7 days):
${context.recentAchievements.length > 0 
  ? context.recentAchievements.map(a => `- ${a.category}: "${a.text}"`).join('\n')
  : '- None recorded in last week'}

${context.recentRecognitions.length > 0 
  ? `Manager & Peer Recognition (last 14 days):\n${context.recentRecognitions.map(r => `- "${r.title}" from ${r.givenByName}${r.category ? ` (${r.category})` : ''}${r.description ? `: "${r.description}"` : ''}`).join('\n')}`
  : ''}

${context.managerWins && context.managerWins.length > 0
  ? `Wins from Recent 1:1 with Manager:\n- Your manager noted: ${context.managerWins.join('; ')}\n- Last 1:1 was on: ${context.lastOneOnOneDate}`
  : ''}

Today's Capability Focus (rotating through priorities):
- Capability: ${context.priorityCapability || 'Not set'}
- Current level: ${context.capabilityLevel || 'unassessed'}
- Target level: ${context.targetLevel || 'growth'}
- Description: ${context.capabilityDescription || 'A key skill for their role'}
${context.allPriorityCapabilities.length > 1 ? `- Other priorities they're working on: ${context.allPriorityCapabilities.filter((_, i) => i !== context.capabilityFocusIndex).map(c => c.name).join(', ')}` : ''}

90-Day Goal:
- Goal: ${context.activeGoal || 'Not set'}
- Benchmark progress: ${context.totalBenchmarks > 0 ? `${context.completedBenchmarks} of ${context.totalBenchmarks} milestones complete` : 'No benchmarks set'}
${(context.goalBenchmarks && context.goalBenchmarks.length > 0) ? `- Upcoming benchmarks: ${context.goalBenchmarks.slice(context.completedBenchmarks, context.completedBenchmarks + 2).join('; ')}` : ''}

Personal Vision:
- Vision: ${context.personalVision || 'Not yet articulated'}

Diagnostic Insights:
- Natural strength: ${context.diagnosticStrength || 'Not assessed'}
- Skill to develop: ${context.diagnosticGrowthArea || 'Not assessed'}

Learning Style: ${context.learningPreference || 'Not specified'}

Generate the complete podcast script. Make it feel personal and motivating. Use natural speech patterns and include [pause] markers where appropriate.

IMPORTANT: Near the end, clearly state the daily challenge in a memorable way. Make it specific, achievable, and connected to their growth.`;

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

    console.log('Enhanced script generated successfully, length:', script.length);

    // Extract daily challenge from script for storage
    const challengeMatch = script.match(/(?:challenge|task|mission|goal for today|today's challenge)[^.]*?[:]\s*([^.]+\.)/i) ||
                          script.match(/(?:I challenge you to|your challenge is|here's your challenge)[^.]*?([^.]+\.)/i);
    const extractedChallenge = challengeMatch ? challengeMatch[1].trim() : null;

    // Generate title with theme
    const title = `${dayTheme.name}: Your ${context.dayOfWeek} Growth Brief`;

    // Determine topics covered
    const topicsCovered = [];
    if (context.habitStreak > 0) topicsCovered.push('habits');
    if (context.recentAchievements.length > 0) topicsCovered.push('achievements');
    if (context.recentRecognitions.length > 0) topicsCovered.push('recognition');
    if (context.managerWins && context.managerWins.length > 0) topicsCovered.push('manager-feedback');
    if (context.priorityCapability) topicsCovered.push(context.priorityCapability);
    if (context.activeGoal) topicsCovered.push('goals');
    if (context.yesterdayChallenge) topicsCovered.push('accountability');
    if (context.personalVision) topicsCovered.push('vision');

    return new Response(
      JSON.stringify({
        success: true,
        script,
        title,
        topicsCovered,
        context,
        // New fields for storage
        capabilityId: todayCapability?.id || null,
        capabilityFocusIndex,
        dailyChallenge: extractedChallenge,
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
