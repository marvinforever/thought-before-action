import jsPDF from "jspdf";
import { IGPData, formatLevel, levelToNumber, getGap, RESOURCE_TYPE_CONFIG } from "./igp-types";

// Colors
const NAVY: RGB = [30, 58, 95];
const GOLD: RGB = [230, 184, 0];
const WHITE: RGB = [255, 255, 255];
const LIGHT_GRAY: RGB = [245, 247, 250];
const MID_GRAY: RGB = [130, 140, 155];
const DARK_TEXT: RGB = [30, 42, 58];
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];
const BLUE: RGB = [37, 99, 235];
const AMBER: RGB = [217, 119, 6];
const PURPLE: RGB = [147, 51, 234];

type RGB = [number, number, number];

function setC(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
  doc.rect(x, y, w, h, "F");
}

function approachText(a: string): string {
  return a === "natural" ? "Experiential" : a === "training_needed" ? "Instructional" : "Mixed Approach";
}
function approachColor(a: string): RGB {
  return a === "natural" ? GREEN : a === "training_needed" ? PURPLE : BLUE;
}

const LEVEL_PDF: Record<string, { bg: RGB; text: RGB }> = {
  foundational: { bg: [200, 205, 215], text: [60, 70, 85] },
  advancing: { bg: [255, 230, 150], text: [140, 90, 0] },
  independent: { bg: [180, 210, 255], text: [30, 70, 180] },
  mastery: { bg: [180, 240, 200], text: [20, 120, 60] },
};

function typeLabelText(t: string): string {
  const map: Record<string, string> = { book: "BOOK", video: "VIDEO", podcast: "PODCAST", course: "COURSE", exercise: "PRACTICE", mentorship: "MENTORSHIP", tool: "TOOL" };
  return map[t] || t.toUpperCase();
}
function typeColor(t: string): RGB {
  const c = RESOURCE_TYPE_CONFIG[t];
  return c ? (c.pdfColor as RGB) : MID_GRAY;
}

export function generateIGPPdf(data: IGPData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const cW = pageW - margin * 2;
  let y = 0;

  const checkPage = (n: number) => {
    if (y + n > pageH - 18) {
      doc.addPage();
      y = 14;
      fillRect(doc, 0, 0, pageW, 2, GOLD);
    }
  };

  const sectionTitle = (t: string) => {
    checkPage(16);
    y += 3;
    fillRect(doc, margin, y, cW, 9, NAVY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    setC(doc, WHITE);
    doc.text(t.toUpperCase(), margin + 4, y + 6.5);
    y += 14;
  };

  const bodyLines = (text: string, indent = 0, maxW?: number): number => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    setC(doc, DARK_TEXT);
    const w = (maxW || cW) - indent - 4;
    const lines = doc.splitTextToSize(text, w);
    checkPage(lines.length * 4 + 2);
    doc.text(lines, margin + indent + 2, y);
    y += lines.length * 4 + 2;
    return lines.length;
  };

  const drawLevelBadge = (x: number, yPos: number, level: string, maxW = 30) => {
    const lc = LEVEL_PDF[level] || LEVEL_PDF.foundational;
    const label = formatLevel(level);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    const tw = Math.min(doc.getTextWidth(label) + 4, maxW);
    fillRect(doc, x, yPos - 3, tw, 5, lc.bg);
    setC(doc, lc.text);
    doc.text(label, x + 2, yPos);
  };

  // ===== HEADER =====
  fillRect(doc, 0, 0, pageW, 42, NAVY);
  fillRect(doc, 0, 42, pageW, 2.5, GOLD);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  setC(doc, WHITE);
  doc.text("INDIVIDUAL GROWTH PLAN", margin, 17);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  setC(doc, [200, 210, 225]);
  doc.text(data.profile.full_name, margin, 26);
  if (data.profile.job_title) { doc.setFontSize(9); doc.text(data.profile.job_title, margin, 33); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  setC(doc, GOLD);
  doc.text("JERICHO", pageW - margin, 14, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  setC(doc, [160, 170, 185]);
  doc.text("by The Momentum Company", pageW - margin, 19, { align: "right" });
  doc.setFontSize(7.5);
  setC(doc, [200, 210, 225]);
  doc.text(`Generated: ${new Date(data.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW - margin, 27, { align: "right" });
  if (data.profile.company_name) doc.text(data.profile.company_name, pageW - margin, 34, { align: "right" });
  y = 50;

  const ai = data.ai_recommendations;

  // ===== EXECUTIVE SUMMARY =====
  sectionTitle("Executive Summary");
  if (ai.overall_summary) bodyLines(ai.overall_summary);
  y += 2;

  // Strengths
  if (ai.strengths_statement) {
    checkPage(10);
    fillRect(doc, margin, y, cW, 0.5, GREEN);
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    setC(doc, GREEN);
    doc.text("STRENGTHS", margin + 2, y); y += 4;
    bodyLines(ai.strengths_statement);
    y += 2;
  }

  if (ai.primary_development_focus) {
    checkPage(10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    setC(doc, BLUE);
    doc.text("PRIMARY FOCUS", margin + 2, y); y += 4;
    bodyLines(ai.primary_development_focus);
    y += 2;
  }

  // Top Priority Actions
  if (ai.top_priority_actions?.length > 0) {
    checkPage(12);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    setC(doc, NAVY);
    doc.text("TOP PRIORITY ACTIONS", margin + 2, y); y += 6;
    ai.top_priority_actions.forEach((a, i) => {
      checkPage(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      setC(doc, NAVY);
      doc.text(`${i + 1}.`, margin + 4, y);
      doc.setFont("helvetica", "normal");
      setC(doc, DARK_TEXT);
      const lines = doc.splitTextToSize(a.action, cW - 20);
      doc.text(lines, margin + 12, y);
      if (a.capability_name) {
        doc.setFontSize(6.5); setC(doc, MID_GRAY);
        doc.text(`[${a.capability_name}]`, margin + 12, y + lines.length * 4);
        y += lines.length * 4 + 4;
      } else {
        y += lines.length * 4 + 3;
      }
    });
    y += 2;
  }

  // At a Glance
  if (ai.at_a_glance) {
    checkPage(16);
    const ag = ai.at_a_glance;
    const boxW = cW / 5;
    const items = [
      { label: "Total", value: String(ag.total_capabilities), color: NAVY },
      { label: "On Target", value: String(ag.on_target_count), color: GREEN },
      { label: "+1 Gap", value: String(ag.gap_1_count), color: AMBER },
      { label: "+2 Gap", value: String(ag.gap_2_plus_count), color: RED },
      { label: "Mastery", value: String(ag.by_level?.mastery || 0), color: PURPLE },
    ];
    items.forEach((item, i) => {
      const x = margin + i * boxW;
      fillRect(doc, x + 1, y, boxW - 2, 12, LIGHT_GRAY);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      setC(doc, item.color);
      doc.text(item.value, x + boxW / 2, y + 6, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      setC(doc, MID_GRAY);
      doc.text(item.label, x + boxW / 2, y + 10.5, { align: "center" });
    });
    y += 16;
  }

  // ===== 90-DAY ROADMAP =====
  if (ai.roadmap) {
    sectionTitle("90-Day Development Roadmap");
    const colW = (cW - 6) / 3;
    const columns = [
      { title: "START NOW (Month 1)", items: ai.roadmap.month_1 || [], color: RED },
      { title: "BUILD ON (Month 2-3)", items: ai.roadmap.month_2_3 || [], color: AMBER },
      { title: "SUSTAIN (Month 3+)", items: ai.roadmap.month_3_plus || [], color: GREEN },
    ];
    
    checkPage(20);
    columns.forEach((col, ci) => {
      const x = margin + ci * (colW + 3);
      fillRect(doc, x, y, colW, 6, col.color);
      doc.setFont("helvetica", "bold"); doc.setFontSize(6);
      setC(doc, WHITE);
      doc.text(col.title, x + 2, y + 4);
    });
    y += 8;

    const maxItems = Math.max(...columns.map(c => c.items.length));
    for (let row = 0; row < maxItems; row++) {
      checkPage(16);
      columns.forEach((col, ci) => {
        const item = col.items[row];
        if (!item) return;
        const x = margin + ci * (colW + 3);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        setC(doc, DARK_TEXT);
        const lines = doc.splitTextToSize(item.action, colW - 4);
        doc.text(lines, x + 2, y);
        doc.setFontSize(6); setC(doc, MID_GRAY);
        doc.text(`${item.resource_type} | ${item.time_per_week}`, x + 2, y + lines.length * 3.5);
      });
      y += 12;
    }
    y += 4;
  }

  // ===== CAPABILITY OVERVIEW TABLE =====
  if (data.capabilities?.length > 0) {
    sectionTitle("Capability Overview");
    const cols = [
      { x: margin + 3, label: "CAPABILITY" },
      { x: margin + cW * 0.40, label: "CURRENT" },
      { x: margin + cW * 0.54, label: "TARGET" },
      { x: margin + cW * 0.66, label: "GAP" },
      { x: margin + cW * 0.76, label: "APPROACH" },
    ];

    checkPage(9);
    fillRect(doc, margin, y, cW, 7, LIGHT_GRAY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    setC(doc, NAVY);
    cols.forEach(c => doc.text(c.label, c.x, y + 5));
    y += 10;

    // Sort capabilities
    const sorted = [...data.capabilities].sort((a, b) => {
      const gA = getGap(a.current_level, a.target_level);
      const gB = getGap(b.current_level, b.target_level);
      if (gA >= 2 && gB < 2) return -1;
      if (gB >= 2 && gA < 2) return 1;
      if (gA > 0 && gB <= 0) return -1;
      if (gB > 0 && gA <= 0) return 1;
      return gB - gA;
    });

    sorted.forEach((cap, i) => {
      checkPage(8);
      if (i % 2 === 0) fillRect(doc, margin, y - 1, cW, 7, [250, 251, 253]);
      const rec = ai.recommendations?.find((r: any) => r.capability_name === cap.name);
      const gap = getGap(cap.current_level, cap.target_level);

      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      setC(doc, DARK_TEXT);
      const maxNameW = cols[1].x - cols[0].x - 4;
      const name = doc.getTextWidth(cap.name) > maxNameW ? cap.name.substring(0, 24) + "..." : cap.name;
      doc.text(name, cols[0].x, y + 3.5);

      drawLevelBadge(cols[1].x, y + 3.5, cap.current_level);
      drawLevelBadge(cols[2].x, y + 3.5, cap.target_level);

      if (gap > 0) {
        const gc: RGB = gap >= 2 ? RED : AMBER;
        setC(doc, gc);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
        doc.text(`+${gap}`, cols[3].x, y + 3.5);
      } else if (gap === 0 && cap.current_level) {
        setC(doc, GREEN);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        doc.text("On Target", cols[3].x, y + 3.5);
      }

      if (rec) {
        const ac = approachColor(rec.advancement_approach);
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
        setC(doc, ac);
        doc.text(approachText(rec.advancement_approach), cols[4].x, y + 3.5);
      }
      y += 7;
    });
    y += 4;
  }

  // ===== DIAGNOSTIC =====
  if (data.diagnostic) {
    sectionTitle("Diagnostic Assessment");
    const scores = [
      { name: "Engagement", value: data.diagnostic.engagement_score },
      { name: "Clarity", value: data.diagnostic.clarity_score },
      { name: "Career", value: data.diagnostic.career_score },
      { name: "Learning", value: data.diagnostic.learning_score },
      { name: "Manager", value: data.diagnostic.manager_score },
      { name: "Skills", value: data.diagnostic.skills_score },
      { name: "Retention", value: data.diagnostic.retention_score },
      { name: "Burnout Risk", value: data.diagnostic.burnout_score },
    ];

    // Alert for critical scores
    const critical = scores.filter(s => s.value !== null && s.value !== undefined && s.value <= 30);
    if (critical.length > 0) {
      checkPage(critical.length * 6 + 4);
      critical.forEach(s => {
        fillRect(doc, margin, y, cW, 5, [255, 235, 235]);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        setC(doc, RED);
        doc.text(`ALERT: ${s.name}: ${s.value}% -- Immediate attention recommended`, margin + 3, y + 3.5);
        y += 6;
      });
      y += 2;
    }

    const pending = scores.filter(s => s.value === null || s.value === undefined).length;
    if (pending > 0) {
      checkPage(8);
      fillRect(doc, margin, y, cW, 5, [255, 245, 220]);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      setC(doc, AMBER);
      doc.text(`Diagnostic partially complete -- ${pending} of ${scores.length} dimensions pending assessment`, margin + 3, y + 3.5);
      y += 8;
    }

    const colW = cW / 4;
    checkPage(32);
    scores.forEach((s, i) => {
      const col = i % 4;
      if (col === 0 && i > 0) y += 16;
      checkPage(16);
      const x = margin + col * colW;

      fillRect(doc, x + 2, y, colW - 4, 12, LIGHT_GRAY);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      setC(doc, MID_GRAY);
      doc.text(s.name, x + 4, y + 5);

      if (s.value === null || s.value === undefined) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(7);
        setC(doc, MID_GRAY);
        doc.text("Awaiting Data", x + colW - 6, y + 5, { align: "right" });
      } else {
        const sc: RGB = s.value <= 30 ? RED : s.value <= 60 ? AMBER : s.value <= 85 ? BLUE : GREEN;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        setC(doc, sc);
        doc.text(`${s.value}%`, x + colW - 6, y + 5, { align: "right" });
        const barW = ((colW - 8) * Math.min(s.value, 100)) / 100;
        fillRect(doc, x + 4, y + 7.5, colW - 8, 3, [220, 225, 230]);
        fillRect(doc, x + 4, y + 7.5, barW, 3, sc);
      }
    });
    y += 20;
  }

  // ===== DETAILED CAPABILITY RECOMMENDATIONS =====
  if (ai.recommendations?.length > 0) {
    sectionTitle("Detailed Training & Development");
    const topPriorityNames = new Set((ai.top_priority_actions || []).map(a => a.capability_name));

    ai.recommendations.forEach((rec: any) => {
      const cap = data.capabilities?.find(c => c.name === rec.capability_name);
      checkPage(30);

      // Header bar
      fillRect(doc, margin, y, cW, 8, [235, 238, 245]);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      setC(doc, NAVY);

      let headerX = margin + 4;
      if (topPriorityNames.has(rec.capability_name)) {
        fillRect(doc, margin + 3, y + 1.5, 26, 5, GOLD);
        doc.setFont("helvetica", "bold"); doc.setFontSize(5.5);
        setC(doc, NAVY);
        doc.text("TOP PRIORITY", margin + 5, y + 5);
        headerX = margin + 32;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        setC(doc, NAVY);
      }
      doc.text(rec.capability_name || "Capability", headerX, y + 5.5);

      if (cap) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        setC(doc, MID_GRAY);
        doc.text(`${formatLevel(cap.current_level)} > ${formatLevel(cap.target_level)}`, pageW - margin - 3, y + 5.5, { align: "right" });
      }
      y += 12;

      // Assessment
      if (rec.current_assessment) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(8);
        setC(doc, MID_GRAY);
        const al = doc.splitTextToSize(rec.current_assessment, cW - 10);
        checkPage(al.length * 4 + 3);
        doc.text(al, margin + 5, y);
        y += al.length * 4 + 3;
      }

      // Why this matters
      if (rec.why_this_matters) {
        checkPage(10);
        fillRect(doc, margin + 5, y, cW - 10, 0.3, GOLD);
        y += 3;
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
        setC(doc, GOLD);
        doc.text("WHY THIS MATTERS", margin + 5, y); y += 4;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
        setC(doc, DARK_TEXT);
        const wl = doc.splitTextToSize(rec.why_this_matters, cW - 14);
        checkPage(wl.length * 3.8 + 3);
        doc.text(wl, margin + 7, y);
        y += wl.length * 3.8 + 4;
      }

      // Approach + timeline
      const ac = approachColor(rec.advancement_approach);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      setC(doc, ac);
      checkPage(6);
      let approachLine = approachText(rec.advancement_approach);
      if (rec.estimated_timeline) approachLine += ` | ${rec.estimated_timeline}`;
      doc.text(`[${approachLine}]`, margin + 5, y);
      y += 5;

      if (rec.advancement_reasoning) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
        setC(doc, DARK_TEXT);
        const rl = doc.splitTextToSize(rec.advancement_reasoning, cW - 14);
        checkPage(rl.length * 3.8 + 3);
        doc.text(rl, margin + 7, y);
        y += rl.length * 3.8 + 4;
      }

      // Training items
      if (rec.training_items?.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
        setC(doc, NAVY);
        checkPage(8);
        doc.text("TRAINING RECOMMENDATIONS:", margin + 5, y);
        y += 6;

        rec.training_items.forEach((item: any) => {
          checkPage(18);

          // Type badge
          const label = typeLabelText(item.type);
          const tc = typeColor(item.type);
          doc.setFont("helvetica", "bold"); doc.setFontSize(6);
          setC(doc, WHITE);
          const bw = doc.getTextWidth(label) + 4;
          fillRect(doc, margin + 7, y - 2.5, bw, 4, tc);
          doc.text(label, margin + 9, y);

          // Cost badge
          const costX = margin + 9 + bw + 2;
          if (item.cost_indicator === "free") {
            const cl = "FREE";
            const cw2 = doc.getTextWidth(cl) + 4;
            fillRect(doc, costX, y - 2.5, cw2, 4, GREEN);
            setC(doc, WHITE);
            doc.text(cl, costX + 2, y);
          } else {
            const costLabel = item.cost_detail ? `PAID (${item.cost_detail})` : "PAID";
            const cw2 = doc.getTextWidth(costLabel) + 4;
            fillRect(doc, costX, y - 2.5, cw2, 4, RED);
            setC(doc, WHITE);
            doc.text(costLabel, costX + 2, y);
          }
          y += 3;

          // Title
          doc.setFont("helvetica", "bold"); doc.setFontSize(8);
          setC(doc, DARK_TEXT);
          const tl = doc.splitTextToSize(item.title || '', cW - 18);
          checkPage(tl.length * 4 + 2);
          doc.text(tl, margin + 9, y);
          y += tl.length * 4;

          // Target level
          if (item.target_level) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
            setC(doc, MID_GRAY);
            doc.text(`Target: ${formatLevel(item.target_level)}`, margin + 9, y);
            y += 3.5;
          }

          // Description
          if (item.description) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7);
            setC(doc, MID_GRAY);
            const dl = doc.splitTextToSize(item.description, cW - 18);
            checkPage(dl.length * 3.5 + 2);
            doc.text(dl, margin + 9, y);
            y += dl.length * 3.5 + 2;
          }

          // Free alternative
          if (item.free_alternative) {
            checkPage(8);
            fillRect(doc, margin + 9, y, cW - 18, 0.3, GREEN);
            y += 2;
            doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
            setC(doc, GREEN);
            doc.text("Free Alternative:", margin + 9, y);
            doc.setFont("helvetica", "normal");
            setC(doc, DARK_TEXT);
            const fl = doc.splitTextToSize(item.free_alternative, cW - 40);
            doc.text(fl, margin + 30, y);
            y += fl.length * 3.5 + 3;
          }

          y += 2;
        });
      }

      // Level progression
      if (rec.level_progression?.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
        setC(doc, NAVY);
        checkPage(8);
        doc.text("LEVEL PROGRESSION PATH:", margin + 5, y);
        y += 6;

        rec.level_progression.forEach((lp: any) => {
          checkPage(18);
          y += 1;
          fillRect(doc, margin + 7, y, cW - 14, 0.5, GOLD);
          y += 3;
          const lc = LEVEL_PDF[lp.level] || LEVEL_PDF.foundational;
          doc.setFont("helvetica", "bold"); doc.setFontSize(8);
          setC(doc, lc.text);
          doc.text(formatLevel(lp.level), margin + 7, y + 2);
          y += 6;

          if (lp.definition) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7);
            setC(doc, DARK_TEXT);
            const dl = doc.splitTextToSize(`What it looks like: ${lp.definition}`, cW - 20);
            checkPage(dl.length * 3.5 + 2);
            doc.text(dl, margin + 9, y);
            y += dl.length * 3.5 + 2;
          }
          if (lp.how_to_achieve) {
            doc.setFont("helvetica", "italic"); doc.setFontSize(7);
            setC(doc, MID_GRAY);
            const hl = doc.splitTextToSize(`How to achieve: ${lp.how_to_achieve}`, cW - 20);
            checkPage(hl.length * 3.5 + 2);
            doc.text(hl, margin + 9, y);
            y += hl.length * 3.5 + 3;
          }
        });
      }

      // Separator
      y += 4;
      checkPage(4);
      fillRect(doc, margin + 10, y, cW - 20, 0.3, [220, 225, 230]);
      y += 6;
    });
  }

  // ===== GLOSSARY =====
  sectionTitle("Glossary of Terms");
  const glossary = [
    { term: "Foundational", def: "Beginning stage -- building awareness and basic understanding. Requires guidance." },
    { term: "Advancing", def: "Developing stage -- can apply with some support. Building confidence and consistency." },
    { term: "Independent", def: "Proficient stage -- consistently demonstrates without supervision. Can mentor others." },
    { term: "Mastery", def: "Expert stage -- recognized authority. Innovates and elevates others." },
    { term: "Gap", def: "Difference between current and target level. +1 = one level below; +2 = two levels below." },
    { term: "On Target", def: "Current level meets or exceeds target level." },
    { term: "Experiential", def: "Develops organically through day-to-day work and practice." },
    { term: "Instructional", def: "Requires structured learning (courses, books, coaching)." },
    { term: "Mixed Approach", def: "Combination of experience and targeted training." },
  ];
  const termW = cW * 0.28;
  const defW = cW * 0.72;
  checkPage(12);
  fillRect(doc, margin, y, termW, 7, LIGHT_GRAY);
  fillRect(doc, margin + termW, y, defW, 7, LIGHT_GRAY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  setC(doc, NAVY);
  doc.text("TERM", margin + 3, y + 5);
  doc.text("DEFINITION", margin + termW + 3, y + 5);
  y += 10;

  glossary.forEach((item, i) => {
    const dl = doc.splitTextToSize(item.def, defW - 6);
    const rh = Math.max(dl.length * 3.8 + 4, 8);
    checkPage(rh + 2);
    if (i % 2 === 0) fillRect(doc, margin, y - 1, cW, rh, [250, 251, 253]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    setC(doc, NAVY);
    doc.text(item.term, margin + 3, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    setC(doc, DARK_TEXT);
    doc.text(dl, margin + termW + 3, y + 3);
    y += rh + 1;
  });

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    fillRect(doc, 0, pageH - 12, pageW, 12, NAVY);
    fillRect(doc, 0, pageH - 12, pageW, 1, GOLD);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    setC(doc, [160, 170, 185]);
    doc.text("Jericho by The Momentum Company  |  Confidential Individual Growth Plan", margin, pageH - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  const safeName = (data.profile.full_name || "growth-plan").replace(/\s+/g, "-").toLowerCase();
  doc.save(`${safeName}-igp-${new Date().toISOString().split("T")[0]}.pdf`);
}
