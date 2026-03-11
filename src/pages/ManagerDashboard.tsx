import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, Calendar, TrendingUp, MessageSquare, Award, ClipboardCheck, UserPlus, Compass, ListTodo, BookOpen, Zap, Rocket, FileText } from "lucide-react";
import { IGPDocument } from "@/components/igp/IGPDocument";
import { EmployeeCapabilitiesDialog } from "@/components/EmployeeCapabilitiesDialog";
import { AssignCapabilitiesDialog } from "@/components/AssignCapabilitiesDialog";
import { AdjustCapabilityDialog } from "@/components/AdjustCapabilityDialog";
import { OneOnOneDialog } from "@/components/OneOnOneDialog";
import { RecognitionDialog } from "@/components/RecognitionDialog";
import { ScheduleReviewDialog } from "@/components/ScheduleReviewDialog";
import { ManageMyTeamDialog } from "@/components/ManageMyTeamDialog";
import { ViewGrowthPlanDialog } from "@/components/ViewGrowthPlanDialog";
import { StandardCapWatchlistTab } from "@/components/StandardCapWatchlistTab";
import { TeamAnalytics } from "@/components/TeamAnalytics";
import { TeamDiagnosticSnapshot } from "@/components/TeamDiagnosticSnapshot";
import { ReviewsTab } from "@/components/ReviewsTab";
import { TeamHealthRisks } from "@/components/TeamHealthRisks";
import { useViewAs } from "@/contexts/ViewAsContext";
import { ViewAsCompanyBanner } from "@/components/ViewAsCompanyBanner";
import { ManagerOnboardingWizard } from "@/components/manager-onboarding/ManagerOnboardingWizard";
import { ManagerPriorityActions } from "@/components/ManagerPriorityActions";
import { RecognitionFeed } from "@/components/RecognitionFeed";
import { RecognitionAnalytics } from "@/components/RecognitionAnalytics";
import { RecognitionNudge } from "@/components/RecognitionNudge";
import { ManagerToDoTab } from "@/components/ManagerToDoTab";
import { MeetingRequestsSection } from "@/components/MeetingRequestsSection";

import { ManagerResourcesTab } from "@/components/ManagerResourcesTab";
import { AIEfficiencyReport } from "@/components/AIEfficiencyReport";
import { TeamCareerIntelligence } from "@/components/TeamCareerIntelligence";
import { TelegramEngagementWidget } from "@/components/TelegramEngagementWidget";
import { TelegramConnectCTA } from "@/components/TelegramConnectCTA";


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
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; full_name: string; company_id?: string; email?: string } | null>(null);
  const [capabilitiesDialogOpen, setCapabilitiesDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [oneOnOneDialogOpen, setOneOnOneDialogOpen] = useState(false);
  const [oneOnOneScheduleMode, setOneOnOneScheduleMode] = useState(false);
  
  const [recognitionDialogOpen, setRecognitionDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [manageTeamDialogOpen, setManageTeamDialogOpen] = useState(false);
  const [growthPlanDialogOpen, setGrowthPlanDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("team");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadDirectReports();
  }, [viewAsCompanyId]);

  // Real-time subscription for diagnostic data updates
  useEffect(() => {
    const channel = supabase
      .channel('manager-diagnostics-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diagnostic_responses'
        },
        (payload) => {
          console.log('New diagnostic data received, refreshing manager dashboard...');
          loadDirectReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewAsCompanyId]);

  const loadDirectReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let assignmentsQuery = supabase
        .from("manager_assignments")
        .select(`
          employee_id,
          company_id,
          profiles!manager_assignments_employee_id_fkey (
            id,
            full_name,
            email,
            role
          )
        `);

      // Filter by company if super admin is viewing as a company
      if (viewAsCompanyId) {
        assignmentsQuery = assignmentsQuery.eq("company_id", viewAsCompanyId);
      } else {
        assignmentsQuery = assignmentsQuery.eq("manager_id", user.id);
      }

      const { data: assignments, error: assignError } = await assignmentsQuery;

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

  const handleAssignFromView = () => {
    setCapabilitiesDialogOpen(false);
    setAssignDialogOpen(true);
  };

  const handleOneOnOne = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id, email: employee.email });
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

  const handleViewGrowthPlan = (employee: DirectReport) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setGrowthPlanDialogOpen(true);
  };

  // Helper function for priority actions callbacks
  const handlePriorityOneOnOne = (employee: { id: string; full_name: string; company_id: string }) => {
    const report = directReports.find(r => r.id === employee.id);
    setSelectedEmployee({ 
      id: employee.id, 
      full_name: employee.full_name, 
      company_id: employee.company_id,
      email: report?.email 
    });
    setOneOnOneDialogOpen(true);
  };

  const handlePriorityRecognition = (employee: { id: string; full_name: string; company_id: string }) => {
    setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
    setRecognitionDialogOpen(true);
  };

  const handleViewCapabilityRequests = () => {
    setActiveTab("requests");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Manager Onboarding Wizard */}
      <ManagerOnboardingWizard
        onManageTeam={() => setManageTeamDialogOpen(true)}
        onStartOneOnOne={(employee) => {
          setSelectedEmployee({
            id: employee.id,
            full_name: employee.full_name,
            company_id: employee.company_id,
            email: employee.email,
          });
          setOneOnOneDialogOpen(true);
        }}
        onViewCapabilities={(employee) => {
          setSelectedEmployee({ id: employee.id, full_name: employee.full_name, company_id: employee.company_id });
          setCapabilitiesDialogOpen(true);
        }}
      />

      <ViewAsCompanyBanner />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-primary p-8 text-primary-foreground shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full -ml-24 -mb-24" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Manager Dashboard</h1>
              <p className="text-primary-foreground/90 text-lg">
                Lead, develop, and empower your team
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground px-6 py-3 rounded-lg shadow-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <div>
                    <div className="text-2xl font-bold">{directReports.length}</div>
                    <div className="text-xs opacity-90">Direct Reports</div>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setManageTeamDialogOpen(true)}
                variant="accent"
                size="lg"
                className="shadow-lg"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Connect CTA */}
      <TelegramConnectCTA variant="card" />

      {/* Telegram Engagement Widget */}
      <TelegramEngagementWidget />

      {/* Recognition Nudge */}
      <RecognitionNudge onRecognize={handlePriorityRecognition} />

      {/* Meeting Requests from Team Members */}
      <MeetingRequestsSection 
        onScheduleMeeting={(employeeId, employeeName) => {
          const dr = directReports.find(r => r.id === employeeId);
          if (dr) {
            setSelectedEmployee({ id: employeeId, full_name: employeeName, company_id: dr.company_id, email: dr.email });
            setOneOnOneDialogOpen(true);
          }
        }}
      />

      {/* Priority Actions - New Quick Action Panel */}
      <ManagerPriorityActions
        onStartOneOnOne={handlePriorityOneOnOne}
        onViewCapabilityRequests={handleViewCapabilityRequests}
        onGiveRecognition={handlePriorityRecognition}
        onViewToDoTab={() => setActiveTab("todo")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team">Team Overview</TabsTrigger>
          <TabsTrigger value="todo" className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            To-Do
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="recognition">Recognition</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="career" className="flex items-center gap-1">
            <Rocket className="h-3 w-3" />
            Career Intel
          </TabsTrigger>
          <TabsTrigger value="ai-efficiency" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            AI Efficiency
          </TabsTrigger>
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
                <Card key={report.id} className="hover:shadow-lg transition-all hover:border-accent/50 border-l-4 border-l-accent/30">
                  <CardHeader className="bg-gradient-to-br from-card to-accent/5 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {report.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <div>{report.full_name}</div>
                        <div className="text-xs text-muted-foreground font-normal">{report.role}</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Target className="h-4 w-4 text-accent" />
                          Capabilities
                        </span>
                        <Badge variant="secondary" className="font-bold">
                          {report.capability_count}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-accent" />
                          Goals Progress
                        </span>
                        <Badge variant="secondary" className="font-bold">
                          {report.completed_goals}/{report.total_goals}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm text-muted-foreground">Diagnostic</span>
                        <Badge variant={report.has_diagnostic ? "default" : "outline"}>
                          {report.has_diagnostic ? "✓ Complete" : "⏳ Pending"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                        <IGPDocument
                          profileId={report.id}
                          employeeName={report.full_name}
                          variant="button"
                        />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOneOnOne(report)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          1-on-1
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
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
                                          variant="accent"
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

        <TabsContent value="todo" className="space-y-4">
          <ManagerToDoTab
            onStartOneOnOne={(employee) => {
              setSelectedEmployee({
                id: employee.id,
                full_name: employee.full_name,
                company_id: employee.company_id,
                email: employee.email
              });
              setOneOnOneScheduleMode(false);
              setOneOnOneDialogOpen(true);
            }}
            onScheduleOneOnOne={(employee) => {
              setSelectedEmployee({
                id: employee.id,
                full_name: employee.full_name,
                company_id: employee.company_id,
                email: employee.email
              });
              setOneOnOneScheduleMode(true);
              setOneOnOneDialogOpen(true);
            }}
            onScheduleReview={(employee) => {
              setSelectedEmployee({
                id: employee.id,
                full_name: employee.full_name,
                company_id: employee.company_id
              });
              setReviewDialogOpen(true);
            }}
            onViewRequest={() => setActiveTab("requests")}
          />
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <ManagerResourcesTab employee={selectedEmployee} />
        </TabsContent>

        <TabsContent value="recognition" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <RecognitionFeed />
            <RecognitionAnalytics />
          </div>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-4">
          <StandardCapWatchlistTab />
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <TeamHealthRisks 
            onScheduleOneOnOne={(employeeId, employeeName) => {
              const employee = directReports.find(r => r.id === employeeId);
              if (employee) {
                setSelectedEmployee({ 
                  id: employee.id, 
                  full_name: employee.full_name,
                  company_id: employee.company_id 
                });
                setOneOnOneDialogOpen(true);
              }
            }}
          />
          <TeamDiagnosticSnapshot />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <TeamAnalytics />
        </TabsContent>

        <TabsContent value="career" className="space-y-4">
          <TeamCareerIntelligence />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>

        <TabsContent value="ai-efficiency">
          <AIEfficiencyReport />
        </TabsContent>
      </Tabs>

      {selectedEmployee && (
        <>
          <EmployeeCapabilitiesDialog
            open={capabilitiesDialogOpen}
            onOpenChange={setCapabilitiesDialogOpen}
            employee={selectedEmployee}
            onAssignClick={handleAssignFromView}
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
          {selectedEmployee && (
            <ViewGrowthPlanDialog
              open={growthPlanDialogOpen}
              onOpenChange={setGrowthPlanDialogOpen}
              employee={selectedEmployee}
            />
          )}
          {selectedEmployee?.company_id && (
            <>
              <OneOnOneDialog
                open={oneOnOneDialogOpen}
                onOpenChange={(open) => {
                  setOneOnOneDialogOpen(open);
                  if (!open) {
                    setOneOnOneScheduleMode(false);
                    loadDirectReports();
                  }
                }}
                employee={{
                  id: selectedEmployee.id,
                  full_name: selectedEmployee.full_name,
                  company_id: selectedEmployee.company_id,
                  email: selectedEmployee.email,
                }}
                scheduleOnly={oneOnOneScheduleMode}
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
