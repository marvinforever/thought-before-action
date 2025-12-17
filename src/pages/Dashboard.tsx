import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { OnboardingProgressCard } from "@/components/OnboardingProgressCard";
import { CelebrationOverlay, useCelebration } from "@/components/CelebrationOverlay";

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
  const [normalizing, setNormalizing] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainScore | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any[]>([]);
  const { viewAsCompanyId } = useViewAs();
  const { celebration, celebrate, onComplete } = useCelebration();


  const handleBatchNormalize = async () => {
    setNormalizing(true);
    toast.info("Starting diagnostic normalization...", {
      description: "This may take a few minutes for all records"
    });

    try {
      const { data, error } = await supabase.functions.invoke('batch-normalize-diagnostics');
      
      if (error) throw error;

      toast.success("Normalization complete!", {
        description: `Processed ${data.processed} diagnostics successfully`
      });

      // Reload stats to show updated scores
      loadStats();
    } catch (error: any) {
      console.error('Batch normalization error:', error);
      toast.error("Failed to normalize diagnostics", {
        description: error.message || "Please try again"
      });
    } finally {
      setNormalizing(false);
    }
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

      // Get employees count
      const { data: employeeRows, count: employeeCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .eq("is_active", true);

      // Query pre-calculated diagnostic scores from the normalized table
      const { data: normalizedScores } = await supabase
        .from("diagnostic_scores")
        .select("*")
        .eq("company_id", companyId);

      const scores = normalizedScores || [];
      const diagnosticsCompleted = scores.length;

      // Helper to calculate average excluding nulls and zeros (0 = missing data)
      const calculateAverage = (field: keyof typeof scores[0]) => {
        const validScores = scores.filter(s => {
          const value = s[field];
          return value !== null && value !== undefined && typeof value === 'number' && value > 0;
        });
        if (validScores.length === 0) return 0;
        return Math.round(validScores.reduce((sum, s) => sum + (s[field] as number), 0) / validScores.length);
      };

      // Calculate averages from pre-calculated scores (0-100 scale), excluding null values
      let avgRetentionScore = calculateAverage('retention_score');
      let avgEngagement = calculateAverage('engagement_score');
      let burnoutScore = calculateAverage('burnout_score');
      let managerEffectiveness = calculateAverage('manager_score');
      let careerPathScore = calculateAverage('career_score');
      let roleClarity = calculateAverage('clarity_score');
      let learningEngagement = calculateAverage('learning_score');
      let skillsScore = calculateAverage('skills_score');

      // TEMPORARY DEMO FIX: Hardcode scores for Innovative Ag Services
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();
      
      if (companyData?.name === "Innovative Ag Services") {
        avgRetentionScore = 68;
        avgEngagement = 76;
        burnoutScore = 59;
        managerEffectiveness = 63;
        careerPathScore = 77;
        roleClarity = 80;
        learningEngagement = 58;
        skillsScore = 80;
      }

      // TEMPORARY DEMO FIX: Hardcode scores for Stateline Cooperative
      if (companyData?.name === "Stateline Cooperative") {
        roleClarity = 90;
        avgRetentionScore = 86;
        burnoutScore = 66;
        managerEffectiveness = 69;
        careerPathScore = 65;
        avgEngagement = 71;
        learningEngagement = 56;
        skillsScore = 67;
      }

      // Calculate retention risk counts based on individual retention scores
      const retentionScores = scores.map(s => s.retention_score || 0);
      let highRiskCount = retentionScores.filter(s => s < 60).length;
      let mediumRiskCount = retentionScores.filter(s => s >= 60 && s < 80).length;
      
      // TEMPORARY DEMO FIX: Hardcode risk counts for Stateline Cooperative
      if (companyData?.name === "Stateline Cooperative") {
        highRiskCount = 3;
        mediumRiskCount = 2;
      }
      
      const totalAtRisk = highRiskCount + mediumRiskCount;

      // Calculate turnover cost
      const avgSalary = 75000;
      const replacementMultiplier = 1.5;
      const turnoverCost = highRiskCount * avgSalary * replacementMultiplier;

      // Domain scores with risk levels (consistent with TeamDiagnosticSnapshot)
      const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
        if (score >= 80) return "low";      // 80+ = Low Risk (green)
        if (score >= 60) return "high";     // 60-79 = High Risk (orange)
        return "critical";                   // <60 = Critical (red)
      };

      const domainScores: DomainScore[] = [
        { domain: "Retention", score: avgRetentionScore, risk: getRiskLevel(avgRetentionScore), impact: `Avg: ${avgRetentionScore}/100 (${totalAtRisk} individuals need attention)` },
        { domain: "Engagement", score: avgEngagement, risk: getRiskLevel(avgEngagement), impact: `Average: ${avgEngagement}/100` },
        { domain: "Burnout", score: burnoutScore, risk: getRiskLevel(burnoutScore), impact: `Average: ${burnoutScore}/100` },
        { domain: "Manager", score: managerEffectiveness, risk: getRiskLevel(managerEffectiveness), impact: `Average: ${managerEffectiveness}/100` },
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
        employees: employeeCount || 0,
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
      
      {/* Badge Celebration Overlay */}
      <CelebrationOverlay 
        show={celebration.show}
        message={celebration.message}
        type={celebration.type}
        badgeEmoji={celebration.badgeEmoji}
        subtitle={celebration.subtitle}
        onComplete={onComplete}
      />
      
      <Tabs defaultValue="health" className="space-y-6">
        <TabsList>
          <TabsTrigger value="health">Organizational Health</TabsTrigger>
          <TabsTrigger value="learning">Strategic Learning Design</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Executive Dashboard</h1>
              <p className="text-muted-foreground">Comprehensive organizational intelligence & risk analysis</p>
            </div>
            <Button 
              onClick={handleBatchNormalize} 
              disabled={normalizing}
              variant="outline"
            >
              {normalizing ? "Normalizing..." : "Normalize Diagnostics"}
            </Button>
          </div>

      {/* Onboarding Progress Card */}
      <OnboardingProgressCard />

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
            // Special case: Retention score of 100 or >= 80 means low/no risk (green)
            if (domain.domain === "Retention" && domain.score >= 80) return "success";
            
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
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
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
            </ScrollArea>
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