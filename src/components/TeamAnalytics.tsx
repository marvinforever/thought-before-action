import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Target, Award, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function TeamAnalytics() {
  const [loading, setLoading] = useState(true);
  const [capabilityDistribution, setCapabilityDistribution] = useState<any[]>([]);
  const [growthTrends, setGrowthTrends] = useState<any[]>([]);
  const [teamMetrics, setTeamMetrics] = useState({
    totalMembers: 0,
    avgCapabilities: 0,
    goalCompletionRate: 0,
    recognitionCount: 0,
    oneOnOneCount: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get direct reports
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      const employeeIds = assignments?.map(a => a.employee_id) || [];

      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Load capability distribution
      const { data: capabilities } = await supabase
        .from("employee_capabilities")
        .select(`
          current_level,
          capability_id,
          capabilities (name, category)
        `)
        .in("profile_id", employeeIds);

      // Aggregate by level
      const levelCounts = capabilities?.reduce((acc: any, cap: any) => {
        const level = cap.current_level || 'unassigned';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      const distributionData = Object.entries(levelCounts || {}).map(([level, count]) => ({
        level,
        count,
      }));
      setCapabilityDistribution(distributionData);

      // Load growth trends (capability adjustments over last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: adjustments } = await supabase
        .from("capability_adjustments")
        .select("created_at, new_level")
        .in("profile_id", employeeIds)
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      // Group by month
      const monthlyGrowth = adjustments?.reduce((acc: any, adj: any) => {
        const month = new Date(adj.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!acc[month]) {
          acc[month] = { month, adjustments: 0 };
        }
        acc[month].adjustments += 1;
        return acc;
      }, {});

      setGrowthTrends(Object.values(monthlyGrowth || {}));

      // Load team metrics
      const { data: goals } = await supabase
        .from("ninety_day_targets")
        .select("completed")
        .in("profile_id", employeeIds);

      const completedGoals = goals?.filter(g => g.completed).length || 0;
      const totalGoals = goals?.length || 0;

      const { count: recognitionCount } = await supabase
        .from("recognition_notes")
        .select("*", { count: "exact", head: true })
        .in("given_to", employeeIds);

      const { count: oneOnOneCount } = await supabase
        .from("one_on_one_notes")
        .select("*", { count: "exact", head: true })
        .in("employee_id", employeeIds);

      const avgCaps = capabilities?.length ? capabilities.length / employeeIds.length : 0;

      setTeamMetrics({
        totalMembers: employeeIds.length,
        avgCapabilities: Math.round(avgCaps * 10) / 10,
        goalCompletionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
        recognitionCount: recognitionCount || 0,
        oneOnOneCount: oneOnOneCount || 0,
      });

    } catch (error: any) {
      toast({
        title: "Error loading analytics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading analytics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Capabilities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.avgCapabilities}</div>
            <p className="text-xs text-muted-foreground">per team member</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.goalCompletionRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognition Given</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.recognitionCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1-on-1 Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.oneOnOneCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="distribution" className="space-y-4">
        <TabsList>
          <TabsTrigger value="distribution">Capability Levels</TabsTrigger>
          <TabsTrigger value="growth">Growth Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Capability Level Distribution</CardTitle>
              <CardDescription>
                How your team's capabilities are distributed across proficiency levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capabilityDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={capabilityDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Capabilities" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No capability data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Growth Trends</CardTitle>
              <CardDescription>
                Capability adjustments over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              {growthTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="adjustments" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Level Changes"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No growth data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
