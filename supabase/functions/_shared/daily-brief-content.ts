import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export interface UserContext {
  firstName: string;
  episodeTitle: string;
  topics: string[];
  script: string;
  dailyChallenge: string | null;
  streakDays: number | null;
  habits: { name: string; currentStreak: number; completionsThisWeek: number }[];
  ninetyDayTargets: { title: string; progress: number; daysRemaining: number; benchmarks: { title: string; isCompleted: boolean }[] }[];
  topCapabilities: { name: string; currentLevel: string; targetLevel: string }[];
  recentAchievements: string[];
  personalVision: string | null;
  recognitionsSent: number;
  totalBenchmarks: number;
  completedBenchmarks: number;
  capabilityScore: number | null;
  totalCapabilities: number;
  focusCapability: string | null;
  appUrl: string;
  priorityTasks: { title: string; priority: string; dueDate: string | null }[];
  calendarEvents: { title: string; startTime: string; endTime: string; isAllDay: boolean; attendees: string[]; location: string | null }[];
}

export interface BriefContent {
  subject: string;
  body: string;
  shortSummary: string; // ~160 chars for SMS
}

export type BriefFormat = 'html' | 'markdown' | 'plain';

function getDaysRemaining(quarter: string, year: number): number {
  const quarterNum = parseInt(quarter?.replace('Q', '') || '1');
  const startMonth = (quarterNum - 1) * 3;
  const quarterEnd = new Date(year, startMonth + 3, 0);
  const now = new Date();
  return Math.max(0, Math.ceil((quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function gatherUserContext(supabase: any, profileId: string, userTimezone: string = 'America/New_York'): Promise<UserContext> {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const appUrl = 'https://askjericho.com';

  const [
    profileResult, episodeResult, habitsResult, habitCompletionsResult,
    targetsResult, capabilitiesResult, achievementsResult, visionResult,
    recognitionsResult, tasksResult
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, company_id").eq("id", profileId).maybeSingle(),
    supabase.from("podcast_episodes").select("*").eq("profile_id", profileId).eq("episode_date", today).maybeSingle(),
    supabase.from("leading_indicators").select("id, habit_name, current_streak").eq("profile_id", profileId).eq("is_active", true),
    supabase.from("habit_completions").select("habit_id").eq("profile_id", profileId).gte("completed_date", weekAgo),
    supabase.from("ninety_day_targets").select("id, goal_text, completed, quarter, year, benchmarks").eq("profile_id", profileId).eq("completed", false).eq("year", new Date().getFullYear()),
    supabase.from("employee_capabilities").select("current_level, target_level, priority, capabilities(name)").eq("profile_id", profileId).lte("priority", 3).order("priority"),
    supabase.from("achievements").select("achievement_text").eq("profile_id", profileId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(3),
    supabase.from("personal_visions").select("vision_statement").eq("profile_id", profileId).maybeSingle(),
    supabase.from("recognition_notes").select("id", { count: 'exact', head: true }).eq("given_by", profileId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("project_tasks").select("title, priority, due_date").eq("profile_id", profileId).in("column_status", ["todo", "in_progress"]).order("priority", { ascending: false }).limit(5),
  ]);

  const profile = profileResult.data;
  const episode = episodeResult.data;
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const habits = (habitsResult.data || []).map((h: any) => ({
    name: h.habit_name,
    currentStreak: h.current_streak || 0,
    completionsThisWeek: (habitCompletionsResult.data || []).filter((c: any) => c.habit_id === h.id).length
  }));

  const ninetyDayTargets = (targetsResult.data || []).map((t: any) => {
    let parsedBenchmarks: { title: string; isCompleted: boolean }[] = [];
    if (t.benchmarks) {
      if (typeof t.benchmarks === 'object' && t.benchmarks.text) {
        const lines = String(t.benchmarks.text).split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5).map((l: string) => l.replace(/^\*+\s*/, '').replace(/^\d+\.\s*/, '').trim()).filter((l: string) => l.length > 5);
        parsedBenchmarks = lines.map((l: string) => ({ title: l, isCompleted: false }));
      } else if (Array.isArray(t.benchmarks)) {
        parsedBenchmarks = t.benchmarks.map((b: any) => ({ title: typeof b === 'string' ? b : (b.text || b.title || String(b)), isCompleted: b.completed || b.isCompleted || false }));
      }
    }
    return {
      title: t.goal_text || 'Untitled Goal',
      progress: 0,
      daysRemaining: getDaysRemaining(t.quarter, t.year),
      benchmarks: parsedBenchmarks.slice(0, 5)
    };
  });

  const totalBenchmarks = ninetyDayTargets.reduce((sum: number, t: any) => sum + t.benchmarks.length, 0);
  const completedBenchmarks = ninetyDayTargets.reduce((sum: number, t: any) => sum + t.benchmarks.filter((b: any) => b.isCompleted).length, 0);

  const allCapabilities = (capabilitiesResult.data || []).filter((c: any) => c.capabilities?.name);
  const topCapabilities = allCapabilities.map((c: any) => ({ name: c.capabilities.name, currentLevel: c.current_level || 'Not assessed', targetLevel: c.target_level || 'Not set' }));

  const levelOrder = ['foundational', 'level 1', 'advancing', 'level 2', 'independent', 'level 3', 'mastery', 'level 4'];
  const getLevelIndex = (level: string) => { const n = (level || '').toLowerCase(); const idx = levelOrder.findIndex(l => n.includes(l) || l.includes(n)); return idx >= 0 ? Math.floor(idx / 2) : 0; };
  const assessedCaps = allCapabilities.filter((c: any) => c.current_level && c.target_level);
  const capabilityScore = assessedCaps.length > 0 ? Math.round((assessedCaps.filter((c: any) => getLevelIndex(c.current_level) >= getLevelIndex(c.target_level)).length / assessedCaps.length) * 100) : null;

  const { data: streakRow } = await supabase.from("login_streaks").select("current_streak, last_login_date").eq("profile_id", profileId).single();
  let streakDays: number | null = null;
  if (streakRow?.last_login_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    streakDays = (streakRow.last_login_date === todayStr || streakRow.last_login_date === yesterday) ? (streakRow.current_streak || 0) : 0;
  }

  const focusCapability = episode?.capability_name || topCapabilities[0]?.name || null;

  // Fetch today's calendar events if Google is connected
  let calendarEvents: { title: string; startTime: string; endTime: string; isAllDay: boolean; attendees: string[]; location: string | null }[] = [];
  try {
    const { data: googleIntegration } = await supabase
      .from('user_integrations')
      .select('id, sync_status')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .eq('sync_status', 'connected')
      .maybeSingle();

    if (googleIntegration) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const calResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: profileId }),
      });

      if (calResponse.ok) {
        const calData = await calResponse.json();
        // Get today's date in user's timezone for proper filtering
        const userNow = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));
        const todayUser = userNow.toISOString().split('T')[0];
        
        calendarEvents = (calData.events || [])
          .filter((e: any) => {
            const isAllDay = !e.start?.dateTime && !!e.start?.date;
            if (isAllDay) {
              const startDate = e.start.date;
              const endDate = e.end?.date || startDate;
              return startDate <= todayUser && todayUser < endDate;
            } else {
              const eventLocal = new Date(new Date(e.start.dateTime).toLocaleString('en-US', { timeZone: userTimezone }));
              const eventDateStr = eventLocal.toISOString().split('T')[0];
              return eventDateStr === todayUser;
            }
          })
          .map((e: any) => {
            const isAllDay = !e.start?.dateTime && !!e.start?.date;
            return {
              title: e.summary || 'Untitled',
              startTime: isAllDay ? '' : e.start.dateTime,
              endTime: isAllDay ? '' : (e.end?.dateTime || ''),
              isAllDay,
              attendees: (e.attendees || []).map((a: any) => a.displayName || a.email || '').filter(Boolean),
              location: e.location || null,
            };
          })
          .slice(0, 10);
      }
    }
  } catch (calErr) {
    console.error('[daily-brief-content] Calendar fetch error (non-fatal):', calErr);
  }

  return {
    firstName,
    episodeTitle: episode?.title || "Your Daily Growth Brief",
    topics: episode?.topics_covered || [],
    script: episode?.script || '',
    dailyChallenge: episode?.daily_challenge || null,
    streakDays,
    habits,
    ninetyDayTargets,
    topCapabilities,
    recentAchievements: (achievementsResult.data || []).map((a: any) => a.achievement_text),
    personalVision: visionResult.data?.vision_statement || null,
    recognitionsSent: (recognitionsResult as any).count || 0,
    totalBenchmarks,
    completedBenchmarks,
    capabilityScore,
    totalCapabilities: allCapabilities.length,
    focusCapability,
    appUrl,
    priorityTasks: (tasksResult.data || []).map((t: any) => ({ title: t.title, priority: t.priority, dueDate: t.due_date })),
    calendarEvents,
  };
}

export async function generateBriefContent(context: UserContext, format: BriefFormat): Promise<BriefContent> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const formatInstruction = format === 'html'
    ? 'Format the "body" as HTML using <p>, <strong>, <a> tags. Keep it scannable.'
    : format === 'markdown'
    ? 'Format the "body" as Telegram-compatible Markdown. Use *bold*, _italic_, and plain text. No HTML. Keep it mobile-friendly and concise (~200 words).'
    : 'Format the "body" as plain text. No HTML, no markdown. Keep it very concise (~150 words).';

  const linkInstruction = format === 'html'
    ? `Use <a href="..."> for links. Valid routes: ${context.appUrl}/dashboard/my-growth-plan, ${context.appUrl}/dashboard/my-resources, ${context.appUrl}/dashboard/my-capabilities, ${context.appUrl}/dashboard/personal-assistant`
    : format === 'markdown'
    ? `For links use: [text](url). Valid routes: ${context.appUrl}/dashboard/my-growth-plan, ${context.appUrl}/dashboard/personal-assistant`
    : `Mention the app URL ${context.appUrl} once at the end.`;

  const systemPrompt = `You are Jericho, a warm AI growth coach. Write a personalized daily briefing.

Voice: Warm, encouraging, practical, conversational, data-informed.

Structure:
1. Warm greeting
2. Today's schedule snapshot (from calendar, if available — mention key meetings and who they're with)
3. Top 3-5 priorities for today (from their task list)
4. Quick 90-day goal status
5. Habit tracker summary
6. Today's learning focus (specific capability name)
7. Daily challenge
8. A "Quick Reflect" question — ONE short question that connects to something from their playbook, a recent goal, or today's challenge. Frame it as something they can reply to answer. Keep it to one sentence, make it specific to them, and always start with "Quick reflect:"
9. Motivating sign-off

IMPORTANT: The Quick Reflect question MUST be specific to this person — reference a goal, habit, challenge, or something from their recent history. Never ask a generic question.

${formatInstruction}
${linkInstruction}

ALSO generate a "shortSummary" field: a ~140 character plain text summary suitable for SMS. Include one key insight and the app URL.

Return JSON: { "subject": "...", "body": "...", "shortSummary": "..." }`;

  const userPrompt = `Write today's briefing for ${context.firstName}.

${context.personalVision ? `Vision: "${context.personalVision}"` : ''}
Focus Capability: ${context.focusCapability || 'Growth & Development'}

90-Day Targets (${context.ninetyDayTargets.length}):
${context.ninetyDayTargets.map(t => `- ${t.title}: ${t.daysRemaining} days left`).join('\n') || 'None set'}

Habits: ${context.habits.map(h => `${h.name} (${h.currentStreak}d streak)`).join(', ') || 'None'}
${context.streakDays ? `Login Streak: ${context.streakDays} days` : ''}

Tasks:
${context.priorityTasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]`).join('\n') || 'No tasks'}

Capabilities: ${context.topCapabilities.map(c => `${c.name}: ${c.currentLevel} → ${c.targetLevel}`).join(', ') || 'None'}

TODAY'S CALENDAR (${context.calendarEvents.length} events):
${context.calendarEvents.length > 0
  ? context.calendarEvents.map(e => {
      let timeLabel: string;
      if (e.isAllDay) {
        timeLabel = 'All day';
      } else if (e.startTime) {
        // Convert to Eastern time for display
        const eventDate = new Date(e.startTime);
        timeLabel = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
      } else {
        timeLabel = 'All day';
      }
      const attendeeList = e.attendees.length > 0 ? ` with ${e.attendees.slice(0, 3).join(', ')}` : '';
      return `- ${timeLabel}: ${e.title}${attendeeList}${e.location ? ` (${e.location})` : ''}`;
    }).join('\n')
  : 'No calendar connected or no events today'}

${context.dailyChallenge ? `Challenge: ${context.dailyChallenge}` : ''}
${context.recentAchievements.length > 0 ? `Recent wins: ${context.recentAchievements.join(', ')}` : ''}`;

  if (!LOVABLE_API_KEY) {
    return {
      subject: `Hey ${context.firstName}, your daily growth update`,
      body: format === 'html'
        ? `<p>Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!</p>`
        : `Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!`,
      shortSummary: `${context.firstName}, check in on your goals today! ${context.appUrl}`
    };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) throw new Error(`AI gateway error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No AI content");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || `Hey ${context.firstName}, your daily growth update`,
        body: parsed.body || `Hey ${context.firstName}, check in today!`,
        shortSummary: (parsed.shortSummary || `${context.firstName}, check your growth plan today! ${context.appUrl}`).substring(0, 160)
      };
    }
    throw new Error("Could not parse AI JSON");
  } catch (error) {
    console.error("Brief content generation error:", error);
    return {
      subject: `Hey ${context.firstName}, your daily growth update`,
      body: format === 'html'
        ? `<p>Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!</p>`
        : `Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!`,
      shortSummary: `${context.firstName}, check in on your goals today! ${context.appUrl}`
    };
  }
}
