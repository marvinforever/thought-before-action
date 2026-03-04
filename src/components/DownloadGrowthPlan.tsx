import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface DownloadGrowthPlanProps {
  className?: string;
}

// Color palette matching Jericho brand
const NAVY = [30, 58, 95] as const; // hsl(211,51%,24%) → rgb
const GOLD = [230, 184, 0] as const; // hsl(45,100%,48%) → rgb
const WHITE = [255, 255, 255] as const;
const LIGHT_GRAY = [245, 247, 250] as const;
const MID_GRAY = [130, 140, 155] as const;
const DARK_TEXT = [30, 42, 58] as const;
const GREEN = [22, 163, 74] as const;
const RED = [220, 38, 38] as const;

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
  if (score === null) return { label: "N/A", color: MID_GRAY };
  if (score >= 80) return { label: `${score}%`, color: GREEN };
  if (score >= 60) return { label: `${score}%`, color: GOLD };
  return { label: `${score}%`, color: RED };
}

export function DownloadGrowthPlan({ className }: DownloadGrowthPlanProps) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all data in parallel
      const [profileRes, capabilitiesRes, diagnosticRes, visionRes, goalsRes, habitsRes, achievementsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, job_title, company_id").eq("id", user.id).single(),
        supabase.from("employee_capabilities")
          .select("current_level, target_level, self_assessed_level, priority, capability_id, capabilities(name, category)")
          .eq("profile_id", user.id)
          .neq("marked_not_relevant", true)
          .order("priority", { ascending: true }),
        supabase.from("diagnostic_scores").select("*").eq("profile_id", user.id).maybeSingle(),
        supabase.from("personal_goals").select("one_year_vision, three_year_vision").eq("profile_id", user.id).maybeSingle(),
        supabase.from("ninety_day_targets").select("goal_text, category, completed, by_when").eq("profile_id", user.id).eq("category", "professional").order("created_at", { ascending: false }),
        supabase.from("leading_indicators").select("habit_name, target_frequency, current_streak").eq("profile_id", user.id).neq("habit_type", "personal").eq("is_active", true),
        supabase.from("achievements").select("achievement_text, achieved_date").eq("profile_id", user.id).eq("category", "professional").order("achieved_date", { ascending: false }).limit(10),
      ]);

      const profile = profileRes.data;
      const capabilities = capabilitiesRes.data || [];
      const diagnostic = diagnosticRes.data;
      const vision = visionRes.data;
      const goals = goalsRes.data || [];
      const habits = habitsRes.data || [];
      const achievements = achievementsRes.data || [];

      // Get company name
      let companyName = "";
      if (profile?.company_id) {
        const { data: company } = await supabase.from("companies").select("name").eq("id", profile.company_id).single();
        companyName = company?.name || "";
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = 0;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 20) {
          doc.addPage();
          y = 20;
          // Thin gold line at top of continuation pages
          drawRect(doc, 0, 0, pageW, 2, GOLD);
        }
      };

      const sectionHeader = (title: string) => {
        checkPage(16);
        drawRect(doc, margin, y, contentW, 8, NAVY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        setColor(doc, WHITE);
        doc.text(title.toUpperCase(), margin + 4, y + 5.5);
        y += 12;
      };

      // ===== HEADER =====
      drawRect(doc, 0, 0, pageW, 42, NAVY);
      drawRect(doc, 0, 42, pageW, 3, GOLD);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      setColor(doc, WHITE);
      doc.text("INDIVIDUAL GROWTH PLAN", margin, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      setColor(doc, [200, 210, 225]);
      doc.text(profile?.full_name || "Employee", margin, 26);
      if (profile?.job_title) {
        doc.text(profile.job_title, margin, 32);
      }

      // Right side: branding + date
      doc.setFontSize(9);
      setColor(doc, GOLD);
      doc.text("JERICHO", pageW - margin, 14, { align: "right" });
      doc.setFontSize(7);
      setColor(doc, [160, 170, 185]);
      doc.text("by The Momentum Company", pageW - margin, 19, { align: "right" });
      doc.setFontSize(8);
      setColor(doc, [200, 210, 225]);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW - margin, 28, { align: "right" });
      if (companyName) {
        doc.text(companyName, pageW - margin, 34, { align: "right" });
      }

      y = 52;

      // ===== PROFESSIONAL VISION =====
      if (vision?.one_year_vision || vision?.three_year_vision) {
        sectionHeader("Professional Vision");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setColor(doc, DARK_TEXT);
        if (vision.one_year_vision) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          setColor(doc, MID_GRAY);
          doc.text("1-YEAR VISION", margin + 2, y);
          y += 4;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setColor(doc, DARK_TEXT);
          const lines1 = doc.splitTextToSize(vision.one_year_vision, contentW - 4);
          checkPage(lines1.length * 4 + 2);
          doc.text(lines1, margin + 2, y);
          y += lines1.length * 4 + 4;
        }
        if (vision.three_year_vision) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          setColor(doc, MID_GRAY);
          doc.text("3-YEAR VISION", margin + 2, y);
          y += 4;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setColor(doc, DARK_TEXT);
          const lines3 = doc.splitTextToSize(vision.three_year_vision, contentW - 4);
          checkPage(lines3.length * 4 + 2);
          doc.text(lines3, margin + 2, y);
          y += lines3.length * 4 + 4;
        }
        y += 2;
      }

      // ===== DIAGNOSTIC ASSESSMENT =====
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
          
          // Score bar background
          drawRect(doc, x + 2, y, colW - 4, 10, LIGHT_GRAY);
          
          // Score bar fill
          if (s.value !== null) {
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

      // ===== CAPABILITIES =====
      if (capabilities.length > 0) {
        sectionHeader("Capability Assessment");

        // Table header
        checkPage(8);
        drawRect(doc, margin, y, contentW, 7, LIGHT_GRAY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setColor(doc, NAVY);
        doc.text("CAPABILITY", margin + 3, y + 4.5);
        doc.text("CATEGORY", margin + 72, y + 4.5);
        doc.text("CURRENT", margin + 110, y + 4.5);
        doc.text("TARGET", margin + 138, y + 4.5);
        doc.text("GAP", margin + 164, y + 4.5);
        y += 9;

        capabilities.forEach((cap: any, i: number) => {
          checkPage(7);
          if (i % 2 === 0) {
            drawRect(doc, margin, y - 1, contentW, 6, [250, 251, 253]);
          }
          
          const capName = cap.capabilities?.name || "Unknown";
          const category = cap.capabilities?.category || "—";
          const currentLvl = cap.current_level;
          const targetLvl = cap.target_level;
          const gap = levelToNumber(targetLvl) - levelToNumber(currentLvl);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          setColor(doc, DARK_TEXT);
          doc.text(capName.substring(0, 35), margin + 3, y + 3);

          doc.setFontSize(7);
          setColor(doc, MID_GRAY);
          doc.text((category || "—").substring(0, 18), margin + 72, y + 3);

          doc.setFontSize(7.5);
          setColor(doc, DARK_TEXT);
          doc.text(formatLevel(currentLvl), margin + 110, y + 3);
          doc.text(formatLevel(targetLvl), margin + 138, y + 3);

          if (gap > 0) {
            setColor(doc, RED);
            doc.text(`▲ ${gap}`, margin + 164, y + 3);
          } else if (gap === 0 && currentLvl) {
            setColor(doc, GREEN);
            doc.text("✓ Met", margin + 164, y + 3);
          } else {
            setColor(doc, MID_GRAY);
            doc.text("—", margin + 164, y + 3);
          }

          y += 6;
        });
        y += 4;
      }

      // ===== 90-DAY GOALS =====
      if (goals.length > 0) {
        sectionHeader("90-Day Professional Goals");
        const completed = goals.filter(g => g.completed).length;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setColor(doc, MID_GRAY);
        doc.text(`${completed} of ${goals.length} completed`, margin + 2, y);
        y += 5;

        goals.forEach((goal: any) => {
          checkPage(8);
          const icon = goal.completed ? "☑" : "☐";
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setColor(doc, goal.completed ? GREEN : DARK_TEXT);
          doc.text(icon, margin + 3, y + 3);
          
          const goalText = goal.goal_text || "No description";
          const lines = doc.splitTextToSize(goalText, contentW - 20);
          doc.text(lines, margin + 10, y + 3);
          
          if (goal.by_when) {
            doc.setFontSize(7);
            setColor(doc, MID_GRAY);
            doc.text(`Due: ${new Date(goal.by_when).toLocaleDateString()}`, pageW - margin, y + 3, { align: "right" });
          }
          y += lines.length * 4 + 3;
        });
        y += 2;
      }

      // ===== PROFESSIONAL HABITS =====
      if (habits.length > 0) {
        sectionHeader("Professional Habits & Streaks");
        habits.forEach((habit: any) => {
          checkPage(7);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setColor(doc, DARK_TEXT);
          doc.text(`• ${habit.habit_name}`, margin + 3, y + 3);
          
          doc.setFontSize(7);
          setColor(doc, MID_GRAY);
          doc.text(habit.target_frequency || "", margin + 90, y + 3);
          
          if (habit.current_streak > 0) {
            setColor(doc, GOLD);
            doc.text(`🔥 ${habit.current_streak} streak`, pageW - margin, y + 3, { align: "right" });
          }
          y += 6;
        });
        y += 2;
      }

      // ===== ACHIEVEMENTS =====
      if (achievements.length > 0) {
        sectionHeader("Recent Professional Achievements");
        achievements.forEach((a: any) => {
          checkPage(8);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setColor(doc, DARK_TEXT);
          const lines = doc.splitTextToSize(`★ ${a.achievement_text}`, contentW - 30);
          doc.text(lines, margin + 3, y + 3);
          
          if (a.achieved_date) {
            doc.setFontSize(7);
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
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        setColor(doc, [160, 170, 185]);
        doc.text("Jericho by The Momentum Company  •  Confidential Individual Growth Plan", margin, pageH - 5);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
        // Gold accent line above footer
        drawRect(doc, 0, pageH - 12, pageW, 1, GOLD);
      }

      // Save
      const safeName = (profile?.full_name || "growth-plan").replace(/\s+/g, "-").toLowerCase();
      doc.save(`${safeName}-growth-plan-${new Date().toISOString().split("T")[0]}.pdf`);

      toast({
        title: "Growth Plan Downloaded",
        description: "Your individual growth plan PDF has been generated.",
      });
    } catch (error: any) {
      console.error("Error generating growth plan:", error);
      toast({
        title: "Failed to generate growth plan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Button
        onClick={generate}
        disabled={generating}
        variant="outline"
        className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {generating ? "Generating..." : "Download Growth Plan"}
      </Button>
    </div>
  );
}
