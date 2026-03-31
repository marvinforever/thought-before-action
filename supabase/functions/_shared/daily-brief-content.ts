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
        
        // Calculate today's date in user timezone using offset math (not toLocaleString which is unreliable in Deno)
        const nowMs = Date.now();
        // Get offset by comparing UTC date string with locale date string
        const utcDate = new Date(nowMs).toISOString().split('T')[0];
        // Use Intl.DateTimeFormat for reliable timezone date extraction
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayUser = formatter.format(new Date(nowMs)); // YYYY-MM-DD format from en-CA locale
        
        console.log(`[daily-brief] Calendar filter: todayUser=${todayUser}, timezone=${userTimezone}, events returned=${(calData.events || []).length}`);
        
        calendarEvents = (calData.events || [])
          .filter((e: any) => {
            const isAllDay = !e.start?.dateTime && !!e.start?.date;
            if (isAllDay) {
              const startDate = e.start.date;
              const endDate = e.end?.date || startDate;
              return startDate <= todayUser && todayUser < endDate;
            } else {
              // Extract date in user's timezone from the event's dateTime
              const eventFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' });
              const eventDateStr = eventFormatter.format(new Date(e.start.dateTime));
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

  const systemPrompt = `You are Jericho — a sharp, no-BS executive coach. NOT a cheerleader. NOT a morning show host. You give the kind of advice a $500/hr coach would give in a 2-minute hallway conversation.

ABSOLUTE RULES (violating these is a failure):
1. NEVER celebrate anything under a 5-day streak. A 1-day or 2-day streak is NOTHING. Do NOT mention it. Do NOT say "great to see you keeping up." Ignore it entirely.
2. NEVER include personal/admin tasks (tax prep, medical, insurance, legal paperwork, errands, "Frost Law", credit cards, home tasks). These have already been filtered out. If somehow one slips through, SKIP IT.
3. NEVER define a capability. "Self Awareness is about understanding your own emotions" = INSTANT FAIL. Instead, pull the SPECIFIC coaching action from their playbook data and say: "Try this today: [exact action]."
4. NEVER use filler phrases: "keep up the great work", "that's fantastic", "you're showing up", "let's make today count", "cheering you on", "your growth journey", "keep that momentum", "perfect examples of". These are BANNED.
5. MAX 200 WORDS for the body. Not a suggestion — a hard limit. If you go over, you failed.
6. Every sentence must contain SPECIFIC information (a name, number, date, or action). Generic sentences = delete them.
7. For EXPIRED targets (0 days remaining): Do NOT say "0 days remaining" — instead say the target has lapsed and ask ONE pointed question about whether to reset it or close it. Don't pile on.
8. Clear calendar days: ONE sentence, not a paragraph. "Calendar's clear — block 2 hours for [specific priority]."

TONE: Like texting a friend who happens to be a brilliant strategist. Casual, sharp, zero padding.

STRUCTURE (each section = 1-3 sentences MAX):
1. Greeting — One casual line. No metrics, no streaks under 5 days.
2. SCHEDULE — If meetings: the most important one + prep action. If clear: one line.
3. REAL TALK — The ONE thing that matters most today. A stalled target? A streak worth celebrating? A quick win to knock out? Pick ONE, go deep for 2 sentences.
4. DO THIS TODAY — One specific playbook coaching action. Quote it directly from their data. No definitions.
5. PRIORITIES — Top 2 work tasks only. Bullet format.
6. REFLECT — One razor-sharp question tied to a specific goal, benchmark, or playbook action.
7. Sign-off — Your name. That's it. "— Jericho"

${formatInstruction}
${linkInstruction}

Generate a "shortSummary" field: ~140 character plain text for SMS. One honest insight + app URL.

Return JSON: { "subject": "...", "body": "...", "shortSummary": "..." }`;

  // Build evidence-based context
  const progressSection = buildProgressEvidence(context);
  const calendarSection = buildCalendarContext(context);

  // Pre-filter tasks: remove personal/admin items before they reach the AI
  const personalKeywords = ['frost law', 'tax', 'medical', 'insurance', 'credit card', 'health insurance', 'real property', 'dental', 'doctor', 'pharmacy', 'grocery', 'laundry', 'personal', 'errand'];
  const filteredTasks = context.priorityTasks.filter(t => {
    const lower = t.title.toLowerCase();
    return !personalKeywords.some(kw => lower.includes(kw));
  });

  // Reframe expired targets
  const targetLines = context.ninetyDayTargets.map(t => {
    const completedCount = t.benchmarks.filter(b => b.isCompleted).length;
    if (t.daysRemaining <= 0) {
      return `- ${t.title}: TARGET LAPSED (was due this quarter), ${completedCount}/${t.benchmarks.length} benchmarks done. Needs reset or closure.`;
    }
    return `- ${t.title}: ${t.daysRemaining} days left, ${completedCount}/${t.benchmarks.length} benchmarks done`;
  }).join('\n') || 'None set.';

  // Only include meaningful streaks
  const meaningfulHabits = context.habits.filter(h => h.currentStreak >= 5 || h.completionsThisWeek >= 3);
  const habitsSection = meaningfulHabits.length > 0
    ? meaningfulHabits.map(h => `- ${h.name}: ${h.currentStreak}d streak, ${h.completionsThisWeek} completions this week`).join('\n')
    : context.habits.length > 0
      ? `${context.habits.length} habits tracked but no streaks above 5 days yet.`
      : 'No habits tracked.';

  const userPrompt = `Briefing for ${context.firstName}. Day ${context.daysOnPlatform} on platform.

${context.personalVision ? `Vision: "${context.personalVision}"` : ''}
Focus Capability: ${context.focusCapability || 'None'}

── PROGRESS ──
${buildProgressEvidence(context)}

── CALENDAR ──
${calendarSection}

── WORK TASKS (personal items already removed) ──
${filteredTasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]${t.dueDate ? ` (due: ${t.dueDate})` : ''}`).join('\n') || 'No work tasks today.'}

── 90-DAY TARGETS ──
${targetLines}

── HABITS (only 5+ day streaks shown) ──
${habitsSection}
${context.streakDays !== null && context.streakDays >= 5 ? `Login Streak: ${context.streakDays} days` : ''}

── CAPABILITIES ──
${context.topCapabilities.length > 0 ? context.topCapabilities.map(c => `- ${c.name}: ${c.currentLevel} → ${c.targetLevel}`).join('\n') : 'None assigned.'}

── PLAYBOOK COACHING DATA ──
${context.playbook ? `
${context.playbook.topCapabilityInsights.length > 0 ? `Coaching Tips:\n${context.playbook.topCapabilityInsights.map(c => `- ${c.name}: "${c.coaching}"`).join('\n')}` : ''}
${context.playbook.quickWin ? `Quick Win: "${context.playbook.quickWin.title}" — ${context.playbook.quickWin.description}` : ''}
${context.playbook.priorityActions.length > 0 ? `Priority Actions:\n${context.playbook.priorityActions.map(a => `- ${a.title}: ${a.description}`).join('\n')}` : ''}
` : 'No playbook yet.'}

${context.dailyChallenge ? `Challenge: ${context.dailyChallenge}` : ''}
${context.recentAchievements.length > 0 ? `Achievements: ${context.recentAchievements.join(', ')}` : ''}`;

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
        response_format: { type: "json_object" },
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

    // Try direct parse first, then regex extraction
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Try to fix common JSON issues: unescaped newlines in strings
        const cleaned = jsonMatch[0]
          .replace(/(?<=:\s*"[^"]*)\n/g, '\\n')
          .replace(/(?<=:\s*"[^"]*)\r/g, '\\r');
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // Last resort: extract fields with regex
          const subjectMatch = content.match(/"subject"\s*:\s*"([^"]+)"/);
          const summaryMatch = content.match(/"shortSummary"\s*:\s*"([^"]+)"/);
          // Extract body between "body": " and the next key or end
          const bodyMatch = content.match(/"body"\s*:\s*"([\s\S]*?)"\s*[,}]\s*"(?:shortSummary|subject)/);
          parsed = {
            subject: subjectMatch?.[1] || `${context.firstName}, your morning brief`,
            body: bodyMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') || '',
            shortSummary: summaryMatch?.[1] || '',
          };
        }
      }
    }

    if (!parsed || (!parsed.body && !parsed.subject)) {
      throw new Error("Could not parse AI JSON");
    }

    return {
      subject: parsed.subject || `${context.firstName}, your morning brief`,
      body: parsed.body || `Hey ${context.firstName}, check in today!`,
      shortSummary: (parsed.shortSummary || `${context.firstName}, check your growth plan today! ${context.appUrl}`).substring(0, 160)
    };
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
