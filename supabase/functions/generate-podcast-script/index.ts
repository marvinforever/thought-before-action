import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI_CONFIG, mapCapabilityLevel, COACHING_STYLE, MISSING_PLAN_GUIDANCE, VARIETY_RULES } from "../_shared/jericho-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Curated inspirational quotes for growth mindset
const INSPIRATIONAL_QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Growth is never by mere chance; it is the result of forces working together.", author: "James Cash Penney" },
  { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { quote: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { quote: "It is not the mountain we conquer, but ourselves.", author: "Edmund Hillary" },
  { quote: "Excellence is not a destination but a continuous journey that never ends.", author: "Brian Tracy" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" },
  { quote: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi" },
  { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { quote: "Great things never come from comfort zones.", author: "Unknown" },
  { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
  { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { quote: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { quote: "Little things make big days.", author: "Unknown" },
  { quote: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
  { quote: "Don't wait for opportunity. Create it.", author: "Unknown" },
  { quote: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", author: "Unknown" },
  { quote: "The key to success is to focus on goals, not obstacles.", author: "Unknown" },
  { quote: "Dream bigger. Do bigger.", author: "Unknown" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
  { quote: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
];

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
  goalBenchmarks: { text: string; completed: boolean }[];
  goalSprints: { text: string; completed: boolean }[];
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
  // Recognition & Manager feedback
  recentRecognitions: {
    title: string;
    description: string | null;
    category: string | null;
    givenByName: string;
    recognitionDate: string;
  }[];
  managerWins: string[] | null;
  lastOneOnOneDate: string | null;
  // Coaching follow-ups from conversations
  pendingFollowUps: {
    topic: string;
    type: string;
    scheduledFor: string;
    context: any;
  }[];
  recentConversationSummary: string | null;
  inspirationalQuote: { quote: string; author: string };
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

function getCentralTime(now: Date = new Date()) {
  // Simple Central Time approximation (UTC-6). We use it only for day themes + rotation.
  // This avoids server-local timezone differences (edge runtime is UTC).
  const centralTimeOffsetHours = -6;
  const centralTime = new Date(now.getTime() + centralTimeOffsetHours * 60 * 60 * 1000);
  return { now, centralTime };
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

    const recentAchievements = (achievements || [])
      .map(a => ({
        text: a.achievement_text,
        category: a.category || 'general'
      }))
      // Filter likely third-person achievements (often created when the user is praising someone else)
      // This prevents mis-attributing actions like "he painted his office" to the user.
      .filter(a => !/\b(his|her|their)\b/i.test(a.text));

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

    // Fetch pending coaching follow-ups (from conversations with Jericho)
    const { data: pendingFollowUpsData } = await supabase
      .from('coaching_follow_ups')
      .select('follow_up_type, scheduled_for, context')
      .eq('profile_id', profileId)
      .is('completed_at', null)
      .is('skipped_at', null)
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5);

    // Filter out administrative follow-ups (e.g., "send recognition to X") that are easy to misattribute in spoken audio.
    const pendingFollowUps = (pendingFollowUpsData || [])
      .map(f => ({
        topic: f.context?.topic || f.follow_up_type,
        type: f.follow_up_type,
        scheduledFor: f.scheduled_for,
        context: f.context
      }))
      .filter(f => {
        const t = (f.topic || '').toLowerCase();
        return !t.includes('recognition') && !t.includes('send recognition');
      })
      .slice(0, 3);

    console.log(`Found ${pendingFollowUps.length} pending follow-ups for podcast (filtered)`);

    // Fetch most recent conversation summary for continuity (skip "recognition"-type summaries to avoid wrong attribution)
    const { data: recentSummaries } = await supabase
      .from('conversation_summaries')
      .select('summary_text, key_topics, action_items, emotional_tone, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5);

    const safeSummary = (recentSummaries || []).find(s => {
      const topics = (s.key_topics || []).map((k: string) => String(k).toLowerCase());
      const text = (s.summary_text || '').toLowerCase();
      return !topics.includes('recognition') && !text.includes('send recognition');
    }) || null;

    const recentConversationSummary = safeSummary?.summary_text || null;
    const recentActionItems = safeSummary?.action_items || [];

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
    const allPriorityCapabilities = (capabilities || []).map(cap => {
      const level = cap.current_level || 'unassessed';
      const target = cap.target_level || 'growth';

      // Use shared level mapping from jericho-config
      const levelToLabel = (l: string) => mapCapabilityLevel(l);

      return {
        id: (cap.capabilities as any)?.id,
        name: (cap.capabilities as any)?.name || 'Unknown',
        level,
        target,
        levelLabel: levelToLabel(level),
        targetLabel: levelToLabel(target),
        description: (cap.capabilities as any)?.description || ''
      };
    });

    // Calculate which capability to focus on today (rotate through top capabilities)
    const capabilityCount = allPriorityCapabilities.length;
    const capabilityFocusIndex = capabilityCount > 0 
      ? (lastCapabilityIndex + 1) % capabilityCount 
      : 0;
    
    const todayCapability = allPriorityCapabilities[capabilityFocusIndex] || null;

    // Helper: normalize benchmarks/sprints stored as jsonb (array, object, or string)
    const normalizeChecklist = (value: any): { text: string; completed: boolean }[] => {
      if (!value) return [];

      const toItemsFromText = (t: string) => {
        const lines = t
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
          .map(l => l.replace(/^[-•\u2022]\s*/, ''))
          .filter(Boolean);

        return lines.length > 1 ? lines : [t.trim()].filter(Boolean);
      };

      if (Array.isArray(value)) {
        return value.map((v: any) => ({
          text: typeof v === 'string' ? v : (v?.text || v?.description || String(v)),
          completed: typeof v === 'object' && v?.completed === true,
        })).filter(i => i.text);
      }

      if (typeof value === 'object') {
        // Most common shape in our DB right now: { text: "..." }
        if (typeof value.text === 'string') {
          return toItemsFromText(value.text).map(text => ({ text, completed: false }));
        }
        return [{ text: String(value), completed: false }];
      }

      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return normalizeChecklist(parsed);
        } catch {
          return toItemsFromText(value).map(text => ({ text, completed: false }));
        }
      }

      return [];
    };

    // Day theme + rotation clock (Central Time)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const { now, centralTime } = getCentralTime();
    const dayOfWeek = days[centralTime.getDay()];
    const dayTheme = DAY_THEMES[dayOfWeek];
    const dayKey = Math.floor(centralTime.getTime() / 86400000); // stable day index

    console.log(`Day calculation: UTC=${now.toISOString()}, Central Time=${centralTime.toISOString()}, day=${dayOfWeek}`);

    // Fetch 90-day goals (rotate through ALL goals, not just professional)
    const { data: goals } = await supabase
      .from('ninety_day_targets')
      .select('goal_text, completed, benchmarks, sprints, goal_type, category, created_at')
      .eq('profile_id', profileId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(10);

    const allActiveGoals = goals || [];

    // Rotate among all active goals daily
    const goalFocusIndex = allActiveGoals.length > 0 ? (dayKey % allActiveGoals.length) : 0;
    const activeGoal = allActiveGoals[goalFocusIndex] || null;

    // Rotate the *type* of goal reference so we don't repeat the 90-day outcome.
    // Outcome should appear no more than once every 4 days.
    const canMentionOutcomeToday = dayKey % 4 === 0;

    const goalBenchmarks = normalizeChecklist(activeGoal?.benchmarks);
    const goalSprints = normalizeChecklist(activeGoal?.sprints);
    const totalBenchmarks = goalBenchmarks.length;
    const completedBenchmarks = goalBenchmarks.filter(b => b.completed).length;

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

    // Pick a random inspirational quote for today
    const todayQuote = INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)];

    const context: PodcastContext = {
      userName,
      habitStreak: topHabit?.current_streak || 0,
      habitName: topHabit?.habit_name || null,
      recentAchievements,
      priorityCapability: todayCapability?.name || null,
      capabilityLevel: (todayCapability as any)?.levelLabel || todayCapability?.level || null,
      targetLevel: (todayCapability as any)?.targetLabel || todayCapability?.target || null,
      capabilityDescription: todayCapability?.description || null,
      activeGoal: activeGoal?.goal_text || null,
      goalBenchmarks,
      goalSprints,
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
        level: (c as any).levelLabel || c.level,
        target: (c as any).targetLabel || c.target,
      })),
      recentRecognitions,
      managerWins,
      lastOneOnOneDate,
      pendingFollowUps,
      recentConversationSummary,
      inspirationalQuote: todayQuote,
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
- Direct and challenging (never placating) - you celebrate wins, but you also push for real action
- Energetic but grounded - enthusiastic without being over-the-top
- Specific and personal - using the user's actual data and calling things by name
- Action-oriented - every episode ends with a clear, doable challenge
- Vision-connected - helping them see how today's small steps lead to their bigger aspirations

Today's Theme: ${dayTheme.name} - ${dayTheme.focus}
${dayTheme.additionalInstructions}

${config.structure}

Rules:
- Write for spoken audio - use contractions, simple sentences, natural pauses
- Include [pause] markers for dramatic effect or transitions (use sparingly, 2-4 per episode max)
- If data is missing, do NOT fill it in. Skip that section gracefully.
- Never say "according to your data" or "based on your profile" - just state things naturally as if you know them
- Avoid repeating the same phrasing across days (no templated lines). Use varied sentence openings.
- CRITICAL: Capability levels must be referred to ONLY as Level 1 / Level 2 / Level 3 / Level 4 (never "foundational/advancing/independent/mastery").
- If a target level appears lower than the current level, do NOT pretend that's a growth target; instead, tell them to double-check and update it in My Growth Plan.
- If 30-day benchmarks or 7-day sprints are missing, be direct: tell them to open My Growth Plan and add them, and if they need help, click the chat bubble to do it with you.
- Target approximately ${config.words}
- IMPORTANT: Do NOT include any stage directions, audio cues, or production notes like "intro music fades in", "music plays", etc. Write ONLY the spoken words.
- CRITICAL: Do NOT use asterisks, markdown formatting, or any text emphasis markers. Write plain text only.
- CRITICAL: Do NOT use time-of-day greetings like "Good morning", "Good afternoon", or "Good evening". Use timeless greetings like "Hey [name]".
- Extract and clearly state the daily challenge in a way that it could be pulled out and stored separately`;

    const userPrompt = `Create today's ${durationMinutes}-minute podcast script for this user:

User Context:
- Name: ${context.userName}
- Day: ${context.dayOfWeek} (${dayTheme.name} theme)
- Login streak: ${context.loginStreak > 0 ? `${context.loginStreak} consecutive days` : 'Just getting started'}

Yesterday's Challenge: ${context.yesterdayChallenge || 'None given (first episode or break)'}

${context.pendingFollowUps.length > 0 
  ? `COACHING FOLLOW-UPS (from recent conversations - naturally check in on these):
${context.pendingFollowUps.map(f => `- ${f.topic}${f.context?.action_items?.length > 0 ? ` (they committed to: ${f.context.action_items.map((a: any) => a.item || a).join(', ')})` : ''}`).join('\n')}
These are things they discussed in recent coaching sessions. Weave in a natural, caring check-in about one or more of these.`
  : ''}

${context.recentConversationSummary 
  ? `Recent Coaching Session Summary (this is about ${context.userName}'s own conversations - things THEY discussed with you):
${context.recentConversationSummary}
IMPORTANT: This summary is about ${context.userName}'s own actions and discussions. If it mentions other people (like sending recognition TO someone), ${context.userName} was the one doing the action, not receiving it.`
  : ''}

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

90-Day Goal & Execution Plan:
- Current focus goal (rotating): ${context.activeGoal || 'Not set'}
${context.goalBenchmarks.length > 0 
  ? `- 30-Day Benchmarks (${context.completedBenchmarks} of ${context.totalBenchmarks} complete):
  ${context.goalBenchmarks.map(b => `  ${b.completed ? '✓' : '○'} ${b.text}`).join('\n  ')}`
  : '⚠️ NO 30-DAY BENCHMARKS SET.'}
${context.goalSprints.length > 0 
  ? `- 7-Day Sprints (this week):
  ${context.goalSprints.map(s => `  ${s.completed ? '✓' : '○'} ${s.text}`).join('\n  ')}`
  : '⚠️ NO 7-DAY SPRINTS SET.'}

MISSING PLAN GUIDANCE:
If benchmarks or sprints are missing, DO NOT just say "that's okay for today." Instead, be direct but encouraging:
  "Hey ${context.userName}, I see we're missing your 30-day benchmarks or 7-day sprints. No worries - open up My Growth Plan and let's get those in. Click on any 90-day goal to add benchmarks and sprints. Not sure how? Click the chat bubble and I'll walk you through it. Let's set this week's focus today."
Encourage them to take action now - you're a coach, not a cheerleader.

ROTATION RULES (CRITICAL):
- Do NOT repeat the 90-day outcome every day.
- Only mention the 90-day outcome explicitly if: ${canMentionOutcomeToday ? 'YES (allowed today)' : 'NO (not allowed today)'}
- If outcome mention is not allowed, focus ONLY on the next incomplete sprint or benchmark and what to do today/this week.

Personal Vision:
- Vision: ${context.personalVision || 'Not yet articulated'}

Diagnostic Insights:
- Natural strength: ${context.diagnosticStrength || 'Not assessed'}
- Skill to develop: ${context.diagnosticGrowthArea || 'Not assessed'}

Learning Style: ${context.learningPreference || 'Not specified'}

Inspirational Quote to weave in:
"${context.inspirationalQuote.quote}" — ${context.inspirationalQuote.author}
(Naturally include this quote somewhere in the episode - it can be in the opening, middle, or closing. Make it feel organic, not forced.)

Generate the complete podcast script. Make it feel personal and motivating. Use natural speech patterns and include [pause] markers where appropriate.

IMPORTANT: Near the end, clearly state the daily challenge in a memorable way. Make it specific, achievable, and connected to their growth.
IMPORTANT: If they have benchmarks or sprints, focus on those SPECIFIC next steps rather than just repeating their 90-day outcome over and over.
${context.pendingFollowUps.length > 0 ? '\nBONUS: If there are coaching follow-ups, naturally weave in a caring check-in about at least one of them. Make it conversational, not robotic.' : ''}`;

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
        temperature: 0.95,
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
