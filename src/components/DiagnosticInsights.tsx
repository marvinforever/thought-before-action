import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, AlertCircle, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Insight = {
  type: 'warning' | 'opportunity' | 'strength';
  title: string;
  description: string;
  actionable?: string;
  isAI?: boolean;
};

export function DiagnosticInsights() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      const employeeIds = assignments?.map(a => a.employee_id) || [];

      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      const generatedInsights: Insight[] = [];

      // Check for employees without diagnostics
      const { data: diagnostics } = await supabase
        .from("diagnostic_responses")
        .select("profile_id")
        .in("profile_id", employeeIds);

      const withDiagnostics = diagnostics?.map(d => d.profile_id) || [];
      const withoutDiagnostics = employeeIds.filter(id => !withDiagnostics.includes(id));

      if (withoutDiagnostics.length > 0) {
        generatedInsights.push({
          type: 'warning',
          title: 'Missing Diagnostics',
          description: `${withoutDiagnostics.length} team member(s) haven't completed their diagnostic assessment`,
          actionable: 'Encourage team members to complete their assessments for better insights',
        });
      }

      // Check for overdue 1-on-1s
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentOneOnOnes } = await supabase
        .from("one_on_one_notes")
        .select("employee_id")
        .in("employee_id", employeeIds)
        .gte("meeting_date", thirtyDaysAgo.toISOString());

      const hadRecentOneOnOne = recentOneOnOnes?.map(o => o.employee_id) || [];
      const needsOneOnOne = employeeIds.filter(id => !hadRecentOneOnOne.includes(id));

      if (needsOneOnOne.length > 0) {
        generatedInsights.push({
          type: 'warning',
          title: 'Overdue Check-ins',
          description: `${needsOneOnOne.length} team member(s) haven't had a 1-on-1 in over 30 days`,
          actionable: 'Schedule regular check-ins to maintain connection and address concerns',
        });
      }

      // Check for pending capability requests
      const { count: pendingRequests } = await supabase
        .from("capability_level_requests")
        .select("*", { count: "exact", head: true })
        .in("profile_id", employeeIds)
        .eq("status", "pending");

      if (pendingRequests && pendingRequests > 0) {
        generatedInsights.push({
          type: 'opportunity',
          title: 'Pending Requests',
          description: `${pendingRequests} capability level request(s) awaiting your review`,
          actionable: 'Review and respond to capability requests to support team growth',
        });
      }

      // Check for high performers (lots of recognition)
      const { data: recognition } = await supabase
        .from("recognition_notes")
        .select("given_to")
        .in("given_to", employeeIds);

      const recognitionCounts = recognition?.reduce((acc: any, r: any) => {
        acc[r.given_to] = (acc[r.given_to] || 0) + 1;
        return acc;
      }, {});

      const highPerformers = Object.entries(recognitionCounts || {}).filter(([_, count]: any) => count >= 3);

      if (highPerformers.length > 0) {
        generatedInsights.push({
          type: 'strength',
          title: 'High Performers',
          description: `${highPerformers.length} team member(s) have received multiple recognitions`,
          actionable: 'Consider these individuals for leadership opportunities or mentorship roles',
        });
      }

      // Check goal completion rates
      const { data: goals } = await supabase
        .from("ninety_day_targets")
        .select("profile_id, completed")
        .in("profile_id", employeeIds);

      const goalsByEmployee = goals?.reduce((acc: any, g: any) => {
        if (!acc[g.profile_id]) {
          acc[g.profile_id] = { total: 0, completed: 0 };
        }
        acc[g.profile_id].total += 1;
        if (g.completed) acc[g.profile_id].completed += 1;
        return acc;
      }, {});

      const strugglingWithGoals = Object.entries(goalsByEmployee || {}).filter(
        ([_, stats]: any) => stats.total >= 3 && (stats.completed / stats.total) < 0.5
      );

      if (strugglingWithGoals.length > 0) {
        generatedInsights.push({
          type: 'warning',
          title: 'Goal Achievement Concerns',
          description: `${strugglingWithGoals.length} team member(s) have low goal completion rates`,
          actionable: 'Schedule coaching sessions to identify blockers and adjust goals if needed',
        });
      }

      setInsights(generatedInsights);

    } catch (error: any) {
      toast({
        title: "Error loading insights",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-team-insights");

      if (error) {
        if (error.message?.includes("Rate limit")) {
          toast({
            title: "Rate Limit",
            description: "Too many requests. Please wait a moment and try again.",
            variant: "destructive",
          });
          return;
        }
        if (error.message?.includes("credits")) {
          toast({
            title: "Credits Exhausted",
            description: "AI credits have been exhausted. Please contact support.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      if (data?.insights && data.insights.length > 0) {
        // Add AI-generated insights to the existing insights
        const aiInsights = data.insights.map((insight: any) => ({
          ...insight,
          isAI: true,
        }));
        setInsights(prev => [...prev, ...aiInsights]);
        toast({
          title: "AI Insights Generated",
          description: `Generated ${aiInsights.length} new insights based on your team's data`,
        });
      } else {
        toast({
          title: "No New Insights",
          description: "AI couldn't generate additional insights at this time",
        });
      }
    } catch (error: any) {
      console.error("Error generating AI insights:", error);
      toast({
        title: "Error generating AI insights",
        description: error.message || "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading insights...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Team Insights
              </CardTitle>
              <CardDescription>
                AI-powered recommendations based on your team's data
              </CardDescription>
            </div>
            <Button onClick={generateAIInsights} disabled={generatingAI}>
              <Brain className="h-4 w-4 mr-2" />
              {generatingAI ? "Generating..." : "Refresh AI Insights"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No insights available yet. As your team grows and engages with the platform, insights will appear here.</p>
            </div>
          ) : (
            insights.map((insight, index) => (
              <Card key={index} className="border-l-4" style={{
                borderLeftColor: insight.type === 'warning' ? 'hsl(var(--destructive))' : 
                                insight.type === 'opportunity' ? 'hsl(var(--primary))' : 
                                'hsl(var(--chart-2))'
              }}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {insight.type === 'warning' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        {insight.type === 'opportunity' && <TrendingUp className="h-4 w-4 text-primary" />}
                        {insight.type === 'strength' && <Users className="h-4 w-4 text-chart-2" />}
                        <h4 className="font-semibold">{insight.title}</h4>
                        <Badge variant={insight.type === 'warning' ? 'destructive' : insight.type === 'opportunity' ? 'default' : 'secondary'}>
                          {insight.type}
                        </Badge>
                        {insight.isAI && (
                          <Badge variant="outline" className="gap-1">
                            <Brain className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                      {insight.actionable && (
                        <p className="text-sm font-medium text-foreground">
                          💡 {insight.actionable}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
