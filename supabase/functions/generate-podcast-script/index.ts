import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI_CONFIG, mapCapabilityLevel, COACHING_STYLE, MISSING_PLAN_GUIDANCE, VARIETY_RULES, CONVERSATION_FORMAT, PODCAST_HOSTS } from "../_shared/jericho-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to detect if target level is lower than current (data entry error)
function detectLevelRegression(currentLevel: string | null, targetLevel: string | null): boolean {
  if (!currentLevel || !targetLevel) return false;
  
  const levelOrder: Record<string, number> = {
    'Level 1': 1, 'foundational': 1,
    'Level 2': 2, 'advancing': 2,
    'Level 3': 3, 'independent': 3,
    'Level 4': 4, 'mastery': 4,
  };
  
  const currentNum = levelOrder[currentLevel] || levelOrder[currentLevel.toLowerCase()] || 0;
  const targetNum = levelOrder[targetLevel] || levelOrder[targetLevel.toLowerCase()] || 0;
  
  return targetNum > 0 && currentNum > 0 && targetNum < currentNum;
}

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
  professionalVision: string | null;
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
  // Recognition GIVEN to others
  recognitionGiven: {
    title: string;
    recipientName: string;
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
  // Diagnostic scores for closing summary
  diagnosticScores: {
    clarity: number | null;
    engagement: number | null;
    burnout: number | null;
    career: number | null;
    manager: number | null;
    retention: number | null;
  } | null;
  // Badges and achievements
  badges: {
    name: string;
    description: string;
    earnedAt: string;
  }[];
  nextBadgeHint: string | null;
  // Leaderboard position
  leaderboardPosition: number | null;
  totalEmployees: number | null;
  // System usage tips
  underutilizedFeatures: string[];
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
      .select('id, achievement_text, category')
      .eq('profile_id', profileId)
      .gte('achieved_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('achieved_date', { ascending: false })
      .limit(10); // Fetch more to filter

    // Note: usedAchievementIds will be populated after recognition query (line order matters)
    // We'll filter achievements after we have the usage data

    // Fetch recent recognition notes (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    // VARIETY SYSTEM: Fetch already-mentioned content to avoid repetition
    const { data: usedContent } = await supabase
      .from('podcast_content_usage')
      .select('content_type, content_id')
      .eq('profile_id', profileId);
    
    const usedRecognitionIds = new Set(
      (usedContent || []).filter(u => u.content_type === 'recognition_received').map(u => u.content_id)
    );
    const usedAchievementIds = new Set(
      (usedContent || []).filter(u => u.content_type === 'achievement').map(u => u.content_id)
    );
    const usedBadgeIds = new Set(
      (usedContent || []).filter(u => u.content_type === 'badge').map(u => u.content_id)
    );
    const usedRecognitionGivenIds = new Set(
      (usedContent || []).filter(u => u.content_type === 'recognition_given').map(u => u.content_id)
    );
    
    // Get habit milestone thresholds already mentioned
    const usedHabitMilestones = new Map<string, number[]>();
    (usedContent || [])
      .filter(u => u.content_type === 'habit_milestone')
      .forEach(u => {
        // content_id format: "habitId:threshold"
        const [habitId, thresholdStr] = (u.content_id || '').split(':');
        if (habitId && thresholdStr) {
          const existing = usedHabitMilestones.get(habitId) || [];
          existing.push(parseInt(thresholdStr, 10));
          usedHabitMilestones.set(habitId, existing);
        }
      });
    
    console.log(`Content usage tracking: ${usedRecognitionIds.size} recognitions, ${usedAchievementIds.size} achievements, ${usedBadgeIds.size} badges already mentioned`);
    
    const { data: recognitions } = await supabase
      .from('recognition_notes')
      .select(`
        id,
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
      .limit(10); // Fetch more to filter

    // Filter out already-mentioned recognitions (ONCE EVER rule)
    const freshRecognitions = (recognitions || []).filter(r => !usedRecognitionIds.has(r.id));
    
    const recentRecognitions = freshRecognitions.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      givenByName: (r.profiles as any)?.full_name?.split(' ')[0] || 'A colleague',
      recognitionDate: r.recognition_date
    }));

    console.log(`Found ${recognitions?.length || 0} recognitions, ${recentRecognitions.length} fresh (not mentioned before)`);

    // Now filter achievements with the usage data we have
    const freshAchievements = (achievements || []).filter(a => !usedAchievementIds.has(a.id));
    const recentAchievements = freshAchievements
      .slice(0, 3)
      .map(a => ({
        id: a.id,
        text: a.achievement_text,
        category: a.category || 'general'
      }))
      // Filter likely third-person achievements
      .filter(a => !/\b(his|her|their)\b/i.test(a.text));
    
    console.log(`Found ${achievements?.length || 0} achievements, ${recentAchievements.length} fresh (not mentioned before)`);
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
    // Also skip topics that have been discussed too frequently (e.g., "crucial conversations")
    const { data: recentSummaries } = await supabase
      .from('conversation_summaries')
      .select('summary_text, key_topics, action_items, emotional_tone, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Track topics discussed in the last 7 days to avoid repetition
    const sevenDaysAgoTs = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentTopics = (recentSummaries || [])
      .filter(s => s.created_at >= sevenDaysAgoTs)
      .flatMap(s => (s.key_topics || []).map((k: string) => String(k).toLowerCase()));
    
    // Count topic frequency - if a topic appears 3+ times in 7 days, filter it out
    const topicCounts: Record<string, number> = {};
    recentTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
    const overusedTopics = Object.entries(topicCounts)
      .filter(([_, count]) => count >= 3)
      .map(([topic]) => topic);
    
    // HARDCODED BLOCKLIST - topics that should NEVER appear in podcasts regardless of frequency
    const blockedTopics = [
      'crucial conversation', 'crucial conversations', 'difficult conversation',
      'test conversation', 'demo', 'example topic'
    ];
    
    // Combine blocklist with dynamically overused topics
    const allBlockedTopics = [...new Set([...overusedTopics, ...blockedTopics])];
    
    console.log('Overused topics (filtering from podcast):', overusedTopics);
    console.log('All blocked topics:', allBlockedTopics);

    const safeSummary = (recentSummaries || []).find(s => {
      const topics = (s.key_topics || []).map((k: string) => String(k).toLowerCase());
      const text = (s.summary_text || '').toLowerCase();
      // Skip recognition topics, overused topics, AND blocked topics
      const hasBlocked = topics.some((t: string) => 
        allBlockedTopics.some(blocked => t.includes(blocked) || blocked.includes(t))
      );
      const textHasBlocked = allBlockedTopics.some(blocked => text.includes(blocked));
      return !topics.includes('recognition') && !text.includes('send recognition') && !hasBlocked && !textHasBlocked;
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

    // Fetch 90-day goals - ONLY current year goals (no old 2025 goals)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.ceil((currentDate.getMonth() + 1) / 3);
    const currentQuarterName = `Q${currentQuarter}`;
    
    // Get goals from current year only, prioritizing current quarter
    const { data: goals } = await supabase
      .from('ninety_day_targets')
      .select('goal_text, completed, benchmarks, sprints, goal_type, category, created_at, quarter, year')
      .eq('profile_id', profileId)
      .eq('completed', false)
      .eq('year', currentYear) // STRICT: Only current year (2026)
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

    // Fetch both personal and professional visions from personal_goals table
    // Note: The table uses separate columns for professional vs personal visions (not goal_type)
    const { data: goalsData } = await supabase
      .from('personal_goals')
      .select('one_year_vision, three_year_vision, personal_one_year_vision, personal_three_year_vision')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    const goalsRow = goalsData?.[0];
    const professionalVision = goalsRow?.one_year_vision || goalsRow?.three_year_vision || null;
    const personalVision = goalsRow?.personal_one_year_vision || goalsRow?.personal_three_year_vision || null;

    console.log('Vision data:', { professionalVision: !!professionalVision, personalVision: !!personalVision });

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

    // Fetch diagnostic scores for closing summary
    const { data: diagnosticScoresData } = await supabase
      .from('diagnostic_scores')
      .select('clarity_score, engagement_score, burnout_score, career_score, manager_score, retention_score')
      .eq('profile_id', profileId)
      .order('calculated_at', { ascending: false })
      .limit(1);

    const diagnosticScores = diagnosticScoresData?.[0] ? {
      clarity: diagnosticScoresData[0].clarity_score,
      engagement: diagnosticScoresData[0].engagement_score,
      burnout: diagnosticScoresData[0].burnout_score,
      career: diagnosticScoresData[0].career_score,
      manager: diagnosticScoresData[0].manager_score,
      retention: diagnosticScoresData[0].retention_score,
    } : null;

    console.log('Diagnostic scores:', diagnosticScores);

    // Fetch recognition GIVEN by the user (last 14 days)
    const { data: recognitionGivenData } = await supabase
      .from('recognition_notes')
      .select(`
        id,
        title,
        recognition_date,
        given_to,
        profiles!recognition_notes_given_to_fkey (full_name)
      `)
      .eq('given_by', profileId)
      .gte('recognition_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('recognition_date', { ascending: false })
      .limit(10);

    // Filter out already-mentioned recognitions given (ONCE EVER rule)
    const freshRecognitionGiven = (recognitionGivenData || []).filter(r => !usedRecognitionGivenIds.has(r.id));
    
    const recognitionGiven = freshRecognitionGiven.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      recipientName: (r.profiles as any)?.full_name?.split(' ')[0] || 'a teammate',
      recognitionDate: r.recognition_date
    }));

    console.log(`Found ${recognitionGivenData?.length || 0} recognitions given, ${recognitionGiven.length} fresh`);

    // Fetch user badges (last 30 days for recency, but show recent ones)
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select(`
        id,
        earned_at,
        badge_id,
        badges (name, description, requirement_type, requirement_value, tier)
      `)
      .eq('profile_id', profileId)
      .order('earned_at', { ascending: false })
      .limit(10);

    // Filter out already-mentioned badges (ONCE EVER rule)
    const freshBadges = (userBadges || []).filter(ub => !usedBadgeIds.has(ub.id));
    
    const badges = freshBadges.slice(0, 3).map(ub => ({
      id: ub.id,
      name: (ub.badges as any)?.name || 'Badge',
      description: (ub.badges as any)?.description || '',
      earnedAt: ub.earned_at
    }));
    
    console.log(`Found ${userBadges?.length || 0} badges, ${badges.length} fresh`);

    // Determine next badge hint based on what they don't have
    const badgeTypes = (userBadges || []).map(ub => (ub.badges as any)?.requirement_type);
    let nextBadgeHint: string | null = null;
    if (!badgeTypes.includes('login_streak')) {
      nextBadgeHint = 'Keep logging in daily to earn a Consistency badge!';
    } else if (!badgeTypes.includes('habit_streak')) {
      nextBadgeHint = 'Build a 7-day habit streak to unlock a Habit Champion badge!';
    } else if (!badgeTypes.includes('recognition_given')) {
      nextBadgeHint = 'Recognize 3 teammates to earn a Team Builder badge!';
    } else if (!badgeTypes.includes('resources_completed')) {
      nextBadgeHint = 'Complete 5 learning resources to earn a Knowledge Seeker badge!';
    }

    console.log(`Found ${badges.length} badges, next hint: ${nextBadgeHint}`);

    // Fetch leaderboard position
    const { data: allEmployeePoints } = await supabase
      .from('profiles')
      .select('id, growth_points')
      .eq('company_id', companyId)
      .not('growth_points', 'is', null)
      .order('growth_points', { ascending: false });

    let leaderboardPosition: number | null = null;
    let totalEmployees: number | null = null;
    if (allEmployeePoints && allEmployeePoints.length > 0) {
      totalEmployees = allEmployeePoints.length;
      const userIndex = allEmployeePoints.findIndex(e => e.id === profileId);
      if (userIndex !== -1) {
        leaderboardPosition = userIndex + 1;
      }
    }

    console.log(`Leaderboard: position ${leaderboardPosition} of ${totalEmployees}`);

    // Determine underutilized features based on missing data
    const underutilizedFeatures: string[] = [];
    if (!personalVision && !professionalVision) {
      underutilizedFeatures.push('Set your personal and professional vision in Settings to help tailor your growth journey');
    }
    if (!topHabit) {
      underutilizedFeatures.push('Create a daily habit in the Habits section to build consistency and earn badges');
    }
    if ((capabilities || []).length === 0) {
      underutilizedFeatures.push('Head to My Capabilities to identify skills you want to develop');
    }
    if (!activeGoal) {
      underutilizedFeatures.push('Set a 90-day goal in My Growth Plan to focus your development');
    }
    if (recentRecognitions.length === 0 && recognitionGiven.length === 0) {
      underutilizedFeatures.push('Use the Recognition feature to celebrate your teammates and build team culture');
    }
    if (!diagnosticScores) {
      underutilizedFeatures.push('Complete your diagnostic assessment to unlock personalized insights and track your growth scores');
    }

    console.log(`Underutilized features: ${underutilizedFeatures.length}`);

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
      professionalVision,
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
      recognitionGiven,
      managerWins,
      lastOneOnOneDate,
      pendingFollowUps,
      recentConversationSummary,
      inspirationalQuote: todayQuote,
      diagnosticScores,
      badges,
      nextBadgeHint,
      leaderboardPosition,
      totalEmployees,
      underutilizedFeatures,
    };

    console.log('Enhanced podcast context:', JSON.stringify(context, null, 2));

    // Duration-based parameters - INCREASED word counts by ~20%
    const durationConfig: Record<number, { words: string; structure: string; maxTokens: number }> = {
      2: {
        words: '400-480 words',
        structure: `Structure (keep to ~400-480 words total for 2-2.5 minute audio):
1. Opening (15 sec, ~35 words): Greet by name with genuine warmth and energy
2. Accountability Check (15 sec, ~30 words): Quick reference to yesterday's challenge or their consistency
3. Personal Win (20 sec, ~45 words): Celebrate a specific achievement or progress
4. Growth Insight (40 sec, ~85 words): One punchy insight related to today's capability focus
5. Daily Challenge (20 sec, ~45 words): Specific, SHORT micro-challenge - one sentence max
6. Quick Pulse Check (25 sec, ~55 words): Quick rundown of their diagnostic scores if available - keep it encouraging
7. Recognition Shoutout (15 sec, ~35 words): If they gave recognition to others, acknowledge their leadership in lifting others up
8. Warm Closing (20 sec, ~45 words): Genuine, warm sign-off - make them feel seen and supported

PACING: Keep the energy UP! Quick transitions, punchy delivery. Emphasize key words. End on a HIGH note with genuine warmth - not cold or abrupt.`,
        maxTokens: 1400
      },
      5: {
        words: '550-650 words',  // Target ~3.5 min actual audio
        structure: `Structure (keep to ~550-650 words total for ~3.5 minute audio - keep the pace MOVING):
1. Opening (15 sec, ~35 words): Energetic greeting by name, quick ${dayTheme.name} theme hook
2. Quick Win (20 sec, ~45 words): ONE highlight - best achievement, recognition, or streak
3. Capability Focus (60 sec, ~120 words): Punchy insight on today's capability with ONE actionable tip
4. Goal Progress (45 sec, ~90 words): Current quarter goal status - focus on next sprint/benchmark, not the 90-day outcome
5. Daily Challenge (25 sec, ~50 words): Clear, specific, SHORT challenge for today
6. Pulse Check (20 sec, ~45 words): Quick diagnostic scores rundown if available
7. Recognition Shoutout (15 sec, ~35 words): Acknowledge any recognition they gave to teammates
8. Warm Closing (25 sec, ~55 words): Connect to vision, genuinely warm sign-off - leave them feeling supported

PACING: Keep it punchy! No rambling. Each section should feel tight and purposeful. End warm, not cold.`,
        maxTokens: 1800
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

    // Generate script using Lovable AI with solo host format
    const systemPrompt = `You are writing a ${durationMinutes}-minute personal growth podcast. You are the host - a warm, caring growth coach who genuinely knows and cares about this person's growth journey.

THE HOST STYLE:
${PODCAST_HOSTS.primary.role}

${CONVERSATION_FORMAT}

Today's Theme: ${dayTheme.name} - ${dayTheme.focus}
${dayTheme.additionalInstructions}

${config.structure}

CRITICAL FORMATTING RULES:
- Write as a solo monologue WITHOUT any speaker labels
- Do NOT include "HOST:" or any prefix - just write the words to be spoken
- Speak directly TO the listener throughout
- Keep it conversational and warm, but direct and actionable
- Natural pacing with brief pauses for emphasis

GENERAL RULES:
- Write for spoken audio - use contractions, simple sentences, natural pauses
- Include [pause] markers for dramatic effect (use sparingly, 2-4 per episode max)
- If data is missing, skip that section gracefully
- Never say "according to your data" - just state things naturally
- CRITICAL: Capability levels must be Level 1 / Level 2 / Level 3 / Level 4 only
- If target level EQUALS current level, tell them to stretch higher via My Capabilities
- If 30-day benchmarks or 7-day sprints are missing, be direct about adding them
- CRITICAL: Only reference CURRENT QUARTER goals
- Target approximately ${config.words}
- IMPORTANT: Do NOT include stage directions, audio cues, or production notes
- CRITICAL: Do NOT use asterisks, markdown formatting, or text emphasis markers
- CRITICAL: Do NOT use time-of-day greetings. Use timeless greetings like "Hey [name]"
- Open warmly, deliver all content, and close with the daily challenge

DAILY CHALLENGE RULES:
- Keep challenges SHORT: 1-2 sentences max, under 20 words
- Make them specific and immediately actionable
- Examples: "Have one 5-minute conversation with a peer about your progress" or "Send a quick thank-you message to someone who helped you this week"
- NOT lengthy multi-part challenges or vague instructions`;

    const userPrompt = `Create today's ${durationMinutes}-minute solo podcast script for this user:

User Context:
- Name: ${context.userName}
- Day: ${context.dayOfWeek} (${dayTheme.name} theme)
- Login streak: ${context.loginStreak > 0 ? `${context.loginStreak} consecutive days` : 'Just getting started'}

Yesterday's Challenge: ${context.yesterdayChallenge || 'None given (first episode or break)'}

${context.pendingFollowUps.length > 0 
  ? `COACHING FOLLOW-UPS (from recent conversations):
${context.pendingFollowUps.map(f => `- ${f.topic}${f.context?.action_items?.length > 0 ? ` (committed to: ${f.context.action_items.map((a: any) => a.item || a).join(', ')})` : ''}`).join('\n')}`
  : ''}

${context.recentConversationSummary 
  ? `Recent Coaching Summary: ${context.recentConversationSummary}`
  : ''}

${allBlockedTopics.length > 0 
  ? `⚠️ NEVER DISCUSS THESE TOPICS: ${allBlockedTopics.join(', ')}`
  : ''}

Habits & Streaks:
- Top habit: ${context.habitStreak > 0 ? `"${context.habitName}" with a ${context.habitStreak}-day streak` : 'No active streak yet'}

Recent Achievements (last 7 days):
${context.recentAchievements.length > 0 
  ? context.recentAchievements.map(a => `- ${a.category}: "${a.text}"`).join('\n')
  : '- None recorded'}

${context.recentRecognitions.length > 0 
  ? `Recognition received:\n${context.recentRecognitions.map(r => `- "${r.title}" from ${r.givenByName}`).join('\n')}`
  : ''}

${context.managerWins && context.managerWins.length > 0
  ? `Manager wins: ${context.managerWins.join('; ')}`
  : ''}

TODAY'S Capability Focus:
- Primary: ${context.priorityCapability || 'Not set'} (Currently at ${context.capabilityLevel || 'unassessed'}, Target: ${context.targetLevel || 'growth'})
${context.capabilityLevel === context.targetLevel ? `⚠️ SAME LEVEL - needs to stretch higher!` : ''}
${detectLevelRegression(context.capabilityLevel, context.targetLevel) ? `⚠️ TARGET IS LOWER THAN CURRENT - This looks like a data entry mistake! Encourage them to go to My Capabilities, click Self-Assess, and update their target to Level 4 or at least match their current level. Don't suggest they should be working "toward" a lower level.` : ''}
- Description: ${context.capabilityDescription || 'A key skill for their role'}

ALL Their Capabilities (feel free to reference ANY of these casually in conversation):
${context.allPriorityCapabilities.length > 0 
  ? context.allPriorityCapabilities.map((c, i) => `${i + 1}. ${c.name} (${c.level} → ${c.target})`).join('\n')
  : '- No capabilities assigned yet'}

🎯 COACHING FREEDOM: You have full permission to:
- Reference ANY of the capabilities above naturally in conversation
- Go deeper on ONE specific topic if it feels right (don't spread too thin)
- Connect capabilities to each other ("Your communication skills will help with that leadership challenge...")
- Mention capabilities they haven't focused on in a while to keep them top of mind
- Vary your focus day-to-day - don't always hit the same capability

Goal & Execution:
- Goal: ${context.activeGoal || 'No current quarter goal'}
${context.goalBenchmarks.length > 0 
  ? `- Benchmarks (${context.completedBenchmarks}/${context.totalBenchmarks}): ${context.goalBenchmarks.slice(0, 2).map(b => `${b.completed ? '✓' : '○'} ${b.text}`).join('; ')}`
  : '⚠️ NO BENCHMARKS SET'}
${context.goalSprints.length > 0 
  ? `- Sprints: ${context.goalSprints.slice(0, 2).map(s => `${s.completed ? '✓' : '○'} ${s.text}`).join('; ')}`
  : '⚠️ NO SPRINTS SET'}

${!context.activeGoal || context.goalBenchmarks.length === 0 || context.goalSprints.length === 0 
  ? `MISSING PLAN - Call this out directly and tell them to set it up in My Growth Plan.` 
  : ''}

ROTATION RULES:
- Mention 90-day outcome only if: ${canMentionOutcomeToday ? 'YES' : 'NO - focus on sprints/benchmarks'}

Personal Vision (life/personal goals): ${context.personalVision || 'Not yet set'}
Professional Vision (career goals): ${context.professionalVision || 'Not yet set'}
${!context.personalVision && !context.professionalVision ? `💡 TIP: Encourage them to set their vision in Settings - it helps personalize their growth journey!` : ''}
Strength: ${context.diagnosticStrength || 'Not assessed'}
Growth area: ${context.diagnosticGrowthArea || 'Not assessed'}

${context.diagnosticScores ? `DIAGNOSTIC PULSE (HIGHER SCORES = BETTER! This is positive data):
- Role Clarity: ${context.diagnosticScores.clarity ?? 'N/A'}% ${(context.diagnosticScores.clarity ?? 0) >= 70 ? '✨ Strong!' : ''}
- Engagement: ${context.diagnosticScores.engagement ?? 'N/A'}% ${(context.diagnosticScores.engagement ?? 0) >= 70 ? '✨ Strong!' : ''}
- Burnout RESILIENCE: ${context.diagnosticScores.burnout ?? 'N/A'}% ${(context.diagnosticScores.burnout ?? 0) >= 70 ? '✨ Healthy!' : '(higher = more resilient)'}
- Career Growth: ${context.diagnosticScores.career ?? 'N/A'}% ${(context.diagnosticScores.career ?? 0) >= 70 ? '✨ On track!' : ''}
- Manager Support: ${context.diagnosticScores.manager ?? 'N/A'}% ${(context.diagnosticScores.manager ?? 0) >= 70 ? '✨ Great support!' : ''}
- Retention Confidence: ${context.diagnosticScores.retention ?? 'N/A'}% ${(context.diagnosticScores.retention ?? 0) >= 70 ? '✨ Committed!' : ''}
IMPORTANT: ALL scores are positive - higher is ALWAYS better. Celebrate high scores! For lower scores, frame as "opportunities we're building together."
Only mention 2-3 scores - pick a mix of their strongest and one growth area.` : `NO DIAGNOSTIC DATA - encourage them to complete their assessment to unlock personalized growth insights!`}

${context.badges.length > 0 
  ? `🏆 BADGES EARNED:
${context.badges.slice(0, 3).map(b => `- ${b.name}: ${b.description}`).join('\n')}
Celebrate their achievements! Reference a recent badge if relevant.`
  : `NO BADGES YET - mention they can earn badges through consistent habits, giving recognition, and completing learning!`}

${context.nextBadgeHint ? `💡 NEXT BADGE HINT: ${context.nextBadgeHint}` : ''}

${context.leaderboardPosition && context.totalEmployees 
  ? `📊 LEADERBOARD: #${context.leaderboardPosition} out of ${context.totalEmployees} teammates!
${context.leaderboardPosition <= 3 ? 'They\'re a TOP performer - celebrate this!' : context.leaderboardPosition <= Math.ceil(context.totalEmployees / 2) ? 'Solid position - encourage them to keep climbing!' : 'Encourage consistent engagement to climb the ranks!'}`
  : ''}

${context.recognitionGiven.length > 0 
  ? `RECOGNITION GIVEN (acknowledge their leadership in lifting others):
${context.recognitionGiven.map(r => `- "${r.title}" to ${r.recipientName}`).join('\n')}
Praise them for being the kind of leader who sees and celebrates others!`
  : ''}

${context.underutilizedFeatures.length > 0 
  ? `🎓 SYSTEM TIPS (pick ONE to mention naturally - help them get more from Jericho):
${context.underutilizedFeatures.slice(0, 2).map(f => `- ${f}`).join('\n')}
Work this in casually, like "Hey, one thing I'd love you to try..." - don't lecture!`
  : ''}

SCRIPT FORMAT REQUIREMENTS:
1. Open warmly with their name: "Hey ${context.userName}!"
2. NO speaker labels - just write the words to be spoken
3. Solo monologue format - speak directly to the listener throughout
4. Deliver coaching insights with warmth and authority
5. Give the daily challenge - KEEP IT SHORT (1 sentence, under 15 words)
6. If diagnostic scores exist, mention 2-3 highlights - CELEBRATE the high ones!
7. If no diagnostics, encourage completing the assessment
8. Reference badges, leaderboard position, or vision when relevant (don't force all of them)
9. If they gave recognition, acknowledge them for lifting up their teammates
10. Optionally drop ONE system tip if there's something they're underutilizing
11. Close with GENUINE WARMTH - make them feel seen, supported, and cheered on. NOT cold or abrupt.

VARIETY: Don't hit everything every day! Rotate focus based on what's most relevant:
- Some days focus on vision and purpose
- Some days celebrate badges and leaderboard
- Some days give a system tip
- Always keep it feeling fresh and personalized

CLOSING ENERGY: End on a HIGH note. Something like "I'm so proud of you" or "You've got this and I'll be right here cheering you on" - genuine, warm, personal. NOT just "Have a great day!"

Remember: Write WITHOUT speaker labels. Just the words to be spoken. Keep it warm, direct, and end with HEART!`;

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

    // RECORD CONTENT USAGE - prevents repetitive mentions in future episodes
    const todayDate = new Date().toISOString().split('T')[0];
    const contentUsageRecords: { profile_id: string; content_type: string; content_id: string; episode_date: string }[] = [];
    
    // Record achievements mentioned
    for (const a of recentAchievements) {
      contentUsageRecords.push({
        profile_id: profileId,
        content_type: 'achievement',
        content_id: (a as any).id,
        episode_date: todayDate
      });
    }
    
    // Record recognitions received mentioned
    for (const r of recentRecognitions) {
      contentUsageRecords.push({
        profile_id: profileId,
        content_type: 'recognition_received',
        content_id: r.id,
        episode_date: todayDate
      });
    }
    
    // Record recognition given mentioned
    for (const r of recognitionGiven) {
      contentUsageRecords.push({
        profile_id: profileId,
        content_type: 'recognition_given',
        content_id: r.id,
        episode_date: todayDate
      });
    }
    
    // Record badges mentioned
    for (const b of badges) {
      contentUsageRecords.push({
        profile_id: profileId,
        content_type: 'badge',
        content_id: b.id,
        episode_date: todayDate
      });
    }
    
    // Record habit milestone if applicable (celebrate at 5, 10, 15, 30, 60, 90 day thresholds)
    const habitMilestones = [5, 10, 15, 30, 60, 90];
    if (topHabit && topHabit.current_streak > 0) {
      const threshold = habitMilestones.find(m => topHabit.current_streak >= m);
      if (threshold) {
        const habitId = (topHabit as any).id || 'unknown';
        const existingThresholds = usedHabitMilestones.get(habitId) || [];
        if (!existingThresholds.includes(threshold)) {
          contentUsageRecords.push({
            profile_id: profileId,
            content_type: 'habit_milestone',
            content_id: `${habitId}:${threshold}`,
            episode_date: todayDate
          });
        }
      }
    }
    
    // Insert all usage records (ignore conflicts from reruns)
    if (contentUsageRecords.length > 0) {
      const { error: usageError } = await supabase
        .from('podcast_content_usage')
        .upsert(contentUsageRecords, { onConflict: 'profile_id,content_type,content_id,episode_date', ignoreDuplicates: true });
      
      if (usageError) {
        console.error('Error recording content usage:', usageError);
      } else {
        console.log(`Recorded ${contentUsageRecords.length} content usage entries`);
      }
    }

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
