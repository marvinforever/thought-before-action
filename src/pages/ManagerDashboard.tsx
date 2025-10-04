import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, Calendar, TrendingUp, MessageSquare, Award, ClipboardCheck, UserPlus } from "lucide-react";
import { EmployeeCapabilitiesDialog } from "@/components/EmployeeCapabilitiesDialog";
import { AssignCapabilitiesDialog } from "@/components/AssignCapabilitiesDialog";
import { AdjustCapabilityDialog } from "@/components/AdjustCapabilityDialog";
import { OneOnOneDialog } from "@/components/OneOnOneDialog";
import { RecognitionDialog } from "@/components/RecognitionDialog";
import { ScheduleReviewDialog } from "@/components/ScheduleReviewDialog";
import { ManageMyTeamDialog } from "@/components/ManageMyTeamDialog";

type DirectReport = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  has_diagnostic: boolean;
  capability_count: number;
  completed_goals: number;
  total_goals: number;
  company_id: string;
};

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; full_name: string; company_id?: string } | null>(null);
  const [capabilitiesDialogOpen, setCapabilitiesDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [oneOnOneDialogOpen, setOneOnOneDialogOpen] = useState(false);
  const [recognitionDialogOpen, setRecognitionDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [manageTeamDialogOpen, setManageTeamDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkManagerAccess();
    loadDirectReports();
  }, []);

  const checkManagerAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["manager", "admin", "super_admin"]);

    if (!roles || roles.length === 0) {
      toast({
        title: "Access Denied",
        description: "You need manager access to view this page",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const loadDirectReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get direct reports
      const { data: assignments, error: assignError } = await supabase
        .from("manager_assignments")
        .select(`
          employee_id,
          profiles!manager_assignments_employee_id_fkey (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq("manager_id", user.id);

      if (assignError) throw assignError;

      // Get capability and goal counts for each report
      const reportsWithStats = await Promise.all(
        (assignments || []).map(async (assignment: any) => {
          const employeeId = assignment.employee_id;
          const profile = assignment.profiles;

          // Get capability count
          const { count: capCount } = await supabase
            .from("employee_capabilities")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", employeeId);

          // Get diagnostic status
          const { count: diagCount } = await supabase
            .from("diagnostic_responses")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", employeeId);

          // Get goals
          const { data: goals } = await supabase
            .from("ninety_day_targets")
            .select("completed")
            .eq("profile_id", employeeId);

          const completedGoals = goals?.filter(g => g.completed).length || 0;
          const totalGoals = goals?.length || 0;

          return {
            id: profile.id,
            full_name: profile.full_name || "Unknown",
            email: profile.email || "",
            role: profile.role || "Employee",
            has_diagnostic: (diagCount || 0) > 0,
            capability_count: capCount || 0,
            completed_goals: completedGoals,
            total_goals: totalGoals,
            company_id: assignment.company_id,
          };
        })
      );

      setDirectReports(reportsWithStats);
    } catch (error: any) {
      toast({
        title: "Error loading reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewCapabilities = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setCapabilitiesDialogOpen(true);
  };

  const handleAssignCapabilities = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setAssignDialogOpen(true);
  };

  const handleOneOnOne = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setOneOnOneDialogOpen(true);
  };

  const handleRecognition = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setRecognitionDialogOpen(true);
  };

  const handleScheduleReview = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setReviewDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage and develop your team
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2">
            <Users className="h-4 w-4 mr-2" />
            {directReports.length} Direct Reports
          </Badge>
          <Button onClick={() => setManageTeamDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Manage Team
          </Button>
        </div>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">Team Overview</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Loading team data...
              </CardContent>
            </Card>
          ) : directReports.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No direct reports assigned yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {directReports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{report.full_name}</CardTitle>
                    <CardDescription>{report.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Capabilities</span>
                        <Badge variant="secondary">
                          <Target className="h-3 w-3 mr-1" />
                          {report.capability_count}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Goals Progress</span>
                        <Badge variant="secondary">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {report.completed_goals}/{report.total_goals}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Diagnostic</span>
                        <Badge variant={report.has_diagnostic ? "default" : "outline"}>
                          {report.has_diagnostic ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleOneOnOne(report)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          1-on-1
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleRecognition(report)}
                        >
                          <Award className="h-3 w-3 mr-1" />
                          Recognize
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleViewCapabilities(report)}
                        >
                          View Caps
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleScheduleReview(report)}
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="capabilities">
          <Card>
            <CardHeader>
              <CardTitle>Team Capabilities Overview</CardTitle>
              <CardDescription>
                View and manage capabilities across your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Capability matrix coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Performance Reviews</CardTitle>
              <CardDescription>
                Schedule and manage performance reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Review scheduling coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedEmployee && (
        <>
          <EmployeeCapabilitiesDialog
            open={capabilitiesDialogOpen}
            onOpenChange={setCapabilitiesDialogOpen}
            employee={selectedEmployee}
          />
          <AssignCapabilitiesDialog
            open={assignDialogOpen}
            onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) {
                loadDirectReports();
              }
            }}
            employee={selectedEmployee}
          />
          {selectedEmployee.company_id && (
            <>
              <OneOnOneDialog
                open={oneOnOneDialogOpen}
                onOpenChange={(open) => {
                  setOneOnOneDialogOpen(open);
                  if (!open) loadDirectReports();
                }}
                employee={{
                  id: selectedEmployee.id,
                  full_name: selectedEmployee.full_name,
                  company_id: selectedEmployee.company_id
                }}
              />
              <RecognitionDialog
                open={recognitionDialogOpen}
                onOpenChange={setRecognitionDialogOpen}
                employee={{
                  id: selectedEmployee.id,
                  full_name: selectedEmployee.full_name,
                  company_id: selectedEmployee.company_id
                }}
              />
              <ScheduleReviewDialog
                open={reviewDialogOpen}
                onOpenChange={(open) => {
                  setReviewDialogOpen(open);
                  if (!open) loadDirectReports();
                }}
                employee={{
                  id: selectedEmployee.id,
                  full_name: selectedEmployee.full_name,
                  company_id: selectedEmployee.company_id
                }}
              />
            </>
          )}
        </>
      )}

      <ManageMyTeamDialog
        open={manageTeamDialogOpen}
        onOpenChange={setManageTeamDialogOpen}
        onTeamUpdated={loadDirectReports}
      />
    </div>
  );
}
