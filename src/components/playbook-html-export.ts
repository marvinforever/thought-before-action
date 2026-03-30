import type { EngagementScores, Narrative, CapabilityEntry } from "./PlaybookViewer";

/**
 * Generates a clean, styled standalone HTML document from structured playbook data.
 * Used for "open in new tab" — matches the native viewer's layout and feel.
 */
export function generatePlaybookHtml(
  narrative: Narrative,
  scores: EngagementScores,
  capabilities: CapabilityEntry[],
): string {
  const priorityCaps = capabilities.filter(c => c.is_priority);
  const strengthCaps = capabilities.filter(c => !c.is_priority);

  const levelBadge = (level: string) => {
    const colors: Record<string, string> = {
      foundational: "background:#fff7ed;color:#c2410c;border:1px solid #fed7aa",
      advancing: "background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe",
      independent: "background:#ecfdf5;color:#047857;border:1px solid #a7f3d0",
      mastery: "background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe",
    };
    return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;${colors[level] || ""}">${level}</span>`;
  };

  const scoreGrid = [
    { label: "Burnout Risk", value: scores.burnoutRisk },
    { label: "Role Strain", value: scores.roleStrain },
    { label: "Satisfaction", value: scores.satisfaction },
    { label: "Self-Efficacy", value: scores.selfEfficacy },
    { label: "Org Support", value: scores.orgSupport },
    { label: "Strength Use", value: scores.strengthUtil },
    { label: "Growth Barriers", value: scores.growthBarriers },
    { label: "Engagement", value: scores.overallEngagement },
  ];

  const resIcon = (type: string) => {
    const map: Record<string, string> = { podcast: "🎙️", video: "🎥", article: "📄", framework: "📐", reflection: "🪞" };
    return map[type] || "📚";
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Growth Playbook</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .section-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .section-title { font-size: 18px; font-weight: 700; }
  .north-star { border-color: #d4a017; background: linear-gradient(135deg, #fffbeb, #fef3c7); }
  .ns-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #d4a017; margin-bottom: 8px; }
  .ns-text { font-size: 22px; font-weight: 700; color: #1e293b; }
  .ns-followup { font-size: 14px; color: #64748b; margin-top: 8px; }
  .score-composite { text-align: center; padding: 20px; }
  .composite-num { font-size: 56px; font-weight: 800; color: #1e293b; }
  .composite-label { font-size: 13px; color: #94a3b8; }
  .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
  .score-tile { text-align: center; padding: 12px 8px; background: #f8fafc; border-radius: 8px; }
  .score-val { font-size: 22px; font-weight: 700; color: #1e293b; }
  .score-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .burnout-alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 12px; color: #dc2626; font-size: 14px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } .score-grid { grid-template-columns: repeat(2, 1fr); } }
  .superpower { background: #f0fdf4; border-color: #bbf7d0; }
  .growth-edge { background: #fffbeb; border-color: #fde68a; }
  .sub-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .blockquote { border-left: 3px solid #d4a017; padding-left: 12px; font-style: italic; color: #475569; margin-bottom: 8px; }
  .cap-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; background: #fff; }
  .cap-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .cap-name { font-weight: 600; font-size: 14px; }
  .cap-cat { font-size: 12px; color: #94a3b8; }
  .cap-levels { display: flex; align-items: center; gap: 6px; }
  .cap-arrow { color: #94a3b8; font-size: 13px; }
  .cap-bar { height: 5px; background: #f1f5f9; border-radius: 4px; margin-top: 10px; position: relative; overflow: hidden; }
  .cap-bar-fill { height: 100%; border-radius: 4px; background: #1e3a5f; }
  .cap-reasoning { font-size: 13px; color: #64748b; margin-top: 10px; line-height: 1.5; }
  .priority-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; display: flex; gap: 12px; }
  .priority-num { width: 28px; height: 28px; border-radius: 50%; background: #fef3c7; color: #d4a017; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .qw-card { background: #fffbeb; border-color: #fde68a; }
  .qw-step { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; font-size: 14px; }
  .qw-check { color: #d4a017; flex-shrink: 0; margin-top: 2px; }
  .res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .res-grid { grid-template-columns: 1fr; } }
  .res-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #fff; }
  .res-icon { font-size: 20px; margin-right: 8px; }
  .res-title { font-weight: 600; font-size: 14px; }
  .res-desc { font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5; }
  .res-time { font-size: 12px; color: #d4a017; font-weight: 600; margin-top: 6px; }
  .closing { text-align: center; font-size: 16px; font-weight: 500; font-style: italic; color: #475569; padding: 20px; }
  .section-sub { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #d4a017; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  .strength-sub { color: #94a3b8; }
  p { margin-bottom: 8px; font-size: 14px; }
</style>
</head>
<body>
<div class="container">

${narrative.north_star_text ? `
<div class="card north-star">
  <div class="ns-label">⧫ Your North Star</div>
  <div class="ns-text">"${narrative.north_star_text}"</div>
  ${narrative.north_star_followup ? `<div class="ns-followup">${narrative.north_star_followup}</div>` : ""}
</div>` : ""}

<div class="card">
  <div class="section-header">
    <div class="section-icon" style="background:#f0f9ff">📊</div>
    <div class="section-title">Engagement Diagnostic</div>
  </div>
  <div class="score-composite">
    <div class="composite-num">${scores.composite}</div>
    <div class="composite-label">Composite Score</div>
  </div>
  <div class="score-grid">
    ${scoreGrid.map(s => `<div class="score-tile"><div class="score-val">${s.value}</div><div class="score-label">${s.label}</div></div>`).join("")}
  </div>
  ${narrative.diagnostic_commentary ? `<p style="margin-top:16px;color:#64748b">${narrative.diagnostic_commentary}</p>` : ""}
  ${narrative.burnout_alert ? `<div class="burnout-alert">🔥 ${narrative.burnout_alert}</div>` : ""}
</div>

${narrative.snapshot_paragraphs?.length ? `
<div class="card">
  <div class="section-header">
    <div class="section-icon" style="background:#f5f3ff">🧠</div>
    <div class="section-title">Your Snapshot</div>
  </div>
  ${narrative.snapshot_paragraphs.map(p => `<p>${p}</p>`).join("")}
</div>` : ""}

<div class="two-col">
  ${narrative.superpower_paragraphs?.length ? `
  <div class="card superpower">
    <div class="sub-title">🏆 Your Superpower</div>
    ${narrative.superpower_paragraphs.map(p => `<p>${p}</p>`).join("")}
  </div>` : ""}
  ${narrative.growth_edge_quote ? `
  <div class="card growth-edge">
    <div class="sub-title">⚡ Your Growth Edge</div>
    <div class="blockquote">"${narrative.growth_edge_quote}"</div>
    ${narrative.growth_edge_intro ? `<p style="color:#64748b">${narrative.growth_edge_intro}</p>` : ""}
  </div>` : ""}
</div>

<div class="card">
  <div class="section-header">
    <div class="section-icon" style="background:#fef3c7">🎯</div>
    <div class="section-title">Capability Map</div>
  </div>
  ${priorityCaps.length ? `<div class="section-sub">⭐ Development Priorities</div>` : ""}
  ${priorityCaps.map(c => `
  <div class="cap-card" style="border-left:3px solid #d4a017">
    <div class="cap-header">
      <div><span class="cap-name">${c.capability_name}</span> <span class="cap-cat">· ${c.category}</span></div>
      <div class="cap-levels">${levelBadge(c.current_level)} <span class="cap-arrow">→</span> ${levelBadge(c.target_level)}</div>
    </div>
    <div class="cap-bar"><div class="cap-bar-fill" style="width:${(["foundational","advancing","independent","mastery"].indexOf(c.current_level)+1)*25}%"></div></div>
    <div class="cap-reasoning">${c.reasoning}</div>
  </div>`).join("")}
  ${strengthCaps.length ? `<div class="section-sub strength-sub" style="margin-top:20px">🛡️ Strengths</div>` : ""}
  ${strengthCaps.map(c => `
  <div class="cap-card">
    <div class="cap-header">
      <div><span class="cap-name">${c.capability_name}</span> <span class="cap-cat">· ${c.category}</span></div>
      <div class="cap-levels">${levelBadge(c.current_level)} <span class="cap-arrow">→</span> ${levelBadge(c.target_level)}</div>
    </div>
    <div class="cap-bar"><div class="cap-bar-fill" style="width:${(["foundational","advancing","independent","mastery"].indexOf(c.current_level)+1)*25}%"></div></div>
    <div class="cap-reasoning">${c.reasoning}</div>
  </div>`).join("")}
</div>

${narrative.priorities?.length ? `
<div class="card">
  <div class="section-header">
    <div class="section-icon" style="background:#fef3c7">💡</div>
    <div class="section-title">Priority Actions</div>
  </div>
  ${narrative.priorities.map((p, i) => `
  <div class="priority-card">
    <div class="priority-num">${i + 1}</div>
    <div>
      <div style="font-weight:600;font-size:14px;margin-bottom:4px">${p.title}</div>
      <div style="font-size:13px;color:#64748b;line-height:1.5">${p.description}</div>
    </div>
  </div>`).join("")}
</div>` : ""}

${narrative.quick_win_title ? `
<div class="card qw-card">
  <div class="section-header">
    <div class="section-icon" style="background:#fde68a">⚡</div>
    <div class="section-title">Your Quick Win: ${narrative.quick_win_title}</div>
  </div>
  ${narrative.quick_win_intro ? `<p>${narrative.quick_win_intro}</p>` : ""}
  ${narrative.quick_win_steps?.map(s => `<div class="qw-step"><span class="qw-check">✓</span><span>${s}</span></div>`).join("") || ""}
  ${narrative.quick_win_closer ? `<p style="font-style:italic;color:#64748b;margin-top:12px">${narrative.quick_win_closer}</p>` : ""}
</div>` : ""}

${narrative.learning_resources?.length ? `
<div class="card">
  <div class="section-header">
    <div class="section-icon" style="background:#ecfdf5">📚</div>
    <div class="section-title">Curated Learning</div>
  </div>
  ${narrative.learning_intro ? `<p style="margin-bottom:16px;color:#64748b">${narrative.learning_intro}</p>` : ""}
  <div class="res-grid">
    ${narrative.learning_resources.map(r => `
    <div class="res-card">
      <div><span class="res-icon">${resIcon(r.type)}</span><span class="res-title">${r.title}</span></div>
      <div class="res-desc">${r.description}</div>
      ${r.time_estimate ? `<div class="res-time">${r.time_estimate}</div>` : ""}
    </div>`).join("")}
  </div>
</div>` : ""}

${narrative.closing_statement ? `<div class="card closing">"${narrative.closing_statement}"</div>` : ""}

</div>
</body>
</html>`;
}
