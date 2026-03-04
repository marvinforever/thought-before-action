import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IGPData } from "./igp-types";
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
  variant?: "button" | "menuItem";
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
      (data.ai_recommendations.top_priority_actions || []).map(a => a.capability_name)
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
            <IGPDevelopmentRoadmap roadmap={data.ai_recommendations.roadmap} />
            <IGPCapabilityOverview capabilities={data.capabilities} recommendations={data.ai_recommendations.recommendations || []} />
            
            {data.diagnostic && <IGPDiagnosticScorecard diagnostic={data.diagnostic} />}

            {/* Detailed Capability Cards */}
            {data.ai_recommendations.recommendations?.length > 0 && (
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
      <button
        onClick={handleViewIGP}
        disabled={loading}
        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left disabled:opacity-50"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        {loading ? "Generating IGP..." : "View Growth Plan"}
      </button>
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
