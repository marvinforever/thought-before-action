import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, X, Target, Flame, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { IGPData, formatLevel } from "./igp-types";
import { IGPHeader } from "./IGPHeader";
import { IGPExecutiveSummary } from "./IGPExecutiveSummary";
import { IGPDevelopmentRoadmap } from "./IGPDevelopmentRoadmap";
import { IGPCapabilityOverview } from "./IGPCapabilityOverview";
import { IGPDiagnosticScorecard } from "./IGPDiagnosticScorecard";
import { IGPCapabilityDetail } from "./IGPCapabilityDetail";
import { IGPGlossary } from "./IGPGlossary";
import { IGPProgressBar } from "./IGPProgressBar";
import { IGPTableOfContents } from "./IGPTableOfContents";
import { generateIGPPdf } from "./igp-pdf-export";

interface IGPDocumentProps {
  profileId: string;
  employeeName: string;
  variant?: "button" | "menuItem" | "inline";
  onComplete?: () => void;
}

export function IGPDocument({ profileId, employeeName, variant = "button", onComplete }: IGPDocumentProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IGPData | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const { toast } = useToast();

  const fetchData = async (): Promise<IGPData> => {
    const { data: result, error } = await supabase.functions.invoke('generate-growth-plan-recommendations', {
      body: { profile_id: profileId }
    });
    if (error) throw error;
    if (!result?.success) throw new Error(result?.error || 'Failed to generate recommendations');
    return {
      ...result,
      generated_at: new Date().toISOString(),
    } as IGPData;
  };

  const handleViewIGP = async () => {
    setLoading(true);
    try {
      toast({ title: "Generating Growth Plan", description: `Building AI-powered IGP for ${employeeName}...` });
      const result = await fetchData();
      setData(result);
      setShowViewer(true);
      onComplete?.();
    } catch (error: any) {
      console.error("Error generating IGP:", error);
      toast({ title: "Failed to generate growth plan", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setLoading(true);
    try {
      toast({ title: "Generating PDF", description: `Building IGP PDF for ${employeeName}...` });
      const igpData = data || await fetchData();
      if (!data) setData(igpData);
      generateIGPPdf(igpData);
      toast({ title: "Growth Plan Downloaded", description: `IGP for ${employeeName} has been generated.` });
      onComplete?.();
    } catch (error: any) {
      console.error("Error generating IGP PDF:", error);
      toast({ title: "Failed to generate PDF", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Full-screen viewer
  if (showViewer && data) {
    const topPriorityNames = new Set(
      (data.ai_recommendations?.top_priority_actions || []).map((a: any) =>
        typeof a === 'string' ? '' : a.capability_name
      )
    );

    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Individual Growth Plan — {data.profile.full_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={loading}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowViewer(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
          {/* Sidebar TOC */}
          <div className="hidden lg:block w-56 shrink-0">
            <IGPTableOfContents data={data} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            <IGPHeader profile={data.profile} generatedAt={data.generated_at} />
            <IGPProgressBar capabilities={data.capabilities} />
            <IGPExecutiveSummary profile={data.profile} ai={data.ai_recommendations} diagnostic={data.diagnostic} />
            <IGPDevelopmentRoadmap roadmap={data.ai_recommendations?.roadmap} />
            <IGPCapabilityOverview capabilities={data.capabilities} recommendations={data.ai_recommendations?.recommendations || []} />
            
            {data.diagnostic && <IGPDiagnosticScorecard diagnostic={data.diagnostic} />}

            {/* Professional Vision */}
            {(data.vision?.one_year_vision || data.vision?.three_year_vision) && (
              <div className="space-y-3 print:break-inside-avoid" id="igp-vision">
                <h2 className="text-lg font-bold text-foreground">Professional Vision</h2>
                {data.vision.one_year_vision && (
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">1-Year Vision</p>
                    <p className="text-sm text-foreground/80">{data.vision.one_year_vision}</p>
                  </div>
                )}
                {data.vision.three_year_vision && (
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">3-Year Vision</p>
                    <p className="text-sm text-foreground/80">{data.vision.three_year_vision}</p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Capability Cards */}
            {data.ai_recommendations?.recommendations?.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">Detailed Training & Development</h2>
                {data.ai_recommendations.recommendations.map((rec) => (
                  <IGPCapabilityDetail
                    key={rec.capability_name}
                    recommendation={rec}
                    capability={data.capabilities.find(c => c.name === rec.capability_name)}
                    isTopPriority={topPriorityNames.has(rec.capability_name)}
                  />
                ))}
              </div>
            )}

            {/* 90-Day Goals */}
            {data.goals && data.goals.length > 0 && (
              <div className="space-y-3 print:break-inside-avoid" id="igp-goals">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  90-Day Professional Goals
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.goals.filter(g => g.completed).length} of {data.goals.length} completed
                </p>
                <div className="space-y-2">
                  {data.goals.map((goal, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${goal.completed ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-card"}`}>
                      <span className={`text-sm ${goal.completed ? "text-green-600" : "text-muted-foreground"}`}>
                        {goal.completed ? "✓" : "○"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${goal.completed ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>
                          {goal.goal_text || "No description"}
                        </p>
                        {goal.by_when && (
                          <p className="text-xs text-muted-foreground mt-0.5">Due: {new Date(goal.by_when).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habits */}
            {data.habits && data.habits.length > 0 && (
              <div className="space-y-3 print:break-inside-avoid" id="igp-habits">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Flame className="h-5 w-5 text-accent" />
                  Professional Habits & Streaks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.habits.map((habit, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{habit.habit_name}</p>
                        {habit.target_frequency && (
                          <p className="text-xs text-muted-foreground">{habit.target_frequency}</p>
                        )}
                      </div>
                      {habit.current_streak > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-bold">
                          🔥 {habit.current_streak} day streak
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements */}
            {data.achievements && data.achievements.length > 0 && (
              <div className="space-y-3 print:break-inside-avoid" id="igp-achievements">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-accent" />
                  Recent Professional Achievements
                </h2>
                <div className="space-y-2">
                  {data.achievements.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                      <span className="text-accent text-sm">★</span>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{a.achievement_text}</p>
                        {a.achieved_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.achieved_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <IGPGlossary />

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground py-8 border-t">
              <p>Jericho by The Momentum Company — Confidential Individual Growth Plan</p>
              <p className="mt-1">Generated {new Date(data.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Button/menu trigger
  if (variant === "menuItem") {
    return (
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          void handleViewIGP();
        }}
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        {loading ? "Generating IGP..." : "View Growth Plan"}
      </DropdownMenuItem>
    );
  }

  if (variant === "inline") {
    return (
      <Button onClick={handleViewIGP} disabled={loading} variant="outline" size="sm">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
        {loading ? "Generating..." : "Growth Plan"}
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button onClick={handleViewIGP} disabled={loading} variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
        {loading ? "Generating..." : "View Growth Plan"}
      </Button>
      <Button onClick={handleDownloadPdf} disabled={loading} variant="outline" size="icon" title="Download PDF">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
