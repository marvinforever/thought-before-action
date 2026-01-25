import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Target, 
  Users, 
  Sparkles, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Heart,
  MessageSquare,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/contexts/ViewAsContext";
import { format } from "date-fns";

interface TeamMemberReadiness {
  profileId: string;
  fullName: string;
  role: string;
  targetRole: string | null;
  overallReadiness: number | null;
  capabilityReadiness: number | null;
  experienceReadiness: number | null;
  performanceReadiness: number | null;
  estimatedReadyDate: string | null;
  topGaps: string[];
  topStrengths: string[];
}

interface TeamAspiration {
  id: string;
  profileId: string;
  fullName: string;
  aspirationText: string;
  aspirationType: string;
  targetRole: string | null;
  sentiment: string | null;
  createdAt: string;
}

interface TeamCareerSummary {
  totalWithReadiness: number;
  avgReadiness: number;
  readyNow: number;
  readySoon: number;
  needsDevelopment: number;
  totalAspirations: number;
  topTargetRoles: { role: string; count: number }[];
  commonGaps: { gap: string; count: number }[];
}

export function TeamCareerIntelligence() {
  const [loading, setLoading] = useState(true);
  const [teamReadiness, setTeamReadiness] = useState<TeamMemberReadiness[]>([]);
  const [teamAspirations, setTeamAspirations] = useState<TeamAspiration[]>([]);
  const [summary, setSummary] = useState<TeamCareerSummary | null>(null);
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadTeamCareerData();
  }, [viewAsCompanyId]);

  const loadTeamCareerData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get direct reports
      let assignmentsQuery = supabase
        .from("manager_assignments")
        .select("employee_id, profiles!manager_assignments_employee_id_fkey(id, full_name, role)");

      if (viewAsCompanyId) {
        assignmentsQuery = assignmentsQuery.eq("company_id", viewAsCompanyId);
      } else {
        assignmentsQuery = assignmentsQuery.eq("manager_id", user.id);
      }

      const { data: assignments, error: assignError } = await assignmentsQuery;
      if (assignError) throw assignError;

      const employeeIds = assignments?.map((a: any) => a.employee_id) || [];
      const profileMap = new Map(assignments?.map((a: any) => [a.employee_id, a.profiles]) || []);

      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Load promotion readiness for team
      const { data: readinessData } = await supabase
        .from("promotion_readiness")
        .select("*")
        .in("profile_id", employeeIds)
        .order("assessed_at", { ascending: false });

      // Deduplicate - take most recent per profile
      const latestReadiness = new Map<string, any>();
      readinessData?.forEach((r: any) => {
        if (!latestReadiness.has(r.profile_id)) {
          latestReadiness.set(r.profile_id, r);
        }
      });

      // Load career aspirations for team
      const { data: aspirationsData } = await supabase
        .from("career_aspirations")
        .select("*")
        .in("profile_id", employeeIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      // Build team readiness list
      const readinessList: TeamMemberReadiness[] = [];
      latestReadiness.forEach((r, profileId) => {
        const profile = profileMap.get(profileId) as any;
        const gaps = Array.isArray(r.capability_gaps) ? r.capability_gaps : [];
        const strengths = Array.isArray(r.strengths) ? r.strengths : [];
        
        readinessList.push({
          profileId,
          fullName: profile?.full_name || "Unknown",
          role: profile?.role || "Employee",
          targetRole: r.target_role,
          overallReadiness: r.overall_readiness_pct,
          capabilityReadiness: r.capability_readiness_pct,
          experienceReadiness: r.experience_readiness_pct,
          performanceReadiness: r.performance_readiness_pct,
          estimatedReadyDate: r.estimated_ready_date,
          topGaps: gaps.slice(0, 3).map((g: any) => typeof g === 'string' ? g : g.capability || g.name || 'Unknown'),
          topStrengths: strengths.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.capability || s.name || 'Unknown'),
        });
      });

      // Sort by readiness descending
      readinessList.sort((a, b) => (b.overallReadiness || 0) - (a.overallReadiness || 0));
      setTeamReadiness(readinessList);

      // Build aspirations list
      const aspirationsList: TeamAspiration[] = (aspirationsData || []).map((a: any) => {
        const profile = profileMap.get(a.profile_id) as any;
        return {
          id: a.id,
          profileId: a.profile_id,
          fullName: profile?.full_name || "Unknown",
          aspirationText: a.aspiration_text,
          aspirationType: a.aspiration_type,
          targetRole: a.target_role,
          sentiment: a.sentiment,
          createdAt: a.created_at,
        };
      });
      setTeamAspirations(aspirationsList);

      // Calculate summary metrics
      const readyNow = readinessList.filter(r => (r.overallReadiness || 0) >= 80).length;
      const readySoon = readinessList.filter(r => (r.overallReadiness || 0) >= 60 && (r.overallReadiness || 0) < 80).length;
      const needsDevelopment = readinessList.filter(r => (r.overallReadiness || 0) < 60).length;
      const avgReadiness = readinessList.length > 0 
        ? Math.round(readinessList.reduce((sum, r) => sum + (r.overallReadiness || 0), 0) / readinessList.length)
        : 0;

      // Count target roles
      const roleCount: Record<string, number> = {};
      readinessList.forEach(r => {
        if (r.targetRole) {
          roleCount[r.targetRole] = (roleCount[r.targetRole] || 0) + 1;
        }
      });
      const topTargetRoles = Object.entries(roleCount)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Count common gaps
      const gapCount: Record<string, number> = {};
      readinessList.forEach(r => {
        r.topGaps.forEach(gap => {
          gapCount[gap] = (gapCount[gap] || 0) + 1;
        });
      });
      const commonGaps = Object.entries(gapCount)
        .map(([gap, count]) => ({ gap, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setSummary({
        totalWithReadiness: readinessList.length,
        avgReadiness,
        readyNow,
        readySoon,
        needsDevelopment,
        totalAspirations: aspirationsList.length,
        topTargetRoles,
        commonGaps,
      });

    } catch (error: any) {
      console.error("Error loading team career data:", error);
      toast({
        title: "Error loading career intelligence",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getReadinessColor = (pct: number | null) => {
    if (!pct) return "bg-muted";
    if (pct >= 80) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getSentimentBadge = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">positive</Badge>;
      case "negative":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">negative</Badge>;
      default:
        return <Badge variant="secondary">neutral</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading career intelligence...</span>
        </CardContent>
      </Card>
    );
  }

  if (teamReadiness.length === 0 && teamAspirations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">No Career Data Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Career readiness data will appear here once team members generate their career paths.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Readiness</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgReadiness}%</div>
              <Progress value={summary.avgReadiness} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready Now</CardTitle>
              <Sparkles className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.readyNow}</div>
              <p className="text-xs text-muted-foreground">80%+ readiness</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready Soon</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.readySoon}</div>
              <p className="text-xs text-muted-foreground">60-79% readiness</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Development</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.needsDevelopment}</div>
              <p className="text-xs text-muted-foreground">&lt;60% readiness</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="readiness" className="space-y-4">
        <TabsList>
          <TabsTrigger value="readiness" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Promotion Readiness
          </TabsTrigger>
          <TabsTrigger value="aspirations" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Team Aspirations
            {teamAspirations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{teamAspirations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Readiness Tab */}
        <TabsContent value="readiness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Promotion Readiness</CardTitle>
              <CardDescription>
                Individual readiness scores for your direct reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {teamReadiness.map((member) => (
                    <div
                      key={member.profileId}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                          {member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium">{member.fullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {member.role}
                            {member.targetRole && (
                              <span className="ml-2">
                                → <span className="text-primary font-medium">{member.targetRole}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Readiness Score */}
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${getReadinessColor(member.overallReadiness)}`} />
                            <span className="text-lg font-bold">
                              {member.overallReadiness ?? 'N/A'}%
                            </span>
                          </div>
                          {member.estimatedReadyDate && (
                            <div className="text-xs text-muted-foreground">
                              Est. {format(new Date(member.estimatedReadyDate), "MMM yyyy")}
                            </div>
                          )}
                        </div>

                        {/* Top Gap */}
                        {member.topGaps.length > 0 && (
                          <div className="hidden md:block">
                            <Badge variant="outline" className="text-xs">
                              Gap: {member.topGaps[0]}
                            </Badge>
                          </div>
                        )}

                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aspirations Tab */}
        <TabsContent value="aspirations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Career Aspirations</CardTitle>
              <CardDescription>
                Career interests automatically detected from team conversations with Jericho
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamAspirations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No aspirations detected yet</p>
                  <p className="text-sm">Aspirations are detected from Jericho chat conversations</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {teamAspirations.map((aspiration) => (
                      <div
                        key={aspiration.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{aspiration.fullName}</span>
                              <Badge variant="outline" className="text-xs">
                                {aspiration.aspirationType}
                              </Badge>
                              {aspiration.sentiment && getSentimentBadge(aspiration.sentiment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              "{aspiration.aspirationText}"
                            </p>
                            {aspiration.targetRole && (
                              <Badge className="mt-2" variant="secondary">
                                Target: {aspiration.targetRole}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(aspiration.createdAt), "MMM d")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Target Roles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Target Roles</CardTitle>
                <CardDescription>
                  Most common promotion targets on your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.topTargetRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No target roles set yet</p>
                ) : (
                  <div className="space-y-3">
                    {summary?.topTargetRoles.map((item, i) => (
                      <div key={item.role} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-muted-foreground">
                            {i + 1}.
                          </span>
                          <span className="font-medium">{item.role}</span>
                        </div>
                        <Badge variant="secondary">{item.count} members</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Common Capability Gaps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Common Capability Gaps</CardTitle>
                <CardDescription>
                  Focus areas for team development
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.commonGaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No gaps identified yet</p>
                ) : (
                  <div className="space-y-3">
                    {summary?.commonGaps.map((item) => (
                      <div key={item.gap} className="flex items-center justify-between">
                        <span className="text-sm">{item.gap}</span>
                        <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">
                          {item.count} members
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
