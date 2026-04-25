import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export interface PlaybookContext {
  narrativeHighlights: string | null; // Key paragraph from playbook narrative
  quickWin: { title: string; description: string; steps: string[] } | null;
  priorityActions: { title: string; description: string }[];
  recommendedResources: { title: string; contentType: string; capabilityName: string }[];
  topCapabilityInsights: { name: string; currentLevel: string; targetLevel: string; coaching: string }[];
}

export interface SalesConversationContext {
  customerName: string;
  productsDiscussed: string[];
  keyTopics: string[];
  lastMessageSnippet: string;
  conversationDate: string;
}

export interface SalesPipelineContext {
  isSalesperson: boolean;          // true if user has any deals OR sales activities OR sales conversations
  hasRecentActivity: boolean;      // any sales activity (deal touch / activity log / convo) in last 14 days
  totalOpenDeals: number;
  totalPipelineValue: number;
  stalledDeals: {
    dealName: string;
    stage: string;
    value: number | null;
    daysSinceActivity: number;
  }[];
  missedFollowUps: {
    subject: string;
    activityType: string;
    dealName: string | null;
    scheduledFor: string;
    daysOverdue: number;
  }[];
  opportunities: {
    dealName: string;
    stage: string;
    value: number | null;
    probability: number | null;
    expectedCloseDate: string | null;
    daysToClose: number | null;
  }[];
  daysSinceLastSalesActivity: number | null;
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
  // Sales conversation continuity
  recentSalesConversations: SalesConversationContext[];
  // Sales pipeline coaching context (only meaningful for salespeople)
  salesPipeline: SalesPipelineContext;
  // Timezone used to render dates/times in the brief (IANA string)
  userTimezone: string;
  // Behavior-aware classification: ENGAGED | DRIFTING | DISENGAGED | DORMANT
  userState: UserState;
  // Days since the user's most recent meaningful activity (login/chat/habit/task)
  daysSinceLastActivity: number | null;
  // ISO date of the most recent activity signal observed
  lastActivityAt: string | null;
}

export type UserState = 'ENGAGED' | 'DRIFTING' | 'DISENGAGED' | 'DORMANT';

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

  // ── Behavior-aware state classification ──
  // Pull lightweight activity signals: login, chat, habit completion, recent task touch
  let lastActivityAt: string | null = null;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [
      lastLoginRes,
      lastHabitRes,
      lastTaskTouchRes,
    ] = await Promise.all([
      supabase.from("login_streaks").select("last_login_date").eq("profile_id", profileId).maybeSingle(),
      supabase.from("habit_completions").select("completed_date").eq("profile_id", profileId).order("completed_date", { ascending: false }).limit(1),
      supabase.from("project_tasks").select("updated_at").eq("profile_id", profileId).gte("updated_at", since).order("updated_at", { ascending: false }).limit(1),
    ]);

    const candidates: string[] = [];
    if (streakRow?.last_login_date) candidates.push(`${streakRow.last_login_date}T12:00:00Z`);
    else if (lastLoginRes.data?.last_login_date) candidates.push(`${lastLoginRes.data.last_login_date}T12:00:00Z`);
    if (lastJerichoChat) candidates.push(lastJerichoChat);
    const lastHabit = lastHabitRes.data?.[0]?.completed_date;
    if (lastHabit) candidates.push(`${lastHabit}T12:00:00Z`);
    const lastTaskTouch = lastTaskTouchRes.data?.[0]?.updated_at;
    if (lastTaskTouch) candidates.push(lastTaskTouch);

    if (candidates.length > 0) {
      lastActivityAt = candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
    }
  } catch (stateErr) {
    console.error('[daily-brief-content] State signal fetch error (non-fatal):', stateErr);
  }

  const daysSinceLastActivity = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const userState: UserState = classifyState(daysSinceLastActivity, daysOnPlatform);

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
        body: JSON.stringify({ userId: profileId, daysBack: 0, daysForward: 1 }),
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

  // ── Fetch recent sales conversations for coaching continuity ──
  let recentSalesConversations: SalesConversationContext[] = [];
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const companyId = profile?.company_id;

    if (companyId) {
      // Get recent sales coach messages from the last 24 hours
      const { data: recentConvos } = await supabase
        .from('sales_coach_conversations')
        .select('id, customer_focus, created_at, sales_coach_messages(content, role, created_at)')
        .eq('profile_id', profileId)
        .eq('company_id', companyId)
        .gte('updated_at', yesterday)
        .order('updated_at', { ascending: false })
        .limit(3);

      if (recentConvos && recentConvos.length > 0) {
        // Also get recent customer insights for product mentions
        const { data: recentInsights } = await supabase
          .from('customer_insights')
          .select('customer_name, insight_type, insight_text')
          .eq('profile_id', profileId)
          .eq('company_id', companyId)
          .gte('created_at', yesterday)
          .in('insight_type', ['product_interest', 'buying_signal', 'crops', 'acreage'])
          .order('created_at', { ascending: false })
          .limit(10);

        // Also check company knowledge for product info related to discussed products
        const productKeywords = (recentInsights || [])
          .filter((i: any) => i.insight_type === 'product_interest')
          .map((i: any) => i.insight_text)
          .join(' ');

        for (const convo of recentConvos) {
          const messages = (convo.sales_coach_messages || []) as any[];
          const userMessages = messages.filter((m: any) => m.role === 'user');
          const lastUserMsg = userMessages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          // Extract product mentions from conversation
          const allContent = messages.map((m: any) => m.content || '').join(' ');
          const productPatterns = /(?:seed|treatment|chemical|fertilizer|fungicide|herbicide|insecticide|biological|inoculant|adjuvant|micronutrient|foliar|pre-?emerge|post-?emerge|starter|nitrogen|phosphorus|potassium|trait|variety|hybrid|(?:[A-Z][a-z]+(?:®|™)))/gi;
          const productMatches = [...new Set((allContent.match(productPatterns) || []).map((p: string) => p.trim()))];

          // Extract key discussion topics
          const topicPatterns = /(?:recommend|pitch|propose|suggest|trial|demo|switch|compare|ROI|pricing|program|package|value stack|bundle|acre|field|rotation|application|timing|rate)/gi;
          const topicMatches = [...new Set((allContent.match(topicPatterns) || []).map((t: string) => t.toLowerCase().trim()))];

          const customerInsights = (recentInsights || []).filter((i: any) => 
            convo.customer_focus && i.customer_name?.toLowerCase().includes(convo.customer_focus.toLowerCase())
          );

          recentSalesConversations.push({
            customerName: convo.customer_focus || 'General',
            productsDiscussed: productMatches.slice(0, 5),
            keyTopics: topicMatches.slice(0, 5),
            lastMessageSnippet: lastUserMsg?.content?.slice(0, 200) || '',
            conversationDate: convo.created_at,
          });
        }
      }
    }
  } catch (salesErr) {
    console.error('[daily-brief-content] Sales conversation fetch error (non-fatal):', salesErr);
  }

  // ── Fetch sales pipeline coaching context ──
  // Surfaces stalled deals, missed follow-ups, and live opportunities for salespeople.
  // If the user has no deals AND no activities AND no sales conversations, they're not
  // a salesperson — we return an empty/inactive shell and the prompt skips this section.
  let salesPipeline: SalesPipelineContext = {
    isSalesperson: false,
    hasRecentActivity: false,
    totalOpenDeals: 0,
    totalPipelineValue: 0,
    stalledDeals: [],
    missedFollowUps: [],
    opportunities: [],
    daysSinceLastSalesActivity: null,
  };
  try {
    const nowMs = Date.now();
    const fourteenDaysAgo = new Date(nowMs - 14 * 24 * 60 * 60 * 1000).toISOString();
    const todayIso = new Date().toISOString();

    const [openDealsRes, missedFollowupsRes, recentActivityRes] = await Promise.all([
      supabase
        .from('sales_deals')
        .select('id, deal_name, stage, value, probability, expected_close_date, last_activity_at, updated_at')
        .eq('profile_id', profileId)
        .not('stage', 'in', '(closed_won,closed_lost)')
        .order('value', { ascending: false, nullsFirst: false })
        .limit(50),
      supabase
        .from('sales_activities')
        .select('id, subject, activity_type, scheduled_for, completed_at, deal_id, sales_deals(deal_name)')
        .eq('profile_id', profileId)
        .is('completed_at', null)
        .not('scheduled_for', 'is', null)
        .lt('scheduled_for', todayIso)
        .order('scheduled_for', { ascending: true })
        .limit(10),
      supabase
        .from('sales_activities')
        .select('completed_at, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const openDeals = (openDealsRes.data || []) as any[];
    const missed = (missedFollowupsRes.data || []) as any[];
    const lastActivityRow = (recentActivityRes.data || [])[0] as any;

    const lastSalesActivityIso = lastActivityRow?.completed_at || lastActivityRow?.created_at || null;
    const daysSinceLastSalesActivity = lastSalesActivityIso
      ? Math.floor((nowMs - new Date(lastSalesActivityIso).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const isSalesperson = openDeals.length > 0 || missed.length > 0 || lastSalesActivityIso !== null || recentSalesConversations.length > 0;
    const hasRecentActivity = (daysSinceLastSalesActivity !== null && daysSinceLastSalesActivity <= 14) || recentSalesConversations.length > 0;

    // Stalled deals: open deals with no activity in 14+ days
    const stalledDeals = openDeals
      .map((d: any) => {
        const lastTouch = d.last_activity_at || d.updated_at;
        const daysSinceActivity = lastTouch
          ? Math.floor((nowMs - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        return {
          dealName: d.deal_name,
          stage: d.stage,
          value: d.value !== null ? Number(d.value) : null,
          daysSinceActivity,
        };
      })
      .filter(d => d.daysSinceActivity >= 14)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);

    const missedFollowUps = missed.map((m: any) => {
      const scheduled = new Date(m.scheduled_for).getTime();
      return {
        subject: m.subject || m.activity_type || 'Follow-up',
        activityType: m.activity_type,
        dealName: m.sales_deals?.deal_name || null,
        scheduledFor: m.scheduled_for,
        daysOverdue: Math.max(0, Math.floor((nowMs - scheduled) / (1000 * 60 * 60 * 24))),
      };
    }).slice(0, 5);

    // Opportunities: open deals at later stages OR closing within 30 days, sorted by value
    const opportunityStages = ['proposal', 'negotiation', 'commitment', 'closing'];
    const opportunities = openDeals
      .filter((d: any) => {
        const stageOpp = opportunityStages.includes(String(d.stage || '').toLowerCase());
        const closeSoon = d.expected_close_date
          ? (new Date(d.expected_close_date).getTime() - nowMs) <= 30 * 24 * 60 * 60 * 1000
          : false;
        return stageOpp || closeSoon;
      })
      .map((d: any) => {
        const daysToClose = d.expected_close_date
          ? Math.ceil((new Date(d.expected_close_date).getTime() - nowMs) / (1000 * 60 * 60 * 24))
          : null;
        return {
          dealName: d.deal_name,
          stage: d.stage,
          value: d.value !== null ? Number(d.value) : null,
          probability: d.probability !== null ? Number(d.probability) : null,
          expectedCloseDate: d.expected_close_date,
          daysToClose,
        };
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);

    const totalPipelineValue = openDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

    salesPipeline = {
      isSalesperson,
      hasRecentActivity,
      totalOpenDeals: openDeals.length,
      totalPipelineValue,
      stalledDeals,
      missedFollowUps,
      opportunities,
      daysSinceLastSalesActivity,
    };
  } catch (pipeErr) {
    console.error('[daily-brief-content] Sales pipeline fetch error (non-fatal):', pipeErr);
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
    quickWinStepsTotal: 0,
    quickWinStepsDone,
    capabilitiesStarted,
    priorityActionsCompleted,
    priorityActionsTotal,
    lastJerichoChat,
    daysOnPlatform,
    hasCalendarConnected,
    playbook: playbookContext,
    recentSalesConversations,
    salesPipeline,
    userTimezone,
    userState,
    daysSinceLastActivity,
    lastActivityAt,
  };
}

// ── Lightweight standalone state classifier ──
// Used by callers (e.g. send-daily-brief-email) that want to decide whether to
// send AT ALL before paying for a full context gather + AI call.
export async function classifyUserStateForProfile(
  supabase: any,
  profileId: string,
): Promise<{ state: UserState; daysSinceLastActivity: number | null; lastActivityAt: string | null }> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [profileRes, loginRes, chatRes, habitRes, taskRes] = await Promise.all([
      supabase.from("profiles").select("created_at").eq("id", profileId).maybeSingle(),
      supabase.from("login_streaks").select("last_login_date").eq("profile_id", profileId).maybeSingle(),
      supabase.from("conversations").select("created_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(1),
      supabase.from("habit_completions").select("completed_date").eq("profile_id", profileId).order("completed_date", { ascending: false }).limit(1),
      supabase.from("project_tasks").select("updated_at").eq("profile_id", profileId).gte("updated_at", since).order("updated_at", { ascending: false }).limit(1),
    ]);

    const candidates: string[] = [];
    if (loginRes.data?.last_login_date) candidates.push(`${loginRes.data.last_login_date}T12:00:00Z`);
    const chat = chatRes.data?.[0]?.created_at;
    if (chat) candidates.push(chat);
    const habit = habitRes.data?.[0]?.completed_date;
    if (habit) candidates.push(`${habit}T12:00:00Z`);
    const task = taskRes.data?.[0]?.updated_at;
    if (task) candidates.push(task);

    const lastActivityAt = candidates.length > 0
      ? candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
      : null;
    const daysSinceLastActivity = lastActivityAt
      ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const daysOnPlatform = profileRes.data?.created_at
      ? Math.floor((Date.now() - new Date(profileRes.data.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return { state: classifyState(daysSinceLastActivity, daysOnPlatform), daysSinceLastActivity, lastActivityAt };
  } catch (err) {
    console.error('[daily-brief-content] classifyUserStateForProfile error:', err);
    return { state: 'ENGAGED', daysSinceLastActivity: null, lastActivityAt: null };
  }
}

function classifyState(days: number | null, daysOnPlatform: number): UserState {
  // New users (< 3 days on platform) without signals are still ENGAGED — they
  // just haven't had time to build activity history yet.
  if (days === null) return daysOnPlatform < 3 ? 'ENGAGED' : 'DISENGAGED';
  if (days <= 3) return 'ENGAGED';
  if (days <= 7) return 'DRIFTING';
  if (days <= 14) return 'DISENGAGED';
  return 'DORMANT';
}

export async function generateBriefContent(context: UserContext, format: BriefFormat): Promise<BriefContent> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Determine the user's timezone for calendar display
  const userTimezone = context.userTimezone || 'America/New_York';

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

  const stateInstruction = buildStateInstruction(context);

  const systemPrompt = `You are Jericho — a coach. A real one. You talk like a person who knows them, not a system reporting metrics. Direct. Human. Slightly challenging. Never soft, never corporate, never robotic.

VOICE EXAMPLES:
- BAD: "You are currently below your Q1 targets."
- GOOD: "You've been quiet for a bit. That usually means something's off. Let's reset this week."
- BAD: "Your engagement has decreased by 30%."
- GOOD: "You went dark on the Henderson deal. What's the real story there?"
- BAD: "Great job maintaining your streak!"
- GOOD: "Five days in. You're starting to look like someone who actually does this."

ABSOLUTE RULES (violating these is a failure):
1. NEVER celebrate anything under a 5-day streak. A 1-day or 2-day streak is NOTHING. Ignore it entirely.
2. NEVER include personal/admin tasks (tax prep, medical, insurance, legal paperwork, errands, "Frost Law", credit cards, home tasks). These have already been filtered out.
3. NEVER define a capability. "Self Awareness is about understanding your own emotions" = INSTANT FAIL. Instead, pull the SPECIFIC coaching action from their playbook data.
4. BANNED phrases (corporate, fluffy, or robotic — instant fail): "keep up the great work", "that's fantastic", "you're showing up", "let's make today count", "cheering you on", "your growth journey", "keep that momentum", "perfect examples of", "currently below", "in order to", "leverage", "utilize", "circle back", "touch base", "moving forward", "as per", "kindly", "we noticed that", "it appears that", "based on your data", "great job", "keep it up", "you've got this", "crushing it", "rockstar", "absolutely", "amazing work".
5. NEVER start a sentence with "You are currently…", "Based on…", "According to…", "Our analysis shows…", or anything that sounds like a dashboard. Talk like a person.
6. AIM for 250-350 WORDS. Enough to be substantive, short enough to respect their time. Cut anything that doesn't earn its place.
7. Every sentence must contain SPECIFIC information (a name, number, date, or action) OR a direct human observation. No filler. No over-explaining.
8. For EXPIRED targets (0 days remaining): Say the target has lapsed and ask ONE pointed question about whether to reset it or close it. Don't pile on.
9. NEVER reference outdated quarters or goals from past quarters. If a target lapsed, address it ONCE and move on.
10. NEVER guilt the user about being absent or inactive. Notice it like a friend would, not like an HR report.
11. Use contractions. Short sentences. Occasional sentence fragments. Read it out loud — if it sounds like a memo, rewrite it.
12. SALES PIPELINE RULES (CRITICAL):
    a. If the user is NOT a salesperson (no deals, no activities, no sales conversations) → DO NOT include any PIPELINE section. Don't invent it. Don't reference deals.
    b. If the user IS a salesperson but has NO recent sales activity (last 14+ days quiet) → DO NOT fabricate insight. Skip pipeline specifics. Switch to a single re-engagement nudge in REAL TALK: notice the quiet, ask one honest question, point them back to the Sales Agent. NEVER list deals as if they're being worked.
    c. If the user IS a salesperson WITH recent activity → include a PIPELINE section (see STRUCTURE) using ONLY the data provided. Never invent deal names, customer names, dollar amounts, or stages.
    d. Reps should feel COACHED, not monitored. No "you have 4 stalled deals" report-talk. Instead: "The Henderson deal hasn't moved in 18 days. What's the real holdup?"

TONE: A coach who knows them and isn't afraid to push. Warm but unflinching. Think the friend who tells you the truth at the bar, not the one who sends you a motivational quote. The user should feel SEEN, not analyzed.

STRUCTURE (use clear section headers):
1. **Greeting** — One casual, warm line. Reference something real (day of week, what's on their plate). No metrics.
2. **YESTERDAY'S SALES INTEL** (ONLY if sales conversations exist) — Reference the specific customer and product they discussed yesterday. Connect it to today: "You were working the [Product] angle with [Customer] yesterday. Here's how to keep that momentum..." Include a specific training suggestion or product knowledge tip relevant to what they discussed. Link to Sales Agent.
3. **PIPELINE** (ONLY when user is a salesperson WITH recent activity AND there are stalled deals, missed follow-ups, OR opportunities to surface) — Pick 1–2 things that matter most. Name the deal/customer specifically. Coach, don't report. Examples: "Henderson hasn't moved in 18 days — what's the real holdup?" / "You owe Miller a follow-up call from Tuesday. Knock it out before 10am." / "The Carter deal is 30 days from close at 60% probability. Time to get the decision-maker on the phone." Skip this section entirely if no pipeline data, or if the user is quiet on sales (then the re-engagement nudge belongs in REAL TALK).
4. **SCHEDULE** — If meetings exist: list the top 2-3 with times, attendees, and one prep action per meeting. If a meeting involves a customer they discussed with the Sales Agent, call that out explicitly. Suggest Sales Agent for customer calls. If no meetings: suggest what to do with the open time (specific to their priorities).
5. **REAL TALK** — The 1-2 things that matter most today. A stalled target? A streak worth celebrating? Progress on quick win? Go specific with numbers and names. Be honest about what's behind. (For salespeople gone quiet: this is where the re-engagement nudge lives — one honest line, one question, one link to Sales Agent. Do NOT fabricate pipeline activity.)
6. **PLAYBOOK ACTION** — One specific coaching tip quoted from their playbook data. Frame it as: "Your playbook says: [exact tip]. Here's how to apply it today: [concrete action]."
7. **PRIORITIES** — Top 2-3 WORK tasks as bullets. Add a quick note on approach if helpful.
8. **REFLECT** — One specific question tied to a real goal, benchmark, or recent event. Not generic "how will X influence Y" — instead: "You need 12 contracts and have 0 benchmarks done. Who are you calling first?"
9. **Sign-off** — "— Jericho" (nothing else)

${stateInstruction}

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
USER STATE: ${context.userState}${context.daysSinceLastActivity !== null ? ` (last meaningful activity: ${context.daysSinceLastActivity} day${context.daysSinceLastActivity === 1 ? '' : 's'} ago)` : ' (no activity signal yet)'}

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

── YESTERDAY'S SALES CONVERSATIONS ──
${context.recentSalesConversations.length > 0 ? context.recentSalesConversations.map(sc => {
    const products = sc.productsDiscussed.length > 0 ? `Products discussed: ${sc.productsDiscussed.join(', ')}` : '';
    const topics = sc.keyTopics.length > 0 ? `Topics: ${sc.keyTopics.join(', ')}` : '';
    const snippet = sc.lastMessageSnippet ? `Last message: "${sc.lastMessageSnippet}"` : '';
    return `- Customer: ${sc.customerName}\n  ${[products, topics, snippet].filter(Boolean).join('\n  ')}`;
  }).join('\n') : 'No recent sales conversations.'}

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
      timeLabel = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: ctx.userTimezone || 'America/New_York',
      });
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

// ── Helper: State-specific override block injected into the system prompt ──
// Engaged users get the standard rich brief (no override). DRIFTING/DISENGAGED/
// DORMANT users get progressively shorter, more re-engagement-focused output
// that REPLACES the standard STRUCTURE above.
function buildStateInstruction(ctx: UserContext): string {
  switch (ctx.userState) {
    case 'ENGAGED':
      return `STATE = ENGAGED (active in last 3 days). Use the full STRUCTURE above. Talk to them like a coach who's been watching the work — name the target, the customer, the habit. Push them on one thing. End with one clear next move, not a question that adds load.`;

    case 'DRIFTING':
      return `STATE = DRIFTING (last activity ${ctx.daysSinceLastActivity ?? '?'} days ago). OVERRIDE THE STRUCTURE ABOVE. Sound like a coach who noticed they went quiet — curious, not corporate. Output exactly:
1. **Greeting** — One human line. Notice the gap the way a friend would. No metrics. No guilt. Example tone: "You've been quiet for a few days. Usually means something's pulling at you."
2. **What you committed to** — Reference ONE specific commitment from their data (a 90-day target, a habit, a quick win, or a customer they were working). Use exact names/numbers. One sentence. Make it feel personal, not pulled from a report.
3. **Today's one move** — One concrete next step that takes <15 minutes. Specific. Linked. Direct.
4. **Sign-off** — "— Jericho"
TOTAL LENGTH: 80–140 words. No "REAL TALK" section. No PRIORITIES list. No REFLECT question. No corporate language.`;

    case 'DISENGAGED':
      return `STATE = DISENGAGED (last activity ${ctx.daysSinceLastActivity ?? '?'} days ago). OVERRIDE THE STRUCTURE ABOVE. This is a re-engagement message. Sound like a coach reaching out, not a system pinging them. Output exactly:
1. **Greeting** — One human line. Acknowledge they've been heads-down without guilting. Example: "Been a minute. Hope the season's not running you over."
2. **The hook** — ONE sentence that connects to something real they set up (a vision phrase, a target name, or a customer name). Make them feel remembered. No dashboards. No metrics. No bullet lists.
3. **One move** — One small action that takes <5 minutes. A single link. Said plainly.
4. **Sign-off** — "— Jericho"
TOTAL LENGTH: 40–80 words. NEVER include schedule, priorities, playbook tips, or reflect questions. Feel seen, not analyzed.`;

    case 'DORMANT':
      return `STATE = DORMANT (last activity ${ctx.daysSinceLastActivity ?? '14+'} days ago). OVERRIDE THE STRUCTURE ABOVE. This is a reactivation note, not a brief. Talk like a coach who's giving them an honest out. Output exactly:
1. **Greeting** — One short line by first name. No "long time no see" guilt.
2. **The invitation** — ONE sentence offering a fresh start: reset goals, or pause the briefs entirely. Make both options feel okay. Example tone: "If this isn't the season for it, that's fair. Want to reset, or want me to back off for a while?"
3. **Two links** — One to come back (Growth Plan), one to mute (Settings). No sales pitch.
4. **Sign-off** — "— Jericho"
TOTAL LENGTH: 30–60 words. NEVER reference old goals, lapsed targets, dashboards, or metrics. No corporate language.`;

    default:
      return '';
  }
}
