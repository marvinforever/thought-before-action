import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, ExternalLink, X } from "lucide-react";
import { PlaybookViewer } from "./PlaybookViewer";

interface PlaybookData {
  id: string;
  report_content: any;
  capability_matrix: any;
  status: string;
  completed_at: string | null;
  share_token: string | null;
}

export function GrowthPlaybookBanner() {
  const [playbook, setPlaybook] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadPlaybook();
  }, []);

  const loadPlaybook = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("leadership_reports")
        .select("id, report_content, capability_matrix, status, completed_at, share_token")
        .eq("profile_id", user.id)
        .eq("report_type", "individual_playbook")
        .in("status", ["generated", "delivered"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setPlaybook(data);
    } catch (err) {
      console.error("Error loading playbook:", err);
    } finally {
      setLoading(false);
    }
  };

  const getHtmlContent = (): string => {
    if (!playbook?.report_content) return "";
    const content = playbook.report_content as any;
    if (typeof content === "string") return content;
    if (content.html) return content.html;
    return "";
  };

  const handleOpenNewTab = () => {
    const html = getHtmlContent();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // Extract structured data
  const getStructuredData = () => {
    const content = playbook?.report_content as any;
    if (!content) return null;
    const narrative = content.narrative;
    const scores = content.engagement_scores;
    const caps = playbook?.capability_matrix;
    if (narrative && scores && Array.isArray(caps)) {
      return { narrative, scores, capabilities: caps };
    }
    return null;
  };

  if (loading || !playbook) return null;

  const html = getHtmlContent();
  const structured = getStructuredData();
  if (!html && !structured) return null;

  return (
    <>
      <Card className="border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Your Growth Playbook</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Personalized coaching report based on your diagnostic conversation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
              >
                <Sparkles className="w-4 h-4" />
                View Playbook
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenNewTab}
                className="text-muted-foreground hover:text-foreground"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Growth Playbook
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleOpenNewTab} className="gap-1 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                Full Report
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialogOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" style={{ height: "calc(90vh - 52px)" }}>
            {structured ? (
              <PlaybookViewer
                narrative={structured.narrative}
                scores={structured.scores}
                capabilities={structured.capabilities}
                htmlFallback={html}
                onOpenInNewTab={handleOpenNewTab}
              />
            ) : (
              <iframe
                srcDoc={html}
                className="w-full h-full border-0"
                title="Growth Playbook"
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
