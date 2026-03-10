import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// ENTRY POINT — Returns 202 immediately, processes in background
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Push ALL heavy work into background
    const promise = runPipeline(profile_id);
    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(promise);

    return new Response(JSON.stringify({
      status: 'generating',
      message: 'Your growth plan is being built. You\'ll receive it via email shortly.',
      profile_id,
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[growth-plan] Request error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipeline(profile_id: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let growthPlanId: string | null = null;

  try {
    console.log(`[growth-plan] ▶ Pipeline started for ${profile_id}`);

    // Update status
    await supabase.from('user_active_context').update({
      report_status: 'generating',
      updated_at: new Date().toISOString(),
    }).eq('profile_id', profile_id);

    // ── STAGE 1: LOAD CONTEXT ──
    console.log('[growth-plan] Stage 1: Loading context...');
    const context = await loadContext(supabase, profile_id);
    if (!context) {
      await writeError(supabase, profile_id, growthPlanId, 'context_load', 'Failed to load required context data');
      return;
    }

    // Create growth_plans record
    const { data: gp } = await supabase.from('growth_plans').upsert({
      profile_id,
      status: 'generating',
      model_used: 'claude-opus-4-20250514',
      generated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' }).select('id').single();
    growthPlanId = gp?.id || null;

    // ── STAGE 2: CAPABILITY MAPPING (LLM Call #1) ──
    console.log('[growth-plan] Stage 2: Capability mapping via Claude Opus...');
    const capabilityMatrix = await mapCapabilities(context, profile_id);
    if (!capabilityMatrix) {
      await writeError(supabase, profile_id, growthPlanId, 'capability_mapping', 'LLM failed to return valid capability matrix');
      return;
    }

    // Save matrix
    if (growthPlanId) {
      await supabase.from('growth_plans').update({
        capability_matrix: capabilityMatrix,
      }).eq('id', growthPlanId);
    }

    // ── STAGE 3: REPORT GENERATION (LLM Call #2) ──
    console.log('[growth-plan] Stage 3: Report generation via Claude Opus...');
    const reportText = await generateReport(context, capabilityMatrix, profile_id);
    if (!reportText) {
      await writeError(supabase, profile_id, growthPlanId, 'report_generation', 'LLM failed to generate report text');
      return;
    }

    const wordCount = reportText.split(/\s+/).length;
    console.log(`[growth-plan] Report generated: ${wordCount} words`);

    // ── STAGE 4: BUILD HTML EMAIL ──
    console.log('[growth-plan] Stage 4: Building HTML report...');
    const reportHtml = buildReportHtml(context, capabilityMatrix, reportText);

    // ── STAGE 5: DATA WRITES ──
    console.log('[growth-plan] Stage 5: Writing data...');
    await supabase.from('growth_plans').update({
      generated_text: reportText,
      report_html: reportHtml,
      status: 'generated',
      word_count: wordCount,
    }).eq('id', growthPlanId);

    await supabase.from('user_active_context').update({
      report_status: 'generated',
      report_generated_at: new Date().toISOString(),
      error_log: null,
      updated_at: new Date().toISOString(),
    }).eq('profile_id', profile_id);

    // Also store AI recommendations in onboarding_data for client polling
    const resultPayload = {
      success: true,
      profile: { full_name: context.full_name, job_title: context.job_title, company_name: context.company_name },
      ai_recommendations: capabilityMatrix,
      generated_at: new Date().toISOString(),
    };
    await supabase.from('user_active_context').update({
      onboarding_data: resultPayload,
    }).eq('profile_id', profile_id);

    // ── STAGE 6: DELIVERY ──
    console.log('[growth-plan] Stage 6: Delivering...');
    await deliver(supabase, profile_id, growthPlanId, context, capabilityMatrix, reportHtml);

    console.log(`[growth-plan] ✅ Pipeline complete for ${profile_id}`);

  } catch (error: any) {
    console.error('[growth-plan] Pipeline error:', error);
    await writeError(supabase, profile_id, growthPlanId, 'pipeline', error.message);
  }
}

// ============================================================================
// STAGE 1: LOAD CONTEXT
// ============================================================================

interface UserContext {
  full_name: string;
  first_name: string;
  job_title: string;
  company_name: string;
  email: string;
  phone: string | null;
  // Diagnostic data from onboarding
  tenure_role: string;
  team_size: string;
  natural_strengths: string;
  hardest_part: string;
  obstacles: string;
  vision_great_year: string;
  career_goal_3yr: string;
  growth_feeling: string;
  learning_formats: string;
  engagement_score: number | null;
  career_growth_score: number | null;
  role_clarity_score: number | null;
  // All onboarding data as raw object
  raw_onboarding: Record<string, any>;
  // Capabilities list
  capabilities: any[];
}

async function loadContext(supabase: any, profile_id: string): Promise<UserContext | null> {
  const [profileRes, contextRes, capsRes, scoresRes] = await Promise.all([
    supabase.from('profiles').select('full_name, job_title, role, email, phone, company_id').eq('id', profile_id).single(),
    supabase.from('user_active_context').select('onboarding_data, error_log').eq('profile_id', profile_id).single(),
    supabase.from('capabilities').select('id, name, category, description').eq('status', 'approved').order('category'),
    supabase.from('diagnostic_scores').select('engagement_score, career_score, clarity_score').eq('profile_id', profile_id).single(),
  ]);

  const profile = profileRes.data;
  const uac = contextRes.data;
  const diagScores = scoresRes.data;

  if (!profile) {
    console.error('[growth-plan] No profile found for', profile_id);
    return null;
  }

  const od = (uac?.onboarding_data as Record<string, any>) || {};

  let companyName = '';
  if (profile.company_id) {
    const { data: co } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
    companyName = co?.name || '';
  }

  const fullName = od.full_name || profile.full_name || 'Unknown';
  const firstName = fullName.split(' ')[0];

  return {
    full_name: fullName,
    first_name: firstName,
    job_title: od.job_title || profile.job_title || profile.role || 'Professional',
    company_name: od.company_name || companyName,
    email: od.email || profile.email,
    phone: od.phone || profile.phone || null,
    tenure_role: od.tenure_role || od.tenure || '',
    team_size: od.team_size || '',
    natural_strengths: od.natural_strengths || od.strength || '',
    hardest_part: od.hardest_part || od.obstacle || '',
    obstacles: od.obstacles || od.obstacle || '',
    vision_great_year: od.vision_great_year || '',
    career_goal_3yr: od.career_goal_3yr || '',
    growth_feeling: od.growth_feeling || od.score?.toString() || '',
    learning_formats: od.learning_formats || od.learning_style || '',
    engagement_score: od.engagement_score ?? diagScores?.engagement_score ?? null,
    career_growth_score: od.career_growth_score ?? diagScores?.career_score ?? null,
    role_clarity_score: od.role_clarity_score ?? diagScores?.clarity_score ?? null,
    raw_onboarding: od,
    capabilities: capsRes.data || [],
  };
}

// ============================================================================
// STAGE 2: CAPABILITY MAPPING (Claude Opus — Call #1)
// ============================================================================

async function mapCapabilities(context: UserContext, profile_id: string): Promise<any | null> {
  const systemPrompt = `You are the Jericho capability mapping engine. Given a user's role, title, industry, tenure, and diagnostic responses, select the 10-12 most relevant capabilities from the provided list and assign current levels (1-4) based on evidence from their responses.

Level definitions:
- Level 1 (Foundational): Learning the basics, needs guidance, developing awareness
- Level 2 (Advancing): Can perform with support, building consistency, growing confidence  
- Level 3 (Independent): Performs effectively without supervision, coaches others, reliable
- Level 4 (Mastery): Expert level, innovates, shapes strategy, develops others, industry leader

For each capability, cite the specific diagnostic response that informed your level assignment.

Additionally, identify the Top 3 highest-leverage capabilities — the ones where improvement would create the biggest impact given this person's role and goals. For each of the Top 3, assign a target_level (current + 1 or current + 2 for stretch).

Return ONLY valid JSON in this exact format:
{
  "capability_matrix": [
    {
      "capability_name": "string",
      "domain": "string",
      "current_level": 1-4,
      "current_level_name": "Foundational|Advancing|Independent|Mastery",
      "evidence": "quoted or paraphrased response that supports this level",
      "is_top3": true/false,
      "priority_rank": null or 1-3,
      "target_level": null or 1-4,
      "target_level_name": null or "Foundational|Advancing|Independent|Mastery",
      "timeline_months": null or "4-8" or "6-12"
    }
  ],
  "profile_summary": {
    "strongest_domain": "string",
    "developing_domains": ["string"],
    "opportunity_domains": ["string"],
    "pattern_notes": "2-3 sentence analysis of overall capability shape"
  }
}`;

  const userMessage = `EMPLOYEE: ${context.full_name}
ROLE: ${context.job_title}
COMPANY: ${context.company_name}
TENURE: ${context.tenure_role}
TEAM SIZE: ${context.team_size}

DIAGNOSTIC RESPONSES:
- Self-rated growth score: ${context.growth_feeling}
- Natural strengths: ${context.natural_strengths}
- Hardest part of role: ${context.hardest_part}
- Obstacles: ${context.obstacles}
- Vision for a great year: ${context.vision_great_year}
- 3-year career goal: ${context.career_goal_3yr}
- Learning preference: ${context.learning_formats}
- Engagement score: ${context.engagement_score ?? 'N/A'}
- Career growth score: ${context.career_growth_score ?? 'N/A'}
- Role clarity score: ${context.role_clarity_score ?? 'N/A'}

ALL RAW ONBOARDING DATA:
${JSON.stringify(context.raw_onboarding, null, 2)}

AVAILABLE CAPABILITIES (select 10-12 most relevant):
${context.capabilities.map((c: any) => `- ${c.name} (${c.category}): ${c.description}`).join('\n')}`;

  try {
    const result = await callAI(
      { taskType: 'leadership-assessment', profileId: profile_id, functionName: 'generate-growth-plan-recommendations' },
      [{ role: 'user', content: userMessage }],
      { systemPrompt, maxTokens: 4000, temperature: 0.3 }
    );

    const parsed = tryParseJSON(result.content);
    if (!parsed) {
      console.error('[growth-plan] Failed to parse capability matrix, retrying...');
      // Retry once
      const retry = await callAI(
        { taskType: 'leadership-assessment', profileId: profile_id, functionName: 'generate-growth-plan-recommendations' },
        [{ role: 'user', content: userMessage + '\n\nCRITICAL: Return ONLY valid JSON. No markdown fences.' }],
        { systemPrompt, maxTokens: 4000, temperature: 0.2 }
      );
      return tryParseJSON(retry.content);
    }
    return parsed;
  } catch (error: any) {
    console.error('[growth-plan] Capability mapping error:', error);
    return null;
  }
}

// ============================================================================
// STAGE 3: REPORT GENERATION (Claude Opus — Call #2)
// ============================================================================

async function generateReport(context: UserContext, capabilityMatrix: any, profile_id: string): Promise<string | null> {
  const top3 = (capabilityMatrix.capability_matrix || []).filter((c: any) => c.is_top3);

  const systemPrompt = `You are Jericho's report writer. You generate Personalized Growth Plans that are so specific, so insightful, and so actionable that people share them with their managers.

You have been given a user's complete diagnostic data and their capability mapping. Generate the FULL report text.

REPORT STRUCTURE:

SECTION 1: DIAGNOSTIC SNAPSHOT
- Three scores (engagement, career_growth, role_clarity) each with score out of 100, one-line interpretive note connecting to something they actually said
- Narrative paragraph (3-4 sentences) connecting scores to their specific situation. Reference their exact words.

SECTION 2: PATTERN ANALYSIS — "What Your Answers Tell Us"
- 8 capability domain categories with percentage scores for radar chart data (return as JSON block)
- 2-3 named patterns (e.g., "The Builder's Paradox") that each reference at least 2 different diagnostic responses, name the tension or insight, connect to the Big 3 development priorities
- 3 "Unfair Advantages" — strengths they may not recognize as strategic assets. Each cites evidence and connects to growth acceleration.

SECTION 3: YOUR ACCELERATION MAP — "The Big 3"
For EACH of the 3 highest-leverage capabilities:
A. Header: Name, current level → target level, timeline
B. WHY this capability (2-3 sentences connecting to stated goals, obstacles, role requirements)
C. WHERE YOU ARE (3-4 bullet points of role-specific behavioral indicators — must reference their actual words)
D. WHERE YOU'RE GOING (3-4 bullet points of target-level behaviors — vivid, specific, aspirational)
E. THE GAP (2-3 sentences connecting stated challenges to the capability gap)
F. YOUR FIRST 3 MOVES (hyper-specific, calendar-able):
   - Move 1 (This week): 15-20 minutes
   - Move 2 (Next week): Builds on Move 1
   - Move 3 (End of week 2): Bigger step demonstrating growth
G. WHAT JERICHO UNLOCKS (1-2 sentences showing what ongoing coaching adds)

SECTION 4: YOUR 90-DAY SPRINT — "Where to Start"
- Sprint 1 ONLY. Three phases:
  - Weeks 1-2: Establish Baselines
  - Weeks 3-6: Build & Practice
  - Weeks 7-12: Execute & Measure
- Note: "Sprint 2 should be built from real results, not predictions. Jericho does that."

SECTION 5: PATH TO [THEIR CAREER GOAL] — "The 3-Year View"
- Year 1: Foundation, Year 2: Expansion, Year 3: Strategic Impact
- Gap analysis: Closest to ready, Needs development, Longer-term
- Connect directly to their stated 3-year career goal

SECTION 6: YOUR LEARNING PRESCRIPTION — "Start Here"
- 1 book, 1 podcast/episode, 1 video (TED/YouTube)
- Each under 1 hour/week commitment, matched to learning preference
- Each with why THIS resource for THIS person

SECTION 7: CLOSING
- "Your first move is above. It takes 20 minutes. Do it this week."
- "Then text Jericho what happened."
- "This plan was built for you. No one else has these scores, this capability map, or this growth path. Own it."
- CTA: askjericho.com/try

ABSOLUTE RULES:
1. No two Big 3 sections may share action items or resources
2. Every 'Where You Are' must reference something the person actually said
3. Every action item must be specific enough to put on a calendar
4. Pattern analysis must connect at least 2 different diagnostic responses
5. Every section must include at least one element that could ONLY apply to this person
6. NO filler phrases like "in today's fast-paced world"
7. Minimum 4,000 words. Maximum 7,000 words.
8. Tone: Direct, warm, occasionally challenging. Never corporate. Never condescending.
9. Return as structured markdown with clear section headers. Include JSON blocks for chart data.
10. Every "WHAT JERICHO UNLOCKS" section must create a specific, visceral gap — show the cost of trying to develop this capability alone vs. with ongoing coaching. Don't just say "Jericho helps." Make them feel what they'd lose by stopping at Move 3. Reference their specific situation, not generic coaching benefits.
11. If personality assessment data is present in the diagnostic data (DISC, Strengthscope, Kolbe, StrengthsFinder, Enneagram), add a dedicated subsection under Pattern Analysis called "What Your [Assessment Type] Reveals About Your Growth Path." Connect their personality profile to their Big 3 priorities. Show how their natural wiring accelerates some priorities and creates friction on others. This should feel like a coach who actually understands HOW they're wired, not just WHAT they need to develop.
12. Engagement, Career Growth, and Role Clarity scores must each be accompanied by a specific quote or paraphrase from the diagnostic that JUSTIFIES the score. If the score feels disconnected from what the person said, adjust the score to match the evidence. The evidence always wins.`;

  const userMessage = `EMPLOYEE: ${context.full_name}
ROLE: ${context.job_title}
COMPANY: ${context.company_name}
TENURE: ${context.tenure_role}
TEAM SIZE: ${context.team_size}

DIAGNOSTIC RESPONSES:
- Self-rated growth score: ${context.growth_feeling}
- Natural strengths: "${context.natural_strengths}"
- Hardest part: "${context.hardest_part}"
- Obstacles: "${context.obstacles}"
- Vision for a great year: "${context.vision_great_year}"
- 3-year career goal: "${context.career_goal_3yr}"
- Learning preference: ${context.learning_formats}
- Engagement: ${context.engagement_score ?? 'N/A'}/100
- Career growth: ${context.career_growth_score ?? 'N/A'}/100
- Role clarity: ${context.role_clarity_score ?? 'N/A'}/100

ALL RAW DATA:
${JSON.stringify(context.raw_onboarding, null, 2)}

CAPABILITY MATRIX (from mapping stage):
${JSON.stringify(capabilityMatrix, null, 2)}

TOP 3 PRIORITIES:
${top3.map((c: any, i: number) => `${i + 1}. ${c.capability_name} — Level ${c.current_level} → ${c.target_level} (${c.timeline_months} months)`).join('\n')}`;

  try {
    const result = await callAI(
      { taskType: 'leadership-assessment', profileId: profile_id, functionName: 'generate-growth-plan-recommendations', estimatedOutputTokens: 12000 },
      [{ role: 'user', content: userMessage }],
      { systemPrompt, maxTokens: 16000, temperature: 0.7 }
    );

    // Check for truncation — if no closing section, request continuation
    if (!result.content.includes('askjericho.com') && !result.content.includes('Own it') && result.content.length > 3000) {
      console.log('[growth-plan] Report may be truncated, requesting continuation...');
      const continuation = await callAI(
        { taskType: 'leadership-assessment', profileId: profile_id, functionName: 'generate-growth-plan-recommendations' },
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: result.content },
          { role: 'user', content: 'Continue the report from where you left off. Complete all remaining sections including the Learning Prescription and Closing.' },
        ],
        { systemPrompt, maxTokens: 4000, temperature: 0.7 }
      );
      return result.content + '\n\n' + continuation.content;
    }

    return result.content;
  } catch (error: any) {
    console.error('[growth-plan] Report generation error:', error);
    return null;
  }
}

// ============================================================================
// STAGE 4: BUILD HTML REPORT EMAIL
// ============================================================================

function svgArcGauge(score: number | null, label: string, benchmark: number = 60): string {
  const val = score ?? 0;
  const color = val >= benchmark + 10 ? '#2ecc71' : val >= benchmark - 10 ? '#e67e22' : '#e74c3c';
  const radius = 54;
  const strokeWidth = 10;
  const cx = 65, cy = 65;
  // 260-degree arc
  const startAngle = 140; // degrees from 12 o'clock (bottom-left start)
  const totalAngle = 260;
  const endAngleFill = startAngle + (totalAngle * Math.min(val, 100) / 100);
  const toRad = (deg: number) => (deg - 90) * Math.PI / 180;
  const arcPoint = (angle: number) => ({
    x: cx + radius * Math.cos(toRad(angle)),
    y: cy + radius * Math.sin(toRad(angle)),
  });
  const trackStart = arcPoint(startAngle);
  const trackEnd = arcPoint(startAngle + totalAngle);
  const fillEnd = arcPoint(endAngleFill);
  const largeTrack = totalAngle > 180 ? 1 : 0;
  const largeFill = (endAngleFill - startAngle) > 180 ? 1 : 0;

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${largeTrack} 1 ${trackEnd.x} ${trackEnd.y}`;
  const fillPath = val > 0
    ? `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${largeFill} 1 ${fillEnd.x} ${fillEnd.y}`
    : '';

  return `<div style="text-align:center;width:160px;">
    <svg viewBox="0 0 130 130" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
      <path d="${trackPath}" fill="none" stroke="#e8ecf0" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>` : ''}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="'Merriweather',Georgia,serif" font-size="28" font-weight="700" fill="${color}">${score ?? '—'}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="'Inter',Arial,sans-serif" font-size="9" fill="#999" text-transform="uppercase" letter-spacing="0.5">/100</text>
    </svg>
    <p style="margin:4px 0 0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">${label}</p>
  </div>`;
}

function capabilityProgressBar(current: number, target: number | null, currentName: string, targetName: string | null): string {
  const levels = ['Foundational', 'Advancing', 'Independent', 'Mastery'];
  const fillPct = (current / 4) * 100;
  const targetPct = target ? (target / 4) * 100 : null;

  const dots = levels.map((lvl, i) => {
    const pct = ((i + 1) / 4) * 100;
    const isCurrent = (i + 1) === current;
    const isTarget = (i + 1) === (target ?? 0);
    const isPast = (i + 1) <= current;
    return `
      <div style="position:absolute;left:${pct}%;transform:translateX(-50%);top:-8px;text-align:center;">
        <div style="width:${isCurrent || isTarget ? 14 : 8}px;height:${isCurrent || isTarget ? 14 : 8}px;border-radius:50%;background:${isTarget ? '#c9963b' : isPast ? '#3d8bd4' : '#d1d5db'};border:${isCurrent ? '3px solid #0d1b2a' : isTarget ? '3px solid #c9963b' : 'none'};margin:0 auto;box-sizing:border-box;"></div>
        <p style="font-size:9px;color:${isCurrent ? '#0d1b2a' : isTarget ? '#c9963b' : '#999'};font-weight:${isCurrent || isTarget ? '700' : '400'};margin:4px 0 0;white-space:nowrap;font-family:'Inter',Arial,sans-serif;">${lvl}</p>
        ${isCurrent ? '<p style="font-size:8px;color:#3d8bd4;margin:1px 0 0;font-weight:600;font-family:\'Inter\',Arial,sans-serif;">YOU</p>' : ''}
        ${isTarget ? '<p style="font-size:8px;color:#c9963b;margin:1px 0 0;font-weight:600;font-family:\'Inter\',Arial,sans-serif;">TARGET</p>' : ''}
      </div>`;
  }).join('');

  return `<div style="position:relative;height:60px;margin:30px 20px 40px;">
    <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#e8ecf0;border-radius:3px;">
      <div style="width:${fillPct}%;height:100%;background:linear-gradient(90deg,#3d8bd4,#2c6faa);border-radius:3px;transition:width 0.3s;"></div>
      ${targetPct ? `<div style="position:absolute;left:${targetPct}%;top:-4px;width:3px;height:14px;background:#c9963b;border-radius:2px;transform:translateX(-50%);"></div>` : ''}
    </div>
    ${dots}
  </div>`;
}

function sprintTimeline(): string {
  const phases = [
    { label: 'WEEKS 1–2', title: 'Establish Baselines', desc: 'Set benchmarks, identify starting points, begin first moves' },
    { label: 'WEEKS 3–6', title: 'Build & Practice', desc: 'Deepen habits, apply skills daily, gather feedback' },
    { label: 'WEEKS 7–12', title: 'Execute & Measure', desc: 'Demonstrate growth, measure against baselines' },
    { label: 'DAY 90', title: 'Sprint Review', desc: 'Self-assess, celebrate wins, plan Sprint 2 with Jericho' },
  ];

  const dots = phases.map((p, i) => {
    const left = (i / (phases.length - 1)) * 100;
    const isFirst = i === 0;
    return `<div style="position:absolute;left:${left}%;transform:translateX(-50%);text-align:center;width:140px;">
      <p style="font-family:'Inter',Arial,sans-serif;font-size:9px;color:#c9963b;font-weight:700;letter-spacing:1.5px;margin:0 0 8px;">${p.label}</p>
      <div style="width:${isFirst ? 18 : 14}px;height:${isFirst ? 18 : 14}px;background:${isFirst ? '#c9963b' : '#3d8bd4'};border-radius:50%;margin:0 auto;border:${isFirst ? '3px solid #f0dbb8' : 'none'};box-sizing:border-box;"></div>
      <p style="font-family:'Merriweather',Georgia,serif;font-size:12px;font-weight:700;color:#0d1b2a;margin:8px 0 2px;">${p.title}</p>
      <p style="font-family:'Inter',Arial,sans-serif;font-size:10px;color:#666;margin:0;line-height:1.4;">${p.desc}</p>
    </div>`;
  }).join('');

  return `<div style="position:relative;margin:50px 30px 80px;height:160px;">
    <div style="position:absolute;top:29px;left:0;right:0;height:3px;background:linear-gradient(90deg,#c9963b,#3d8bd4,#3d8bd4,#2c6faa);border-radius:2px;"></div>
    ${dots}
  </div>`;
}

function careerPathway(context: UserContext): string {
  const goal = context.career_goal_3yr || 'Your Career Goal';
  const cards = [
    { year: 'Year 1', title: 'Foundation', color: '#3d8bd4', desc: 'Build core capabilities, establish habits, prove growth trajectory' },
    { year: 'Year 2', title: 'Expansion', color: '#c9963b', desc: 'Broaden scope, develop others, take on strategic projects' },
    { year: 'Year 3', title: 'Strategic Impact', color: '#2ecc71', desc: 'Lead at scale, shape direction, arrive at your goal' },
  ];

  const cardHtml = cards.map((c, i) => {
    const isFirst = i === 0;
    return `<td style="width:30%;vertical-align:top;">
      <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #eee;position:relative;">
        <div style="height:5px;background:${c.color};"></div>
        ${isFirst ? '<div style="position:absolute;top:12px;right:10px;background:#e74c3c;color:#fff;font-size:8px;font-weight:700;padding:2px 6px;border-radius:3px;font-family:\'Inter\',Arial,sans-serif;letter-spacing:0.5px;">YOU ARE HERE</div>' : ''}
        <div style="padding:18px 14px;">
          <p style="font-family:'Inter',Arial,sans-serif;font-size:10px;color:${c.color};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px;">${c.year}</p>
          <p style="font-family:'Merriweather',Georgia,serif;font-size:15px;font-weight:700;color:#0d1b2a;margin:0 0 8px;">${c.title}</p>
          <p style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:#666;margin:0;line-height:1.5;">${c.desc}</p>
        </div>
      </div>
    </td>
    ${i < 2 ? '<td style="width:5%;text-align:center;vertical-align:middle;"><span style="color:#c9963b;font-size:22px;">→</span></td>' : ''}`;
  }).join('');

  return `<div style="margin:25px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>${cardHtml}</tr>
    </table>
    <div style="text-align:center;margin-top:16px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0d1b2a,#1b3a5c);color:#fff;padding:8px 24px;border-radius:20px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;">
        🎯 GOAL: ${goal.length > 80 ? goal.substring(0, 80) + '…' : goal}
      </div>
    </div>
  </div>`;
}

function buildReportHtml(context: UserContext, capabilityMatrix: any, reportMarkdown: string): string {
  const top3 = (capabilityMatrix.capability_matrix || []).filter((c: any) => c.is_top3);
  const summary = capabilityMatrix.profile_summary || {};
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Convert markdown sections to HTML
  const reportHtml = markdownToHtml(reportMarkdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personalized Growth Plan — ${context.full_name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f0ea; color: #2c3e50; line-height: 1.7; -webkit-font-smoothing: antialiased; }
    .container { max-width: 760px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 40px rgba(0,0,0,0.08); }
    
    /* Cover */
    .cover { background: linear-gradient(145deg, #0a1628 0%, #0d1b2a 40%, #1b3a5c 100%); color: #ffffff; padding: 70px 55px 60px; text-align: center; position: relative; overflow: hidden; }
    .cover::before { content: ''; position: absolute; top: -50%; right: -30%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(201,150,59,0.08) 0%, transparent 70%); }
    .cover-logo { display: inline-block; width: 52px; height: 52px; background: linear-gradient(135deg, #c9963b, #dbb065); border-radius: 14px; line-height: 52px; font-family: 'Merriweather', Georgia, serif; font-size: 28px; font-weight: 900; color: #0d1b2a; margin-bottom: 24px; }
    .cover h1 { font-family: 'Merriweather', Georgia, serif; font-size: 30px; margin: 0 0 6px; font-weight: 700; letter-spacing: 0.5px; }
    .cover .subtitle { color: #c9963b; font-family: 'Merriweather', Georgia, serif; font-size: 20px; margin: 0 0 6px; font-weight: 400; }
    .cover .role-line { color: #7da8c9; font-size: 14px; margin: 0 0 28px; }
    .cover .tagline { color: #5b88a6; font-size: 13px; margin: 24px 0 0; letter-spacing: 0.3px; }
    .cover .valued { color: #c9963b; font-size: 11px; margin-top: 28px; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 600; }
    .cover .date-line { color: #4a6a80; font-size: 12px; margin-top: 12px; }
    .gold-rule { height: 3px; background: linear-gradient(90deg, transparent 5%, #c9963b 30%, #dbb065 50%, #c9963b 70%, transparent 95%); margin: 0; border: none; }
    
    /* Sections */
    .section { padding: 45px 55px; }
    .section h2 { font-family: 'Merriweather', Georgia, serif; color: #0d1b2a; font-size: 22px; margin: 0 0 8px; border-bottom: 2px solid #c9963b; padding-bottom: 10px; font-weight: 700; }
    .section h3 { font-family: 'Merriweather', Georgia, serif; color: #2c6faa; font-size: 17px; margin: 28px 0 10px; font-weight: 700; }
    .section h4 { font-family: 'Inter', sans-serif; color: #0d1b2a; font-size: 14px; margin: 22px 0 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .section p { margin: 8px 0; font-size: 14.5px; line-height: 1.75; }
    .section ul { padding-left: 20px; }
    .section li { margin: 6px 0; font-size: 14.5px; line-height: 1.65; }
    
    /* Score Dashboard */
    .scores { display: flex; justify-content: center; gap: 20px; margin: 30px 0; padding: 25px 0; background: linear-gradient(180deg, #f8f9fb 0%, #fff 100%); border-radius: 16px; border: 1px solid #eef1f5; }
    
    /* Big 3 Cards */
    .big3-card { background: linear-gradient(135deg, #f9fafb 0%, #f3f5f8 100%); border-left: 4px solid #c9963b; padding: 28px 25px; margin: 22px 0; border-radius: 0 12px 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .big3-card h3 { font-family: 'Merriweather', Georgia, serif; color: #0d1b2a; margin-top: 0; border: none; font-size: 18px; }
    .big3-meta { font-family: 'Inter', sans-serif; font-size: 12px; color: #888; margin: 4px 0 16px; }
    
    /* Moves */
    .move { background: #ffffff; border: 1px solid #e5e8ed; border-radius: 10px; padding: 16px 18px; margin: 10px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.02); }
    .move-label { color: #c9963b; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; font-family: 'Inter', sans-serif; }
    
    /* Pattern/Advantage cards */
    .pattern-card { background: linear-gradient(135deg, #f8f9fb, #eef2f7); border-radius: 10px; padding: 22px; margin: 15px 0; border: 1px solid #dde3ea; }
    .pattern-card .name { font-family: 'Merriweather', Georgia, serif; color: #0d1b2a; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
    .advantage-card { background: linear-gradient(135deg, #fffcf5, #fef6e4); border-radius: 10px; padding: 22px; margin: 15px 0; border: 1px solid #f0e0c0; }
    
    /* CTA */
    .cta-section { background: linear-gradient(145deg, #0a1628, #0d1b2a 40%, #1b3a5c); color: #fff; padding: 50px 55px; text-align: center; position: relative; }
    .cta-section p { color: #7da8c9; font-size: 14px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #c9963b, #dbb065); color: #0d1b2a; text-decoration: none; padding: 16px 44px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 22px 0; font-family: 'Inter', sans-serif; letter-spacing: 0.3px; box-shadow: 0 4px 16px rgba(201,150,59,0.3); }
    .cta-quote { font-family: 'Merriweather', Georgia, serif; font-style: italic; color: #c9963b; margin-top: 30px; font-size: 14px; }
    
    /* Footer */
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #999; background: #f8f9fb; }
    
    @media (max-width: 600px) {
      .section, .cover, .cta-section { padding: 30px 22px; }
      .scores { flex-direction: column; align-items: center; gap: 15px; }
    }

    @media print {
      body { background: #fff; }
      .container { box-shadow: none; max-width: 100%; }
      .cover { break-after: page; }
      .section { break-inside: avoid; }
      .big3-card { break-inside: avoid; }
      .cta-section { break-before: page; }
      .cta-button { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- COVER -->
    <div class="cover">
      <div class="cover-logo">J</div>
      <p style="color: #c9963b; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 24px; font-weight: 600;">The Momentum Company presents</p>
      <h1>PERSONALIZED GROWTH PLAN</h1>
      <p class="subtitle">${context.full_name}</p>
      <p class="role-line">${context.job_title}${context.company_name ? ' · ' + context.company_name : ''}</p>
      <p class="tagline">${(capabilityMatrix.capability_matrix || []).length} capabilities analyzed · ${top3.length} priorities identified · 1 clear path forward</p>
      <p class="valued">Your complimentary Growth Map</p>
      <p class="date-line">${date}</p>
    </div>
    <hr class="gold-rule">

    <!-- SCORE DASHBOARD -->
    <div class="section">
      <h2>📊 Your Leadership Profile</h2>
      <div class="scores">
        ${svgArcGauge(context.engagement_score, 'Engagement', 60)}
        ${svgArcGauge(context.career_growth_score, 'Career Growth', 60)}
        ${svgArcGauge(context.role_clarity_score, 'Role Clarity', 60)}
      </div>
    </div>
    <hr class="gold-rule">

    <!-- BIG 3 SUMMARY -->
    <div class="section">
      <h2>🎯 The Big 3 — Your Acceleration Map</h2>
      ${top3.map((c: any, i: number) => `
      <div class="big3-card">
        <h3>#${i + 1}: ${c.capability_name}</h3>
        <p class="big3-meta">${c.domain} · ${c.timeline_months || '4-8'} months · Level ${c.current_level} → ${c.target_level}</p>
        ${capabilityProgressBar(c.current_level, c.target_level, c.current_level_name, c.target_level_name)}
        <p style="font-size: 13px; color: #555; font-style: italic; margin-top: 20px; border-left: 3px solid #c9963b; padding-left: 12px;">"${c.evidence}"</p>
      </div>`).join('')}
    </div>
    <hr class="gold-rule">

    <!-- 90-DAY SPRINT TIMELINE -->
    <div class="section">
      <h2>🏃 Your 90-Day Sprint</h2>
      <p style="color:#666;font-size:13px;margin-bottom:5px;">Sprint 1 — the only sprint built from prediction. Sprint 2 comes from real results.</p>
      ${sprintTimeline()}
    </div>
    <hr class="gold-rule">

    <!-- CAREER PATHWAY -->
    <div class="section">
      <h2>🗺️ Path to Your Career Goal — The 3-Year View</h2>
      ${careerPathway(context)}
    </div>
    <hr class="gold-rule">

    <!-- FULL REPORT -->
    <div class="section">
      ${reportHtml}
    </div>
    <hr class="gold-rule">

    <!-- CTA -->
    <div class="cta-section">
      <p style="color: #c9963b; font-size: 14px; margin-bottom: 5px; font-weight: 600;">Your first move is above. It takes 20 minutes.</p>
      <p style="color: #ffffff; font-family: 'Merriweather', Georgia, serif; font-size: 22px; font-weight: 700; margin: 8px 0 0;">Do it this week. Then tell Jericho what happened.</p>
      <a href="https://askjericho.com/try" class="cta-button">Continue with Jericho →</a>
      <p class="cta-quote">"You don't rise to your goals. You fall to your systems."</p>
    </div>

    <div class="footer">
      <p style="margin:0 0 4px;">The Momentum Company · <a href="https://askjericho.com" style="color: #2c6faa; text-decoration: none;">askjericho.com</a></p>
      <p style="margin:0;">This plan was built for ${context.full_name}. No one else has these scores, this capability map, or this growth path.</p>
    </div>
  </div>
</body>
</html>`;
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^# (.*$)/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/```json\n([\s\S]*?)```/g, '<pre style="background:#f8f9fa;padding:15px;border-radius:8px;font-size:12px;overflow-x:auto;">$1</pre>')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#f8f9fa;padding:15px;border-radius:8px;font-size:12px;">$1</pre>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup])/gm, '')
    ;
}

// ============================================================================
// STAGE 6: DELIVERY
// ============================================================================

async function deliver(supabase: any, profile_id: string, growthPlanId: string | null, context: UserContext, capabilityMatrix: any, reportHtml: string) {
  const top3 = (capabilityMatrix.capability_matrix || []).filter((c: any) => c.is_top3);
  const top3Names = top3.map((c: any) => c.capability_name).join(', ');
  const capCount = (capabilityMatrix.capability_matrix || []).length;

  let emailSent = false;
  let smsSent = false;

  // EMAIL
  if (context.email) {
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Jericho <jericho@sender.askjericho.com>',
          to: [context.email],
          subject: `${context.first_name}, your Personalized Growth Plan is ready`,
          html: reportHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errText = await emailResponse.text();
        throw new Error(`Resend API ${emailResponse.status}: ${errText}`);
      }

      emailSent = true;
      console.log('[growth-plan] Email sent to', context.email);
    } catch (e: any) {
      console.error('[growth-plan] Email failed:', e.message);
      await writeError(supabase, profile_id, growthPlanId, 'email_delivery', e.message);
    }
  }

  // SMS
  if (context.phone) {
    try {
      const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
      const TWILIO_AUTH = Deno.env.get('TWILIO_AUTH_TOKEN');
      const TWILIO_FROM = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (TWILIO_SID && TWILIO_AUTH && TWILIO_FROM) {
        const smsBody = `Hey ${context.first_name} — your Personalized Growth Plan just landed in your inbox. I analyzed ${capCount} capabilities and identified your top 3: ${top3Names}. Excited for you to see it. — Jericho`;

        const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_AUTH}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: context.phone,
            From: TWILIO_FROM,
            Body: smsBody,
          }),
        });

        if (twilioRes.ok) {
          smsSent = true;
          console.log('[growth-plan] SMS sent to', context.phone);
        } else {
          const err = await twilioRes.text();
          console.error('[growth-plan] SMS error:', err);
        }
      }
    } catch (e: any) {
      console.error('[growth-plan] SMS delivery error:', e.message);
    }
  }

  // STATUS — only "delivered" if email actually sent
  const finalStatus = emailSent ? 'delivered' : 'generated_not_delivered';

  if (growthPlanId) {
    await supabase.from('growth_plans').update({
      status: finalStatus,
      delivered_at: emailSent ? new Date().toISOString() : null,
      delivery_method: emailSent && smsSent ? 'email+sms'
        : emailSent ? 'email'
        : smsSent ? 'sms'
        : 'none',
    }).eq('id', growthPlanId);
  }

  await supabase.from('user_active_context').update({
    report_status: finalStatus,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', profile_id);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

async function writeError(supabase: any, profile_id: string, growthPlanId: string | null, stage: string, errorMsg: string) {
  const errorEntry = { stage, error: errorMsg.substring(0, 1000), timestamp: new Date().toISOString() };
  console.error(`[growth-plan] ❌ Error at ${stage}:`, errorMsg);

  try {
    await supabase.from('user_active_context').update({
      report_status: 'failed',
      error_log: JSON.stringify(errorEntry),
      updated_at: new Date().toISOString(),
    }).eq('profile_id', profile_id);

    if (growthPlanId) {
      // Append to error_log jsonb array
      const { data: existing } = await supabase.from('growth_plans').select('error_log').eq('id', growthPlanId).single();
      const errors = Array.isArray(existing?.error_log) ? existing.error_log : [];
      errors.push(errorEntry);
      await supabase.from('growth_plans').update({
        status: 'failed',
        error_log: errors,
      }).eq('id', growthPlanId);
    }

    // Send fallback email if we have context
    if (stage !== 'context_load') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const RESEND_FROM = 'Jericho <jericho@sender.askjericho.com>';
      
      // Try to get email from profile
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', profile_id).single();
      if (profile?.email && RESEND_API_KEY) {
        const firstName = (profile.full_name || '').split(' ')[0] || 'there';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Jericho <jericho@sender.askjericho.com>',
            to: [profile.email],
            subject: `${firstName}, your growth plan is on its way`,
            html: `<p>Hey ${firstName},</p><p>Your growth plan is taking a little longer than usual to render. We're on it — you'll have it within 24 hours.</p><p>— Jericho</p>`,
          }),
        });
      }
    }
  } catch (e) {
    console.error('[growth-plan] Failed to write error:', e);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function tryParseJSON(content: string): any {
  try { return JSON.parse(content); } catch { /* continue */ }
  const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[1]); } catch { /* continue */ } }
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) { try { return JSON.parse(objectMatch[0]); } catch { /* continue */ } }
  return null;
}
