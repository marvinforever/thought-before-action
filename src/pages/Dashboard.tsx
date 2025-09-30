import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, BookOpen, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    employees: 0,
    capabilities: 0,
    resources: 0,
    diagnosticsCompleted: 0,
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

      const [employeesRes, capabilitiesRes, resourcesRes, diagnosticsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }).eq("company_id", profile.company_id),
        supabase.from("capabilities").select("id", { count: "exact" }),
        supabase.from("resources").select("id", { count: "exact" }).eq("company_id", profile.company_id),
        supabase.from("diagnostic_responses").select("id", { count: "exact" }).eq("company_id", profile.company_id),
      ]);

      setStats({
        employees: employeesRes.count || 0,
        capabilities: capabilitiesRes.count || 0,
        resources: resourcesRes.count || 0,
        diagnosticsCompleted: diagnosticsRes.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: "Total Employees", value: stats.employees, icon: Users, color: "text-blue-600" },
    { title: "Capabilities", value: stats.capabilities, icon: Target, color: "text-green-600" },
    { title: "Resources", value: stats.resources, icon: BookOpen, color: "text-purple-600" },
    { title: "Diagnostics Completed", value: stats.diagnosticsCompleted, icon: TrendingUp, color: "text-orange-600" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your team's capabilities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Jericho Lite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Get started by importing your employee diagnostic data and setting up your capability framework.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold">Quick Start Guide:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Import employee diagnostic data from your Typeform CSV</li>
              <li>Review and manage your capabilities framework</li>
              <li>Add learning resources to your library</li>
              <li>Let AI match employees to capabilities</li>
              <li>Send personalized learning recommendations</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;