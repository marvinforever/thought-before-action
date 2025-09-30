import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Target, Brain, Zap } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface DomainScore {
  domain: string;
  score: number;
  risk: "low" | "medium" | "high" | "critical";
  impact: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    employees: 0,
    diagnosticsCompleted: 0,
    avgEngagement: 0,
    retentionRisk: 0,
    estimatedTurnoverCost: 0,
    atRiskEmployees: 0,
    domainScores: [] as DomainScore[],
    managerEffectiveness: 0,
    burnoutScore: 0,
    careerPathScore: 0,
    roleClarity: 0,
    learningEngagement: 0,
    skillsGap: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.session.user.id)
        .single();

      if (!profile) return;

      const [employeesRes, diagnosticDataRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }).eq("company_id", profile.company_id),
        supabase.from("diagnostic_responses").select("*").eq("company_id", profile.company_id),
      ]);

      const diagnostics = diagnosticDataRes.data || [];
      const employeeCount = employeesRes.count || 0;
      const uniqueEmployeesWithDiagnostics = new Set(diagnostics.map(d => d.profile_id).filter(Boolean)).size;

      // 1. RETENTION & FLIGHT RISK
      const retentionScores = diagnostics.map(d => parseInt(d.would_stay_if_offered_similar) || 0).filter(s => s > 0);
      const highRiskCount = retentionScores.filter(s => s <= 5).length;
      const retentionRisk = retentionScores.length > 0 ? Math.round((highRiskCount / retentionScores.length) * 100) : 0;
      const avgSalary = 75000; // Industry average
      const turnoverCost = Math.round(highRiskCount * avgSalary * 1.5);

      // 2. ENGAGEMENT INDEX - 4-question formula
      // (Q28 + Q29 + Q31 + Q32) / 4 × 10 = Score out of 100
      // Q28: Growth path, Q29: Manager feedback, Q31: Feel valued, Q32: Daily energy
      const engagementScores = diagnostics.map(d => {
        const scores = (d.additional_responses as any)?.engagement_scores;
        if (scores) {
          // Use raw 1-10 scores from additional_responses (new data)
          const growthPath = scores.growth_path_score || 0;
          const managerFeedback = scores.manager_feedback_score || 0;
          const valued = scores.valued_score || 0;
          const energy = scores.energy_score || 0;
          return (growthPath + managerFeedback + valued + energy) / 4;
        } else {
          // Fallback for old data without engagement_scores
          const growthPath = d.sees_growth_path ? 10 : 0;
          const managerFeedback = parseInt(d.manager_support_quality) || 0;
          const valued = d.feels_valued ? 10 : 0;
          const energy = parseInt(d.daily_energy_level) || 0;
          return (growthPath + managerFeedback + valued + energy) / 4;
        }
      }).filter(s => s > 0);
      const avgEngagement = engagementScores.length > 0 ? Math.round((engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) * 10) : 0;
      
      // Keep energy scores for impact calculation
      const energyScores = diagnostics.map(d => parseInt(d.daily_energy_level) || 0).filter(s => s > 0);

      // 3. BURNOUT
      const burnoutMap: Record<string, number> = {
        'Never or almost never': 1,
        'Rarely (monthly)': 2,
        'Sometimes (weekly)': 3,
        'Often (several times a week)': 4,
        'Frequently (daily)': 5,
      };
      const burnoutScores = diagnostics.map(d => burnoutMap[d.burnout_frequency || ''] || 0).filter(s => s > 0);
      const burnoutScore = burnoutScores.length > 0 ? Math.round((burnoutScores.reduce((a, b) => a + b, 0) / burnoutScores.length) * 20) : 0;

      // 4. MANAGER EFFECTIVENESS
      const managerScores = diagnostics.map(d => parseInt(d.manager_support_quality) || 0).filter(s => s > 0);
      const managerEffectiveness = managerScores.length > 0 ? Math.round((managerScores.reduce((a, b) => a + b, 0) / managerScores.length) * 10) : 0;

      // 5. CAREER DEVELOPMENT
      const careerPathCount = diagnostics.filter(d => d.sees_growth_path === true).length;
      const careerPathScore = diagnostics.length > 0 ? Math.round((careerPathCount / diagnostics.length) * 100) : 0;

      // 6. ROLE CLARITY
      const clarityScores = diagnostics.map(d => d.role_clarity_score || 0).filter(s => s > 0);
      const roleClarity = clarityScores.length > 0 ? Math.round((clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length) * 10) : 0;

      // 7. LEARNING ENGAGEMENT
      const learningHours = diagnostics.map(d => parseFloat(d.weekly_development_hours as any) || 0).filter(h => h > 0);
      const learningEngagement = learningHours.length > 0 ? Math.round((learningHours.reduce((a, b) => a + b, 0) / learningHours.length) * 10) : 0;

      // 8. SKILLS GAP (inverse of confidence)
      const confidenceScores = diagnostics.map(d => d.confidence_score || 0).filter(s => s > 0);
      const avgConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 5;
      const skillsGap = Math.round((10 - avgConfidence) * 10);

      // Domain scores with risk levels
      const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 75) return "low";
        if (score >= 50) return "medium";
        if (score >= 25) return "high";
        return "critical";
      };

      const domainScores: DomainScore[] = [
        { domain: "Retention", score: 100 - retentionRisk, risk: getRiskLevel(100 - retentionRisk), impact: `$${Math.round(turnoverCost / 1000)}K at risk` },
        { domain: "Engagement", score: avgEngagement, risk: getRiskLevel(avgEngagement), impact: `${energyScores.filter(s => s <= 5).length} low energy` },
        { domain: "Burnout", score: 100 - burnoutScore, risk: getRiskLevel(100 - burnoutScore), impact: `${burnoutScores.filter(s => s >= 4).length} high burnout` },
        { domain: "Manager", score: managerEffectiveness, risk: getRiskLevel(managerEffectiveness), impact: `${managerScores.filter(s => s <= 5).length} low support` },
        { domain: "Career", score: careerPathScore, risk: getRiskLevel(careerPathScore), impact: `${diagnostics.length - careerPathCount} no path` },
        { domain: "Clarity", score: roleClarity, risk: getRiskLevel(roleClarity), impact: `${clarityScores.filter(s => s <= 5).length} unclear roles` },
        { domain: "Learning", score: learningEngagement, risk: getRiskLevel(learningEngagement), impact: `${learningHours.filter(h => h < 1).length} low hours` },
        { domain: "Skills", score: 100 - skillsGap, risk: getRiskLevel(100 - skillsGap), impact: `${confidenceScores.filter(s => s <= 5).length} low confidence` },
      ];

      setStats({
        employees: employeeCount,
        diagnosticsCompleted: uniqueEmployeesWithDiagnostics,
        avgEngagement,
        retentionRisk,
        estimatedTurnoverCost: turnoverCost,
        atRiskEmployees: highRiskCount,
        domainScores,
        managerEffectiveness,
        burnoutScore,
        careerPathScore,
        roleClarity,
        learningEngagement,
        skillsGap,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const chartConfig = {
    score: { label: "Score", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Executive Dashboard</h1>
        <p className="text-muted-foreground">Comprehensive organizational intelligence & risk analysis</p>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees at Risk</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.atRiskEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">High retention risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Turnover Cost Risk</CardTitle>
            <DollarSign className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Math.round(stats.estimatedTurnoverCost / 1000)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Estimated replacement cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement Score</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgEngagement}/100</div>
            <p className="text-xs text-muted-foreground mt-1">Average energy level</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diagnostics Complete</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.diagnosticsCompleted}/{stats.employees}</div>
            <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.diagnosticsCompleted / stats.employees) * 100)}% participation</p>
          </CardContent>
        </Card>
      </div>

      {/* 8-Domain Risk Radar */}
      <Card>
        <CardHeader>
          <CardTitle>8-Domain Organizational Health</CardTitle>
          <p className="text-sm text-muted-foreground">Comprehensive risk assessment across all critical dimensions</p>
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

      {/* Domain Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.domainScores.map((domain) => (
          <Card key={domain.domain} className={getRiskBgColor(domain.risk)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{domain.domain}</CardTitle>
                <span className={`text-sm font-semibold ${getRiskColor(domain.risk)} uppercase`}>{domain.risk}</span>
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

      {/* Detailed Metrics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { metric: "Manager Support", value: stats.managerEffectiveness },
                  { metric: "Career Path", value: stats.careerPathScore },
                  { metric: "Role Clarity", value: stats.roleClarity },
                  { metric: "Learning", value: stats.learningEngagement },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { metric: "Retention Risk", value: stats.retentionRisk },
                  { metric: "Burnout Level", value: stats.burnoutScore },
                  { metric: "Skills Gap", value: stats.skillsGap },
                  { metric: "Disengagement", value: 100 - stats.avgEngagement },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Critical Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.domainScores
              .filter(d => d.risk === "critical" || d.risk === "high")
              .map(domain => (
                <div key={domain.domain} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${getRiskColor(domain.risk)}`} />
                  <div className="flex-1">
                    <div className="font-semibold">{domain.domain}: {domain.impact}</div>
                    <p className="text-sm text-muted-foreground">Score: {domain.score}/100 - Immediate attention required</p>
                  </div>
                </div>
              ))}
            {stats.domainScores.filter(d => d.risk === "critical" || d.risk === "high").length === 0 && (
              <p className="text-sm text-muted-foreground">No critical issues detected. Continue monitoring key metrics.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;