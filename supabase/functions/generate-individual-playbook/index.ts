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
// Build Playbook HTML (Premium Template)
// ============================================================================
function buildPlaybookHtml(d: any, eng: any, caps: any[], narrative: any): string {
  const firstName = d.first_name || 'there';
  const role = d.role || 'Professional';
  const teamContext = d.team_size ? `${d.team_size} Direct Reports` : d.leads_people ? 'People Leader' : '';
  const company = d.company_name || d.industry || '';
  const coverSub = [role, company, teamContext].filter(Boolean).join(' · ');
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const cls = (score: number, invert = false): string => {
    const s = invert ? (100 - score) : score;
    if (s >= 70) return 'high';
    if (s >= 40) return 'mid';
    return 'low';
  };

  const ringOffset = (score: number) => (213.6 * (1 - score / 100)).toFixed(1);

  const engScore = eng.composite;
  const effScore = eng.selfEfficacy;
  const utilScore = eng.strengthUtil;

  const levelNum: Record<string, number> = { foundational: 1, advancing: 2, independent: 3, mastery: 4 };
  const levelLabel: Record<string, string> = { foundational: 'Foundational', advancing: 'Advancing', independent: 'Independent', mastery: 'Mastery' };
  const levelClass: Record<string, string> = { foundational: 'l1', advancing: 'l2', independent: 'l3', mastery: 'l4' };

  const levelCounts = { l1: 0, l2: 0, l3: 0, l4: 0 };
  for (const c of caps) {
    const lc = levelClass[c.current_level] || 'l1';
    levelCounts[lc as keyof typeof levelCounts]++;
  }

  const capCardsHtml = caps.map((c: any) => {
    const currentLvl = c.current_level || 'foundational';
    const targetLvl = c.target_level || 'advancing';
    const currentN = levelNum[currentLvl] || 1;
    const targetN = levelNum[targetLvl] || 2;
    const lc = levelClass[currentLvl] || 'l1';

    const levels = ['mastery', 'independent', 'advancing', 'foundational'];
    const ladderHtml = levels.map((lvl, i) => {
      const n = levelNum[lvl];
      const isCurrent = lvl === currentLvl;
      const isTarget = lvl === targetLvl && targetN > currentN;
      const isBelow = n < currentN;
      const dotClass = isCurrent ? 'current' : isTarget ? 'target' : isBelow ? 'below' : '';
      const descClass = isCurrent ? 'active' : '';
      const lvlDesc = c.level_descriptions?.[lvl] || '';
      const showLine = i < 3;

      let tags = '';
      if (isCurrent) tags = '<span class="ladder-you">★ You are here</span>';
      if (isTarget) tags = '<span class="ladder-target-tag">◎ Target</span>';

      return `<div class="ladder-step">
        <div class="ladder-marker">
          <div class="ladder-dot ${dotClass}"></div>
          ${showLine ? '<div class="ladder-line"></div>' : ''}
        </div>
        <div class="ladder-content">
          <div class="ladder-level ${levelClass[lvl]}">Level ${n} — ${levelLabel[lvl]}${tags}</div>
          <div class="ladder-desc ${descClass}">${lvlDesc}</div>
        </div>
      </div>`;
    }).join('');

    return `<div class="cap-card">
      <div class="cap-card-header">
        <div class="cap-card-left">
          <div>
            <div class="cap-card-name">${c.capability_name}</div>
            <div class="cap-card-cat">${c.category || 'General'}</div>
          </div>
        </div>
        <span class="cap-level-badge ${lc}">Level ${currentN}</span>
      </div>
      <div class="cap-ladder">
        <div class="cap-reasoning">${c.reasoning}</div>
        <div class="ladder">${ladderHtml}</div>
      </div>
    </div>`;
  }).join('');

  const snapshotHtml = (narrative.snapshot_paragraphs || []).map((p: string) => `<p class="body-text">${p}</p>`).join('');
  const superpowerHtml = (narrative.superpower_paragraphs || []).map((p: string) => `<p class="body-text">${p}</p>`).join('');

  const prioritiesHtml = (narrative.priorities || []).map((p: any, i: number) =>
    `<div class="priority-card">
      <div class="priority-num">${i + 1}</div>
      <div class="priority-body">
        <h4>${p.title}</h4>
        <p>${p.description}</p>
      </div>
    </div>`
  ).join('');

  const qwStepsHtml = (narrative.quick_win_steps || []).map((s: string) => `<li>${s}</li>`).join('');

  const typeIcons: Record<string, string> = { podcast: '🎧', framework: '📋', reflection: '💭', article: '📖', video: '🎬' };
  const resourcesHtml = (narrative.learning_resources || []).map((r: any) => {
    const icon = typeIcons[r.type] || '📚';
    const typeLabel = (r.type || 'resource').charAt(0).toUpperCase() + (r.type || 'resource').slice(1);
    return `<div class="resource-card">
      <div class="resource-type ${r.type || ''}">${icon}</div>
      <div class="resource-body">
        <h5>${r.title}</h5>
        <p>${r.description}</p>
        <span class="resource-tag">${typeLabel} · ${r.time_estimate || ''}</span>
      </div>
    </div>`;
  }).join('');

  const burnoutLabel = eng.burnoutRisk > 50 ? 'High' : eng.burnoutRisk > 30 ? 'Moderate' : 'Low';
  const burnoutClass = eng.burnoutRisk > 50 ? 'low' : eng.burnoutRisk > 30 ? 'mid' : 'high';
  const strainLabel = eng.roleStrain > 60 ? 'High' : eng.roleStrain > 40 ? 'Moderate' : 'Low';
  const strainClass = eng.roleStrain > 60 ? 'low' : eng.roleStrain > 40 ? 'mid' : 'high';
  const orgLabel = eng.orgSupport >= 60 ? 'Supported' : 'Limited';
  const orgClass = eng.orgSupport >= 60 ? 'high' : 'low';

  const severityPct = (d.challenge_severity || 5) * 10;
  const energyPct = (d.energy_score || 5) * 10;
  const utilPct = (d.strength_utilization || 5) * 10;
  const connectionPct = (d.engagement_score || 5) * 10;

  const unlockItems = [
    { icon: '📐', iconClass: 'gold', title: 'Your first 90-Day Target is loaded', text: narrative.unlock_target },
    { icon: '🎙️', iconClass: 'amber', title: "Tomorrow's coaching brief is about you", text: narrative.unlock_brief },
    { icon: '📈', iconClass: 'red', title: 'Your scores are being tracked', text: narrative.unlock_tracking },
    { icon: '🧬', iconClass: 'purple', title: '7 capabilities are loaded on your profile', text: narrative.unlock_capabilities },
    { icon: '🗺️', iconClass: 'green', title: 'Your learning library is curated', text: narrative.unlock_learning },
    { icon: '💬', iconClass: 'blue', title: 'Jericho remembers this conversation', text: narrative.unlock_memory },
  ].filter(u => u.text).map(u =>
    `<div class="unlock-item">
      <div class="unlock-icon-wrap ${u.iconClass}">${u.icon}</div>
      <div class="unlock-content">
        <h5>${u.title}</h5>
        <p>${u.text}</p>
      </div>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${firstName}'s Growth Playbook — Jericho</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0B0F14;--bg2:#111820;--bg3:#1A2332;--bg4:#222F40;
  --gold:#E5A530;--gold-dim:#C4882A;--gold-light:#F5D78E;--gold-glow:rgba(229,165,48,.12);
  --text:#F0EDE6;--text2:#9CA3AF;--text3:#6B7280;
  --red:#EF4444;--red-bg:rgba(239,68,68,.08);
  --green:#22C55E;--green-bg:rgba(34,197,94,.08);
  --blue:#3B82F6;--blue-bg:rgba(59,130,246,.08);
  --amber:#F59E0B;--amber-bg:rgba(245,158,11,.08);
  --purple:#8B5CF6;--purple-bg:rgba(139,92,246,.08);
  --orange:#F97316;--orange-bg:rgba(249,115,22,.08);
  --sans:'DM Sans',system-ui,-apple-system,sans-serif;
  --serif:'DM Serif Display',Georgia,serif;
  --l1:#3B82F6;--l1-bg:rgba(59,130,246,.08);--l1-border:rgba(59,130,246,.2);
  --l2:#22C55E;--l2-bg:rgba(34,197,94,.08);--l2-border:rgba(34,197,94,.2);
  --l3:#F97316;--l3-bg:rgba(249,115,22,.08);--l3-border:rgba(249,115,22,.2);
  --l4:#8B5CF6;--l4-bg:rgba(139,92,246,.08);--l4-border:rgba(139,92,246,.2);
}
html{font-size:16px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.7;overflow-x:hidden}
.playbook{max-width:720px;margin:0 auto;padding:2rem 1.5rem 4rem}
.cover{text-align:center;padding:4rem 1rem 3rem;position:relative}
.cover::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:240px;height:240px;background:radial-gradient(circle,rgba(229,165,48,.12),transparent 70%);pointer-events:none}
.cover-badge{display:inline-flex;align-items:center;gap:.5rem;background:var(--gold-glow);border:1px solid rgba(229,165,48,.2);color:var(--gold);font-size:.7rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:.35rem 1rem;border-radius:100px;margin-bottom:1.5rem}
.cover-badge svg{width:14px;height:14px}
.cover h1{font-family:var(--serif);font-size:2.75rem;font-weight:400;line-height:1.15;color:var(--text);margin-bottom:.5rem}
.cover h1 span{color:var(--gold)}
.cover-sub{font-size:1rem;color:var(--text2);margin-bottom:.25rem}
.cover-meta{font-size:.78rem;color:var(--text3);margin-top:1rem;letter-spacing:.04em}
.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(229,165,48,.25),transparent);margin:2.5rem 0}
.score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}
.score-card{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:1.25rem;text-align:center;position:relative;overflow:hidden}
.score-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:16px 16px 0 0}
.score-card.high::before{background:var(--green)}.score-card.mid::before{background:var(--amber)}.score-card.low::before{background:var(--red)}
.ring-wrap{position:relative;width:80px;height:80px;margin:0 auto .75rem}
.ring-bg,.ring-fill{fill:none;stroke-width:6;stroke-linecap:round}
.ring-bg{stroke:rgba(255,255,255,.06)}
.ring-fill.high{stroke:var(--green)}.ring-fill.mid{stroke:var(--amber)}.ring-fill.low{stroke:var(--red)}
.ring-value{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.5rem;font-weight:700;letter-spacing:-.02em}
.ring-value.high{color:var(--green)}.ring-value.mid{color:var(--amber)}.ring-value.low{color:var(--red)}
.score-label{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text2)}
.section{margin:2.5rem 0}
.section-header{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}
.section-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.section-icon.gold{background:var(--gold-glow);color:var(--gold)}
.section-icon.blue{background:var(--blue-bg);color:var(--blue)}
.section-icon.red{background:var(--red-bg);color:var(--red)}
.section-icon.green{background:var(--green-bg);color:var(--green)}
.section-icon.amber{background:var(--amber-bg);color:var(--amber)}
.section-icon.purple{background:var(--purple-bg);color:var(--purple)}
.section-title{font-family:var(--serif);font-size:1.5rem;font-weight:400;color:var(--text)}
.body-text{color:var(--text2);font-size:.95rem;line-height:1.8;margin-bottom:1rem}
.body-text strong{color:var(--text);font-weight:600}
.body-text em{color:var(--gold);font-style:normal;font-weight:500}
.callout{background:var(--bg2);border-left:3px solid var(--gold);border-radius:0 12px 12px 0;padding:1.25rem 1.5rem;margin:1.5rem 0}
.callout p{color:var(--text);font-size:1rem;line-height:1.7;margin:0}
.callout .source{color:var(--text3);font-size:.8rem;margin-top:.5rem}
.north-star{background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid rgba(229,165,48,.15);border-radius:20px;padding:2rem;text-align:center;position:relative;overflow:hidden;margin:1.5rem 0}
.north-star::before{content:'';position:absolute;top:-40px;right:-40px;width:120px;height:120px;background:radial-gradient(circle,rgba(229,165,48,.1),transparent 70%)}
.north-star-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--gold);margin-bottom:.75rem}
.north-star-text{font-family:var(--serif);font-size:1.3rem;color:var(--text);line-height:1.5;max-width:560px;margin:0 auto}
.north-star-conf{display:inline-flex;align-items:center;gap:.5rem;margin-top:1rem;font-size:.85rem;color:var(--text2)}
.north-star-conf span{color:var(--amber);font-weight:700}
.metric-panel{background:var(--bg2);border-radius:14px;padding:1.25rem 1.5rem;margin:1rem 0}
.metric-row{display:flex;align-items:center;gap:1rem;padding:.65rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
.metric-row:last-child{border-bottom:none}
.metric-label{flex:0 0 160px;font-size:.85rem;color:var(--text2)}
.metric-bar-wrap{flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:100px;overflow:hidden}
.metric-bar{height:100%;border-radius:100px}
.metric-bar.high{background:var(--green)}.metric-bar.mid{background:var(--amber)}.metric-bar.low{background:var(--red)}
.metric-value{flex:0 0 40px;text-align:right;font-size:.85rem;font-weight:700}
.metric-value.high{color:var(--green)}.metric-value.mid{color:var(--amber)}.metric-value.low{color:var(--red)}
.priority-list{display:flex;flex-direction:column;gap:.75rem;margin:1rem 0}
.priority-card{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:1.25rem 1.5rem;display:flex;gap:1rem;align-items:flex-start}
.priority-num{width:32px;height:32px;border-radius:10px;background:var(--gold-glow);color:var(--gold);font-weight:700;font-size:.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.1rem}
.priority-body h4{font-size:1rem;font-weight:600;color:var(--text);margin-bottom:.25rem}
.priority-body p{font-size:.85rem;color:var(--text2);line-height:1.6}
.quick-win{background:linear-gradient(135deg,rgba(34,197,94,.06),rgba(34,197,94,.02));border:1px solid rgba(34,197,94,.2);border-radius:20px;padding:2rem;margin:1.5rem 0}
.quick-win-header{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}
.quick-win-badge{background:var(--green-bg);color:var(--green);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:.3rem .75rem;border-radius:100px}
.quick-win h4{font-size:1.1rem;font-weight:600;color:var(--text)}
.quick-win ol{list-style:none;counter-reset:qw;padding:0;margin:.5rem 0}
.quick-win ol li{counter-increment:qw;display:flex;gap:.75rem;padding:.5rem 0;font-size:.9rem;color:var(--text2);line-height:1.6}
.quick-win ol li::before{content:counter(qw);flex-shrink:0;width:24px;height:24px;border-radius:8px;background:rgba(34,197,94,.1);color:var(--green);font-weight:700;font-size:.75rem;display:flex;align-items:center;justify-content:center;margin-top:.15rem}
.resource-card{display:flex;gap:1rem;background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:1rem 1.25rem;margin:.5rem 0;align-items:center}
.resource-type{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.resource-type.podcast{background:rgba(139,92,246,.1);color:#8B5CF6}
.resource-type.framework{background:var(--gold-glow);color:var(--gold)}
.resource-type.reflection{background:var(--blue-bg);color:var(--blue)}
.resource-type.article{background:var(--orange-bg);color:var(--orange)}
.resource-type.video{background:var(--red-bg);color:var(--red)}
.resource-body h5{font-size:.9rem;font-weight:600;color:var(--text);margin-bottom:.15rem}
.resource-body p{font-size:.8rem;color:var(--text2);line-height:1.5}
.resource-tag{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:.2rem .5rem;border-radius:6px;margin-top:.35rem;display:inline-block}
.engagement-alert{background:var(--red-bg);border:1px solid rgba(239,68,68,.2);border-radius:16px;padding:1.5rem;margin:1.5rem 0;display:flex;gap:1rem;align-items:flex-start}
.engagement-alert .ea-icon{width:36px;height:36px;border-radius:10px;background:rgba(239,68,68,.12);color:var(--red);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.engagement-alert h4{font-size:.95rem;font-weight:600;color:var(--red);margin-bottom:.25rem}
.engagement-alert p{font-size:.85rem;color:var(--text2);line-height:1.6}
.cap-card{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:16px;margin:.75rem 0;overflow:hidden}
.cap-card-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem}
.cap-card-left{display:flex;align-items:center;gap:.75rem}
.cap-card-name{font-size:.95rem;font-weight:600;color:var(--text)}
.cap-card-cat{font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-top:.1rem}
.cap-level-badge{font-size:.7rem;font-weight:700;padding:.25rem .6rem;border-radius:6px;white-space:nowrap}
.cap-level-badge.l1{background:var(--l1-bg);color:var(--l1);border:1px solid var(--l1-border)}
.cap-level-badge.l2{background:var(--l2-bg);color:var(--l2);border:1px solid var(--l2-border)}
.cap-level-badge.l3{background:var(--l3-bg);color:var(--l3);border:1px solid var(--l3-border)}
.cap-level-badge.l4{background:var(--l4-bg);color:var(--l4);border:1px solid var(--l4-border)}
.cap-ladder{padding:0 1.25rem 1.25rem}
.cap-reasoning{font-size:.82rem;color:var(--text2);line-height:1.6;margin-bottom:1rem;padding:.75rem 1rem;background:rgba(229,165,48,.04);border-radius:10px;border-left:2px solid rgba(229,165,48,.3)}
.ladder{display:flex;flex-direction:column;gap:0}
.ladder-step{display:flex;gap:.75rem;position:relative;padding:.6rem 0}
.ladder-marker{display:flex;flex-direction:column;align-items:center;width:40px;flex-shrink:0;position:relative}
.ladder-dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.12);background:var(--bg2);position:relative;z-index:1}
.ladder-dot.current{border-color:var(--gold);background:var(--gold);box-shadow:0 0 12px rgba(229,165,48,.4)}
.ladder-dot.below{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.08)}
.ladder-dot.target{border-color:var(--green);background:transparent;box-shadow:0 0 0 3px rgba(34,197,94,.15)}
.ladder-line{width:2px;flex:1;background:rgba(255,255,255,.06);margin:2px 0}
.ladder-step:last-child .ladder-line{display:none}
.ladder-content{flex:1;padding-bottom:.25rem}
.ladder-level{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.15rem}
.ladder-level.l1{color:var(--l1)}.ladder-level.l2{color:var(--l2)}.ladder-level.l3{color:var(--l3)}.ladder-level.l4{color:var(--l4)}
.ladder-desc{font-size:.8rem;color:var(--text3);line-height:1.5}
.ladder-desc.active{color:var(--text2)}
.ladder-you{display:inline-flex;align-items:center;gap:.35rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);background:var(--gold-glow);padding:.15rem .5rem;border-radius:4px;margin-left:.5rem}
.ladder-target-tag{display:inline-flex;align-items:center;gap:.35rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--green);background:var(--green-bg);padding:.15rem .5rem;border-radius:4px;margin-left:.5rem}
.cap-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin:1rem 0;padding:1rem;background:var(--bg2);border-radius:14px}
.cap-summary-item{text-align:center;padding:.5rem}
.cap-summary-count{font-size:1.5rem;font-weight:700}
.cap-summary-count.l1{color:var(--l1)}.cap-summary-count.l2{color:var(--l2)}.cap-summary-count.l3{color:var(--l3)}.cap-summary-count.l4{color:var(--l4)}
.cap-summary-label{font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-top:.15rem}
.diag-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:1rem 0}
.diag-item{background:var(--bg2);border-radius:12px;padding:1rem;display:flex;align-items:center;justify-content:space-between}
.diag-item .label{font-size:.8rem;color:var(--text2)}
.diag-item .val{font-size:1.1rem;font-weight:700}
.diag-item .val.high{color:var(--green)}.diag-item .val.mid{color:var(--amber)}.diag-item .val.low{color:var(--red)}
.unlock-list{display:flex;flex-direction:column;gap:.5rem;margin:1rem 0}
.unlock-item{display:flex;gap:1rem;background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:1.1rem 1.25rem;align-items:flex-start}
.unlock-icon-wrap{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.unlock-icon-wrap.gold{background:var(--gold-glow)}.unlock-icon-wrap.amber{background:var(--amber-bg)}
.unlock-icon-wrap.red{background:var(--red-bg)}.unlock-icon-wrap.purple{background:var(--purple-bg)}
.unlock-icon-wrap.green{background:var(--green-bg)}.unlock-icon-wrap.blue{background:var(--blue-bg)}
.unlock-content h5{font-size:.9rem;font-weight:600;color:var(--text);margin-bottom:.2rem}
.unlock-content p{font-size:.82rem;color:var(--text2);line-height:1.55}
.the-math{background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid rgba(229,165,48,.12);border-radius:20px;padding:2rem;text-align:center;margin:1.5rem 0}
.math-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--gold);margin-bottom:1.25rem}
.math-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.math-item{padding:.75rem}
.math-number{font-family:var(--serif);font-size:2.5rem;font-weight:400;color:var(--text);line-height:1}
.math-desc{font-size:.78rem;color:var(--text2);margin-top:.4rem;line-height:1.4}
.cta-section{text-align:center;padding:3rem 1.5rem;margin-top:1rem}
.cta-eyebrow{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin-bottom:.5rem}
.cta-section h2{font-family:var(--serif);font-size:1.75rem;color:var(--text);margin-bottom:.5rem}
.cta-section p{color:var(--text2);font-size:.95rem;margin-bottom:1.5rem;max-width:480px;margin-left:auto;margin-right:auto}
.cta-btn{display:inline-flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,var(--gold),var(--gold-dim));color:var(--bg);font-weight:700;font-size:1rem;padding:1rem 2.5rem;border-radius:14px;text-decoration:none;box-shadow:0 4px 20px rgba(229,165,48,.3)}
.cta-sub{font-size:.8rem;color:var(--text3);margin-top:1rem}
.cta-proof{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 1.25rem;margin-top:1.5rem}
.cta-proof-item{display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--text2)}
.cta-check{color:var(--green);font-weight:700;font-size:.85rem}
.closing{text-align:center;padding:1.5rem 2rem;margin:1rem 0}
.closing p{font-family:var(--serif);font-size:1.15rem;color:var(--gold-light);line-height:1.6;max-width:500px;margin:0 auto}
.footer{text-align:center;padding:2rem 0;border-top:1px solid rgba(255,255,255,.04);margin-top:2rem}
.footer-logo{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
.footer-logo .mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--gold),var(--gold-dim));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:var(--bg)}
.footer-logo span{font-weight:700;font-size:1rem;color:var(--text)}
.footer p{font-size:.75rem;color:var(--text3)}
.disagree-cta{display:flex;align-items:center;gap:.75rem;background:var(--bg3);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:1rem 1.25rem;margin-top:1rem}
.disagree-cta .dc-icon{font-size:1.1rem}
.disagree-cta .text{flex:1}
.disagree-cta .text p{font-size:.82rem;color:var(--text2);line-height:1.5;margin:0}
.disagree-cta .text a{color:var(--gold);text-decoration:none;font-weight:600}
.section-cta{display:flex;align-items:center;gap:.75rem;background:linear-gradient(135deg,rgba(229,165,48,.04),rgba(229,165,48,.02));border:1px solid rgba(229,165,48,.12);border-radius:12px;padding:.85rem 1.25rem;margin-top:1.25rem}
.section-cta .cta-text{flex:1;font-size:.82rem;color:var(--text2);line-height:1.5}
.section-cta .cta-text strong{color:var(--text);font-weight:600}
.section-cta .cta-link{flex-shrink:0;font-size:.78rem;font-weight:700;color:var(--gold);text-decoration:none;white-space:nowrap}
.section-cta .cta-link:hover{text-decoration:underline}
.playbook-intro{text-align:center;max-width:560px;margin:2rem auto 0;padding:0 .5rem}
.playbook-intro p{font-size:.95rem;color:var(--text2);line-height:1.8}
.playbook-intro strong{color:var(--text);font-weight:600}
.playbook-intro .alive{color:var(--gold);font-weight:500}
@media(max-width:600px){
  .cover h1{font-size:2rem}
  .score-grid{grid-template-columns:1fr}
  .diag-grid{grid-template-columns:1fr}
  .math-grid{grid-template-columns:1fr;gap:.5rem}
  .metric-label{flex:0 0 100px;font-size:.8rem}
  .cap-summary{grid-template-columns:repeat(2,1fr)}
  .cta-proof{flex-direction:column;align-items:center}
}
</style>
</head><body>
<div class="playbook">

  <div class="cover">
    <div class="cover-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      Individual Playbook
    </div>
    <h1>${firstName}'s Growth<br><span>Playbook</span></h1>
    <p class="cover-sub">${coverSub}</p>
    <p class="cover-meta">Generated ${dateStr} · Powered by Jericho</p>
  </div>

  <div class="score-grid">
    <div class="score-card ${cls(engScore)}">
      <div class="ring-wrap">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle class="ring-bg" cx="40" cy="40" r="34" />
          <circle class="ring-fill ${cls(engScore)}" cx="40" cy="40" r="34" stroke-dasharray="213.6" stroke-dashoffset="${ringOffset(engScore)}" transform="rotate(-90 40 40)" />
        </svg>
        <div class="ring-value ${cls(engScore)}">${engScore}</div>
      </div>
      <div class="score-label">Engagement</div>
    </div>
    <div class="score-card ${cls(effScore)}">
      <div class="ring-wrap">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle class="ring-bg" cx="40" cy="40" r="34" />
          <circle class="ring-fill ${cls(effScore)}" cx="40" cy="40" r="34" stroke-dasharray="213.6" stroke-dashoffset="${ringOffset(effScore)}" transform="rotate(-90 40 40)" />
        </svg>
        <div class="ring-value ${cls(effScore)}">${effScore}</div>
      </div>
      <div class="score-label">Self-Efficacy</div>
    </div>
    <div class="score-card ${cls(utilScore)}">
      <div class="ring-wrap">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle class="ring-bg" cx="40" cy="40" r="34" />
          <circle class="ring-fill ${cls(utilScore)}" cx="40" cy="40" r="34" stroke-dasharray="213.6" stroke-dashoffset="${ringOffset(utilScore)}" transform="rotate(-90 40 40)" />
        </svg>
        <div class="ring-value ${cls(utilScore)}">${utilScore}</div>
      </div>
      <div class="score-label">Strength Utilization</div>
    </div>
  </div>

  <div class="playbook-intro">
    <p>
      This Playbook was built from a single conversation — yours. Every insight, score, and recommendation is personalized to your role, your challenges, and where you want to go. It's not a PDF that sits in a folder. Inside Jericho, <span class="alive">this document breathes</span> — updating as you grow, coaching you daily, and holding you accountable to the vision you just described. <strong>This is day one.</strong>
    </p>
  </div>

  <div class="north-star">
    <div class="north-star-label">— Your North Star —</div>
    <div class="north-star-text">"${narrative.north_star_text || ''}"</div>
    <div class="north-star-conf">Confidence: <span>${d.confidence_score || '?'}/10</span> — ${narrative.north_star_followup || ''}</div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon gold">📍</div>
      <div class="section-title">Your Snapshot</div>
    </div>
    ${snapshotHtml}
    <div class="metric-panel">
      <div class="metric-row">
        <div class="metric-label">Challenge Severity</div>
        <div class="metric-bar-wrap"><div class="metric-bar ${cls(severityPct, true)}" style="width:${severityPct}%"></div></div>
        <div class="metric-value ${cls(severityPct, true)}">${d.challenge_severity || '?'}/10</div>
      </div>
      <div class="metric-row">
        <div class="metric-label">Energy Level</div>
        <div class="metric-bar-wrap"><div class="metric-bar ${cls(energyPct)}" style="width:${energyPct}%"></div></div>
        <div class="metric-value ${cls(energyPct)}">${d.energy_score || '?'}/10</div>
      </div>
      <div class="metric-row">
        <div class="metric-label">Strength Utilization</div>
        <div class="metric-bar-wrap"><div class="metric-bar ${cls(utilPct)}" style="width:${utilPct}%"></div></div>
        <div class="metric-value ${cls(utilPct)}">${d.strength_utilization || '?'}/10</div>
      </div>
      <div class="metric-row">
        <div class="metric-label">Work Connection</div>
        <div class="metric-bar-wrap"><div class="metric-bar ${cls(connectionPct)}" style="width:${connectionPct}%"></div></div>
        <div class="metric-value ${cls(connectionPct)}">${d.engagement_score || '?'}/10</div>
      </div>
    </div>
    <div class="section-cta">
      <div class="cta-text"><strong>These scores change.</strong> Inside Jericho, they're tracked weekly — so you can see if the work is actually moving the needle.</div>
      <a href="https://askjericho.com/auth" class="cta-link">Track yours →</a>
    </div>
  </div>

  ${narrative.burnout_alert ? `<div class="engagement-alert">
    <div class="ea-icon">⚠</div>
    <div>
      <h4>Burnout Risk: Elevated</h4>
      <p>${narrative.burnout_alert}</p>
    </div>
  </div>` : ''}

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon purple">💎</div>
      <div class="section-title">Your Superpower</div>
    </div>
    ${superpowerHtml}
    <div class="section-cta">
      <div class="cta-text"><strong>Your superpower is benched.</strong> Jericho's coaching briefs are designed to get you back to the work only you can do.</div>
      <a href="https://askjericho.com/auth" class="cta-link">Get your first brief →</a>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon amber">🎯</div>
      <div class="section-title">Your Growth Edge</div>
    </div>
    <div class="callout">
      <p>"${narrative.growth_edge_quote || ''}"</p>
      <div class="source">— Your own words</div>
    </div>
    <p class="body-text">${narrative.growth_edge_intro || ''}</p>
    <div class="priority-list">${prioritiesHtml}</div>
    <div class="section-cta">
      <div class="cta-text"><strong>These aren't suggestions — they're loaded.</strong> Your three priorities are already queued as development targets inside Jericho.</div>
      <a href="https://askjericho.com/auth" class="cta-link">See your targets →</a>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon blue">🧬</div>
      <div class="section-title">Your Capability Map</div>
    </div>
    <p class="body-text">Based on your role as <strong>${role}</strong>, your challenges, and your strengths, Jericho has identified 7 core capabilities for your development. Each one is assessed at 4 levels — and we've estimated where you are today.</p>
    <div class="cap-summary">
      <div class="cap-summary-item"><div class="cap-summary-count l1">${levelCounts.l1}</div><div class="cap-summary-label">Level 1</div></div>
      <div class="cap-summary-item"><div class="cap-summary-count l2">${levelCounts.l2}</div><div class="cap-summary-label">Level 2</div></div>
      <div class="cap-summary-item"><div class="cap-summary-count l3">${levelCounts.l3}</div><div class="cap-summary-label">Level 3</div></div>
      <div class="cap-summary-item"><div class="cap-summary-count l4">${levelCounts.l4}</div><div class="cap-summary-label">Level 4</div></div>
    </div>
    ${capCardsHtml}
    <div class="disagree-cta">
      <div class="dc-icon">🎚️</div>
      <div class="text">
        <p>Think we got a level wrong? These are AI-estimated levels based on your conversation. Log into Jericho and self-assess under the Capabilities tab — your input overrides our estimate. <a href="https://askjericho.com/auth">Log in →</a></p>
      </div>
    </div>
    <div class="section-cta">
      <div class="cta-text"><strong>This is your starting line, not your verdict.</strong> Self-assess inside Jericho and your scores update instantly — the AI adapts your plan to match.</div>
      <a href="https://askjericho.com/auth" class="cta-link">Self-assess now →</a>
    </div>
  </div>

  <div class="divider"></div>

  <div class="quick-win">
    <div class="quick-win-header">
      <span class="quick-win-badge">This Week</span>
      <h4>${narrative.quick_win_title || 'Your 7-Day Quick Win'}</h4>
    </div>
    <p class="body-text">${narrative.quick_win_intro || ''}</p>
    <ol>${qwStepsHtml}</ol>
    <p class="body-text" style="font-weight:600;margin-top:.75rem">${narrative.quick_win_closer || ''}</p>
    <div class="section-cta">
      <div class="cta-text"><strong>This is day one.</strong> Jericho generates a new quick win every week based on what you've actually done — not generic advice.</div>
      <a href="https://askjericho.com/auth" class="cta-link">Start your streak →</a>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon green">📚</div>
      <div class="section-title">Your Learning Path</div>
    </div>
    <p class="body-text">${narrative.learning_intro || ''}</p>
    ${resourcesHtml}
    <div class="section-cta">
      <div class="cta-text"><strong>New resources drop weekly.</strong> Jericho curates them based on your progress, not a static list — and they fit your time window.</div>
      <a href="https://askjericho.com/auth" class="cta-link">See what's next →</a>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon red">📊</div>
      <div class="section-title">Diagnostic Snapshot</div>
    </div>
    <p class="body-text">${narrative.diagnostic_commentary || ''}</p>
    <div class="diag-grid">
      <div class="diag-item"><span class="label">Burnout Risk</span><span class="val ${burnoutClass}">${burnoutLabel}</span></div>
      <div class="diag-item"><span class="label">Engagement</span><span class="val ${cls(eng.composite)}">${eng.composite}/100</span></div>
      <div class="diag-item"><span class="label">Role Strain</span><span class="val ${strainClass}">${strainLabel}</span></div>
      <div class="diag-item"><span class="label">Org Support</span><span class="val ${orgClass}">${orgLabel}</span></div>
      <div class="diag-item"><span class="label">Career Direction</span><span class="val high">Clear</span></div>
      <div class="diag-item"><span class="label">Capabilities Mapped</span><span class="val high">7 assessed</span></div>
    </div>
    <p class="body-text" style="font-size:.82rem;color:var(--text3);margin-top:.5rem">These scores are estimated from your coaching conversation. Full validated diagnostics — with trend tracking, team benchmarks, and 90-day progress monitoring — unlock inside Jericho.</p>
    <div class="section-cta">
      <div class="cta-text"><strong>These are estimates.</strong> Full validated diagnostics with trend tracking, team benchmarks, and 90-day monitoring unlock when you log in.</div>
      <a href="https://askjericho.com/auth" class="cta-link">Unlock full diagnostics →</a>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-header">
      <div class="section-icon gold">🔓</div>
      <div class="section-title">What's Already Waiting for You</div>
    </div>
    <p class="body-text">This Playbook scratched the surface. When you log in, Jericho already knows everything you told me — and it's built your next 90 days around it.</p>
    <div class="unlock-list">${unlockItems}</div>
  </div>

  <div class="the-math">
    <div class="math-label">The Math</div>
    <div class="math-grid">
      <div class="math-item">
        <div class="math-number">${narrative.quick_win_hours || '?'}</div>
        <div class="math-desc">hours back this week if your Quick Win lands</div>
      </div>
      <div class="math-item">
        <div class="math-number">7</div>
        <div class="math-desc">capabilities mapped with clear development paths</div>
      </div>
      <div class="math-item">
        <div class="math-number">90</div>
        <div class="math-desc">days to go from ${d.confidence_score || '?'}/10 confidence to making your North Star inevitable</div>
      </div>
    </div>
  </div>

  <div class="cta-section">
    <div class="cta-eyebrow">This is Stage 1. You've seen the snapshot.</div>
    <h2>Ready to see the full picture?</h2>
    <p>Your account is live. Your capabilities are loaded. Your first coaching brief drops tomorrow morning. The only thing missing is you.</p>
    <a href="https://askjericho.com/auth" class="cta-btn">
      Log In to Jericho
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>
    <p class="cta-sub">Your login credentials are in your inbox · askjericho.com</p>
    <div class="cta-proof">
      <span class="cta-proof-item"><span class="cta-check">✓</span> Account created</span>
      <span class="cta-proof-item"><span class="cta-check">✓</span> 7 capabilities assigned</span>
      <span class="cta-proof-item"><span class="cta-check">✓</span> Quick Win queued</span>
      <span class="cta-proof-item"><span class="cta-check">✓</span> First coaching brief scheduled</span>
    </div>
  </div>

  <div class="closing">
    <p>${narrative.closing_statement || ''}</p>
  </div>

  <div class="footer">
    <div class="footer-logo">
      <div class="mark">J</div>
      <span>Jericho</span>
    </div>
    <p>Powered by The Momentum Company · Confidential</p>
    <p>Individual data is never shared with employers at the individual level.</p>
  </div>

</div>
</body></html>`;
}

// ============================================================================
// Build full Playbook email (inline HTML for inbox clients)
// ============================================================================
function buildFullPlaybookEmail(d: any, eng: any, caps: any[], narrative: any): string {
  const firstName = d.first_name || 'there';
  const role = d.role || 'Professional';
  const levelLabel: Record<string, string> = {
    foundational: 'Foundational',
    advancing: 'Advancing',
    independent: 'Independent',
    mastery: 'Mastery',
  };

  const sectionCta = (text: string, label: string) => `
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;background:#171d25;border:1px solid rgba(229,165,48,0.18);border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#9CA3AF;">
            ${text}
          </td>
          <td align="right" style="padding:14px 16px;white-space:nowrap;">
            <a href="https://askjericho.com/auth" style="font-size:13px;font-weight:700;color:#E5A530;text-decoration:none;">${label}</a>
          </td>
        </tr>
      </table>
    </td></tr>`;

  const priorities = (narrative.priorities || []).map((p: any, i: number) => `
    <tr><td style="padding:0 32px 12px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
        <tr>
          <td valign="top" style="padding:16px 0 16px 16px;width:44px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(229,165,48,0.12);color:#E5A530;font-size:14px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
          </td>
          <td style="padding:16px 16px 16px 0;">
            <div style="font-size:16px;font-weight:700;color:#F0EDE6;margin-bottom:4px;">${p.title}</div>
            <div style="font-size:14px;line-height:1.7;color:#9CA3AF;">${p.description}</div>
          </td>
        </tr>
      </table>
    </td></tr>`).join('');

  const capabilities = caps.map((c: any) => `
    <tr><td style="padding:0 32px 12px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
        <tr>
          <td style="padding:16px;">
            <div style="font-size:16px;font-weight:700;color:#F0EDE6;">${c.capability_name}</div>
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin-top:3px;">${c.category || 'General'}</div>
            <div style="margin-top:10px;font-size:13px;line-height:1.7;color:#9CA3AF;">${c.reasoning}</div>
            <div style="margin-top:10px;font-size:12px;line-height:1.6;color:#F0EDE6;">
              <strong>Current:</strong> ${levelLabel[c.current_level] || c.current_level} &nbsp;•&nbsp; <strong>Target:</strong> ${levelLabel[c.target_level] || c.target_level}
            </div>
          </td>
        </tr>
      </table>
    </td></tr>`).join('');

  const quickWinSteps = (narrative.quick_win_steps || []).map((step: string, index: number) => `
    <tr>
      <td valign="top" style="padding:0 12px 12px 0;width:28px;font-size:13px;font-weight:700;color:#22C55E;">${index + 1}.</td>
      <td style="padding:0 0 12px;font-size:14px;line-height:1.7;color:#9CA3AF;">${step}</td>
    </tr>`).join('');

  const resources = (narrative.learning_resources || []).map((r: any) => `
    <tr><td style="padding:0 32px 12px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
        <tr>
          <td style="padding:16px;">
            <div style="font-size:15px;font-weight:700;color:#F0EDE6;">${r.title}</div>
            <div style="font-size:12px;color:#E5A530;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;">${r.type || 'Resource'}${r.time_estimate ? ` · ${r.time_estimate}` : ''}</div>
            <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#9CA3AF;">${r.description}</div>
          </td>
        </tr>
      </table>
    </td></tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${firstName}'s Growth Playbook</title>
</head>
<body style="margin:0;padding:0;background:#0B0F14;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#F0EDE6;">
  <table role="presentation" width="100%" style="border-collapse:collapse;background:#0B0F14;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="680" style="border-collapse:collapse;max-width:680px;width:100%;background:#0B0F14;">
          <tr><td align="center" style="padding:10px 0 28px;">
            <div style="display:inline-block;background:rgba(229,165,48,0.10);border:1px solid rgba(229,165,48,0.2);border-radius:999px;padding:8px 16px;color:#E5A530;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Individual Playbook</div>
            <div style="font-family:Georgia,serif;font-size:38px;line-height:1.15;color:#F0EDE6;margin-top:18px;">${firstName}'s Growth Playbook</div>
            <div style="font-size:15px;line-height:1.6;color:#9CA3AF;margin-top:10px;">${role}${d.industry ? ` · ${d.industry}` : ''}${d.team_size ? ` · ${d.team_size} Direct Reports` : ''}</div>
          </td></tr>

          <tr><td style="padding:0 32px 20px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:linear-gradient(180deg,#1A2332,#151D2B);border:1px solid rgba(229,165,48,0.16);border-radius:18px;">
              <tr>
                <td width="33.33%" align="center" style="padding:22px 10px;border-right:1px solid rgba(255,255,255,0.05);">
                  <div style="font-size:34px;font-weight:800;color:#E5A530;">${eng.composite}</div>
                  <div style="font-size:12px;color:#9CA3AF;">Engagement</div>
                </td>
                <td width="33.33%" align="center" style="padding:22px 10px;border-right:1px solid rgba(255,255,255,0.05);">
                  <div style="font-size:34px;font-weight:800;color:#F0EDE6;">${eng.selfEfficacy}</div>
                  <div style="font-size:12px;color:#9CA3AF;">Self-Efficacy</div>
                </td>
                <td width="33.33%" align="center" style="padding:22px 10px;">
                  <div style="font-size:34px;font-weight:800;color:#F0EDE6;">${eng.strengthUtil}</div>
                  <div style="font-size:12px;color:#9CA3AF;">Strength Utilization</div>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border:1px solid rgba(229,165,48,0.14);border-radius:16px;">
              <tr><td style="padding:22px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E5A530;margin-bottom:10px;">Your North Star</div>
                <div style="font-family:Georgia,serif;font-size:25px;line-height:1.45;color:#F0EDE6;">“${narrative.north_star_text || ''}”</div>
                <div style="margin-top:12px;font-size:14px;line-height:1.6;color:#9CA3AF;">Confidence: <span style="color:#F59E0B;font-weight:700;">${d.confidence_score || '?'}/10</span> — ${narrative.north_star_followup || ''}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:0 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">📍 Your Snapshot</td></tr>
          <tr><td style="padding:0 32px 6px;font-size:15px;line-height:1.8;color:#9CA3AF;">${(narrative.snapshot_paragraphs || []).join('</td></tr><tr><td style="padding:0 32px 16px;font-size:15px;line-height:1.8;color:#9CA3AF;">')}</td></tr>
          <tr><td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border-radius:14px;">
              <tr><td style="padding:14px 16px;font-size:14px;color:#9CA3AF;">Challenge Severity</td><td align="right" style="padding:14px 16px;font-size:14px;font-weight:700;color:#F0EDE6;">${d.challenge_severity || '?'}/10</td></tr>
              <tr><td style="padding:0 16px 14px;font-size:14px;color:#9CA3AF;">Energy Level</td><td align="right" style="padding:0 16px 14px;font-size:14px;font-weight:700;color:#F0EDE6;">${d.energy_score || '?'}/10</td></tr>
              <tr><td style="padding:0 16px 14px;font-size:14px;color:#9CA3AF;">Strength Utilization</td><td align="right" style="padding:0 16px 14px;font-size:14px;font-weight:700;color:#F0EDE6;">${d.strength_utilization || '?'}/10</td></tr>
              <tr><td style="padding:0 16px 16px;font-size:14px;color:#9CA3AF;">Work Connection</td><td align="right" style="padding:0 16px 16px;font-size:14px;font-weight:700;color:#F0EDE6;">${d.engagement_score || '?'}/10</td></tr>
            </table>
          </td></tr>
          ${sectionCta('<strong style="color:#F0EDE6;">These scores change.</strong> Inside Jericho, they\'re tracked weekly — so you can see if the work is actually moving the needle.', 'Track yours →')}

          <tr><td style="padding:0 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">💎 Your Superpower</td></tr>
          <tr><td style="padding:0 32px 16px;font-size:15px;line-height:1.8;color:#9CA3AF;">${(narrative.superpower_paragraphs || []).join('</td></tr><tr><td style="padding:0 32px 16px;font-size:15px;line-height:1.8;color:#9CA3AF;">')}</td></tr>
          ${sectionCta('<strong style="color:#F0EDE6;">Your superpower is benched.</strong> Jericho\'s coaching briefs are designed to get you back to the work only you can do.', 'Get your first brief →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">🎯 Your Growth Edge</td></tr>
          <tr><td style="padding:0 32px 16px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:#111820;border-left:3px solid #E5A530;border-radius:0 12px 12px 0;">
              <tr><td style="padding:18px 18px 12px;font-size:17px;line-height:1.7;color:#F0EDE6;">“${narrative.growth_edge_quote || ''}”</td></tr>
              <tr><td style="padding:0 18px 18px;font-size:12px;color:#6B7280;">— Your own words</td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 32px 18px;font-size:15px;line-height:1.8;color:#9CA3AF;">${narrative.growth_edge_intro || ''}</td></tr>
          ${priorities}
          ${sectionCta('<strong style="color:#F0EDE6;">These aren\'t suggestions — they\'re loaded.</strong> Your three priorities are already queued as development targets inside Jericho.', 'See your targets →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">🧬 Your Capability Map</td></tr>
          <tr><td style="padding:0 32px 18px;font-size:15px;line-height:1.8;color:#9CA3AF;">Based on your role as <strong style="color:#F0EDE6;">${role}</strong>, your challenges, and your strengths, Jericho has identified 7 core capabilities for your development.</td></tr>
          ${capabilities}
          <tr><td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:#1A2332;border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#9CA3AF;">Think we got a level wrong? These are AI-estimated levels based on your conversation. Log into Jericho and self-assess under the Capabilities tab — your input overrides our estimate.</td>
                <td align="right" style="padding:14px 16px;white-space:nowrap;"><a href="https://askjericho.com/auth" style="font-size:13px;font-weight:700;color:#E5A530;text-decoration:none;">Log in →</a></td>
              </tr>
            </table>
          </td></tr>
          ${sectionCta('<strong style="color:#F0EDE6;">This is your starting line, not your verdict.</strong> Self-assess inside Jericho and your scores update instantly — the AI adapts your plan to match.', 'Self-assess now →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">✅ Your Quick Win</td></tr>
          <tr><td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:18px;">
              <tr><td style="padding:20px 20px 8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#22C55E;">This Week</td></tr>
              <tr><td style="padding:0 20px 10px;font-size:20px;font-weight:700;color:#F0EDE6;">${narrative.quick_win_title || 'Your 7-Day Quick Win'}</td></tr>
              <tr><td style="padding:0 20px 14px;font-size:15px;line-height:1.8;color:#9CA3AF;">${narrative.quick_win_intro || ''}</td></tr>
              <tr><td style="padding:0 20px 4px;">
                <table role="presentation" width="100%" style="border-collapse:collapse;">${quickWinSteps}</table>
              </td></tr>
              <tr><td style="padding:4px 20px 20px;font-size:15px;line-height:1.8;color:#F0EDE6;font-weight:700;">${narrative.quick_win_closer || ''}</td></tr>
            </table>
          </td></tr>
          ${sectionCta('<strong style="color:#F0EDE6;">This is day one.</strong> Jericho generates a new quick win every week based on what you\'ve actually done — not generic advice.', 'Start your streak →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">📚 Your Learning Path</td></tr>
          <tr><td style="padding:0 32px 18px;font-size:15px;line-height:1.8;color:#9CA3AF;">${narrative.learning_intro || ''}</td></tr>
          ${resources}
          ${sectionCta('<strong style="color:#F0EDE6;">New resources drop weekly.</strong> Jericho curates them based on your progress, not a static list — and they fit your time window.', 'See what\'s next →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">📊 Diagnostic Snapshot</td></tr>
          <tr><td style="padding:0 32px 16px;font-size:15px;line-height:1.8;color:#9CA3AF;">${narrative.diagnostic_commentary || ''}</td></tr>
          <tr><td style="padding:0 32px 12px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 12px;background:#111820;border-radius:10px;font-size:13px;color:#9CA3AF;">Burnout Risk<br><span style="display:inline-block;margin-top:4px;font-size:18px;font-weight:700;color:#F0EDE6;">${eng.burnoutRisk > 50 ? 'High' : eng.burnoutRisk > 30 ? 'Moderate' : 'Low'}</span></td>
                <td width="8"></td>
                <td style="padding:10px 12px;background:#111820;border-radius:10px;font-size:13px;color:#9CA3AF;">Engagement<br><span style="display:inline-block;margin-top:4px;font-size:18px;font-weight:700;color:#F0EDE6;">${eng.composite}/100</span></td>
              </tr>
              <tr><td height="8"></td><td></td><td></td></tr>
              <tr>
                <td style="padding:10px 12px;background:#111820;border-radius:10px;font-size:13px;color:#9CA3AF;">Role Strain<br><span style="display:inline-block;margin-top:4px;font-size:18px;font-weight:700;color:#F0EDE6;">${eng.roleStrain > 60 ? 'High' : eng.roleStrain > 40 ? 'Moderate' : 'Low'}</span></td>
                <td width="8"></td>
                <td style="padding:10px 12px;background:#111820;border-radius:10px;font-size:13px;color:#9CA3AF;">Org Support<br><span style="display:inline-block;margin-top:4px;font-size:18px;font-weight:700;color:#F0EDE6;">${eng.orgSupport >= 60 ? 'Supported' : 'Limited'}</span></td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 32px 16px;font-size:13px;line-height:1.7;color:#6B7280;">These scores are estimated from your coaching conversation. Full validated diagnostics — with trend tracking, team benchmarks, and 90-day progress monitoring — unlock inside Jericho.</td></tr>
          ${sectionCta('<strong style="color:#F0EDE6;">These are estimates.</strong> Full validated diagnostics with trend tracking, team benchmarks, and 90-day monitoring unlock when you log in.', 'Unlock full diagnostics →')}

          <tr><td style="padding:12px 32px 8px;font-family:Georgia,serif;font-size:28px;color:#F0EDE6;">🔓 What\'s Already Waiting for You</td></tr>
          <tr><td style="padding:0 32px 18px;font-size:15px;line-height:1.8;color:#9CA3AF;">This Playbook scratched the surface. When you log in, Jericho already knows everything you told me — and it\'s built your next 90 days around it.</td></tr>
          <tr><td style="padding:0 32px 12px;font-size:14px;line-height:1.8;color:#9CA3AF;">📐 <strong style="color:#F0EDE6;">Your first 90-Day Target is loaded:</strong> ${narrative.unlock_target || ''}</td></tr>
          <tr><td style="padding:0 32px 12px;font-size:14px;line-height:1.8;color:#9CA3AF;">🎙️ <strong style="color:#F0EDE6;">Tomorrow's coaching brief:</strong> ${narrative.unlock_brief || ''}</td></tr>
          <tr><td style="padding:0 32px 12px;font-size:14px;line-height:1.8;color:#9CA3AF;">📈 <strong style="color:#F0EDE6;">Tracked score:</strong> ${narrative.unlock_tracking || ''}</td></tr>
          <tr><td style="padding:0 32px 12px;font-size:14px;line-height:1.8;color:#9CA3AF;">🧬 <strong style="color:#F0EDE6;">Capability gaps:</strong> ${narrative.unlock_capabilities || ''}</td></tr>
          <tr><td style="padding:0 32px 12px;font-size:14px;line-height:1.8;color:#9CA3AF;">🗺️ <strong style="color:#F0EDE6;">Learning library:</strong> ${narrative.unlock_learning || ''}</td></tr>
          <tr><td style="padding:0 32px 22px;font-size:14px;line-height:1.8;color:#9CA3AF;">💬 <strong style="color:#F0EDE6;">Full memory:</strong> ${narrative.unlock_memory || ''}</td></tr>

          <tr><td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:linear-gradient(135deg,#1A2332,#111820);border:1px solid rgba(229,165,48,0.12);border-radius:18px;">
              <tr><td align="center" style="padding:24px 16px 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E5A530;">The Math</td></tr>
              <tr>
                <td align="center" style="padding:0 16px 24px;">
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td width="33.33%" align="center" style="padding:10px 8px;">
                        <div style="font-family:Georgia,serif;font-size:34px;color:#F0EDE6;">${narrative.quick_win_hours || '?'}</div>
                        <div style="font-size:13px;line-height:1.5;color:#9CA3AF;">hours back this week if your Quick Win lands</div>
                      </td>
                      <td width="33.33%" align="center" style="padding:10px 8px;">
                        <div style="font-family:Georgia,serif;font-size:34px;color:#F0EDE6;">7</div>
                        <div style="font-size:13px;line-height:1.5;color:#9CA3AF;">capabilities mapped with clear development paths</div>
                      </td>
                      <td width="33.33%" align="center" style="padding:10px 8px;">
                        <div style="font-family:Georgia,serif;font-size:34px;color:#F0EDE6;">90</div>
                        <div style="font-size:13px;line-height:1.5;color:#9CA3AF;">days to go from ${d.confidence_score || '?'}/10 confidence to making your North Star inevitable</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="padding:8px 32px 0;" align="center">
            <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#E5A530;margin-bottom:10px;">This is Stage 1. You've seen the snapshot.</div>
            <div style="font-family:Georgia,serif;font-size:32px;line-height:1.2;color:#F0EDE6;margin-bottom:10px;">Ready to see the full picture?</div>
            <div style="font-size:15px;line-height:1.8;color:#9CA3AF;max-width:560px;margin:0 auto 20px;">Your account is live. Your capabilities are loaded. Your first coaching brief drops tomorrow morning. The only thing missing is you.</div>
            <a href="https://askjericho.com/auth" style="display:inline-block;background:linear-gradient(135deg,#E5A530,#C4882A);color:#0B0F14;text-decoration:none;font-size:16px;font-weight:800;padding:16px 32px;border-radius:14px;">Log In to Jericho</a>
            <div style="font-size:12px;color:#6B7280;margin-top:14px;">Your login credentials are in your inbox · askjericho.com</div>
          </td></tr>

          <tr><td style="padding:28px 32px 12px;" align="center">
            <div style="font-family:Georgia,serif;font-size:22px;line-height:1.6;color:#F5D78E;max-width:560px;">${narrative.closing_statement || ''}</div>
          </td></tr>

          <tr><td style="padding:24px 32px 8px;border-top:1px solid rgba(255,255,255,0.05);" align="center">
            <div style="font-size:16px;font-weight:700;color:#F0EDE6;">Jericho</div>
            <div style="font-size:12px;line-height:1.7;color:#6B7280;margin-top:8px;">Powered by The Momentum Company · Confidential</div>
            <div style="font-size:12px;line-height:1.7;color:#6B7280;">Individual data is never shared with employers at the individual level.</div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// Build Playbook email (teaser, not full HTML) — kept as legacy fallback
// ============================================================================
function buildPlaybookEmail(d: any, eng: any, narrative: any): string {
  const firstName = d.first_name || 'there';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#0B0F14;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" style="background-color:#0B0F14;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" style="max-width:600px;width:100%;">

<tr><td align="center" style="padding-bottom:32px;">
  <table role="presentation"><tr>
    <td style="background:linear-gradient(135deg,#E5A530,#F5C563);width:48px;height:48px;border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-size:24px;font-weight:bold;color:#0B0F14;">J</span>
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
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">🧬 7 Capabilities with 4-level assessments and development ladders</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">🎯 Growth Edge + 3 Priorities — from: "${d.feedback_received || ''}"</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">✅ Quick Win: ${narrative.quick_win_title || ''} — executable this week</p>
  <p style="margin:0 0 8px;font-size:14px;color:#D1D5DB !important;">📚 Learning Path — curated for your format and time</p>
</td></tr>

<tr><td style="padding:0 40px 40px;" align="center">
  <table role="presentation"><tr>
    <td style="border-radius:10px;background:linear-gradient(135deg,#E5A530,#D4942A);box-shadow:0 4px 14px rgba(229,165,48,0.35);">
      <a href="https://askjericho.com/auth" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:600;color:#0B0F14 !important;text-decoration:none;border-radius:10px;">View Your Full Playbook →</a>
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

    // STEP 4d: Email the full Playbook (true inbox-safe HTML)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && extractedData.email) {
      try {
        const firstName = extractedData.first_name || 'there';
        const emailHtml = buildFullPlaybookEmail(extractedData, engagementScores, selectedCapabilities, narrative);

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
        console.log(`[generate-individual-playbook] Full playbook email sent to ${extractedData.email}`);

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
