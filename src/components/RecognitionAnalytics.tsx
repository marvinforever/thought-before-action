import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Award, TrendingUp, Users, Target, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface RecognitionStats {
  totalGiven: number;
  totalReceived: number;
  byCategory: { name: string; count: number }[];
  byImpact: { level: string; count: number }[];
  teamMemberStats: { name: string; received: number; profileId: string }[];
  recognitionGaps: { name: string; daysSince: number; profileId: string }[];
}

interface RecognitionAnalyticsProps {
  managerId?: string;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function RecognitionAnalytics({ managerId }: RecognitionAnalyticsProps) {
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [managerId]);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetManagerId = managerId || user.id;

      // Get direct reports
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee:profiles!manager_assignments_employee_id_fkey(id, full_name)")
        .eq("manager_id", targetManagerId);

      const directReports = assignments?.map((a: any) => a.employee).filter(Boolean) || [];
      const directReportIds = directReports.map((dr: any) => dr.id);

      if (directReportIds.length === 0) {
        setStats({
          totalGiven: 0,
          totalReceived: 0,
          byCategory: [],
          byImpact: [],
          teamMemberStats: [],
          recognitionGaps: [],
        });
        setLoading(false);
        return;
      }

      // Get recognition given by manager to their reports
      const { data: givenRecognitions } = await supabase
        .from("recognition_notes")
        .select("id, category, impact_level, given_to, created_at")
        .eq("given_by", targetManagerId)
        .in("given_to", directReportIds);

      // Get recognition received by team (from anyone)
      const { data: receivedRecognitions } = await supabase
        .from("recognition_notes")
        .select("id, category, impact_level, given_to, created_at")
        .in("given_to", directReportIds);

      // Calculate stats
      const totalGiven = givenRecognitions?.length || 0;
      const totalReceived = receivedRecognitions?.length || 0;

      // By category
      const categoryCount: Record<string, number> = {};
      receivedRecognitions?.forEach((r) => {
        const cat = r.category || "Uncategorized";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      const byCategory = Object.entries(categoryCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // By impact
      const impactCount: Record<string, number> = {};
      receivedRecognitions?.forEach((r) => {
        const level = r.impact_level || "small_win";
        impactCount[level] = (impactCount[level] || 0) + 1;
      });
      const byImpact = Object.entries(impactCount).map(([level, count]) => ({ level, count }));

      // Team member stats
      const memberRecognitions: Record<string, number> = {};
      directReports.forEach((dr: any) => {
        memberRecognitions[dr.id] = 0;
      });
      receivedRecognitions?.forEach((r) => {
        if (memberRecognitions[r.given_to] !== undefined) {
          memberRecognitions[r.given_to]++;
        }
      });
      const teamMemberStats = directReports.map((dr: any) => ({
        name: dr.full_name,
        received: memberRecognitions[dr.id] || 0,
        profileId: dr.id,
      })).sort((a: any, b: any) => b.received - a.received);

      // Recognition gaps - team members not recognized recently
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRecognitionsByMember: Record<string, Date | null> = {};
      directReports.forEach((dr: any) => {
        recentRecognitionsByMember[dr.id] = null;
      });

      givenRecognitions?.forEach((r) => {
        const currentLatest = recentRecognitionsByMember[r.given_to];
        const thisDate = new Date(r.created_at);
        if (!currentLatest || thisDate > currentLatest) {
          recentRecognitionsByMember[r.given_to] = thisDate;
        }
      });

      const recognitionGaps = directReports
        .map((dr: any) => {
          const lastRecognized = recentRecognitionsByMember[dr.id];
          const daysSince = lastRecognized
            ? Math.floor((Date.now() - lastRecognized.getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          return {
            name: dr.full_name,
            daysSince,
            profileId: dr.id,
          };
        })
        .filter((g: any) => g.daysSince > 14)
        .sort((a: any, b: any) => b.daysSince - a.daysSince);

      setStats({
        totalGiven,
        totalReceived,
        byCategory,
        byImpact,
        teamMemberStats,
        recognitionGaps,
      });
    } catch (error) {
      console.error("Error loading recognition analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const impactLabels: Record<string, string> = {
    small_win: "Small Wins",
    significant: "Significant",
    exceptional: "Exceptional",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Recognition Analytics
        </CardTitle>
        <CardDescription>
          Track recognition patterns across your team
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <Award className="h-4 w-4" />
              <span className="text-sm font-medium">You've Given</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalGiven}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Team Received</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalReceived}</p>
          </div>
        </div>

        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="distribution" className="flex-1">Distribution</TabsTrigger>
            <TabsTrigger value="team" className="flex-1">By Member</TabsTrigger>
            <TabsTrigger value="gaps" className="flex-1">
              Gaps
              {stats.recognitionGaps.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {stats.recognitionGaps.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="distribution" className="pt-4">
            {stats.byCategory.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recognition data yet</p>
              </div>
            )}

            {/* Impact Distribution */}
            {stats.byImpact.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-3">By Impact Level</p>
                <div className="space-y-2">
                  {stats.byImpact.map((item, idx) => {
                    const total = stats.byImpact.reduce((sum, i) => sum + i.count, 0);
                    const percentage = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={item.level} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{impactLabels[item.level] || item.level}</span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="pt-4">
            {stats.teamMemberStats.length > 0 ? (
              <div className="space-y-3">
                {stats.teamMemberStats.map((member, idx) => {
                  const maxReceived = Math.max(...stats.teamMemberStats.map((m) => m.received), 1);
                  const percentage = (member.received / maxReceived) * 100;
                  return (
                    <div key={member.profileId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{member.name}</span>
                        <span className="text-muted-foreground">{member.received} recognition{member.received !== 1 ? "s" : ""}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gaps" className="pt-4">
            {stats.recognitionGaps.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Team members you haven't recognized in a while:
                </p>
                {stats.recognitionGaps.map((gap) => (
                  <div
                    key={gap.profileId}
                    className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{gap.name}</span>
                    </div>
                    <Badge variant="outline" className="text-amber-600">
                      {gap.daysSince > 100 ? "Never" : `${gap.daysSince} days`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-600">Great job!</p>
                <p className="text-sm text-muted-foreground">You've recognized everyone recently</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
