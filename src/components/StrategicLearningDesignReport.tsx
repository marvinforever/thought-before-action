import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RefreshCw,
  Download,
  Users,
  Award,
  AlertCircle,
  Info,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BusinessGoalsDialog from "@/components/BusinessGoalsDialog";
import { EmployeeCapabilitiesDialog } from "@/components/EmployeeCapabilitiesDialog";
import { useViewAs } from "@/contexts/ViewAsContext";
import { OrganizationalCapabilityScore } from "@/components/OrganizationalCapabilityScore";

type Report = {
  id: string;
  company_id: string;
  executive_summary: any;
  budget_scenarios: any;
  roi_projections: any;
  cohorts: any;
  narrative: string;
  generated_at: string;
  expires_at: string;
};

type Cohort = {
  id: string;
  cohort_name: string;
  capability_name: string;
  capability_id?: string;
  employee_ids: string[];
  employee_count: number;
  priority: number;
  current_level: string;
  target_level: string;
  gap_severity: string;
  recommended_solutions: any[];
  estimated_cost_conservative: number;
  estimated_cost_moderate: number;
  estimated_cost_aggressive: number;
  delivery_quarter: string;
};

export default function StrategicLearningDesignReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [employeeProfiles, setEmployeeProfiles] = useState<Map<string, { full_name: string; email: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [timeframe, setTimeframe] = useState<string>("3");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);
  const [capabilityDialogOpen, setCapabilityDialogOpen] = useState(false);
  const [capabilityDetails, setCapabilityDetails] = useState<any>(null);
  const [employeesByLevel, setEmployeesByLevel] = useState<Record<string, string[]>>({});
  const [orgCapabilities, setOrgCapabilities] = useState<Array<{ current_level: string; target_level: string }>>([]);
  const [cohortCapabilities, setCohortCapabilities] = useState<Record<string, Array<{ current_level: string; target_level: string }>>>({});
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadReport();
  }, [viewAsCompanyId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine company ID (either from viewAs context or user's profile)
      let companyId = viewAsCompanyId;
      
      if (!companyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) return;
        companyId = profile.company_id;
      }

      // Get latest report for this company
      const { data: latestReport, error: reportError } = await supabase
        .from("strategic_learning_reports" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reportError) throw reportError;

      if (latestReport) {
        setReport(latestReport as any);
        // timeframe_years was removed from schema, default to 3 years
        setTimeframe("3");

        // Load cohorts from table; fallback to report.cohorts JSON if table is empty
        const { data: cohortData, error: cohortError } = await supabase
          .from("training_cohorts" as any)
          .select("*")
          .eq("report_id", (latestReport as any).id)
          .order("priority");

        if (cohortError) throw cohortError;

        const sourceCohorts = (cohortData && cohortData.length > 0)
          ? cohortData
          : ((latestReport as any).cohorts || []);

        setCohorts((sourceCohorts as any) || []);

        // Load organizational capability scores
        await loadOrganizationalScores(companyId, sourceCohorts);

        // Extract all unique employee IDs from cohorts and fetch their profiles
        if (sourceCohorts && sourceCohorts.length > 0) {
          const allEmployeeIds = new Set<string>();
          (sourceCohorts as any[]).forEach((cohort: any) => {
            if (cohort.employee_ids && Array.isArray(cohort.employee_ids)) {
              cohort.employee_ids.forEach((id: string) => allEmployeeIds.add(id));
            }
          });

        if (allEmployeeIds.size > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", Array.from(allEmployeeIds));

            if (profilesError) {
              console.error("Error fetching employee profiles:", profilesError);
            } else if (profilesData) {
              const profileMap = new Map<string, { full_name: string; email: string }>();
              profilesData.forEach((profile: any) => {
                profileMap.set(profile.id, {
                  full_name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
                  email: profile.email || '',
                });
              });
              setEmployeeProfiles(profileMap);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading report:", error);
      toast({
        title: "Error loading report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      toast({ title: "Generating report...", description: "This may take a minute" });

      // Determine effective company ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      let effectiveCompanyId = viewAsCompanyId;
      if (!effectiveCompanyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();
        effectiveCompanyId = profile?.company_id;
      }

      const { data, error } = await supabase.functions.invoke("generate-strategic-learning-design", {
        body: {
          timeframe_years: parseInt(timeframe),
          force_regenerate: true,
          viewAsCompanyId: effectiveCompanyId,
        },
      });

      if (error) throw error;

      if (data.cached) {
        toast({ title: "Using cached report", description: "Loaded existing report" });
      } else {
        toast({ title: "Report generated!", description: "Strategic Learning Design is ready" });
      }

      setReport(data.report);
      if (data.cohorts) setCohorts(data.cohorts);
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const loadCapabilityDetails = async (capabilityName: string, employeeIds: string[]) => {
    try {
      // Find the capability by name
      const { data: capability, error: capError } = await supabase
        .from("capabilities")
        .select("*")
        .eq("name", capabilityName)
        .single();

      if (capError) throw capError;

      setCapabilityDetails(capability);

      // Get employee capabilities for these employees
      const { data: empCaps, error: empError } = await supabase
        .from("employee_capabilities")
        .select("profile_id, current_level")
        .in("profile_id", employeeIds)
        .eq("capability_id", capability.id);

      if (empError) throw empError;

      // Group employees by level
      const byLevel: Record<string, string[]> = {};
      empCaps?.forEach((ec: any) => {
        const level = ec.current_level || "Not Assessed";
        if (!byLevel[level]) {
          byLevel[level] = [];
        }
        byLevel[level].push(ec.profile_id);
      });

      setEmployeesByLevel(byLevel);
      setCapabilityDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading capability details:", error);
      toast({
        title: "Error loading capability",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const cleanCohortName = (name: string) => {
    return name.replace(/\s*hot\s*spot\s*/gi, '').trim();
  };

  const loadOrganizationalScores = async (companyId: string, cohortsData: any[]) => {
    try {
      // Get all employee capabilities for this company
      const { data: allEmployeeCaps, error: allCapsError } = await supabase
        .from("employee_capabilities")
        .select(`
          current_level,
          target_level,
          profile_id,
          capability_id,
          capability:capabilities(name)
        `)
        .in("profile_id", (await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId)
        ).data?.map(p => p.id) || []);

      if (allCapsError) throw allCapsError;

      setOrgCapabilities(allEmployeeCaps || []);

      // Calculate scores for each cohort
      const cohortScores: Record<string, Array<{ current_level: string; target_level: string }>> = {};
      
      for (const cohort of cohortsData) {
        if (!cohort.employee_ids || cohort.employee_ids.length === 0) continue;

        // Find the capability ID for this cohort
        const { data: capability } = await supabase
          .from("capabilities")
          .select("id")
          .eq("name", cohort.capability_name)
          .single();

        if (capability) {
          const { data: cohortCaps } = await supabase
            .from("employee_capabilities")
            .select("current_level, target_level")
            .in("profile_id", cohort.employee_ids)
            .eq("capability_id", capability.id);

          if (cohortCaps && cohortCaps.length > 0) {
            cohortScores[cohort.id] = cohortCaps;
          }
        }
      }

      setCohortCapabilities(cohortScores);
    } catch (error: any) {
      console.error("Error loading organizational scores:", error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportForClaude = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Helper function to add text with word wrap
      const addText = (text: string, fontSize = 11, isBold = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
        
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += fontSize * 0.5;
        });
        yPosition += 5;
      };

      // Helper to calculate capability scores
      const LEVEL_MAP: Record<string, number> = {
        foundational: 1.0, beginner: 1.0,
        advancing: 2.0, intermediate: 2.0,
        independent: 3.0, advanced: 3.0, established: 3.0,
        mastery: 4.0, expert: 4.0,
      };
      
      const normalizeLevel = (level: string): number => {
        const normalized = level.toLowerCase();
        return LEVEL_MAP[normalized] || 1.0;
      };

      const calculateScore = (caps: Array<{ current_level: string; target_level: string }>) => {
        if (caps.length === 0) return { current: 0, target: 0, percentage: 0 };
        const totalCurrent = caps.reduce((sum, cap) => sum + normalizeLevel(cap.current_level), 0);
        const totalTarget = caps.reduce((sum, cap) => sum + normalizeLevel(cap.target_level), 0);
        const avgCurrent = totalCurrent / caps.length;
        const avgTarget = totalTarget / caps.length;
        return {
          current: Math.round(avgCurrent * 100),
          target: Math.round(avgTarget * 100),
          percentage: Math.round(((avgCurrent - 1) / 3) * 100)
        };
      };

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Strategic Learning Design Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date(report.generated_at).toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Organizational Capability Score
      if (orgCapabilities.length > 0) {
        addText('ORGANIZATIONAL CAPABILITY SCORE', 14, true);
        const orgScore = calculateScore(orgCapabilities);
        addText(`Current Score: ${orgScore.current} / 400`);
        addText(`Target Score: ${orgScore.target} / 400`);
        addText(`Progress: ${orgScore.percentage}%`);
        yPosition += 5;

        // Scores by Category
        const capsByCategory: Record<string, Array<{ current_level: string; target_level: string; name: string }>> = {};
        
        // Get all employee capabilities with category info
        for (const cohort of cohorts) {
          if (cohort.capability_id) {
            const { data: capability } = await supabase
              .from('capabilities')
              .select('category')
              .eq('id', cohort.capability_id)
              .single();
            
            if (capability?.category) {
              if (!capsByCategory[capability.category]) {
                capsByCategory[capability.category] = [];
              }
              
              const cohortScore = cohortCapabilities[cohort.id];
              if (cohortScore && cohortScore.length > 0) {
                capsByCategory[capability.category].push(...cohortScore.map((c: any) => ({
                  ...c,
                  name: cohort.capability_name
                })));
              }
            }
          }
        }

        if (Object.keys(capsByCategory).length > 0) {
          addText('Capability Scores by Category:', 12, true);
          Object.entries(capsByCategory).forEach(([category, caps]) => {
            const categoryScore = calculateScore(caps);
            addText(`${category}: ${categoryScore.current} / 400 (Target: ${categoryScore.target})`, 10);
          });
          yPosition += 5;
        }
      }

      // Executive Summary
      addText('EXECUTIVE SUMMARY', 14, true);
      const summary = report.executive_summary;
      addText(`Total Employees: ${summary.total_employees}`);
      addText(`Employees Needing Training: ${summary.employees_needing_training}`);
      addText(`Total Training Cohorts: ${summary.total_cohorts}`);
      yPosition += 5;
      
      if (summary.narrative) {
        addText('Overview:', 12, true);
        addText(summary.narrative);
      }

      // Top Priorities
      if (summary.top_priorities && summary.top_priorities.length > 0) {
        addText('Top Priorities:', 12, true);
        summary.top_priorities.forEach((priority: any, index: number) => {
          addText(`${index + 1}. ${priority.capability} - ${priority.employees_affected} employees affected`);
        });
        yPosition += 5;
      }

      // Heavy Load Employees (Hot Spots)
      if (summary.heavy_load_employees && summary.heavy_load_employees.length > 0) {
        addText('EMPLOYEES WITH HEAVY TRAINING LOAD', 14, true);
        summary.heavy_load_employees.forEach((emp: any) => {
          const profile = employeeProfiles.get(emp.employee_id);
          addText(`${profile?.full_name || 'Unknown'} - ${emp.cohort_count} training cohorts`, 11, true);
          if (emp.cohorts && emp.cohorts.length > 0) {
            emp.cohorts.forEach((cohort: string) => {
              addText(`  • ${cohort}`, 10);
            });
          }
          yPosition += 3;
        });
      }

      // Training Cohorts
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }
      
      addText('TRAINING COHORTS', 14, true);
      cohorts.forEach((cohort, index) => {
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }
        
        addText(`${index + 1}. ${cohort.cohort_name}`, 12, true);
        addText(`Capability: ${cohort.capability_name}`);
        addText(`Employee Count: ${cohort.employee_count}`);
        addText(`Current Level: ${cohort.current_level} → Target Level: ${cohort.target_level}`);
        
        if (cohort.employee_ids && cohort.employee_ids.length > 0) {
          addText('Participants:', 11, true);
          cohort.employee_ids.forEach(id => {
            const profile = employeeProfiles.get(id);
            if (profile) {
              addText(`  • ${profile.full_name}`, 10);
            }
          });
        }
        
        // Add cohort capability score if available
        if (cohortCapabilities[cohort.id]) {
          const cohortScore = calculateScore(cohortCapabilities[cohort.id]);
          addText(`Cohort Score: ${cohortScore.current} / 400 (Target: ${cohortScore.target})`, 10);
        }
        
        yPosition += 5;
      });

      // Full Narrative
      if (report.narrative) {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }
        addText('DETAILED ANALYSIS', 14, true);
        addText(report.narrative);
      }

      // Save the PDF
      doc.save(`strategic-learning-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Export complete",
        description: "Strategic Learning Design Report exported as PDF",
      });
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Strategic Learning Design...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>No Strategic Learning Design Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Generate your first Strategic Learning Design report to identify training needs across your organization.</p>
            <div className="flex items-center gap-4">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year Plan</SelectItem>
                  <SelectItem value="2">2 Year Plan</SelectItem>
                  <SelectItem value="3">3 Year Plan</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generateReport} disabled={generating}>
                {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = report.executive_summary;
  const scenarios = report.budget_scenarios;
  const roi = report.roi_projections;

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2">Strategic Learning Design</h1>
          <p className="text-muted-foreground">
            Organizational Training Roadmap
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Generated: {new Date(report.generated_at).toLocaleDateString()} • 
            Next refresh: {new Date(report.expires_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Year</SelectItem>
              <SelectItem value="2">2 Years</SelectItem>
              <SelectItem value="3">3 Years</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={generating} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportForClaude}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Organizational Capability Score */}
      {orgCapabilities.length > 0 && (
        <OrganizationalCapabilityScore 
          capabilities={orgCapabilities}
          title="Company Capability Score"
          showBreakdown={true}
          variant="full"
        />
      )}

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_employees}</div>
            <p className="text-xs text-muted-foreground">
              {summary.employees_needing_training} need training
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Groups</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cohorts.filter(c => c.employee_count >= 4).length}</div>
            <p className="text-xs text-muted-foreground">Minimum 4 people each</p>
          </CardContent>
        </Card>
      </div>

      {/* Business Drivers Button */}
      <div className="flex justify-center -mt-2 mb-4">
        <BusinessGoalsDialog />
      </div>

      <Tabs defaultValue="narrative" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="narrative">Executive Summary</TabsTrigger>
          <TabsTrigger value="cohorts">Training Groups</TabsTrigger>
        </TabsList>

        {/* Executive Narrative */}
        <TabsContent value="narrative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategic Learning Design Overview</CardTitle>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <p className="whitespace-pre-wrap">{summary.narrative}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Priority Action Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.top_priorities?.map((priority: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <span>{priority}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {summary.heavy_load_employees && summary.heavy_load_employees.length > 0 && (
            <Card className="border-yellow-500 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Heavy Training Load Warning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm">
                  These employees are scheduled for 3+ Year 1 cohorts. Consider spreading their development across multiple years:
                </p>
                <div className="space-y-2">
                  {summary.heavy_load_employees.map((emp: any) => (
                    <div key={emp.id} className="flex items-center justify-between p-2 bg-white rounded">
                      <span className="font-medium">{emp.name}</span>
                      <Badge variant="outline" className="bg-yellow-100">
                        {emp.cohort_count} cohorts
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Training Groups */}
        <TabsContent value="cohorts" className="space-y-4">
          {cohorts.filter(c => c.employee_count >= 4).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No training groups found (minimum 4 people per group)
              </CardContent>
            </Card>
          ) : (
            cohorts.filter(c => c.employee_count >= 4).map((cohort) => {
              return (
                <Card key={cohort.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xl">🔥</span>
                          <button
                            onClick={() => loadCapabilityDetails(cohort.capability_name, cohort.employee_ids)}
                            className="text-left hover:underline hover:text-primary transition-colors"
                          >
                            {cleanCohortName(cohort.cohort_name)}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => loadCapabilityDetails(cohort.capability_name, cohort.employee_ids)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {cohort.employee_count} employees
                          </span>
                          <span>•</span>
                          <span>{cohort.current_level} → {cohort.target_level}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                   <CardContent className="space-y-4">
                    {/* Cohort Score */}
                    {cohortCapabilities[cohort.id] && cohortCapabilities[cohort.id].length > 0 && (
                      <OrganizationalCapabilityScore 
                        capabilities={cohortCapabilities[cohort.id]}
                        title="Training Group Score"
                        showBreakdown={false}
                        variant="compact"
                      />
                    )}

                    {/* Why This Training */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Why This Training</p>
                      <p className="text-sm">
                        Multiple employees need development in this capability area. Training this group together creates efficiency and builds shared competency across the team.
                      </p>
                    </div>

                    {/* Employees */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Participants</p>
                      <div className="flex flex-wrap gap-2">
                        {cohort.employee_ids.slice(0, 15).map((id, i) => {
                          const profile = employeeProfiles.get(id);
                          const displayName = profile?.full_name || `Employee ${i + 1}`;
                          return (
                            <Badge 
                              key={id} 
                              variant="secondary" 
                              title={profile?.email}
                              className="cursor-pointer hover:bg-secondary/80 transition-colors"
                              onClick={() => setSelectedEmployeeId(id)}
                            >
                              {displayName}
                            </Badge>
                          );
                        })}
                        {cohort.employee_ids.length > 15 && (
                          <Badge variant="outline">+{cohort.employee_ids.length - 15} more</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

      </Tabs>

      {/* Employee Details Dialog */}
      {selectedEmployeeId && (
        <EmployeeCapabilitiesDialog
          employee={{ id: selectedEmployeeId } as any}
          open={!!selectedEmployeeId}
          onOpenChange={(open) => !open && setSelectedEmployeeId(null)}
        />
      )}

      {/* Capability Details Dialog */}
      <Dialog open={capabilityDialogOpen} onOpenChange={setCapabilityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{capabilityDetails?.name}</DialogTitle>
            <DialogDescription>{capabilityDetails?.description}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">Employees by Current Level</h4>
              <div className="space-y-3">
                {Object.entries(employeesByLevel)
                  .sort(([a], [b]) => {
                    const order = ['foundational', 'developing', 'proficient', 'advanced', 'expert', 'Not Assessed'];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([level, profileIds]) => (
                    <div key={level} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{level}</span>
                        <Badge variant="secondary">{profileIds.length} people</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profileIds.map((profileId) => {
                          const profile = employeeProfiles.get(profileId);
                          return (
                            <Badge
                              key={profileId}
                              variant="outline"
                              className="cursor-pointer hover:bg-secondary transition-colors"
                              onClick={() => {
                                setCapabilityDialogOpen(false);
                                setSelectedEmployeeId(profileId);
                              }}
                            >
                              {profile?.full_name || 'Unknown'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
