import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";

interface DomainScore {
  domain: string;
  score: number;
  risk: "low" | "medium" | "high" | "critical";
  impact: string;
}

export function TeamDiagnosticSnapshot() {
  const [stats, setStats] = useState({
    teamSize: 0,
    diagnosticsCompleted: 0,
    avgEngagement: 0,
    retentionRisk: 0,
    atRiskEmployees: 0,
    domainScores: [] as DomainScore[],
  });
  const [loading, setLoading] = useState(true);
  const [normalizing, setNormalizing] = useState(false);
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadTeamStats();
  }, [viewAsCompanyId]);

  const handleBatchNormalize = async () => {
    try {
      setNormalizing(true);
      toast.info("Starting diagnostic normalization... This may take a few minutes.");
      
      const { data, error } = await supabase.functions.invoke('batch-normalize-diagnostics');
      
      if (error) throw error;
      
      toast.success(`Normalized ${data.processed} diagnostics. Failed: ${data.failed}`);
      
      // Reload data
      loadTeamStats();
    } catch (error: any) {
      console.error("Batch normalization error:", error);
      toast.error("Failed to normalize diagnostics");
    } finally {
      setNormalizing(false);
    }
  };

  const loadTeamStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let employeeIds: string[] = [];
      let companyId = viewAsCompanyId;

      if (companyId) {
        // Super admin viewing as company - get all active employees
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_active", true);
        
        employeeIds = profiles?.map(p => p.id) || [];
      } else {
        // Regular manager - get their direct reports
        const { data: assignments } = await supabase
          .from("manager_assignments")
          .select("employee_id, company_id")
          .eq("manager_id", user.id);

        employeeIds = assignments?.map(a => a.employee_id) || [];
        companyId = assignments?.[0]?.company_id;
      }
      
      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get pre-calculated diagnostic scores
      const { data: scores, error: scoresError } = await supabase
        .from("diagnostic_scores")
        .select("*")
        .in("profile_id", employeeIds);

      if (scoresError) {
        console.error("Error loading scores:", scoresError);
        setLoading(false);
        return;
      }

      if (!scores || scores.length === 0) {
        setStats({
          teamSize: employeeIds.length,
          diagnosticsCompleted: 0,
          avgEngagement: 0,
          retentionRisk: 0,
          atRiskEmployees: 0,
          domainScores: [],
        });
        setLoading(false);
        return;
      }

      // Calculate domain averages from pre-calculated scores
      const avgScore = (field: 'retention_score' | 'engagement_score' | 'burnout_score' | 'manager_score' | 'career_score' | 'clarity_score' | 'learning_score' | 'skills_score') => {
        const values = scores
          .map(s => s[field])
          .filter((v): v is number => v !== null && typeof v === 'number');
        return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      };

      const retentionScore = avgScore('retention_score');
      const engagementScore = avgScore('engagement_score');
      const burnoutScore = avgScore('burnout_score');
      const managerScore = avgScore('manager_score');
      const careerScore = avgScore('career_score');
      const clarityScore = avgScore('clarity_score');
      const learningScore = avgScore('learning_score');
      const skillsScore = avgScore('skills_score');

      const atRiskCount = scores.filter(s => (s.retention_score || 50) < 50).length;

      const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 75) return "low";
        if (score >= 50) return "medium";
        if (score >= 25) return "high";
        return "critical";
      };

      const domainScores: DomainScore[] = [
        { domain: "Retention", score: retentionScore, risk: getRiskLevel(retentionScore), impact: `${atRiskCount} at risk` },
        { domain: "Engagement", score: engagementScore, risk: getRiskLevel(engagementScore), impact: "Overall team morale" },
        { domain: "Burnout", score: burnoutScore, risk: getRiskLevel(burnoutScore), impact: "Work-life balance" },
        { domain: "Manager", score: managerScore, risk: getRiskLevel(managerScore), impact: "Leadership support" },
        { domain: "Career", score: careerScore, risk: getRiskLevel(careerScore), impact: "Growth opportunities" },
        { domain: "Clarity", score: clarityScore, risk: getRiskLevel(clarityScore), impact: "Role understanding" },
        { domain: "Learning", score: learningScore, risk: getRiskLevel(learningScore), impact: "Development activity" },
        { domain: "Skills", score: skillsScore, risk: getRiskLevel(skillsScore), impact: "Capability confidence" },
      ];

      setStats({
        teamSize: employeeIds.length,
        diagnosticsCompleted: scores.length,
        avgEngagement: engagementScore,
        retentionRisk: 100 - retentionScore,
        atRiskEmployees: atRiskCount,
        domainScores,
      });
    } catch (error: any) {
      toast.error(`Error loading team stats: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "text-destructive";
      case "high": return "text-orange-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-green-600";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case "critical": return "bg-destructive/10";
      case "high": return "bg-orange-100 dark:bg-orange-950";
      case "medium": return "bg-yellow-100 dark:bg-yellow-950";
      case "low": return "bg-green-100 dark:bg-green-950";
      default: return "bg-muted";
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "critical": return "Critical";
      case "high": return "High Risk";
      case "medium": return "Moderate";
      case "low": return "Low Risk";
      default: return risk;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Loading team diagnostics...</p>
        </CardContent>
      </Card>
    );
  }

  if (stats.diagnosticsCompleted === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team Diagnostic Snapshot</CardTitle>
            <Button 
              onClick={handleBatchNormalize}
              disabled={normalizing}
              variant="outline"
              size="sm"
            >
              {normalizing ? "Normalizing..." : "Normalize Diagnostics"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4">No diagnostic scores calculated yet.</p>
          <p className="text-sm text-muted-foreground">Click "Normalize Diagnostics" to process existing diagnostic data.</p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    score: { label: "Score", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members at Risk</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.atRiskEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">High retention risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Engagement</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgEngagement}/100</div>
            <p className="text-xs text-muted-foreground mt-1">Average engagement score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retention Risk</CardTitle>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.retentionRisk}%</div>
            <p className="text-xs text-muted-foreground mt-1">Team retention risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diagnostics Complete</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.diagnosticsCompleted}/{stats.teamSize}</div>
            <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.diagnosticsCompleted / stats.teamSize) * 100)}% participation</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Health Radar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Health Overview</CardTitle>
              <p className="text-sm text-muted-foreground">8-domain assessment powered by AI normalization</p>
            </div>
            <Button 
              onClick={handleBatchNormalize}
              disabled={normalizing}
              variant="ghost"
              size="sm"
            >
              {normalizing ? "Normalizing..." : "Refresh Scores"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={stats.domainScores}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Health Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Domain Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.domainScores.map((domain) => (
          <Card key={domain.domain} className={getRiskBgColor(domain.risk)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{domain.domain}</CardTitle>
                <span className={`text-sm font-semibold ${getRiskColor(domain.risk)} uppercase`}>{getRiskLabel(domain.risk)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold">{domain.score}</div>
                  <p className="text-xs text-muted-foreground mt-1">{domain.impact}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center">
                  {domain.risk === "critical" && <TrendingDown className="h-6 w-6 text-destructive" />}
                  {domain.risk === "high" && <AlertTriangle className="h-6 w-6 text-orange-600" />}
                  {domain.risk === "medium" && <Target className="h-6 w-6 text-yellow-600" />}
                  {domain.risk === "low" && <TrendingUp className="h-6 w-6 text-green-600" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Items */}
      {stats.domainScores.some(d => d.risk === "critical" || d.risk === "high") && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Priority Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.domainScores
                .filter(d => d.risk === "critical" || d.risk === "high")
                .map(domain => (
                  <div key={domain.domain} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <AlertTriangle className={`h-5 w-5 mt-0.5 ${domain.risk === "critical" ? "text-destructive" : "text-orange-600"}`} />
                    <div>
                      <p className="font-semibold">{domain.domain}</p>
                      <p className="text-sm text-muted-foreground">{domain.impact}</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
