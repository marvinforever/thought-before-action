import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Target, Award, Clock } from "lucide-react";
import { Gauge } from "@/components/ui/gauge";
import { OrgHealthAdvisor } from "@/components/OrgHealthAdvisor";
import { OrganizationalGrowthDesign } from "@/components/OrganizationalGrowthDesign";
import { EmployeeInterestIndicators } from "@/components/EmployeeInterestIndicators";
import { GrowthAtAGlance } from "@/components/GrowthAtAGlance";
import StrategicLearningDesignReport from "@/components/StrategicLearningDesignReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViewAsCompanyBanner } from "@/components/ViewAsCompanyBanner";
import { useViewAs } from "@/contexts/ViewAsContext";
import { DomainDrilldownDialog } from "@/components/DomainDrilldownDialog";

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
    highRiskCount: 0,
    mediumRiskCount: 0,
    domainScores: [] as DomainScore[],
    managerEffectiveness: 0,
    burnoutScore: 0,
    careerPathScore: 0,
    roleClarity: 0,
    learningEngagement: 0,
    skillsScore: 0,
    recentActivity: [] as Array<{ type: string; description: string; timestamp: Date; icon: string }>,
  });
  const [loading, setLoading] = useState(true);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainScore | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any[]>([]);
  const { viewAsCompanyId } = useViewAs();

  // Normalize manager support quality to a 1-10 number even if stored as text labels
  const parseSupportQuality = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n; // already numeric 1-10
    const s = String(v).toLowerCase();
    if (s.includes('excellent')) return 10;
    if (s.includes('very good')) return 9;
    if (s.includes('good')) return 8;
    if (s.includes('fair')) return 6;
    if (s.includes('poor')) return 3;
    return 0;
  };

  useEffect(() => {
    loadStats();
  }, [viewAsCompanyId]);

  // Real-time subscription for diagnostic data updates
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-diagnostics-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE so dashboard refreshes on edits too
          schema: 'public',
          table: 'diagnostic_responses'
        },
        (payload) => {
          console.log('Diagnostic data changed, refreshing dashboard...', payload.eventType);
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewAsCompanyId]);

  const loadStats = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Check if viewing as another company (super admin feature)
      let companyId = viewAsCompanyId;
      
      if (!companyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", session.session.user.id)
          .maybeSingle();

        if (!profile?.company_id) return;
        companyId = profile.company_id;
      }

      // Only get employees and diagnostics for THIS specific company
      const [employeesRes, diagnosticDataRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("company_id", companyId),
        supabase
          .from("diagnostic_responses")
          .select("*")
          .eq("company_id", companyId)
          .not("submitted_at", "is", null),
      ]);

      const diagnostics = diagnosticDataRes.data || [];
      const employeeRows = employeesRes.data || [];
      const employeeIds = new Set(employeeRows.map((e: any) => e.id));

      // Define a stricter completion rule to avoid counting partial/test rows
      const completeDiagnostics = diagnostics.filter((d: any) => {
        if (!d?.profile_id || !employeeIds.has(d.profile_id)) return false;
        const rc = Number(d.role_clarity_score) || 0;
        const msq = parseSupportQuality(d.manager_support_quality);
        const energy = Number(d.daily_energy_level) || 0;
        const conf = Number(d.confidence_score) || 0;
        const engagement = (d.additional_responses as any)?.engagement_scores;
        const engagementSum = engagement
          ? [engagement.energy_score, engagement.valued_score, engagement.growth_path_score, engagement.manager_feedback_score]
              .map((v: any) => Number(v) || 0)
              .reduce((a: number, b: number) => a + b, 0)
          : 0;
        // Consider complete if key scores are present (typical of real submissions)
        return (rc > 0 && msq > 0 && energy > 0) || (conf > 0 && engagementSum > 0);
      });

      // Count unique current employees with a completed diagnostic
      const completedProfileIds = new Set(completeDiagnostics.map((d: any) => d.profile_id));

      const employeeCount = employeesRes.count ?? employeeRows.length;
      const diagnosticsCompleted = completedProfileIds.size;
      
      console.log('Dashboard Stats Debug:', {
        employeeCount,
        totalDiagnostics: diagnostics.length,
        uniqueDiagProfiles: new Set(diagnostics.map((d: any) => d.profile_id).filter(Boolean)).size,
        diagnosticsCompleted,
        percentage: employeeCount > 0 ? Math.round((diagnosticsCompleted / employeeCount) * 100) : 0
      });

      // 1. RETENTION & FLIGHT RISK - Two-question formula
      // Formula: ((Q1: would_stay + Q2: growth_path) / 2) × 10 = Score (0-100)
      // Thresholds: < 60 = Critical Risk, 60-79 = Watch List, 80+ = Low Risk
      const retentionScores = completeDiagnostics.map(d => {
        const stayScore = parseInt(d.would_stay_if_offered_similar) || 0;
        const growthScore = (d.additional_responses as any)?.engagement_scores?.growth_path_score || 0;
        
        // Skip if either score is missing
        if (stayScore === 0 || growthScore === 0) return null;
        
        // Calculate retention score: average of the two questions, scaled to 0-100
        const retentionScore = ((stayScore + growthScore) / 2) * 10;
        return retentionScore;
      }).filter(s => s !== null) as number[];
      
      // Count employees by risk category
      const highRiskCount = retentionScores.filter(s => s < 60).length; // Critical: < 60
      const mediumRiskCount = retentionScores.filter(s => s >= 60 && s < 80).length; // Watch List: 60-79
      const lowRiskCount = retentionScores.filter(s => s >= 80).length; // Low Risk: 80+
      const totalAtRisk = highRiskCount + mediumRiskCount; // Combined at-risk count
      
      // Calculate average retention score
      const avgRetentionScore = retentionScores.length > 0 
        ? Math.round(retentionScores.reduce((a, b) => a + b, 0) / retentionScores.length) 
        : 0;
      
      // Calculate turnover cost (only for high risk employees - most likely to leave)
      const avgSalary = 75000; // Industry average salary
      const replacementMultiplier = 1.5; // 150% of salary for replacement cost
      const turnoverCost = highRiskCount * avgSalary * replacementMultiplier;
      
      console.log('Retention Breakdown:', {
        totalEmployees: completeDiagnostics.length,
        withRetentionData: retentionScores.length,
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        lowRisk: lowRiskCount,
        avgScore: avgRetentionScore,
        estimatedCost: turnoverCost
      });

      // 2. ENGAGEMENT INDEX - 4-question formula
      // (Q28 + Q29 + Q31 + Q32) / 4 × 10 = Score out of 100
      // Q28: Growth path, Q29: Manager feedback, Q31: Feel valued, Q32: Daily energy
      const engagementScores = completeDiagnostics.map(d => {
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
          const managerFeedback = parseSupportQuality(d.manager_support_quality);
          const valued = d.feels_valued ? 10 : 0;
          const energy = Number(d.daily_energy_level) || 0;
          return (growthPath + managerFeedback + valued + energy) / 4;
        }
      }).filter(s => s > 0);
      const avgEngagement = engagementScores.length > 0 ? parseFloat(((engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) * 10).toFixed(2)) : 0;
      
      // Keep energy scores for impact calculation
      const energyScores = completeDiagnostics.map(d => parseInt(d.daily_energy_level) || 0).filter(s => s > 0);

      // 3. BURNOUT
      const burnoutMap: Record<string, number> = {
        'Never or almost never': 1,
        'Rarely (monthly)': 2,
        'Sometimes (weekly)': 3,
        'Often (several times a week)': 4,
        'Frequently (daily)': 5,
      };
      const burnoutScores = completeDiagnostics.map(d => burnoutMap[d.burnout_frequency || ''] || 0).filter(s => s > 0);
      const burnoutScore = burnoutScores.length > 0 ? Math.round((burnoutScores.reduce((a, b) => a + b, 0) / burnoutScores.length) * 20) : 0;

      // 4. MANAGER EFFECTIVENESS
      const managerScores = completeDiagnostics.map(d => parseSupportQuality(d.manager_support_quality)).filter(s => s > 0);
      const managerEffectiveness = managerScores.length > 0 ? Math.round((managerScores.reduce((a, b) => a + b, 0) / managerScores.length) * 10) : 0;

      // 5. CAREER DEVELOPMENT
      const careerPathCount = completeDiagnostics.filter(d => d.sees_growth_path === true).length;
      const careerPathScore = completeDiagnostics.length > 0 ? Math.round((careerPathCount / completeDiagnostics.length) * 100) : 0;

      // 6. ROLE CLARITY
      const clarityScores = completeDiagnostics.map(d => d.role_clarity_score || 0).filter(s => s > 0);
      const roleClarity = clarityScores.length > 0 ? Math.round((clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length) * 10) : 0;

      // 7. LEARNING ENGAGEMENT - Blended approach
      // 50% time investment (hours * 25, max 100) + 30% quality rating + 20% needs met
      const learningScores = completeDiagnostics.map(d => {
        const hours = parseFloat(d.weekly_development_hours as any) || 0;
        const learningData = (d.additional_responses as any)?.learning_scores;
        const qualityRating = learningData?.quality_rating || 0;
        const needsMet = learningData?.needs_met_percentage || 0;
        
        const timeScore = Math.min(hours * 25, 100); // 1hr=25, 2hr=50, 3hr=75, 4hr=100
        const qualityScore = qualityRating * 10; // 1-10 scale to 0-100
        const needsScore = needsMet; // Already 0-100 percentage
        
        return (timeScore * 0.5) + (qualityScore * 0.3) + (needsScore * 0.2);
      }).filter(s => s > 0);
      const learningEngagement = learningScores.length > 0 ? Math.round(learningScores.reduce((a, b) => a + b, 0) / learningScores.length) : 0;

      // 8. SKILLS - Direct confidence score
      const confidenceScores = completeDiagnostics.map(d => d.confidence_score || 0).filter(s => s > 0);
      const skillsScore = confidenceScores.length > 0 ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 10) : 0;

      // Domain scores with risk levels
      const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 80) return "low";    // 80+ = Low Risk (green)
        if (score >= 60) return "high";   // 60-79 = Medium Risk (orange)
        return "critical";                 // <60 = High Risk (red)
      };

      // Engagement uses quartile-based risk assessment
      const getEngagementRisk = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 75) return "low";       // Top quartile = Low risk
        if (score >= 25) return "high";      // Middle quartiles = Moderate risk (orange)
        return "critical";                   // Bottom quartile = High risk (red)
      };

      const domainScores: DomainScore[] = [
        { domain: "Retention", score: avgRetentionScore, risk: getRiskLevel(avgRetentionScore), impact: `${totalAtRisk} at risk (${highRiskCount} high, ${mediumRiskCount} medium)` },
        { domain: "Engagement", score: avgEngagement, risk: getEngagementRisk(avgEngagement), impact: ">75 = Low, 26-74 = Moderate, <26 = High" },
        { domain: "Burnout", score: 100 - burnoutScore, risk: getRiskLevel(100 - burnoutScore), impact: "" },
        { domain: "Manager", score: managerEffectiveness, risk: getRiskLevel(managerEffectiveness), impact: "" },
        { domain: "Career", score: careerPathScore, risk: getRiskLevel(careerPathScore), impact: "" },
        { domain: "Clarity", score: roleClarity, risk: getRiskLevel(roleClarity), impact: "" },
        { domain: "Learning", score: learningEngagement, risk: getRiskLevel(learningEngagement), impact: "" },
        { domain: "Skills", score: skillsScore, risk: getRiskLevel(skillsScore), impact: "" },
      ];

      // Fetch recent organizational activity
      const [oneOnOnesRes, capRequestsRes, goalsRes, recognitionRes] = await Promise.all([
        supabase
          .from("one_on_one_notes")
          .select("meeting_date, manager_id, employee_id, profiles!one_on_one_notes_employee_id_fkey(full_name)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("capability_level_requests")
          .select("created_at, status, profiles!capability_level_requests_profile_id_fkey(full_name)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("ninety_day_targets")
          .select("updated_at, completed, goal_text, profiles(full_name)")
          .eq("company_id", companyId)
          .eq("completed", true)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("one_on_one_notes")
          .select("created_at, wins, profiles!one_on_one_notes_employee_id_fkey(full_name)")
          .eq("company_id", companyId)
          .not("wins", "is", null)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const recentActivity = [
        ...(oneOnOnesRes.data || []).map(item => ({
          type: "1-on-1",
          description: `1-on-1 with ${(item.profiles as any)?.full_name || "team member"}`,
          timestamp: new Date(item.meeting_date),
          icon: "users"
        })),
        ...(capRequestsRes.data || []).map(item => ({
          type: "capability",
          description: `${(item.profiles as any)?.full_name || "Someone"} requested capability level change`,
          timestamp: new Date(item.created_at),
          icon: "trending-up"
        })),
        ...(goalsRes.data || []).map(item => ({
          type: "goal",
          description: `${(item.profiles as any)?.full_name || "Someone"} completed a goal`,
          timestamp: new Date(item.updated_at),
          icon: "target"
        })),
        ...(recognitionRes.data || []).map(item => ({
          type: "recognition",
          description: `${(item.profiles as any)?.full_name || "Someone"} received recognition`,
          timestamp: new Date(item.created_at),
          icon: "award"
        })),
      ]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      setStats({
        employees: employeeCount,
        diagnosticsCompleted,
        avgEngagement,
        retentionRisk: 100 - avgRetentionScore, // Inverted for legacy display
        estimatedTurnoverCost: Math.round(turnoverCost),
        atRiskEmployees: totalAtRisk,
        highRiskCount,
        mediumRiskCount,
        domainScores,
        managerEffectiveness,
        burnoutScore,
        careerPathScore,
        roleClarity,
        learningEngagement,
        skillsScore,
        recentActivity,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDomainClick = async (domain: DomainScore) => {
    setSelectedDomain(domain);
    
    // Fetch employee details for this domain
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    let companyId = viewAsCompanyId;
    if (!companyId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      companyId = profile.company_id;
    }

    const { data: diagnostics } = await supabase
      .from("diagnostic_responses")
      .select("*, profiles(full_name)")
      .eq("company_id", companyId)
      .not("submitted_at", "is", null);

    if (!diagnostics) return;

    // Calculate scores based on domain type
    const employees = diagnostics.map((d: any) => {
      let score = 0;
      let risk: "low" | "medium" | "high" | "critical" = "low";

      if (domain.domain === "Retention") {
        const stayScore = parseInt(d.would_stay_if_offered_similar) || 0;
        const growthScore = (d.additional_responses as any)?.engagement_scores?.growth_path_score || 0;
        if (stayScore && growthScore) {
          score = Math.round(((stayScore + growthScore) / 2) * 10);
          if (score < 60) risk = "critical";
          else if (score < 80) risk = "high";
          else risk = "low";
        }
      } else if (domain.domain === "Engagement") {
        const scores = (d.additional_responses as any)?.engagement_scores;
        if (scores) {
          score = Math.round(((scores.growth_path_score + scores.manager_feedback_score + scores.valued_score + scores.energy_score) / 4) * 10);
          if (score >= 75) risk = "low";
          else if (score >= 26) risk = "high";
          else risk = "critical";
        }
      }

      return {
        id: d.profile_id,
        name: (d.profiles as any)?.full_name || "Unknown",
        score,
        risk,
      };
    }).filter((e: any) => e.score > 0);

    setEmployeeDetails(employees);
    setDrilldownOpen(true);
  };

  const getDomainInsights = (domain: string, score: number) => {
    if (domain === "Retention") {
      if (score < 60) return "Critical retention risk detected. Immediate action required to prevent turnover.";
      if (score < 80) return "Moderate retention concerns. Proactive engagement recommended.";
      return "Retention is stable. Continue monitoring and supporting team members.";
    }
    if (domain === "Engagement") {
      if (score < 26) return "Engagement is critically low. Team members may be disengaged or burnt out.";
      if (score < 75) return "Engagement levels are moderate. There's room for improvement.";
      return "High engagement detected. Team is energized and connected.";
    }
    return `${domain} score is ${score}. Monitor trends and take action as needed.`;
  };

  const getDomainRecommendations = (domain: string, score: number) => {
    if (domain === "Retention") {
      if (score < 60) return [
        "Schedule immediate 1-on-1s with at-risk employees",
        "Review compensation and career development opportunities",
        "Conduct exit interviews to understand root causes",
        "Implement retention bonuses or incentives where appropriate"
      ];
      if (score < 80) return [
        "Increase frequency of check-ins with team members",
        "Review workload and work-life balance",
        "Clarify career paths and growth opportunities",
        "Strengthen recognition and appreciation programs"
      ];
      return [
        "Maintain current engagement practices",
        "Continue regular 1-on-1 meetings",
        "Celebrate wins and recognize contributions",
        "Monitor for any changes in team dynamics"
      ];
    }
    if (domain === "Engagement") {
      if (score < 26) return [
        "Conduct team engagement survey to identify issues",
        "Address burnout and workload concerns immediately",
        "Rebuild trust through transparent communication",
        "Consider team-building activities and morale boosters"
      ];
      if (score < 75) return [
        "Increase recognition and appreciation frequency",
        "Create more opportunities for meaningful work",
        "Improve communication and feedback loops",
        "Invest in professional development programs"
      ];
      return [
        "Sustain high engagement through continued support",
        "Share success stories and celebrate achievements",
        "Provide growth opportunities and challenges",
        "Foster innovation and creative problem-solving"
      ];
    }
    return ["Monitor this metric regularly", "Take action if trends worsen", "Communicate with your team"];
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
      case "medium": return "Moderate Risk";
      case "low": return "Low Risk";
      default: return risk;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ViewAsCompanyBanner />
      
      <Tabs defaultValue="health" className="space-y-6">
        <TabsList>
          <TabsTrigger value="health">Organizational Health</TabsTrigger>
          <TabsTrigger value="learning">Strategic Learning Design</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Executive Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive organizational intelligence & risk analysis</p>
          </div>

      {/* Growth at a Glance - Featured for Individual Users */}
      <div className="mb-6">
        <GrowthAtAGlance />
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* High Risk - Critical (< 60) */}
        <Card className={`border-l-4 transition-all hover:shadow-lg ${stats.highRiskCount === 0 ? 'border-l-green-600' : 'border-l-destructive'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees at Risk</CardTitle>
            {stats.highRiskCount === 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${stats.highRiskCount === 0 ? 'text-green-600' : 'text-destructive'}`}>
              {stats.highRiskCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.highRiskCount === 0 ? 'No critical retention concerns' : 'Retention score < 60'}
            </p>
          </CardContent>
        </Card>

        {/* Medium Risk - Watch List (60-79) */}
        <Card className={`border-l-4 transition-all hover:shadow-lg ${stats.mediumRiskCount === 0 ? 'border-l-green-600' : 'border-l-orange-600'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Watch List</CardTitle>
            {stats.mediumRiskCount === 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <Clock className="h-5 w-5 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${stats.mediumRiskCount === 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {stats.mediumRiskCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.mediumRiskCount === 0 ? 'No moderate risk employees' : 'Retention score 60-79'}
            </p>
          </CardContent>
        </Card>

        {/* Turnover Cost */}
        <Card className={`border-l-4 transition-all hover:shadow-lg ${stats.estimatedTurnoverCost === 0 ? 'border-l-green-600' : 'border-l-destructive'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Turnover Risk</CardTitle>
            {stats.estimatedTurnoverCost === 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <DollarSign className="h-5 w-5 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${stats.estimatedTurnoverCost === 0 ? 'text-green-600' : ''}`}>
              ${stats.estimatedTurnoverCost === 0 ? '0' : `${Math.round(stats.estimatedTurnoverCost / 1000)}K`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.estimatedTurnoverCost === 0 ? 'No cost exposure' : 'Estimated cost if high risk leave'}
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Domain Health Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.domainScores.map((domain) => {
          const getGaugeColor = (risk: string) => {
            // Special case: Retention at 0 means no risk (green)
            if (domain.domain === "Retention" && domain.score === 0) return "success";
            
            switch (risk) {
              case "critical": return "danger";
              case "high": return "warning";
              case "medium": return "warning";
              case "low": return "success";
              default: return "default";
            }
          };

          const getIcon = () => {
            if (domain.risk === "critical") return <TrendingDown className="h-5 w-5 text-destructive" />;
            if (domain.risk === "high") return <AlertTriangle className="h-5 w-5 text-orange-500" />;
            if (domain.risk === "medium") return <Target className="h-5 w-5 text-yellow-500" />;
            return <TrendingUp className="h-5 w-5 text-green-500" />;
          };

          return (
            <Card 
              key={domain.domain} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleDomainClick(domain)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-center">{domain.domain}</CardTitle>
                <div className="flex justify-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(domain.risk)} ${getRiskColor(domain.risk)}`}>
                    {getRiskLabel(domain.risk)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-6">
                <Gauge 
                  value={domain.score} 
                  max={100}
                  size={120}
                  strokeWidth={12}
                  icon={getIcon()}
                  description={domain.impact}
                  colorScheme={getGaugeColor(domain.risk) as any}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Organizational Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Organizational Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Latest team actions and achievements</p>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity to display</p>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => {
                const IconComponent = 
                  activity.icon === "users" ? Users :
                  activity.icon === "trending-up" ? TrendingUp :
                  activity.icon === "target" ? Target :
                  Award;
                
                const getTimeAgo = (date: Date) => {
                  const now = new Date();
                  const diff = now.getTime() - date.getTime();
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const minutes = Math.floor(diff / (1000 * 60));
                  
                  if (days > 0) return `${days}d ago`;
                  if (hours > 0) return `${hours}h ago`;
                  if (minutes > 0) return `${minutes}m ago`;
                  return "Just now";
                };

                return (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="mt-0.5 p-2 rounded-full bg-primary/10">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{getTimeAgo(activity.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Jericho Org Health Advisor */}
      <OrgHealthAdvisor
        organizationContext={{
          employees: stats.employees,
          diagnosticsCompleted: stats.diagnosticsCompleted,
          diagnosticsPercentage: stats.employees > 0 ? Math.round((stats.diagnosticsCompleted / stats.employees) * 100) : 0,
          atRiskEmployees: stats.atRiskEmployees,
          avgEngagement: stats.avgEngagement,
          domainScores: stats.domainScores,
        }}
      />

      {/* Employee Interest Indicators */}
      <EmployeeInterestIndicators />
        </TabsContent>

        <TabsContent value="learning">
          <StrategicLearningDesignReport />
        </TabsContent>
      </Tabs>

      {/* Domain Drilldown Dialog */}
      {selectedDomain && (
        <DomainDrilldownDialog
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          domain={selectedDomain.domain}
          score={selectedDomain.score}
          risk={selectedDomain.risk}
          employees={employeeDetails}
          insights={getDomainInsights(selectedDomain.domain, selectedDomain.score)}
          recommendations={getDomainRecommendations(selectedDomain.domain, selectedDomain.score)}
        />
      )}
    </div>
  );
};

export default Dashboard;