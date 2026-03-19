import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// STEP 1: Calculate Engagement Scores (deterministic — no AI)
// ============================================================================
function calculateEngagementScores(d: any) {
  const burnoutRisk = (10 - (d.energy_score || 5)) * 10;
  const roleStrain = (d.challenge_severity || 5) * 10;
  const satMap: Record<string, number> = { a: 70, b: 30, c: 85, d: 20 };
  const satisfaction = satMap[d.satisfaction] || 50;
  const selfEfficacy = (d.confidence_score || 5) * 10;
  const orgSupport = (d.org_support === true || d.org_support === 'yes') ? 80 : 30;
  const strengthUtil = (d.strength_utilization || 5) * 10;
  const barrierMap: Record<string, number> = { a: 40, b: 50, c: 35, d: 45 };
  const growthBarriers = barrierMap[d.learning_barrier] || 45;
  const overallEngagement = (d.engagement_score || 5) * 10;

  const composite = Math.round(
    burnoutRisk * 0.20 + roleStrain * 0.15 + satisfaction * 0.15 +
    selfEfficacy * 0.15 + orgSupport * 0.10 + strengthUtil * 0.10 +
    growthBarriers * 0.05 + overallEngagement * 0.10
  );

  return { composite, burnoutRisk, roleStrain, satisfaction, selfEfficacy, orgSupport, strengthUtil, growthBarriers, overallEngagement };
}

// ============================================================================
// Anthropic API helper
// ============================================================================
async function callOpus(systemPrompt: string, userPrompt: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
  }

  const result = await resp.json();
  const text = result.content?.[0]?.text || '';
  return text;
}

// ============================================================================
// Extract JSON from AI response (handles markdown code fences)
// ============================================================================
function extractJson(raw: string): any {
  let cleaned = raw.trim();
  // Strip markdown code fence
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

// ============================================================================
// STEP 2: Capability Selection + Level Estimation
// ============================================================================
const CAPABILITY_SELECTION_SYSTEM = `You are the Jericho Capability Assessment Engine. Given a person's role, challenges, strengths, and conversation data, select the 7 most critical capabilities for their development and estimate their current level.

LEVEL DEFINITIONS:
- foundational (Level 1): Basic awareness. Needs guidance and structure. Learning the fundamentals.
- advancing (Level 2): Developing competence. Can execute with some support. Recognizes patterns but doesn't always act on them.
- independent (Level 3): Reliable performer. Handles complexity autonomously. Coaches others at basic level.
- mastery (Level 4): Expert. Innovates and elevates the entire team. Builds systems and develops other leaders.

RULES:
1. Select capabilities that DIRECTLY connect to what the person told you — their challenges, strengths, role, and vision.
2. Include a MIX: 2-3 capabilities where they're strong (Level 3-4), 3-4 where they have clear gaps (Level 1-2), and 1 stretch capability.
3. The top 3 priorities (is_priority: true) MUST map to their stated development needs.
4. Target level = current + 1 for priorities. Target level = current for strengths. Target level = current + 2 for the stretch (capped at mastery).
5. Reasoning must reference SPECIFIC things the person said — their exact words, their challenge, their feedback.
6. Use ONLY capability IDs from the provided list. Do NOT invent capabilities.

Return JSON only — no explanation outside the JSON:
{
  "capabilities": [
    {
      "capability_id": "uuid from the list",
      "capability_name": "string",
      "category": "string",
      "current_level": "foundational|advancing|independent|mastery",
      "target_level": "foundational|advancing|independent|mastery",
      "is_priority": true/false,
      "reasoning": "2-3 sentences explaining WHY this level, referencing their specific conversation data"
    }
  ]
}`;

async function selectCapabilities(supabase: any, extractedData: any) {
  // Fetch all approved capabilities with their level descriptions
  const { data: capabilities, error: capErr } = await supabase
    .from('capabilities')
    .select('id, name, category, description')
    .eq('status', 'approved');

  if (capErr) throw new Error(`Failed to fetch capabilities: ${capErr.message}`);
  if (!capabilities?.length) throw new Error('No approved capabilities found');

  const { data: allLevels } = await supabase
    .from('capability_levels')
    .select('capability_id, level, description');

  // Build lookup
  const levelsByCapId: Record<string, Record<string, string>> = {};
  for (const lv of allLevels || []) {
    if (!levelsByCapId[lv.capability_id]) levelsByCapId[lv.capability_id] = {};
    levelsByCapId[lv.capability_id][lv.level] = lv.description;
  }

  // Build capabilities list for AI
  const capList = capabilities.map((c: any) => {
    const levels = levelsByCapId[c.id] || {};
    return `ID: ${c.id}\nName: ${c.name}\nCategory: ${c.category || 'General'}\nDescription: ${c.description || ''}\nFoundational: ${levels.foundational || 'N/A'}\nAdvancing: ${levels.advancing || 'N/A'}\nIndependent: ${levels.independent || 'N/A'}\nMastery: ${levels.mastery || 'N/A'}`;
  }).join('\n---\n');

  const d = extractedData;
  const userPrompt = `Select 7 capabilities and estimate levels for this person:

PERSON: ${d.first_name || ''} ${d.last_name || ''}
ROLE: ${d.role || 'Unknown'}
INDUSTRY: ${d.industry || 'Unknown'}
TEAM SIZE: ${d.team_size || 'Unknown'}
LEADS PEOPLE: ${d.leads_people ? 'Yes' : 'No'}
PRIMARY CHALLENGE: ${d.primary_challenge || 'Unknown'} (severity: ${d.challenge_severity || '?'}/10)
STRENGTHS: ${d.strengths || 'Unknown'}
RECENT WIN: ${d.recent_win || 'Unknown'}
SKILL GAP: ${d.skill_gap || 'Unknown'}
FEEDBACK: ${d.feedback_received || 'Unknown'}
VISION: ${d.twelve_month_vision || 'Unknown'}
ENERGY: ${d.energy_score || '?'}/10
CONFIDENCE: ${d.confidence_score || '?'}/10
STRENGTH UTILIZATION: ${d.strength_utilization || '?'}/10
SATISFACTION: ${d.satisfaction || '?'}
ORG SUPPORT: ${d.org_support ? 'Yes' : 'No'}
LEARNING FORMAT: ${d.learning_format || 'Unknown'}
AVAILABLE TIME: ${d.available_time || 'Unknown'}
LEARNING BARRIER: ${d.learning_barrier || '?'}
QUICK WIN: ${d.quick_win || 'Unknown'}
ENGAGEMENT: ${d.engagement_score || '?'}/10

AVAILABLE CAPABILITIES:
${capList}`;

  const raw = await callOpus(CAPABILITY_SELECTION_SYSTEM, userPrompt);
  const parsed = extractJson(raw);

  if (!parsed.capabilities || parsed.capabilities.length !== 7) {
    throw new Error(`Expected 7 capabilities, got ${parsed.capabilities?.length || 0}`);
  }

  // Attach full level descriptions for narrative generation
  for (const cap of parsed.capabilities) {
    cap.level_descriptions = levelsByCapId[cap.capability_id] || {};
  }

  return parsed.capabilities;
}

// ============================================================================
// STEP 3: Generate Narrative Content
// ============================================================================
const NARRATIVE_SYSTEM = `You are the Jericho Playbook Engine. You generate devastatingly personalized coaching content for Individual Playbooks. Your writing is warm, direct, coaching-oriented — like a sharp friend who sees you clearly and tells you the truth with love.

RULES:
1. Use their EXACT words when referencing what they told you. Mirror their language — never translate into clinical terms.
2. Every sentence should feel like it could only have been written for THIS person. Nothing generic.
3. Write in second person ("you"). Direct address, always.
4. Be honest about concerning scores. A 4/10 energy is dangerous — say so directly.
5. Connect insights ACROSS data points. The power is in the PATTERN, not individual scores.
6. Maximum 3-4 sentences per paragraph. Tight, punchy, zero fluff.
7. Celebrate strengths before addressing gaps. Lead with what's working.
8. Frame development as unlocking what they already have, not fixing what's broken.
9. The Quick Win must be specific enough to execute THIS WEEK — a framework, a script, a constraint.
10. Learning resources must match their stated format preference and available time. Use REAL resources (real books, real podcasts, real frameworks) — never invent titles.
11. NEVER use the phrase "90-Day Sprint." The correct framework is: 90-Day Targets → 30-Day Benchmarks → 7-Day Sprints.
12. For capabilities: reference their conversation data in the reasoning. "You said X — that's a Level 2 pattern because..."
13. The "unlock" fields are the SALE. Each one must reference a SPECIFIC thing they said — their challenge, their vision, their win, their format preference, their team size. If a reader could swap in a different person's name and the line still works, you failed. These must feel like the software already knows them intimately.

Return a JSON object with these exact keys:

{
  "snapshot_paragraphs": ["paragraph 1 as HTML with <strong> and <em> tags", "paragraph 2"],
  "north_star_text": "Their 12-month vision — quoted or lightly refined for clarity",
  "north_star_followup": "One sentence connecting confidence score to making it inevitable",
  "superpower_paragraphs": ["paragraph 1 with <strong> and <em> tags", "paragraph 2"],
  "growth_edge_quote": "Their exact words about their gap — direct quote from their conversation",
  "growth_edge_intro": "1-2 sentences connecting the quote to their development priorities",
  "priorities": [
    {
      "title": "Priority capability name",
      "description": "2-3 sentences on what this means and why it matters NOW for them specifically"
    }
  ],
  "quick_win_title": "Name of the framework or action",
  "quick_win_intro": "Setup paragraph referencing what they said they needed, with <em> tags for their words",
  "quick_win_steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
  "quick_win_closer": "One sentence motivating follow-through — direct and personal",
  "learning_intro": "1-2 sentences acknowledging their time constraint and format preference",
  "learning_resources": [
    {
      "type": "podcast|framework|reflection|article|video",
      "title": "Real resource name",
      "description": "Why THIS resource for THIS person and how to use it",
      "time_estimate": "22 min"
    }
  ],
  "diagnostic_commentary": "2-3 sentences interpreting their overall composite engagement score and what it means for their trajectory — honest, not sugarcoated",
  "burnout_alert": "If energy_score <= 5: a direct 2-sentence warning about sustainability. If energy > 5: null",
  "closing_statement": "Motivating final line that references their North Star vision",
  "unlock_target": "One sentence about their first 90-Day Target based on their vision — specific to their exact words.",
  "unlock_brief": "One sentence about what tomorrow's coaching brief will address — reference their specific challenge.",
  "unlock_tracking": "One sentence about the specific score being tracked that should concern them.",
  "unlock_capabilities": "One sentence referencing their specific capability gaps and the self-assess option.",
  "unlock_learning": "One sentence referencing their exact format preference and time constraint.",
  "unlock_memory": "One sentence making it clear Jericho retains full context from this conversation.",
  "quick_win_hours": "A number (string): estimated hours per week the quick win could recover. Be specific and conservative."
}`;

async function generateNarrative(extractedData: any, engagementScores: any, capabilities: any[]) {
  const d = extractedData;
  const priorities = capabilities.filter((c: any) => c.is_priority);
  const strengths = capabilities.filter((c: any) => !c.is_priority);

  const userPrompt = `Generate the Playbook narrative for this person:

PERSON: ${d.first_name || ''} ${d.last_name || ''}
ROLE: ${d.role || 'Unknown'}
INDUSTRY: ${d.industry || 'Unknown'}
COMPANY SIZE: ${d.company_size || 'Unknown'}
LEADS PEOPLE: ${d.leads_people ? 'Yes' : 'No'}
TEAM SIZE: ${d.team_size || 'Unknown'}

CONVERSATION DATA:
- Primary Challenge: ${d.primary_challenge || 'Unknown'} (severity: ${d.challenge_severity || '?'}/10)
- Energy Score: ${d.energy_score || '?'}/10
- Satisfaction: ${d.satisfaction || '?'} (a=love work but context is problem, b=work is stale, c=growing and enjoying, d=thinking about change)
- 12-Month Vision: ${d.twelve_month_vision || 'Unknown'}
- Confidence: ${d.confidence_score || '?'}/10
- Org Support: ${d.org_support ? 'Yes' : 'No'}
- Strengths: ${d.strengths || 'Unknown'}
- Recent Win: ${d.recent_win || 'Unknown'}
- Skill Gap: ${d.skill_gap || 'Unknown'}
- Feedback Received: ${d.feedback_received || 'Unknown'}
- Strength Utilization: ${d.strength_utilization || '?'}/10
- Learning Format: ${d.learning_format || 'Unknown'}
- Available Time: ${d.available_time || 'Unknown'}
- Learning Barrier: ${d.learning_barrier || '?'} (a=time, b=relevance, c=energy, d=access)
- Quick Win: ${d.quick_win || 'Unknown'}
- Engagement: ${d.engagement_score || '?'}/10

ENGAGEMENT SCORES:
- Composite: ${engagementScores.composite}
- Burnout Risk: ${engagementScores.burnoutRisk}
- Role Strain: ${engagementScores.roleStrain}
- Satisfaction: ${engagementScores.satisfaction}
- Self-Efficacy: ${engagementScores.selfEfficacy}
- Org Support: ${engagementScores.orgSupport}
- Strength Utilization: ${engagementScores.strengthUtil}
- Growth Barriers: ${engagementScores.growthBarriers}
- Overall Engagement: ${engagementScores.overallEngagement}

SELECTED CAPABILITIES (7):
${capabilities.map((c: any, i: number) => `${i + 1}. ${c.capability_name} (${c.category})
   Current: ${c.current_level} → Target: ${c.target_level}
   Priority: ${c.is_priority ? 'YES' : 'no'}
   AI Reasoning: ${c.reasoning}
   Level Descriptions:
     Foundational: ${c.level_descriptions?.foundational || 'N/A'}
     Advancing: ${c.level_descriptions?.advancing || 'N/A'}
     Independent: ${c.level_descriptions?.independent || 'N/A'}
     Mastery: ${c.level_descriptions?.mastery || 'N/A'}`).join('\n\n')}

PRIORITIES (development focus):
${priorities.map((p: any) => `- ${p.capability_name}: ${p.reasoning}`).join('\n')}

STRENGTHS (celebrate):
${strengths.map((s: any) => `- ${s.capability_name}: ${s.reasoning}`).join('\n')}`;

  const raw = await callOpus(NARRATIVE_SYSTEM, userPrompt);
  return extractJson(raw);
}

// ============================================================================
// STEP 4: Validate narrative output
// ============================================================================
function validateNarrative(n: any, energyScore: number): string[] {
  const errors: string[] = [];
  if (!n.snapshot_paragraphs?.length) errors.push('Missing snapshot_paragraphs');
  if (!n.north_star_text) errors.push('Missing north_star_text');
  if (!n.superpower_paragraphs?.length) errors.push('Missing superpower_paragraphs');
  if (!n.growth_edge_quote) errors.push('Missing growth_edge_quote');
  if (!n.priorities || n.priorities.length !== 3) errors.push(`Expected 3 priorities, got ${n.priorities?.length || 0}`);
  if (!n.quick_win_title) errors.push('Missing quick_win_title');
  if (!n.quick_win_steps || n.quick_win_steps.length < 2 || n.quick_win_steps.length > 4) errors.push('quick_win_steps must have 2-4 items');
  if (!n.learning_resources || n.learning_resources.length < 2 || n.learning_resources.length > 4) errors.push('learning_resources must have 2-4 items');
  if (energyScore <= 5 && !n.burnout_alert) errors.push('burnout_alert required for energy <= 5');
  const unlockKeys = ['unlock_target', 'unlock_brief', 'unlock_tracking', 'unlock_capabilities', 'unlock_learning', 'unlock_memory'];
  for (const k of unlockKeys) {
    if (!n[k]) errors.push(`Missing ${k}`);
  }
  if (!n.quick_win_hours || isNaN(Number(n.quick_win_hours))) errors.push('quick_win_hours must be a number string');
  return errors;
}

// ============================================================================
// Build Playbook HTML
// ============================================================================
function buildPlaybookHtml(d: any, eng: any, caps: any[], narrative: any): string {
  const firstName = d.first_name || 'there';
  const levelColors: Record<string, string> = {
    foundational: '#3B82F6',
    advancing: '#22C55E',
    independent: '#F97316',
    mastery: '#A855F7',
  };
  const levelNumbers: Record<string, number> = {
    foundational: 1, advancing: 2, independent: 3, mastery: 4,
  };
  const levelLabels: Record<string, string> = {
    foundational: 'Level 1', advancing: 'Level 2', independent: 'Level 3', mastery: 'Level 4',
  };

  // Build capability cards HTML
  const capCardsHtml = caps.map((c: any) => {
    const currentNum = levelNumbers[c.current_level] || 1;
    const targetNum = levelNumbers[c.target_level] || 2;
    const color = levelColors[c.current_level] || '#3B82F6';
    const dots = [1, 2, 3, 4].map(n =>
      `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:4px;${n <= currentNum ? `background:${color};` : 'background:rgba(255,255,255,0.15);'}${n === targetNum && n > currentNum ? `border:2px solid ${color};background:transparent;` : ''}"></span>`
    ).join('');
    const levelDesc = c.level_descriptions?.[c.current_level] || '';
    return `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;color:#FFF;font-size:15px;">${c.capability_name}</span>
        <span style="font-size:12px;color:${color};font-weight:600;">${levelLabels[c.current_level]} → ${levelLabels[c.target_level]}</span>
      </div>
      <div style="margin-bottom:8px;">${dots}</div>
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">${c.reasoning}</p>
      ${levelDesc ? `<p style="margin:8px 0 0;font-size:12px;color:#6B7280;font-style:italic;">At ${levelLabels[c.current_level]}: ${levelDesc}</p>` : ''}
    </div>`;
  }).join('');

  // Priority items
  const prioritiesHtml = (narrative.priorities || []).map((p: any) =>
    `<div style="background:rgba(229,165,48,0.08);border-left:3px solid #E5A530;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:12px;">
      <p style="margin:0 0 4px;font-weight:600;color:#E5A530;font-size:15px;">🎯 ${p.title}</p>
      <p style="margin:0;color:#D1D5DB;font-size:14px;line-height:1.6;">${p.description}</p>
    </div>`
  ).join('');

  // Quick win steps
  const stepsHtml = (narrative.quick_win_steps || []).map((s: string, i: number) =>
    `<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
      <span style="flex-shrink:0;width:28px;height:28px;background:#E5A530;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#0F1419;font-size:13px;">${i + 1}</span>
      <p style="margin:0;color:#D1D5DB;font-size:14px;line-height:1.6;">${s}</p>
    </div>`
  ).join('');

  // Learning resources
  const typeIcons: Record<string, string> = { podcast: '🎧', framework: '🔧', reflection: '💭', article: '📖', video: '🎬' };
  const resourcesHtml = (narrative.learning_resources || []).map((r: any) =>
    `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:600;color:#FFF;font-size:14px;">${typeIcons[r.type] || '📚'} ${r.title}</span>
        <span style="font-size:12px;color:#6B7280;">${r.time_estimate || ''}</span>
      </div>
      <p style="margin:0;color:#9CA3AF;font-size:13px;line-height:1.5;">${r.description}</p>
    </div>`
  ).join('');

  // Engagement gauge SVG helper
  function gaugeArc(score: number, label: string, color: string): string {
    const pct = Math.max(0, Math.min(100, score));
    const angle = (pct / 100) * 270;
    const r = 40;
    const cx = 50, cy = 50;
    const startAngle = 135;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return `<div style="text-align:center;flex:1;min-width:100px;">
      <svg viewBox="0 0 100 100" width="80" height="80">
        <path d="M ${cx + r * Math.cos(startRad)} ${cy + r * Math.sin(startRad)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos((405 * Math.PI) / 180)} ${cy + r * Math.sin((405 * Math.PI) / 180)}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" stroke-linecap="round"/>
        ${pct > 0 ? `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` : ''}
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#FFF" font-size="18" font-weight="700">${pct}</text>
      </svg>
      <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">${label}</p>
    </div>`;
  }

  // Unlock items
  const unlockItems = [
    { icon: '🎯', label: '90-Day Target', text: narrative.unlock_target },
    { icon: '📋', label: 'Tomorrow\'s Brief', text: narrative.unlock_brief },
    { icon: '📊', label: 'Score Tracking', text: narrative.unlock_tracking },
    { icon: '🧬', label: 'Capabilities', text: narrative.unlock_capabilities },
    { icon: '📚', label: 'Learning Path', text: narrative.unlock_learning },
    { icon: '🧠', label: 'Memory', text: narrative.unlock_memory },
  ].filter(u => u.text).map(u =>
    `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:20px;flex-shrink:0;">${u.icon}</span>
      <div>
        <p style="margin:0 0 2px;font-weight:600;color:#E5A530;font-size:13px;">${u.label}</p>
        <p style="margin:0;color:#D1D5DB;font-size:13px;line-height:1.5;">${u.text}</p>
      </div>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Individual Playbook — ${firstName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0F1419;color:#E5E7EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;}
  .container{max-width:680px;margin:0 auto;padding:40px 24px;}
  .section{margin-bottom:40px;}
  h1{font-size:32px;font-weight:800;color:#FFF;margin-bottom:8px;}
  h2{font-size:22px;font-weight:700;color:#FFF;margin-bottom:16px;}
  h3{font-size:17px;font-weight:600;color:#FFF;margin-bottom:12px;}
  .subtitle{color:#9CA3AF;font-size:15px;margin-bottom:32px;}
  .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(229,165,48,0.3),transparent);margin:32px 0;}
  .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:16px;}
  .highlight{color:#E5A530;}
  .text-body{color:#D1D5DB;font-size:15px;line-height:1.7;margin-bottom:12px;}
  .quote{border-left:3px solid #E5A530;padding:12px 20px;background:rgba(229,165,48,0.06);border-radius:0 8px 8px 0;margin:16px 0;}
  .quote p{color:#E5A530;font-style:italic;font-size:15px;margin:0;}
  .burnout-alert{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px 20px;margin:16px 0;}
  .burnout-alert p{color:#FCA5A5;font-size:14px;margin:0;}
  .cta-button{display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#E5A530,#D4942A);color:#0F1419;font-weight:700;font-size:16px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(229,165,48,0.35);}
  .footer{text-align:center;padding:40px 0;color:#4B5563;font-size:12px;}
</style>
</head><body>
<div class="container">

  <!-- Header -->
  <div class="section" style="text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="background:linear-gradient(135deg,#E5A530,#F5C563);width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:24px;font-weight:bold;color:#0F1419;">J</span>
      </div>
      <span style="font-size:28px;font-weight:700;color:#FFF;">Jericho</span>
    </div>
    <h1>Your Individual Playbook</h1>
    <p class="subtitle">Built for <span class="highlight">${firstName}</span> · ${d.role || 'Professional'} · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
  </div>

  <div class="divider"></div>

  <!-- Snapshot -->
  <div class="section">
    <h2>📍 Your Snapshot</h2>
    ${(narrative.snapshot_paragraphs || []).map((p: string) => `<p class="text-body">${p}</p>`).join('')}
  </div>

  <!-- Engagement Gauges -->
  <div class="section">
    <div class="card" style="padding:24px;">
      <h3 style="text-align:center;margin-bottom:16px;">Your Engagement Profile</h3>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;">
        ${gaugeArc(eng.composite, 'Composite', '#E5A530')}
        ${gaugeArc(100 - eng.burnoutRisk, 'Energy', eng.burnoutRisk > 50 ? '#EF4444' : '#22C55E')}
        ${gaugeArc(eng.selfEfficacy, 'Confidence', '#3B82F6')}
        ${gaugeArc(eng.strengthUtil, 'Utilization', '#A855F7')}
        ${gaugeArc(eng.overallEngagement, 'Engagement', '#06B6D4')}
      </div>
    </div>
    <p class="text-body">${narrative.diagnostic_commentary || ''}</p>
    ${narrative.burnout_alert ? `<div class="burnout-alert"><p>⚠️ ${narrative.burnout_alert}</p></div>` : ''}
  </div>

  <div class="divider"></div>

  <!-- North Star -->
  <div class="section">
    <h2>⭐ Your North Star</h2>
    <div class="quote"><p>"${narrative.north_star_text || ''}"</p></div>
    <p class="text-body">${narrative.north_star_followup || ''}</p>
  </div>

  <!-- Superpower -->
  <div class="section">
    <h2>💎 Your Superpower</h2>
    ${(narrative.superpower_paragraphs || []).map((p: string) => `<p class="text-body">${p}</p>`).join('')}
  </div>

  <div class="divider"></div>

  <!-- Capabilities -->
  <div class="section">
    <h2>🧬 Your 7 Capabilities</h2>
    ${capCardsHtml}
  </div>

  <!-- Growth Edge -->
  <div class="section">
    <h2>🔥 Your Growth Edge</h2>
    <div class="quote"><p>"${narrative.growth_edge_quote || ''}"</p></div>
    <p class="text-body">${narrative.growth_edge_intro || ''}</p>
    <h3 style="margin-top:20px;">Your 3 Priorities</h3>
    ${prioritiesHtml}
  </div>

  <div class="divider"></div>

  <!-- Quick Win -->
  <div class="section">
    <h2>✅ Your 7-Day Quick Win: ${narrative.quick_win_title || ''}</h2>
    <p class="text-body">${narrative.quick_win_intro || ''}</p>
    <div class="card">
      ${stepsHtml}
    </div>
    <p class="text-body" style="font-weight:600;">${narrative.quick_win_closer || ''}</p>
    ${narrative.quick_win_hours ? `<p style="color:#6B7280;font-size:13px;margin-top:8px;">Estimated impact: recover ~${narrative.quick_win_hours} hours/week</p>` : ''}
  </div>

  <!-- Learning Path -->
  <div class="section">
    <h2>📚 Your Learning Path</h2>
    <p class="text-body">${narrative.learning_intro || ''}</p>
    ${resourcesHtml}
  </div>

  <div class="divider"></div>

  <!-- What's Unlocked Inside Jericho -->
  <div class="section">
    <h2 class="highlight">What's Already Loaded Inside Jericho</h2>
    <div class="card">
      ${unlockItems}
    </div>
  </div>

  <!-- CTA -->
  <div class="section" style="text-align:center;padding:32px 0;">
    <a href="https://askjericho.com/auth" class="cta-button">Log In to Jericho →</a>
    <p style="color:#6B7280;font-size:13px;margin-top:16px;">Your login details are in your welcome email</p>
  </div>

  <!-- Closing -->
  <div class="section" style="text-align:center;">
    <p class="text-body" style="font-style:italic;color:#E5A530;">${narrative.closing_statement || ''}</p>
  </div>

  <div class="footer">
    <p>Built by Jericho · Powered by The Momentum Company</p>
  </div>

</div>
</body></html>`;
}

// ============================================================================
// Build Playbook email (teaser, not full HTML)
// ============================================================================
function buildPlaybookEmail(d: any, eng: any, narrative: any): string {
  const firstName = d.first_name || 'there';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" style="background-color:#0F1419;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" style="max-width:600px;width:100%;">

<tr><td align="center" style="padding-bottom:32px;">
  <table role="presentation"><tr>
    <td style="background:linear-gradient(135deg,#E5A530,#F5C563);width:48px;height:48px;border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-size:24px;font-weight:bold;color:#0F1419;">J</span>
    </td>
    <td style="padding-left:12px;"><span style="font-size:28px;font-weight:700;color:#FFF !important;">Jericho</span></td>
  </tr></table>
</td></tr>

<tr><td>
<table role="presentation" width="100%" style="background:linear-gradient(180deg,#1A2332,#151D2B);border-radius:16px;border:1px solid rgba(229,165,48,0.2);">

<tr><td style="padding:40px 40px 24px;">
  <h1 style="margin:0;font-size:28px;font-weight:700;color:#FFF !important;">Your Playbook is ready, ${firstName}.</h1>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <p style="margin:0;font-size:16px;line-height:1.7;color:#9CA3AF !important;">I built this from our conversation. Here's a taste.</p>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <table role="presentation" width="100%" style="background:rgba(229,165,48,0.08);border-radius:12px;">
  <tr>
    <td align="center" style="padding:20px;">
      <p style="margin:0;font-size:36px;font-weight:800;color:#E5A530 !important;">${eng.composite}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF !important;">Engagement</p>
    </td>
    <td align="center" style="padding:20px;">
      <p style="margin:0;font-size:36px;font-weight:800;color:#FFF !important;">7</p>
      <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF !important;">Capabilities</p>
    </td>
    <td align="center" style="padding:20px;">
      <p style="margin:0;font-size:36px;font-weight:800;color:#FFF !important;">3</p>
      <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF !important;">Priorities</p>
    </td>
  </tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <table role="presentation" width="100%" style="background:rgba(229,165,48,0.06);border-left:3px solid #E5A530;border-radius:0 8px 8px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#E5A530 !important;">Your North Star</p>
    <p style="margin:0;font-size:15px;color:#D1D5DB !important;font-style:italic;">"${narrative.north_star_text || ''}"</p>
  </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#FFF !important;">What's in your Playbook</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">📍 Your Snapshot — ${d.primary_challenge || ''} (severity ${d.challenge_severity || '?'}/10, energy ${d.energy_score || '?'}/10)</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">💎 Your Superpower — ${d.strengths || ''}</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">🧬 7 Capabilities Assessed — each with 4-level descriptions</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">🎯 Growth Edge + 3 Priorities — from: "${d.feedback_received || ''}"</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">✅ Quick Win: ${narrative.quick_win_title || ''} — executable this week</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">📚 Learning Path — ${d.learning_format || ''}, ${d.available_time || ''}</p>
</td></tr>

<tr><td style="padding:0 40px 40px;" align="center">
  <table role="presentation"><tr>
    <td style="border-radius:10px;background:linear-gradient(135deg,#E5A530,#D4942A);box-shadow:0 4px 14px rgba(229,165,48,0.35);">
      <a href="https://askjericho.com/auth" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:600;color:#0F1419 !important;text-decoration:none;border-radius:10px;">View Your Full Playbook →</a>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:0 40px 24px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#6B7280 !important;">✓ Account created · ✓ 7 capabilities loaded · ✓ First brief queued</p>
</td></tr>

</table>
</td></tr>

<tr><td style="padding:24px 20px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#4B5563 !important;">Your login details are in a separate email · askjericho.com</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, profileId, extractedData } = await req.json();

    if (!profileId || !extractedData) {
      return new Response(JSON.stringify({ error: 'profileId and extractedData are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    console.log(`[generate-individual-playbook] Starting for profile ${profileId}`);

    // Get profile info for company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, full_name, email')
      .eq('id', profileId)
      .single();

    const companyId = profile?.company_id || null;

    // STEP 1: Engagement scores
    const engagementScores = calculateEngagementScores(extractedData);
    console.log(`[generate-individual-playbook] Engagement composite: ${engagementScores.composite}`);

    // STEP 2: Capability selection (Opus call 1)
    let selectedCapabilities: any[];
    try {
      selectedCapabilities = await selectCapabilities(supabase, extractedData);
      console.log(`[generate-individual-playbook] Selected ${selectedCapabilities.length} capabilities`);
    } catch (err: any) {
      console.error('[generate-individual-playbook] Capability selection failed:', err.message);
      // Retry once
      selectedCapabilities = await selectCapabilities(supabase, extractedData);
    }

    // STEP 3: Narrative generation (Opus call 2)
    let narrative: any;
    let retried = false;
    try {
      narrative = await generateNarrative(extractedData, engagementScores, selectedCapabilities);
      const errors = validateNarrative(narrative, extractedData.energy_score || 5);
      if (errors.length > 0) {
        console.warn('[generate-individual-playbook] Validation errors, retrying:', errors);
        narrative = await generateNarrative(extractedData, engagementScores, selectedCapabilities);
        retried = true;
        const errors2 = validateNarrative(narrative, extractedData.energy_score || 5);
        if (errors2.length > 0) {
          console.warn('[generate-individual-playbook] Still has validation issues after retry:', errors2);
        }
      }
    } catch (err: any) {
      console.error('[generate-individual-playbook] Narrative generation failed:', err.message);
      // Retry once
      narrative = await generateNarrative(extractedData, engagementScores, selectedCapabilities);
      retried = true;
    }

    // STEP 4a: Auto-assign capabilities to user profile
    for (const cap of selectedCapabilities) {
      const { error: upsertErr } = await supabase.from('employee_capabilities').upsert({
        profile_id: profileId,
        capability_id: cap.capability_id,
        current_level: cap.current_level,
        target_level: cap.target_level,
        ai_reasoning: cap.reasoning,
        priority: cap.is_priority ? 1 : 0,
        assigned_at: new Date().toISOString(),
      }, { onConflict: 'profile_id,capability_id' });

      if (upsertErr) {
        console.error(`[generate-individual-playbook] Capability upsert error for ${cap.capability_name}:`, upsertErr.message);
      }
    }
    console.log(`[generate-individual-playbook] Assigned 7 capabilities to profile`);

    // STEP 4b: Build HTML
    const playbookHtml = buildPlaybookHtml(extractedData, engagementScores, selectedCapabilities, narrative);
    const wordCount = playbookHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

    // STEP 4c: Store Playbook
    const { error: reportErr } = await supabase.from('leadership_reports').upsert({
      profile_id: profileId,
      company_id: companyId,
      report_type: 'individual_playbook',
      status: 'generated',
      report_content: { html: playbookHtml, narrative, engagement_scores: engagementScores },
      capability_matrix: selectedCapabilities,
      word_count: wordCount,
      quality_checks: {
        capabilities_assigned: selectedCapabilities.length,
        priorities_count: selectedCapabilities.filter((c: any) => c.is_priority).length,
        narrative_retried: retried,
        validation_errors: validateNarrative(narrative, extractedData.energy_score || 5),
      },
      delivery_email: extractedData.email,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,report_type' });

    if (reportErr) {
      console.error('[generate-individual-playbook] Report store error:', reportErr.message);
    }

    // Update active context
    await supabase.from('user_active_context')
      .update({ report_status: 'generated' })
      .eq('profile_id', profileId);

    // Update try_sessions if token provided
    if (sessionToken) {
      await supabase.from('try_sessions')
        .update({ status: 'playbook_generated' })
        .eq('session_token', sessionToken);
    }

    // STEP 4d: Email the Playbook teaser
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && extractedData.email) {
      try {
        const emailHtml = buildPlaybookEmail(extractedData, engagementScores, narrative);
        const firstName = extractedData.first_name || 'there';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Jericho <jericho@sender.askjericho.com>',
            to: [extractedData.email],
            subject: `${firstName}, your Playbook is ready 🎯`,
            html: emailHtml,
          }),
        });
        console.log(`[generate-individual-playbook] Playbook email sent to ${extractedData.email}`);

        // Mark delivery
        await supabase.from('leadership_reports')
          .update({ delivered_at: new Date().toISOString() })
          .eq('profile_id', profileId)
          .eq('report_type', 'individual_playbook');
      } catch (emailErr) {
        console.error('[generate-individual-playbook] Email error:', emailErr);
      }
    }

    console.log(`[generate-individual-playbook] Complete. Word count: ${wordCount}, Composite: ${engagementScores.composite}`);

    return new Response(JSON.stringify({
      success: true,
      profileId,
      engagementScores,
      capabilitiesAssigned: selectedCapabilities.length,
      wordCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[generate-individual-playbook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
