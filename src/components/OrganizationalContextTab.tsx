import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Target, BookOpen, Sparkles } from "lucide-react";
import { OrganizationalGrowthDesign } from "@/components/OrganizationalGrowthDesign";

export const OrganizationalContextTab = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyStats, setCompanyStats] = useState<any>(null);

  useEffect(() => {
    checkPermissions();
    if (!isAdmin && !isManager) {
      loadCompanyStats();
    }
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.is_admin || false);

      // Check if user is a manager
      const { data: managerData } = await supabase
        .from("manager_assignments")
        .select("id")
        .eq("manager_id", user.id)
        .limit(1);

      setIsManager(managerData && managerData.length > 0);
    } catch (error) {
      console.error("Error checking permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return;

      // Get company-wide stats
      const { data: employees } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", profile.company_id);

      const employeeIds = employees?.map(e => e.id) || [];

      const [capabilitiesRes, roadmapsRes, resourcesRes] = await Promise.all([
        supabase
          .from("employee_capabilities")
          .select("id, target_level")
          .in("profile_id", employeeIds),
        supabase
          .from("learning_roadmaps")
          .select("profile_id")
          .in("profile_id", employeeIds),
        supabase
          .from("content_recommendations")
          .select("id")
          .in("profile_id", employeeIds)
          .eq("status", "completed"),
      ]);

      setCompanyStats({
        totalEmployees: employees?.length || 0,
        totalCapabilities: capabilitiesRes.data?.length || 0,
        activeRoadmaps: new Set(roadmapsRes.data?.map(r => r.profile_id)).size,
        completedResources: resourcesRes.data?.length || 0,
      });
    } catch (error) {
      console.error("Error loading company stats:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Full view for admins and managers
  if (isAdmin || isManager) {
    return <OrganizationalGrowthDesign />;
  }

  // Read-only view for regular employees
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Company Growth Initiatives</h2>
        <p className="text-muted-foreground mt-1">
          See how your growth fits into the bigger picture
        </p>
      </div>

      {companyStats && (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companyStats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Growing together</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Roadmaps</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companyStats.activeRoadmaps}</div>
                <Progress 
                  value={(companyStats.activeRoadmaps / companyStats.totalEmployees) * 100} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Capabilities</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companyStats.totalCapabilities}</div>
                <p className="text-xs text-muted-foreground">Being developed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Learning</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companyStats.completedResources}</div>
                <p className="text-xs text-muted-foreground">Resources completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Inspiration Section */}
          <Card>
            <CardHeader>
              <CardTitle>Your Impact on Organizational Growth</CardTitle>
              <CardDescription>
                Every capability you develop contributes to our collective success
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium mb-1">Why Your Growth Matters</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• You're part of {companyStats.activeRoadmaps} team members actively developing their skills</li>
                      <li>• Together, we're building {companyStats.totalCapabilities} capabilities across the organization</li>
                      <li>• Our team has completed {companyStats.completedResources} learning resources collectively</li>
                      <li>• Your personal development directly contributes to our company's competitive advantage</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
                <h4 className="font-medium mb-2">Stay Focused on Your Growth</h4>
                <p className="text-sm text-muted-foreground">
                  Keep working on your personal roadmap and capabilities. As you grow, you help 
                  lift the entire team. Check your Strategic Roadmap and AI Learning Roadmap tabs 
                  to continue your development journey.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
