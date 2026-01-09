import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, Target, MessageSquare, Lightbulb, ArrowRight } from "lucide-react";

export default function PublicPrepDocument() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!shareToken) {
        setError("Invalid link");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("sales_prep_documents")
        .select(`
          *,
          companies:company_id (name, logo_url),
          profiles:profile_id (full_name, job_title)
        `)
        .eq("share_token", shareToken)
        .eq("is_public", true)
        .single();

      if (error || !data) {
        setError("Document not found or not publicly shared");
        setLoading(false);
        return;
      }

      setDocument(data);
      setLoading(false);
    };

    fetchDocument();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Document Not Available</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          {document.companies?.logo_url && (
            <img 
              src={document.companies.logo_url} 
              alt={document.companies?.name} 
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-3xl font-bold text-foreground mb-2">{document.title}</h1>
          <p className="text-muted-foreground">
            Prepared by {document.profiles?.full_name || "Sales Team"}
            {document.profiles?.job_title && ` • ${document.profiles.job_title}`}
          </p>
          {document.companies?.name && (
            <p className="text-sm text-muted-foreground mt-1">{document.companies.name}</p>
          )}
        </div>

        {/* Meeting Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Prospect:</span>
                <p className="font-medium">{document.prospect_name || "TBD"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Company:</span>
                <p className="font-medium">{document.prospect_company || "TBD"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Role:</span>
                <p className="font-medium">{document.prospect_role || "TBD"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Call Type:</span>
                <Badge variant="secondary">{document.call_type || "Discovery"}</Badge>
              </div>
            </div>
            {document.call_objective && (
              <>
                <Separator className="my-4" />
                <div>
                  <span className="text-sm text-muted-foreground">Objective:</span>
                  <p className="mt-1">{document.call_objective}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Topics We'll Cover (Talking Points - prospect friendly version) */}
        {document.talking_points?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Topics We'll Cover
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {document.talking_points.map((tp: any, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{tp.point}</p>
                      {tp.detail && (
                        <p className="text-sm text-muted-foreground mt-1">{tp.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Questions for Discussion */}
        {document.discovery_questions?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Questions for Discussion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {document.discovery_questions.map((q: any, i: number) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-primary font-semibold">Q{i + 1}:</span>
                    <p>{q.question}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommended Solutions (if any) */}
        {document.product_recommendations?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recommended Solutions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {document.product_recommendations.map((pr: any, i: number) => (
                  <div key={i} className="p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-transparent">
                    <h4 className="font-semibold text-primary">{pr.product}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{pr.value_prop}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {document.next_steps && (
          <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                <ArrowRight className="h-5 w-5" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{document.next_steps}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>
            Document prepared on {new Date(document.created_at).toLocaleDateString("en-US", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
