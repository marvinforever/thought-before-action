import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export interface PlaybookContext {
  narrativeHighlights: string | null; // Key paragraph from playbook narrative
  quickWin: { title: string; description: string; steps: string[] } | null;
  priorityActions: { title: string; description: string }[];
  recommendedResources: { title: string; contentType: string; capabilityName: string }[];
  topCapabilityInsights: { name: string; currentLevel: string; targetLevel: string; coaching: string }[];
}

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
  // New: evidence-based progress
  resourcesCompletedThisWeek: number;
  quickWinStatus: string | null; // 'accepted' | 'rejected' | 'completed' | null
  quickWinStepsTotal: number;
  quickWinStepsDone: number;
  capabilitiesStarted: string[];
  priorityActionsCompleted: number;
  priorityActionsTotal: number;
  lastJerichoChat: string | null; // ISO date
  daysOnPlatform: number;
  hasCalendarConnected: boolean;
  // Playbook-driven context
  playbook: PlaybookContext | null;
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
    recognitionsResult, tasksResult, playbookInteractionsResult,
    lastConversationResult, playbookResult
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, company_id, created_at").eq("id", profileId).maybeSingle(),
    supabase.from("podcast_episodes").select("*").eq("profile_id", profileId).eq("episode_date", today).maybeSingle(),
    supabase.from("leading_indicators").select("id, habit_name, current_streak").eq("profile_id", profileId).eq("is_active", true),
    supabase.from("habit_completions").select("habit_id").eq("profile_id", profileId).gte("completed_date", weekAgo),
    supabase.from("ninety_day_targets").select("id, goal_text, completed, quarter, year, benchmarks").eq("profile_id", profileId).eq("completed", false).eq("year", new Date().getFullYear()),
    supabase.from("employee_capabilities").select("current_level, target_level, priority, capabilities(name)").eq("profile_id", profileId).lte("priority", 3).order("priority"),
    supabase.from("achievements").select("achievement_text").eq("profile_id", profileId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(3),
    supabase.from("personal_visions").select("vision_statement").eq("profile_id", profileId).maybeSingle(),
    supabase.from("recognition_notes").select("id", { count: 'exact', head: true }).eq("given_by", profileId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("project_tasks").select("title, priority, due_date").eq("profile_id", profileId).in("column_status", ["todo", "in_progress"]).order("priority", { ascending: false }).limit(5),
    // Playbook interactions from the last week
    supabase.from("playbook_interactions").select("section_type, section_key, interaction_type").eq("profile_id", profileId).gte("created_at", weekAgo),
    // Last Jericho conversation
    supabase.from("conversations").select("created_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(1),
    // Playbook (latest individual playbook)
    supabase.from("leadership_reports").select("report_content, capability_matrix").eq("profile_id", profileId).eq("report_type", "individual_playbook").eq("status", "generated").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const episode = episodeResult.data;
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  // Calculate days on platform
  const daysOnPlatform = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

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

  // Parse playbook interactions for evidence-based reporting
  const pbInteractions = playbookInteractionsResult.data || [];
  const resourcesCompletedThisWeek = pbInteractions.filter((i: any) => i.section_type === 'resource' && i.interaction_type === 'completed').length;
  const quickWinInteraction = pbInteractions.find((i: any) => i.section_type === 'quick_win');
  const quickWinStatus = quickWinInteraction?.interaction_type || null;
  const quickWinStepsDone = pbInteractions.filter((i: any) => i.section_type === 'quick_win_step' && i.interaction_type === 'completed').length;
  const capabilitiesStarted = pbInteractions
    .filter((i: any) => i.section_type === 'capability' && i.interaction_type === 'started')
    .map((i: any) => i.section_key);
  const priorityActionsCompleted = pbInteractions.filter((i: any) => i.section_type === 'priority_action' && i.interaction_type === 'completed').length;
  const priorityActionsTotal = pbInteractions.filter((i: any) => i.section_type === 'priority_action').length;

  const lastJerichoChat = lastConversationResult.data?.[0]?.created_at || null;

  // Parse playbook content for richer daily briefs
  let playbookContext: PlaybookContext | null = null;
  try {
    const pbData = playbookResult.data;
    if (pbData) {
      const reportContent = pbData.report_content as any;
      const capMatrix = (pbData.capability_matrix || []) as any[];
      const narrative = reportContent?.narrative;

      // Extract narrative highlights (first key paragraph)
      let narrativeHighlights: string | null = null;
      if (narrative?.opening_hook) {
        narrativeHighlights = narrative.opening_hook;
      } else if (narrative?.executive_summary) {
        narrativeHighlights = narrative.executive_summary;
      }

      // Extract quick win from narrative
      let quickWin: PlaybookContext['quickWin'] = null;
      if (narrative?.quick_win) {
        const qw = narrative.quick_win;
        quickWin = {
          title: qw.title || 'Quick Win',
          description: qw.description || qw.text || '',
          steps: Array.isArray(qw.steps) ? qw.steps.map((s: any) => typeof s === 'string' ? s : s.text || String(s)) : [],
        };
      }

      // Extract priority actions from narrative
      const priorityActions: PlaybookContext['priorityActions'] = [];
      if (narrative?.priority_actions && Array.isArray(narrative.priority_actions)) {
        narrative.priority_actions.slice(0, 3).forEach((pa: any) => {
          priorityActions.push({
            title: pa.title || pa.action || '',
            description: pa.description || pa.rationale || '',
          });
        });
      }

      // Extract top capability insights with coaching tips from the matrix
      const topCapabilityInsights: PlaybookContext['topCapabilityInsights'] = [];
      const recommendedResources: PlaybookContext['recommendedResources'] = [];
      capMatrix.filter((c: any) => c.is_top3).slice(0, 3).forEach((cap: any) => {
        topCapabilityInsights.push({
          name: cap.capability_name || '',
          currentLevel: cap.current_level || '',
          targetLevel: cap.target_level || '',
          coaching: cap.growth_actions?.[0] || cap.development_focus || '',
        });
        // Gather recommended resources from each capability
        if (cap.recommended_resources && Array.isArray(cap.recommended_resources)) {
          cap.recommended_resources.slice(0, 2).forEach((r: any) => {
            recommendedResources.push({
              title: r.title || r.name || '',
              contentType: r.content_type || r.type || 'resource',
              capabilityName: cap.capability_name || '',
            });
          });
        }
      });

      playbookContext = {
        narrativeHighlights,
        quickWin,
        priorityActions,
        recommendedResources: recommendedResources.slice(0, 5),
        topCapabilityInsights,
      };
    }
  } catch (pbErr) {
    console.error('[daily-brief-content] Playbook parse error (non-fatal):', pbErr);
  }

  // Fetch today's calendar events if Google is connected
  let calendarEvents: { title: string; startTime: string; endTime: string; isAllDay: boolean; attendees: string[]; location: string | null }[] = [];
  let hasCalendarConnected = false;
  try {
    const { data: googleIntegration } = await supabase
      .from('user_integrations')
      .select('id, sync_status')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .eq('sync_status', 'connected')
      .maybeSingle();

    if (googleIntegration) {
      hasCalendarConnected = true;
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
    resourcesCompletedThisWeek,
    quickWinStatus,
    quickWinStepsTotal: 0, // Will be enriched from playbook data if available
    quickWinStepsDone,
    capabilitiesStarted,
    priorityActionsCompleted,
    priorityActionsTotal,
    lastJerichoChat,
    daysOnPlatform,
    hasCalendarConnected,
    playbook: playbookContext,
  };
}

export async function generateBriefContent(context: UserContext, format: BriefFormat): Promise<BriefContent> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Determine the user's timezone for calendar display
  const userTimezone = 'America/New_York'; // fallback — real timezone passed upstream

  const formatInstruction = format === 'html'
    ? 'Format the "body" as HTML using <p>, <strong>, <a> tags. Keep it scannable.'
    : format === 'markdown'
    ? 'Format the "body" as Telegram-compatible Markdown. Use *bold*, _italic_, and plain text. No HTML. Keep it mobile-friendly and concise (~200 words).'
    : 'Format the "body" as plain text. No HTML, no markdown. Keep it very concise (~150 words).';

  const linkInstruction = format === 'html'
    ? `Use <a href="..."> for links. Valid app routes:
  - ${context.appUrl}/dashboard/my-growth-plan (Growth Plan / Playbook)
  - ${context.appUrl}/dashboard/my-resources (Resources & Learning)
  - ${context.appUrl}/dashboard/my-capabilities (Capabilities)
  - ${context.appUrl}/dashboard/personal-assistant (Jericho AI Coach)
  - ${context.appUrl}/dashboard/sales (Sales Agent — for sales meetings/calls)
  - ${context.appUrl}/dashboard/settings (Settings & Integrations)`
    : format === 'markdown'
    ? `For links use: [text](url). Valid routes: ${context.appUrl}/dashboard/my-growth-plan, ${context.appUrl}/dashboard/personal-assistant, ${context.appUrl}/dashboard/sales`
    : `Mention the app URL ${context.appUrl} once at the end.`;

  const systemPrompt = `You are Jericho — a trusted advisor who is honest, direct, and supportive. You are NOT a cheerleader. You celebrate REAL progress backed by evidence, and you gently call out where things haven't moved.

CORE RULES:
1. NEVER give credit for things the user hasn't actually done. If data shows 0 resources completed, say so. If a habit streak is 0, don't pretend it's going well.
2. Celebrate PROVEN wins: completed tasks, maintained streaks, finished resources. These deserve genuine recognition.
3. For things that haven't progressed, be honest but constructive: "Your quick win hasn't been started yet — want to tackle one step today?"
4. Be specific. Reference actual numbers, names, and dates — not vague encouragement.
5. Suggest specific Jericho features that can help TODAY based on what's on their calendar and task list.

TONE: Like a mentor who respects you too much to BS you. Warm when warranted. Direct always. Think: "I'm telling you this because I believe in what you can do."

STRUCTURE:
1. Honest greeting — brief, no fluff. One line max.
2. TODAY'S SCHEDULE — If calendar is connected, highlight the most important meeting(s). For each notable meeting:
   - What it is and who's in it
   - A prep suggestion: "Before your call with [person], check [feature] in Jericho" (e.g., Sales Agent for customer calls, Growth Plan for 1:1s with manager)
   If no calendar: suggest connecting Google Calendar for smarter briefings
3. PROGRESS CHECK — Evidence-based status:
    - Resources completed this week (actual number)
   - Quick win status (accepted/in-progress/not started)
   - Capabilities being worked on (or not)
   - Habit streaks (real numbers, highlight gaps honestly)
   - 90-day goal progress (days remaining + benchmarks completed)
4. PLAYBOOK COACHING — If they have a Growth Playbook, weave in specific content from it:
   - Reference their Quick Win by name and nudge progress
   - Mention a specific Priority Action they should focus on today
   - Suggest a specific resource from their playbook that's relevant to today's meetings or tasks
   - Connect their capability coaching tips to what's on their calendar
   This should feel like you KNOW their playbook and are holding them accountable to it.
5. TODAY'S PRIORITIES — Top 2-3 actionable items from tasks, with specific next steps
6. JERICHO TIP — One specific feature suggestion relevant to today. Examples:
   - "You have a sales call at 2pm — open Sales Agent to prep with customer intel"
   - "Your 'Strategic Thinking' capability hasn't moved — try the curated resource in your Playbook"
   - "Haven't chatted with Jericho in X days — a quick check-in could help unblock your goal"
7. Quick Reflect — ONE specific question tied to something real in their data or playbook. Not generic.
8. Sign-off — One sentence. Honest, forward-looking.

${formatInstruction}
${linkInstruction}

Generate a "shortSummary" field: ~140 character plain text for SMS. Include one honest insight + app URL.

Return JSON: { "subject": "...", "body": "...", "shortSummary": "..." }`;

  // Build evidence-based context
  const progressSection = buildProgressEvidence(context);
  const calendarSection = buildCalendarContext(context);

  const userPrompt = `Write today's briefing for ${context.firstName}. Day ${context.daysOnPlatform} on the platform.

${context.personalVision ? `Vision: "${context.personalVision}"` : 'No vision set yet.'}
Focus Capability: ${context.focusCapability || 'None selected'}

── EVIDENCE-BASED PROGRESS ──
${progressSection}

── TODAY'S CALENDAR ──
${calendarSection}

── TASKS ──
${context.priorityTasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]${t.dueDate ? ` (due: ${t.dueDate})` : ''}`).join('\n') || 'No tasks set up yet.'}

── 90-DAY TARGETS (${context.ninetyDayTargets.length}) ──
${context.ninetyDayTargets.map(t => {
  const completedCount = t.benchmarks.filter(b => b.isCompleted).length;
  return `- ${t.title}: ${t.daysRemaining} days left, ${completedCount}/${t.benchmarks.length} benchmarks done`;
}).join('\n') || 'None set — suggest they create one in Growth Plan.'}

── HABITS ──
${context.habits.length > 0
  ? context.habits.map(h => `- ${h.name}: ${h.currentStreak}d streak, ${h.completionsThisWeek} completions this week`).join('\n')
  : 'No habits tracked yet.'}
${context.streakDays !== null ? `Login Streak: ${context.streakDays} days` : 'No login streak data.'}

── CAPABILITIES ──
${context.topCapabilities.length > 0
  ? context.topCapabilities.map(c => `- ${c.name}: ${c.currentLevel} → ${c.targetLevel}`).join('\n')
  : 'No capabilities assigned yet.'}
Capabilities actively being worked on: ${context.capabilitiesStarted.length > 0 ? context.capabilitiesStarted.join(', ') : 'None started yet'}

── GROWTH PLAYBOOK ──
${context.playbook ? `
${context.playbook.narrativeHighlights ? `Playbook Summary: "${context.playbook.narrativeHighlights}"` : ''}
${context.playbook.quickWin ? `Quick Win: "${context.playbook.quickWin.title}" — ${context.playbook.quickWin.description}${context.playbook.quickWin.steps.length > 0 ? `\n  Steps: ${context.playbook.quickWin.steps.map((s, i) => `${i + 1}. ${s}`).join(', ')}` : ''}` : ''}
${context.playbook.priorityActions.length > 0 ? `Priority Actions:\n${context.playbook.priorityActions.map(a => `- ${a.title}: ${a.description}`).join('\n')}` : ''}
${context.playbook.topCapabilityInsights.length > 0 ? `Capability Coaching:\n${context.playbook.topCapabilityInsights.map(c => `- ${c.name} (${c.currentLevel} → ${c.targetLevel}): ${c.coaching}`).join('\n')}` : ''}
${context.playbook.recommendedResources.length > 0 ? `Recommended Resources:\n${context.playbook.recommendedResources.map(r => `- "${r.title}" (${r.contentType}) for ${r.capabilityName}`).join('\n')}` : ''}
` : 'No playbook generated yet — suggest they complete onboarding to get their personalized Growth Playbook.'}

${context.lastJerichoChat ? `Last Jericho conversation: ${context.lastJerichoChat.split('T')[0]}` : 'Has not chatted with Jericho yet.'}
${context.dailyChallenge ? `Today's challenge: ${context.dailyChallenge}` : ''}
${context.recentAchievements.length > 0 ? `Verified achievements: ${context.recentAchievements.join(', ')}` : 'No recent achievements logged.'}`;

  if (!LOVABLE_API_KEY) {
    return {
      subject: `${context.firstName}, your morning brief`,
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
        subject: parsed.subject || `${context.firstName}, your morning brief`,
        body: parsed.body || `Hey ${context.firstName}, check in today!`,
        shortSummary: (parsed.shortSummary || `${context.firstName}, check your growth plan today! ${context.appUrl}`).substring(0, 160)
      };
    }
    throw new Error("Could not parse AI JSON");
  } catch (error) {
    console.error("Brief content generation error:", error);
    return {
      subject: `${context.firstName}, your morning brief`,
      body: format === 'html'
        ? `<p>Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!</p>`
        : `Hey ${context.firstName}, here's your daily brief. Check your goals and habits today!`,
      shortSummary: `${context.firstName}, check in on your goals today! ${context.appUrl}`
    };
  }
}

// ── Helper: Build evidence-based progress summary ──

function buildProgressEvidence(ctx: UserContext): string {
  const lines: string[] = [];

  // Resources
  lines.push(`Resources completed this week: ${ctx.resourcesCompletedThisWeek}`);

  // Quick Win
  if (ctx.quickWinStatus === 'completed') {
    lines.push(`Quick Win: COMPLETED ✓`);
  } else if (ctx.quickWinStatus === 'accepted') {
    lines.push(`Quick Win: Accepted, ${ctx.quickWinStepsDone} steps done (in progress)`);
  } else if (ctx.quickWinStatus === 'rejected') {
    lines.push(`Quick Win: User said it wasn't a fit — don't mention it positively`);
  } else {
    lines.push(`Quick Win: Not yet started — hasn't accepted or rejected it`);
  }

  // Priority Actions
  if (ctx.priorityActionsTotal > 0) {
    lines.push(`Priority Actions: ${ctx.priorityActionsCompleted}/${ctx.priorityActionsTotal} completed`);
  } else {
    lines.push(`Priority Actions: None tracked yet`);
  }

  // Benchmarks
  lines.push(`90-day benchmarks: ${ctx.completedBenchmarks}/${ctx.totalBenchmarks} completed`);

  // Recognitions
  lines.push(`Recognitions sent (30d): ${ctx.recognitionsSent}`);

  return lines.join('\n');
}

// ── Helper: Build calendar context with feature suggestions ──

function buildCalendarContext(ctx: UserContext): string {
  if (!ctx.hasCalendarConnected) {
    return `Calendar NOT connected. Suggest: "Connect Google Calendar in Settings for smarter daily briefings with meeting prep."`;
  }

  if (ctx.calendarEvents.length === 0) {
    return `Calendar connected but no events today. Light day — suggest deep work on capabilities or resources.`;
  }

  const lines = ctx.calendarEvents.map(e => {
    let timeLabel: string;
    if (e.isAllDay) {
      timeLabel = 'All day';
    } else if (e.startTime) {
      const eventDate = new Date(e.startTime);
      timeLabel = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      timeLabel = 'All day';
    }
    const attendeeList = e.attendees.length > 0 ? ` with ${e.attendees.slice(0, 3).join(', ')}` : '';
    const locationInfo = e.location ? ` (${e.location})` : '';

    // Suggest Jericho features based on meeting type
    let featureSuggestion = '';
    const titleLower = e.title.toLowerCase();
    if (titleLower.includes('sales') || titleLower.includes('customer') || titleLower.includes('prospect') || titleLower.includes('demo') || titleLower.includes('call')) {
      featureSuggestion = ' → SUGGEST: Sales Agent for pre-call prep & customer intel';
    } else if (titleLower.includes('1:1') || titleLower.includes('one on one') || titleLower.includes('check-in') || titleLower.includes('sync')) {
      featureSuggestion = ' → SUGGEST: Growth Plan review before the meeting';
    } else if (titleLower.includes('review') || titleLower.includes('performance') || titleLower.includes('feedback')) {
      featureSuggestion = ' → SUGGEST: Check Capabilities & recent achievements in Playbook';
    } else if (titleLower.includes('team') || titleLower.includes('standup') || titleLower.includes('huddle')) {
      featureSuggestion = ' → SUGGEST: Quick check on team priorities in Personal Assistant';
    }

    return `- ${timeLabel}: ${e.title}${attendeeList}${locationInfo}${featureSuggestion}`;
  });

  return `${ctx.calendarEvents.length} events today:\n${lines.join('\n')}`;
}
