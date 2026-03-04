import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface AdminDownloadGrowthPlanProps {
  profileId: string;
  employeeName: string;
  variant?: "button" | "menuItem";
  onComplete?: () => void;
}

const NAVY = [30, 58, 95] as const;
const GOLD = [230, 184, 0] as const;
const WHITE = [255, 255, 255] as const;
const LIGHT_GRAY = [245, 247, 250] as const;
const MID_GRAY = [130, 140, 155] as const;
const DARK_TEXT = [30, 42, 58] as const;
const GREEN = [22, 163, 74] as const;
const RED = [220, 38, 38] as const;
const BLUE = [37, 99, 235] as const;
const ORANGE = [234, 138, 0] as const;

type RGB = readonly [number, number, number];

function setColor(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x, y, w, h, "F");
}

function levelToNumber(level: string | null): number {
  switch (level) {
    case "mastery": return 4;
    case "independent": return 3;
    case "advancing": return 2;
    case "foundational": return 1;
    default: return 0;
  }
}

function formatLevel(level: string | null): string {
  if (!level) return "Not Assessed";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function scoreBadge(score: number | null): { label: string; color: RGB } {
  if (score === null || score === undefined) return { label: "N/A", color: MID_GRAY };
  if (score >= 80) return { label: `${score}%`, color: GREEN };
  if (score >= 60) return { label: `${score}%`, color: GOLD };
  return { label: `${score}%`, color: RED };
}

function typeIcon(type: string): string {
  switch (type) {
    case "book": return "📖";
    case "video": return "🎬";
    case "podcast": return "🎧";
    case "course": return "🎓";
    case "exercise": return "💪";
    case "mentorship": return "🤝";
    default: return "→";
  }
}

function approachLabel(approach: string): { text: string; color: RGB } {
  switch (approach) {
    case "natural": return { text: "Natural Advancement", color: GREEN };
    case "training_needed": return { text: "Training Required", color: ORANGE };
    case "mixed": return { text: "Mixed Approach", color: BLUE };
    default: return { text: approach, color: MID_GRAY };
  }
}

export function AdminDownloadGrowthPlan({ profileId, employeeName, variant = "button", onComplete }: AdminDownloadGrowthPlanProps) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setGenerating(true);
    try {
      toast({ title: "Generating Growth Plan", description: `Building AI-powered IGP for ${employeeName}...` });

      const { data, error } = await supabase.functions.invoke('generate-growth-plan-recommendations', {
        body: { profile_id: profileId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate recommendations');

      const { profile, capabilities, diagnostic, vision, goals, habits, achievements, ai_recommendations: ai } = data;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = pageW - margin * 2;
      let y = 0;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 18) {
          doc.addPage();
          y = 18;
          drawRect(doc, 0, 0, pageW, 2, GOLD);
        }
      };

      const sectionHeader = (title: string) => {
        checkPage(16);
        drawRect(doc, margin, y, contentW, 8, NAVY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setColor(doc, WHITE);
        doc.text(title.toUpperCase(), margin + 4, y + 5.5);
        y += 12;
      };

      const subHeader = (title: string) => {
        checkPage(10);
        drawRect(doc, margin, y, contentW, 6, LIGHT_GRAY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setColor(doc, NAVY);
        doc.text(title, margin + 3, y + 4);
        y += 8;
      };

      const bodyText = (text: string, indent = 0, maxW?: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setColor(doc, DARK_TEXT);
        const lines = doc.splitTextToSize(text, (maxW || contentW) - indent - 2);
        checkPage(lines.length * 3.8 + 2);
        doc.text(lines, margin + indent + 2, y);
        y += lines.length * 3.8 + 1;
      };

      // ===== HEADER =====
      drawRect(doc, 0, 0, pageW, 40, NAVY);
      drawRect(doc, 0, 40, pageW, 2.5, GOLD);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      setColor(doc, WHITE);
      doc.text("INDIVIDUAL GROWTH PLAN", margin, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      setColor(doc, [200, 210, 225]);
      doc.text(profile?.full_name || employeeName, margin, 24);
      if (profile?.job_title) {
        doc.setFontSize(9);
        doc.text(profile.job_title, margin, 30);
      }

      doc.setFontSize(8);
      setColor(doc, GOLD);
      doc.text("JERICHO", pageW - margin, 13, { align: "right" });
      doc.setFontSize(6.5);
      setColor(doc, [160, 170, 185]);
      doc.text("by The Momentum Company", pageW - margin, 17.5, { align: "right" });
      doc.setFontSize(7.5);
      setColor(doc, [200, 210, 225]);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW - margin, 25, { align: "right" });
      if (profile?.company_name) {
        doc.text(profile.company_name, pageW - margin, 31, { align: "right" });
      }

      y = 48;

      // ===== EXECUTIVE SUMMARY =====
      if (ai?.overall_summary) {
        sectionHeader("Executive Summary");
        bodyText(ai.overall_summary);
        y += 2;
      }

      // ===== TOP PRIORITY ACTIONS =====
      if (ai?.top_priority_actions?.length > 0) {
        subHeader("Top Priority Actions");
        ai.top_priority_actions.forEach((action: string, i: number) => {
          checkPage(6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          setColor(doc, NAVY);
          doc.text(`${i + 1}.`, margin + 3, y);
          doc.setFont("helvetica", "normal");
          setColor(doc, DARK_TEXT);
          const lines = doc.splitTextToSize(action, contentW - 12);
          doc.text(lines, margin + 10, y);
          y += lines.length * 3.8 + 2;
        });
        y += 2;
      }

      // ===== PROFESSIONAL VISION (only if exists) =====
      if (vision?.one_year_vision || vision?.three_year_vision) {
        sectionHeader("Professional Vision");
        if (vision.one_year_vision) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          setColor(doc, MID_GRAY);
          doc.text("1-YEAR VISION", margin + 2, y);
          y += 4;
          bodyText(vision.one_year_vision);
          y += 2;
        }
        if (vision.three_year_vision) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          setColor(doc, MID_GRAY);
          doc.text("3-YEAR VISION", margin + 2, y);
          y += 4;
          bodyText(vision.three_year_vision);
          y += 2;
        }
      }

      // ===== DIAGNOSTIC (only if exists) =====
      if (diagnostic) {
        sectionHeader("Diagnostic Assessment");
        const scores = [
          { name: "Engagement", value: diagnostic.engagement_score },
          { name: "Clarity", value: diagnostic.clarity_score },
          { name: "Career", value: diagnostic.career_score },
          { name: "Learning", value: diagnostic.learning_score },
          { name: "Manager", value: diagnostic.manager_score },
          { name: "Skills", value: diagnostic.skills_score },
          { name: "Retention", value: diagnostic.retention_score },
          { name: "Burnout Risk", value: diagnostic.burnout_score },
        ];

        const colW = contentW / 4;
        scores.forEach((s, i) => {
          const col = i % 4;
          if (col === 0 && i > 0) y += 14;
          checkPage(14);
          const x = margin + col * colW;
          const badge = scoreBadge(s.value);
          drawRect(doc, x + 2, y, colW - 4, 10, LIGHT_GRAY);
          if (s.value !== null && s.value !== undefined) {
            const barW = ((colW - 6) * Math.min(s.value, 100)) / 100;
            drawRect(doc, x + 3, y + 6, barW, 3, badge.color as unknown as RGB);
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          setColor(doc, MID_GRAY);
          doc.text(s.name, x + 3, y + 4);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          setColor(doc, badge.color as unknown as RGB);
          doc.text(badge.label, x + colW - 5, y + 4, { align: "right" });
        });
        y += 18;
      }

      // ===== CAPABILITY OVERVIEW TABLE =====
      if (capabilities?.length > 0) {
        sectionHeader("Capability Overview");
        checkPage(8);
        drawRect(doc, margin, y, contentW, 7, LIGHT_GRAY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, NAVY);
        doc.text("CAPABILITY", margin + 3, y + 4.5);
        doc.text("CURRENT", margin + 90, y + 4.5);
        doc.text("TARGET", margin + 115, y + 4.5);
        doc.text("GAP", margin + 140, y + 4.5);
        doc.text("APPROACH", margin + 152, y + 4.5);
        y += 9;

        capabilities.forEach((cap: any, i: number) => {
          checkPage(7);
          if (i % 2 === 0) drawRect(doc, margin, y - 1, contentW, 6, [250, 251, 253]);
          
          const rec = ai?.recommendations?.find((r: any) => r.capability_name === cap.name);
          const gap = levelToNumber(cap.target_level) - levelToNumber(cap.current_level);
          const appr = rec ? approachLabel(rec.advancement_approach) : { text: "—", color: MID_GRAY };

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          setColor(doc, DARK_TEXT);
          doc.text(cap.name.substring(0, 42), margin + 3, y + 3);

          setColor(doc, MID_GRAY);
          doc.text(formatLevel(cap.current_level), margin + 90, y + 3);
          doc.text(formatLevel(cap.target_level), margin + 115, y + 3);

          if (gap > 0) {
            setColor(doc, RED);
            doc.text(`▲ ${gap}`, margin + 140, y + 3);
          } else if (gap === 0 && cap.current_level) {
            setColor(doc, GREEN);
            doc.text("✓", margin + 140, y + 3);
          } else {
            setColor(doc, MID_GRAY);
            doc.text("—", margin + 140, y + 3);
          }

          doc.setFontSize(6.5);
          setColor(doc, appr.color as unknown as RGB);
          doc.text(appr.text, margin + 152, y + 3);

          y += 6;
        });
        y += 4;
      }

      // ===== DETAILED CAPABILITY RECOMMENDATIONS =====
      if (ai?.recommendations?.length > 0) {
        sectionHeader("Detailed Training & Development Recommendations");

        ai.recommendations.forEach((rec: any) => {
          const cap = capabilities?.find((c: any) => c.name === rec.capability_name);
          
          // Capability name header
          checkPage(20);
          drawRect(doc, margin, y, contentW, 7, [240, 243, 248]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          setColor(doc, NAVY);
          doc.text(rec.capability_name || "Capability", margin + 3, y + 5);
          
          if (cap) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            setColor(doc, MID_GRAY);
            doc.text(`${formatLevel(cap.current_level)} → ${formatLevel(cap.target_level)}`, pageW - margin - 2, y + 5, { align: "right" });
          }
          y += 10;

          // Assessment
          if (rec.current_assessment) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            setColor(doc, MID_GRAY);
            const assessLines = doc.splitTextToSize(rec.current_assessment, contentW - 8);
            checkPage(assessLines.length * 3.5 + 2);
            doc.text(assessLines, margin + 4, y);
            y += assessLines.length * 3.5 + 2;
          }

          // Advancement approach
          const appr = approachLabel(rec.advancement_approach);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          setColor(doc, appr.color as unknown as RGB);
          checkPage(5);
          doc.text(`● ${appr.text}`, margin + 4, y);
          y += 4;
          if (rec.advancement_reasoning) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            setColor(doc, DARK_TEXT);
            const reasonLines = doc.splitTextToSize(rec.advancement_reasoning, contentW - 12);
            checkPage(reasonLines.length * 3.5 + 2);
            doc.text(reasonLines, margin + 6, y);
            y += reasonLines.length * 3.5 + 3;
          }

          // Training items
          if (rec.training_items?.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            setColor(doc, NAVY);
            checkPage(6);
            doc.text("RECOMMENDED TRAINING:", margin + 4, y);
            y += 4;

            rec.training_items.forEach((item: any) => {
              checkPage(10);
              const icon = typeIcon(item.type);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              setColor(doc, DARK_TEXT);
              doc.text(`${icon} ${item.title || ''}`, margin + 6, y);
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              setColor(doc, BLUE);
              doc.text(`[${(item.type || '').toUpperCase()}]`, margin + 6, y + 3.5);
              
              if (item.target_level) {
                setColor(doc, MID_GRAY);
                doc.text(`→ ${formatLevel(item.target_level)}`, margin + 30, y + 3.5);
              }
              y += 4;

              if (item.description) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                setColor(doc, MID_GRAY);
                const descLines = doc.splitTextToSize(item.description, contentW - 16);
                checkPage(descLines.length * 3.2 + 2);
                doc.text(descLines, margin + 8, y);
                y += descLines.length * 3.2 + 2;
              }
            });
            y += 1;
          }

          // Level progression
          if (rec.level_progression?.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            setColor(doc, NAVY);
            checkPage(6);
            doc.text("LEVEL PROGRESSION PATH:", margin + 4, y);
            y += 5;

            rec.level_progression.forEach((lp: any) => {
              checkPage(14);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              setColor(doc, GOLD);
              doc.text(`▸ ${formatLevel(lp.level)}`, margin + 6, y);
              y += 4;

              if (lp.definition) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                setColor(doc, DARK_TEXT);
                const defLines = doc.splitTextToSize(`What it looks like: ${lp.definition}`, contentW - 16);
                checkPage(defLines.length * 3.2 + 2);
                doc.text(defLines, margin + 8, y);
                y += defLines.length * 3.2 + 1;
              }

              if (lp.how_to_achieve) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                setColor(doc, MID_GRAY);
                const howLines = doc.splitTextToSize(`How to achieve: ${lp.how_to_achieve}`, contentW - 16);
                checkPage(howLines.length * 3.2 + 2);
                doc.text(howLines, margin + 8, y);
                y += howLines.length * 3.2 + 2;
              }
            });
          }

          y += 4;
        });
      }

      // ===== 90-DAY GOALS (only if exists) =====
      if (goals?.length > 0) {
        sectionHeader("90-Day Professional Goals");
        const completed = goals.filter((g: any) => g.completed).length;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setColor(doc, MID_GRAY);
        doc.text(`${completed} of ${goals.length} completed`, margin + 2, y);
        y += 5;

        goals.forEach((goal: any) => {
          checkPage(8);
          const icon = goal.completed ? "☑" : "☐";
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          setColor(doc, goal.completed ? GREEN : DARK_TEXT);
          doc.text(icon, margin + 3, y + 3);
          const lines = doc.splitTextToSize(goal.goal_text || "No description", contentW - 20);
          doc.text(lines, margin + 10, y + 3);
          if (goal.by_when) {
            doc.setFontSize(6.5);
            setColor(doc, MID_GRAY);
            doc.text(`Due: ${new Date(goal.by_when).toLocaleDateString()}`, pageW - margin, y + 3, { align: "right" });
          }
          y += lines.length * 4 + 3;
        });
        y += 2;
      }

      // ===== HABITS (only if exists) =====
      if (habits?.length > 0) {
        sectionHeader("Professional Habits & Streaks");
        habits.forEach((habit: any) => {
          checkPage(7);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          setColor(doc, DARK_TEXT);
          doc.text(`• ${habit.habit_name}`, margin + 3, y + 3);
          doc.setFontSize(7);
          setColor(doc, MID_GRAY);
          doc.text(habit.target_frequency || "", margin + 90, y + 3);
          if (habit.current_streak > 0) {
            setColor(doc, GOLD);
            doc.text(`${habit.current_streak} streak`, pageW - margin, y + 3, { align: "right" });
          }
          y += 6;
        });
        y += 2;
      }

      // ===== ACHIEVEMENTS (only if exists) =====
      if (achievements?.length > 0) {
        sectionHeader("Recent Professional Achievements");
        achievements.forEach((a: any) => {
          checkPage(8);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          setColor(doc, DARK_TEXT);
          const lines = doc.splitTextToSize(`★ ${a.achievement_text}`, contentW - 30);
          doc.text(lines, margin + 3, y + 3);
          if (a.achieved_date) {
            doc.setFontSize(6.5);
            setColor(doc, MID_GRAY);
            doc.text(new Date(a.achieved_date).toLocaleDateString(), pageW - margin, y + 3, { align: "right" });
          }
          y += lines.length * 4 + 2;
        });
      }

      // ===== FOOTER on every page =====
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawRect(doc, 0, pageH - 12, pageW, 12, NAVY);
        drawRect(doc, 0, pageH - 12, pageW, 1, GOLD);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        setColor(doc, [160, 170, 185]);
        doc.text("Jericho by The Momentum Company  •  Confidential Individual Growth Plan", margin, pageH - 5);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
      }

      const safeName = (profile?.full_name || employeeName || "growth-plan").replace(/\s+/g, "-").toLowerCase();
      doc.save(`${safeName}-igp-${new Date().toISOString().split("T")[0]}.pdf`);

      toast({ title: "Growth Plan Downloaded", description: `IGP for ${employeeName} has been generated with AI recommendations.` });
      onComplete?.();
    } catch (error: any) {
      console.error("Error generating growth plan:", error);
      toast({ title: "Failed to generate growth plan", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (variant === "menuItem") {
    return (
      <button
        onClick={generate}
        disabled={generating}
        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left disabled:opacity-50"
      >
        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {generating ? "Generating IGP..." : "Download Growth Plan"}
      </button>
    );
  }

  return (
    <Button onClick={generate} disabled={generating} variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary">
      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
      {generating ? "Generating..." : "Download Growth Plan"}
    </Button>
  );
}
