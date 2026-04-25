import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  generateBriefContent,
  type BriefFormat,
  type UserContext,
  type UserState,
  type SalesPipelineContext,
  type SalesConversationContext,
  type PlaybookContext,
} from "../_shared/daily-brief-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin preview/testing endpoint for the Daily Brief.
 *
 * Lets an authenticated SUPER ADMIN simulate any user state (ENGAGED /
 * DRIFTING / DISENGAGED / DORMANT), salesperson on/off, recent activity
 * on/off, and a handful of pipeline / calendar / habit knobs, then runs
 * the EXACT same `generateBriefContent` pipeline used in production —
 * so the output mirrors what real users would receive.
 *
 * Returns the brief plus a small "QA report" the UI uses to verify the
 * output respects the rules (banned phrases, length, structural sections).
 */

interface PreviewOverrides {
  state?: UserState;
  salesperson?: boolean;
  hasRecentSalesActivity?: boolean;
  daysSinceLastSalesActivity?: number | null;
  includeStalledDeals?: boolean;
  includeMissedFollowUps?: boolean;
  includeOpportunities?: boolean;
  includeCalendarEvents?: boolean;
  includeMeaningfulHabit?: boolean;
  includePlaybook?: boolean;
  firstName?: string;
  format?: BriefFormat;
}

function buildSyntheticContext(o: PreviewOverrides): UserContext {
  const state: UserState = o.state ?? 'ENGAGED';
  const isSalesperson = o.salesperson ?? false;
  const hasRecentActivity = o.hasRecentSalesActivity ?? true;

  const daysSinceMap: Record<UserState, number> = {
    ENGAGED: 1,
    DRIFTING: 5,
    DISENGAGED: 10,
    DORMANT: 21,
  };
  const daysSinceLastActivity = daysSinceMap[state];
  const lastActivityAt = new Date(
    Date.now() - daysSinceLastActivity * 24 * 60 * 60 * 1000,
  ).toISOString();

  const salesPipeline: SalesPipelineContext = {
    isSalesperson,
    hasRecentActivity: isSalesperson && hasRecentActivity,
    totalOpenDeals: isSalesperson ? 4 : 0,
    totalPipelineValue: isSalesperson ? 285000 : 0,
    stalledDeals:
      isSalesperson && hasRecentActivity && (o.includeStalledDeals ?? true)
        ? [
            { dealName: 'Henderson Farms — Spring Program', stage: 'proposal', value: 48000, daysSinceActivity: 18 },
            { dealName: 'Miller Ag — Foliar Trial', stage: 'discovery', value: 22000, daysSinceActivity: 21 },
          ]
        : [],
    missedFollowUps:
      isSalesperson && hasRecentActivity && (o.includeMissedFollowUps ?? true)
        ? [
            {
              subject: 'Pricing follow-up',
              activityType: 'call',
              dealName: 'Miller Ag — Foliar Trial',
              scheduledFor: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              daysOverdue: 2,
            },
          ]
        : [],
    opportunities:
      isSalesperson && hasRecentActivity && (o.includeOpportunities ?? true)
        ? [
            {
              dealName: 'Carter Family Farm — Full Season',
              stage: 'negotiation',
              value: 95000,
              probability: 60,
              expectedCloseDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              daysToClose: 28,
            },
          ]
        : [],
    daysSinceLastSalesActivity: isSalesperson
      ? (o.daysSinceLastSalesActivity ?? (hasRecentActivity ? 2 : 22))
      : null,
  };

  const recentSalesConversations: SalesConversationContext[] =
    isSalesperson && hasRecentActivity
      ? [
          {
            customerName: 'Henderson Farms',
            productsDiscussed: ['BioStart 360', 'Foliar Pak'],
            keyTopics: ['rate', 'timing', 'ROI'],
            lastMessageSnippet:
              'Wants to see the trial data on BioStart 360 before locking in spring acres.',
            conversationDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        ]
      : [];

  const playbook: PlaybookContext | null = (o.includePlaybook ?? true)
    ? {
        narrativeHighlights:
          'Your strongest lever right now is consistent discovery — slowing down to ask before pitching.',
        quickWin: {
          title: 'Run a 4-question discovery on your next call',
          description:
            'Use the discovery prompt sequence on your very next customer conversation.',
          steps: ['Open with situation question', 'Probe pain', 'Confirm impact', 'Tee up next step'],
        },
        priorityActions: [
          { title: 'Tighten next-step asks', description: 'Every meeting ends with a confirmed date.' },
          { title: 'Rebuild Henderson momentum', description: 'Get a yes/no on trial scope this week.' },
        ],
        recommendedResources: [
          { title: 'Discovery That Closes', contentType: 'video', capabilityName: 'Discovery' },
        ],
        topCapabilityInsights: [
          {
            name: 'Discovery',
            currentLevel: 'Advancing',
            targetLevel: 'Independent',
            coaching: 'Ask one more layer of "why" before you propose. Silence is your friend.',
          },
        ],
      }
    : null;

  const ninetyDayTargets =
    state === 'ENGAGED' || state === 'DRIFTING'
      ? [
          {
            title: 'Sign 12 spring program contracts',
            progress: 0,
            daysRemaining: 22,
            benchmarks: [
              { title: 'Lock 4 by month end', isCompleted: true },
              { title: 'Lock 8 by mid-month', isCompleted: false },
              { title: 'Final 4 by quarter end', isCompleted: false },
            ],
          },
        ]
      : [];

  return {
    firstName: o.firstName || 'Sam',
    episodeTitle: 'Your Daily Growth Brief',
    topics: [],
    script: '',
    dailyChallenge: null,
    streakDays: state === 'ENGAGED' ? 7 : null,
    habits:
      (o.includeMeaningfulHabit ?? true) && (state === 'ENGAGED' || state === 'DRIFTING')
        ? [{ name: 'Morning planning', currentStreak: 7, completionsThisWeek: 5 }]
        : [],
    ninetyDayTargets,
    topCapabilities: [
      { name: 'Discovery', currentLevel: 'Advancing', targetLevel: 'Independent' },
      { name: 'Business Value', currentLevel: 'Foundational', targetLevel: 'Advancing' },
    ],
    recentAchievements: state === 'ENGAGED' ? ['Closed Smith Farms — $18k spring program'] : [],
    personalVision:
      'Be the trusted agronomic advisor my growers call before anyone else.',
    recognitionsSent: 0,
    totalBenchmarks: ninetyDayTargets.reduce((s, t) => s + t.benchmarks.length, 0),
    completedBenchmarks: ninetyDayTargets.reduce(
      (s, t) => s + t.benchmarks.filter((b) => b.isCompleted).length,
      0,
    ),
    capabilityScore: 45,
    totalCapabilities: 8,
    focusCapability: 'Discovery',
    appUrl: 'https://askjericho.com',
    priorityTasks:
      state === 'ENGAGED' || state === 'DRIFTING'
        ? [
            { title: 'Send Henderson the BioStart trial summary', priority: 'high', dueDate: null },
            { title: 'Prep Carter negotiation deck', priority: 'high', dueDate: null },
          ]
        : [],
    calendarEvents:
      (o.includeCalendarEvents ?? true) && (state === 'ENGAGED' || state === 'DRIFTING')
        ? [
            {
              title: 'Carter Family Farm — pricing review',
              startTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
              endTime: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
              isAllDay: false,
              attendees: ['John Carter'],
              location: null,
            },
            {
              title: 'Team huddle',
              startTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
              endTime: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
              isAllDay: false,
              attendees: [],
              location: null,
            },
          ]
        : [],
    resourcesCompletedThisWeek: state === 'ENGAGED' ? 2 : 0,
    quickWinStatus: state === 'ENGAGED' ? 'accepted' : null,
    quickWinStepsTotal: 4,
    quickWinStepsDone: state === 'ENGAGED' ? 2 : 0,
    capabilitiesStarted: [],
    priorityActionsCompleted: state === 'ENGAGED' ? 1 : 0,
    priorityActionsTotal: 3,
    lastJerichoChat: lastActivityAt,
    daysOnPlatform: 30,
    hasCalendarConnected: o.includeCalendarEvents ?? true,
    playbook,
    recentSalesConversations,
    salesPipeline,
    userTimezone: 'America/New_York',
    userState: state,
    daysSinceLastActivity,
    lastActivityAt,
  };
}

// ── QA heuristics: verify the brief obeys the system rules ──

const BANNED_PHRASES = [
  'keep up the great work',
  "that's fantastic",
  "you're showing up",
  "let's make today count",
  'cheering you on',
  'your growth journey',
  'keep that momentum',
  'perfect examples of',
  'currently below',
  'in order to',
  'leverage',
  'utilize',
  'circle back',
  'touch base',
  'moving forward',
  'as per',
  'kindly',
  'we noticed that',
  'it appears that',
  'based on your data',
  'great job',
  'keep it up',
  "you've got this",
  'crushing it',
  'rockstar',
  'absolutely',
  'amazing work',
];

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function runQA(brief: { subject: string; body: string; shortSummary: string }, ctx: UserContext) {
  const plain = stripHtml(brief.body);
  const words = plain.split(/\s+/).filter(Boolean).length;

  const lower = plain.toLowerCase();
  const bannedHits = BANNED_PHRASES.filter((p) => lower.includes(p));

  const mentionsPipeline = /pipeline|stalled|deal|follow-?up|customer|prospect/i.test(plain);
  const isSalesperson = ctx.salesPipeline.isSalesperson;
  const hasRecentSalesActivity = ctx.salesPipeline.hasRecentActivity;

  const expectedLen: Record<UserState, [number, number]> = {
    ENGAGED: [220, 420],
    DRIFTING: [60, 170],
    DISENGAGED: [30, 110],
    DORMANT: [20, 90],
  };
  const [minWords, maxWords] = expectedLen[ctx.userState];

  const checks = [
    {
      label: `Word count within ${minWords}-${maxWords} for ${ctx.userState}`,
      pass: words >= minWords && words <= maxWords,
      detail: `${words} words`,
    },
    {
      label: 'No banned/corporate phrases',
      pass: bannedHits.length === 0,
      detail: bannedHits.length ? `Found: ${bannedHits.join(', ')}` : 'clean',
    },
    {
      label: 'Sign-off present (— Jericho)',
      pass: /[—-]\s*Jericho/i.test(plain),
      detail: '',
    },
    {
      label: !isSalesperson
        ? 'No pipeline/deal language (non-salesperson)'
        : !hasRecentSalesActivity
        ? 'No fabricated deals (salesperson gone quiet)'
        : 'Pipeline coaching present (salesperson active)',
      pass: !isSalesperson
        ? !mentionsPipeline
        : !hasRecentSalesActivity
        ? !/stalled|18 days|21 days|henderson|miller|carter/i.test(plain) ||
          /quiet|been a minute|reset|sales agent/i.test(plain)
        : mentionsPipeline,
      detail: '',
    },
    {
      label:
        ctx.userState === 'ENGAGED'
          ? 'Has REAL TALK / PRIORITIES / REFLECT structure'
          : 'No full-structure sections (state-specific override)',
      pass:
        ctx.userState === 'ENGAGED'
          ? /real talk|priorities|reflect/i.test(plain)
          : !/priorities|reflect/i.test(plain) || ctx.userState === 'DRIFTING',
      detail: '',
    },
  ];

  return {
    wordCount: words,
    bannedHits,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    totalChecks: checks.length,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is a super admin
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Super admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const overrides = (await req.json()) as PreviewOverrides;
    const format: BriefFormat = overrides.format || 'html';
    const ctx = buildSyntheticContext(overrides);
    const brief = await generateBriefContent(ctx, format);
    const qa = runQA(brief, ctx);

    return new Response(
      JSON.stringify({
        brief,
        qa,
        contextSummary: {
          firstName: ctx.firstName,
          userState: ctx.userState,
          daysSinceLastActivity: ctx.daysSinceLastActivity,
          isSalesperson: ctx.salesPipeline.isSalesperson,
          hasRecentSalesActivity: ctx.salesPipeline.hasRecentActivity,
          stalledDeals: ctx.salesPipeline.stalledDeals.length,
          missedFollowUps: ctx.salesPipeline.missedFollowUps.length,
          opportunities: ctx.salesPipeline.opportunities.length,
          calendarEvents: ctx.calendarEvents.length,
          format,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[preview-daily-brief] error', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
