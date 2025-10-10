import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/contexts/ViewAsContext";

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
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  const parseSupportQuality = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
    const s = String(v).toLowerCase();
    if (s.includes('excellent')) return 10;
    if (s.includes('very good')) return 9;
    if (s.includes('good')) return 8;
    if (s.includes('fair')) return 6;
    if (s.includes('poor')) return 3;
    return 0;
  };

  useEffect(() => {
    loadTeamStats();
  }, [viewAsCompanyId]);

  const loadTeamStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let employeeIds: string[] = [];
      let companyId = viewAsCompanyId;

      if (companyId) {
        // Super admin viewing as company - get all employees in that company
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId);
        
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

      // Get diagnostic data for team members
      const { data: diagnostics } = await supabase
        .from("diagnostic_responses")
        .select("*")
        .in("profile_id", employeeIds)
        .eq("company_id", companyId)
        .not("submitted_at", "is", null);

      const diagnosticData = diagnostics || [];
      const uniqueEmployeesWithDiagnostics = new Set(diagnosticData.map(d => d.profile_id).filter(Boolean)).size;

      // 1. RETENTION & FLIGHT RISK
      const retentionScores = diagnosticData.map(d => parseInt(d.would_stay_if_offered_similar) || 0).filter(s => s > 0);
      const highRiskCount = retentionScores.filter(s => s <= 5).length;
      const retentionRisk = retentionScores.length > 0 ? Math.round((highRiskCount / retentionScores.length) * 100) : 0;

      // 2. ENGAGEMENT INDEX
      const engagementScores = diagnosticData.map(d => {
        const scores = (d.additional_responses as any)?.engagement_scores;
        if (scores) {
          const growthPath = scores.growth_path_score || 0;
          const managerFeedback = scores.manager_feedback_score || 0;
          const valued = scores.valued_score || 0;
          const energy = scores.energy_score || 0;
          return (growthPath + managerFeedback + valued + energy) / 4;
        } else {
          const growthPath = d.sees_growth_path ? 10 : 0;
          const managerFeedback = parseSupportQuality(d.manager_support_quality);
          const valued = d.feels_valued ? 10 : 0;
          const energy = Number(d.daily_energy_level) || 0;
          return (growthPath + managerFeedback + valued + energy) / 4;
        }
      }).filter(s => s > 0);
      const avgEngagement = engagementScores.length > 0 ? parseFloat(((engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) * 10).toFixed(2)) : 0;
      
      const energyScores = diagnosticData.map(d => parseInt(d.daily_energy_level) || 0).filter(s => s > 0);

      // 3. BURNOUT
      const burnoutMap: Record<string, number> = {
        'Never or almost never': 1,
        'Rarely (monthly)': 2,
        'Sometimes (weekly)': 3,
        'Often (several times a week)': 4,
        'Frequently (daily)': 5,
      };
      const burnoutScores = diagnosticData.map(d => burnoutMap[d.burnout_frequency || ''] || 0).filter(s => s > 0);
      const burnoutScore = burnoutScores.length > 0 ? Math.round((burnoutScores.reduce((a, b) => a + b, 0) / burnoutScores.length) * 20) : 0;

      // 4. MANAGER EFFECTIVENESS
      const managerScores = diagnosticData.map(d => parseInt(d.manager_support_quality) || 0).filter(s => s > 0);
      const managerEffectiveness = managerScores.length > 0 ? Math.round((managerScores.reduce((a, b) => a + b, 0) / managerScores.length) * 10) : 0;

      // 5. CAREER DEVELOPMENT
      const careerPathCount = diagnosticData.filter(d => d.sees_growth_path === true).length;
      const careerPathScore = diagnosticData.length > 0 ? Math.round((careerPathCount / diagnosticData.length) * 100) : 0;

      // 6. ROLE CLARITY
      const clarityScores = diagnosticData.map(d => d.role_clarity_score || 0).filter(s => s > 0);
      const roleClarity = clarityScores.length > 0 ? Math.round((clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length) * 10) : 0;

      // 7. LEARNING ENGAGEMENT
      const learningScores = diagnosticData.map(d => {
        const hours = parseFloat(d.weekly_development_hours as any) || 0;
        const learningData = (d.additional_responses as any)?.learning_scores;
        const qualityRating = learningData?.quality_rating || 0;
        const needsMet = learningData?.needs_met_percentage || 0;
        
        const timeScore = Math.min(hours * 25, 100);
        const qualityScore = qualityRating * 10;
        const needsScore = needsMet;
        
        return (timeScore * 0.5) + (qualityScore * 0.3) + (needsScore * 0.2);
      }).filter(s => s > 0);
      const learningEngagement = learningScores.length > 0 ? Math.round(learningScores.reduce((a, b) => a + b, 0) / learningScores.length) : 0;

      // 8. SKILLS
      const confidenceScores = diagnosticData.map(d => d.confidence_score || 0).filter(s => s > 0);
      const skillsScore = confidenceScores.length > 0 ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 10) : 0;

      const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 75) return "low";
        if (score >= 50) return "medium";
        if (score >= 25) return "high";
        return "critical";
      };

      const domainScores: DomainScore[] = [
        { domain: "Retention", score: 100 - retentionRisk, risk: getRiskLevel(100 - retentionRisk), impact: `${highRiskCount} at risk` },
        { domain: "Engagement", score: avgEngagement, risk: getRiskLevel(avgEngagement), impact: `${energyScores.filter(s => s <= 5).length} low energy` },
        { domain: "Burnout", score: 100 - burnoutScore, risk: getRiskLevel(100 - burnoutScore), impact: `${burnoutScores.filter(s => s >= 4).length} high burnout` },
        { domain: "Manager", score: managerEffectiveness, risk: getRiskLevel(managerEffectiveness), impact: `${managerScores.filter(s => s <= 5).length} low support` },
        { domain: "Career", score: careerPathScore, risk: getRiskLevel(careerPathScore), impact: `${diagnosticData.length - careerPathCount} no path` },
        { domain: "Clarity", score: roleClarity, risk: getRiskLevel(roleClarity), impact: `${clarityScores.filter(s => s <= 5).length} unclear roles` },
        { domain: "Learning", score: learningEngagement, risk: getRiskLevel(learningEngagement), impact: `${learningScores.filter(s => s < 50).length} low engagement` },
        { domain: "Skills", score: skillsScore, risk: getRiskLevel(skillsScore), impact: `${confidenceScores.filter(s => s <= 5).length} low confidence` },
      ];

      setStats({
        teamSize: employeeIds.length,
        diagnosticsCompleted: uniqueEmployeesWithDiagnostics,
        avgEngagement,
        retentionRisk,
        atRiskEmployees: highRiskCount,
        domainScores,
      });
    } catch (error: any) {
      toast({
        title: "Error loading team stats",
        description: error.message,
        variant: "destructive",
      });
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
          <CardTitle>Team Diagnostic Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No diagnostic data available yet. Encourage your team to complete their assessments.</p>
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
          <CardTitle>Team Health Overview</CardTitle>
          <p className="text-sm text-muted-foreground">8-domain assessment of your team's well-being and performance</p>
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
