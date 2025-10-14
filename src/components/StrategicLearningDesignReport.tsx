import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Download,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  BookOpen,
  Award,
  AlertCircle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BusinessGoalsDialog from "@/components/BusinessGoalsDialog";
import { useViewAs } from "@/contexts/ViewAsContext";

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
  const [budgetScenario, setBudgetScenario] = useState<"conservative" | "moderate" | "aggressive">("moderate");
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

  const exportForClaude = () => {
    // Build comprehensive export with all data
    const exportData = {
      metadata: {
        export_date: new Date().toISOString(),
        report_generated: report.generated_at,
        report_expires: report.expires_at,
        timeframe_years: parseInt(timeframe),
      },
      executive_summary: {
        total_employees: summary.total_employees,
        employees_needing_training: summary.employees_needing_training,
        total_cohorts: summary.total_cohorts,
        narrative: summary.narrative,
        top_priorities: summary.top_priorities,
      },
      training_cohorts: cohorts.map(cohort => ({
        cohort_name: cohort.cohort_name,
        capability_name: cohort.capability_name,
        employee_count: cohort.employee_count,
        priority: cohort.priority,
        current_level: cohort.current_level,
        target_level: cohort.target_level,
        gap_severity: cohort.gap_severity,
        delivery_quarter: cohort.delivery_quarter,
        employees: cohort.employee_ids.map(id => {
          const profile = employeeProfiles.get(id);
          return {
            name: profile?.full_name || 'Unknown',
            email: profile?.email || '',
          };
        }),
        recommended_solutions: {
          conservative: {
            ...cohort.recommended_solutions?.[0],
            cost: cohort.estimated_cost_conservative,
          },
          moderate: {
            ...cohort.recommended_solutions?.[1],
            cost: cohort.estimated_cost_moderate,
          },
          aggressive: {
            ...cohort.recommended_solutions?.[2],
            cost: cohort.estimated_cost_aggressive,
          },
        },
      })),
      budget_scenarios: {
        conservative: {
          total: scenarios?.conservative?.total,
          per_employee: scenarios?.conservative?.per_employee,
          description: "Free to low-cost solutions ($0-$150/person)",
        },
        moderate: {
          total: scenarios?.moderate?.total,
          per_employee: scenarios?.moderate?.per_employee,
          description: "Balanced investment ($500-$2K/person)",
        },
        aggressive: {
          total: scenarios?.aggressive?.total,
          per_employee: scenarios?.aggressive?.per_employee,
          description: "Premium programs ($2K-$5K/person)",
        },
      },
      roi_projections: {
        training_cost: roi.training_cost,
        retention_savings: roi.retention_savings,
        productivity_gains: roi.productivity_gains,
        net_roi: roi.net_roi,
        roi_percentage: roi.roi_percentage,
        break_even_months: roi.break_even_months,
        methodology: roi.methodology,
      },
      full_narrative: report.narrative,
      instructions_for_claude: "This is a strategic learning design report for an organization. Please analyze this data and create a comprehensive, professional report suitable for sharing with clients. Include: 1) Executive summary, 2) Detailed analysis of each training cohort with business justification, 3) Budget recommendations with ROI analysis, 4) Implementation roadmap, and 5) Success metrics. Make it executive-ready and persuasive.",
    };

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strategic-learning-design-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Load this JSON file into Claude for a detailed report",
    });
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

  const selectedBudget =
    (budgetScenario === "conservative"
      ? scenarios?.conservative?.total
      : budgetScenario === "moderate"
      ? scenarios?.moderate?.total
      : scenarios?.aggressive?.total) ?? 0;

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
            Export for Claude
          </Button>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium">Training Hotspots</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_cohorts}</div>
            <p className="text-xs text-muted-foreground">Minimum 4 people each</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">3-Year Investment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(selectedBudget)}</div>
            <div className="text-xs text-muted-foreground space-y-1 mt-2">
              <div className="flex justify-between">
                <span>2026 (Year 1):</span>
                <span className="font-semibold">
                  {formatCurrency(
                    budgetScenario === "conservative"
                      ? scenarios?.conservative?.year1 || 0
                      : budgetScenario === "moderate"
                      ? scenarios?.moderate?.year1 || 0
                      : scenarios?.aggressive?.year1 || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>2027 (Year 2):</span>
                <span className="font-semibold">
                  {formatCurrency(
                    budgetScenario === "conservative"
                      ? scenarios?.conservative?.year2 || 0
                      : budgetScenario === "moderate"
                      ? scenarios?.moderate?.year2 || 0
                      : scenarios?.aggressive?.year2 || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>2028 (Year 3):</span>
                <span className="font-semibold">
                  {formatCurrency(
                    budgetScenario === "conservative"
                      ? scenarios?.conservative?.year3 || 0
                      : budgetScenario === "moderate"
                      ? scenarios?.moderate?.year3 || 0
                      : scenarios?.aggressive?.year3 || 0
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(roi.net_roi)}
            </div>
            <p className="text-xs text-muted-foreground">
              Break-even in {roi.break_even_months} months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business Drivers Button */}
      <div className="flex justify-center -mt-2 mb-4">
        <BusinessGoalsDialog />
      </div>

      <Tabs defaultValue="narrative" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="narrative">Executive Summary</TabsTrigger>
          <TabsTrigger value="cohorts">Training Hotspots</TabsTrigger>
          <TabsTrigger value="budget">Budget Scenarios</TabsTrigger>
          <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
          <TabsTrigger value="always-available">Always Available</TabsTrigger>
          <TabsTrigger value="resources">Resource Library</TabsTrigger>
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

        {/* Training Hotspots */}
        <TabsContent value="cohorts" className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Who Needs What Training</h3>
          
          <Tabs defaultValue="2026" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="2026">
                2026 (Year 1 - Foundation)
                <Badge variant="outline" className="ml-2">
                  {cohorts.filter(c => c.delivery_quarter?.includes('2026')).length} cohorts
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="2027">
                2027 (Year 2 - Scale)
                <Badge variant="outline" className="ml-2">
                  {cohorts.filter(c => c.delivery_quarter?.includes('2027')).length} cohorts
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="2028">
                2028 (Year 3 - Optimize)
                <Badge variant="outline" className="ml-2">
                  {cohorts.filter(c => c.delivery_quarter?.includes('2028')).length} cohorts
                </Badge>
              </TabsTrigger>
            </TabsList>

            {[
              { year: "2026", theme: "Foundation", description: "Build the base that everything else depends on. Leadership, management fundamentals, and revenue-critical skills." },
              { year: "2027", theme: "Scale", description: "Expand to operational excellence and build internal capability. Foundation is solid, now scale up." },
              { year: "2028", theme: "Optimize", description: "Specialized capabilities, advanced skills, and preparing for future growth." }
            ].map(({ year, theme, description }) => {
              const yearCohorts = cohorts.filter((cohort) => 
                cohort.delivery_quarter?.includes(year)
              );
              
              const yearTotal = yearCohorts.reduce((sum, c) => 
                sum + (c.estimated_cost_moderate || 0), 0
              );

              return (
                <TabsContent key={year} value={year} className="space-y-4 mt-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-lg">{year}: {theme}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(yearTotal)}</p>
                          <p className="text-xs text-muted-foreground">{yearCohorts.length} cohorts (moderate budget)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {yearCohorts.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No training cohorts scheduled for {year}
                      </CardContent>
                    </Card>
                  ) : (
                    yearCohorts.map((cohort) => {
                      const moderateSolution = cohort.recommended_solutions?.find((s: any) => s.type === 'moderate');
                      const costPerPerson = moderateSolution?.cost_per_person || 
                        Math.round((cohort.estimated_cost_moderate || 0) / cohort.employee_count);
                      
                      return (
                        <Card key={cohort.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <CardTitle className="flex items-center gap-2 flex-wrap">
                                  {cohort.cohort_name}
                                  <Badge className={getSeverityColor(cohort.gap_severity || 'low')}>
                                    {(cohort.gap_severity || 'low').toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">Priority {cohort.priority}</Badge>
                                </CardTitle>
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {cohort.employee_count} employees
                                  </span>
                                  <span>•</span>
                                  <span>{cohort.current_level} → {cohort.target_level}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {cohort.delivery_quarter}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Why This Cohort (based on priority/severity) */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Why This Training</p>
                              <p className="text-sm">
                                {cohort.priority === 1 && cohort.gap_severity === 'critical' ? 
                                  "Critical business priority. This capability directly impacts revenue generation, customer satisfaction, or regulatory compliance. Must be addressed immediately to prevent business risk."
                                : cohort.priority <= 2 && cohort.gap_severity === 'high' ?
                                  "High-impact foundational skill. Builds the capability base needed for organizational success. Addressing this gap enables multiple downstream improvements."
                                : cohort.priority === 3 ?
                                  "Strategic expansion priority. Once foundational capabilities are established, this training scales operational excellence and builds internal capacity."
                                : "Future-focused investment. Specialized capability that prepares the organization for advanced challenges and competitive differentiation."}
                              </p>
                            </div>

                            {/* Success Metrics */}
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs font-semibold text-green-900 uppercase mb-2">Success Metrics to Track</p>
                              <ul className="text-sm space-y-1">
                                {cohort.capability_name.toLowerCase().includes('leadership') || cohort.capability_name.toLowerCase().includes('management') ? (
                                  <>
                                    <li>• 360° feedback scores improve by 15%</li>
                                    <li>• Team engagement scores increase</li>
                                    <li>• Direct report retention improves</li>
                                  </>
                                ) : cohort.capability_name.toLowerCase().includes('sales') || cohort.capability_name.toLowerCase().includes('agronomy') ? (
                                  <>
                                    <li>• Average deal size increases 10-15%</li>
                                    <li>• Sales cycle time decreases</li>
                                    <li>• Customer satisfaction scores improve</li>
                                  </>
                                ) : cohort.capability_name.toLowerCase().includes('communication') ? (
                                  <>
                                    <li>• Reduction in miscommunication incidents</li>
                                    <li>• Faster project completion times</li>
                                    <li>• Improved customer-facing communications</li>
                                  </>
                                ) : cohort.capability_name.toLowerCase().includes('crm') || cohort.capability_name.toLowerCase().includes('system') ? (
                                  <>
                                    <li>• 90% daily system usage within 60 days</li>
                                    <li>• Complete pipeline visibility achieved</li>
                                    <li>• Forecast accuracy improves 20%</li>
                                  </>
                                ) : (
                                  <>
                                    <li>• Skill assessment scores improve</li>
                                    <li>• Application of skills in daily work</li>
                                    <li>• Performance metrics show improvement</li>
                                  </>
                                )}
                              </ul>
                            </div>

                            {/* Employees */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Participants</p>
                              <div className="flex flex-wrap gap-2">
                                {cohort.employee_ids.slice(0, 15).map((id, i) => {
                                  const profile = employeeProfiles.get(id);
                                  const displayName = profile?.full_name || `Employee ${i + 1}`;
                                  return (
                                    <Badge key={id} variant="secondary" title={profile?.email}>
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
              );
            })}
          </Tabs>
        </TabsContent>

        {/* Budget Scenarios */}
        <TabsContent value="budget" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={budgetScenario === "conservative" ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle>Conservative</CardTitle>
                <p className="text-sm text-muted-foreground">{scenarios.conservative.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{scenarios.conservative.range}</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-4">
                  {formatCurrency(scenarios.conservative.total)}
                </p>
                <Button
                  variant={budgetScenario === "conservative" ? "default" : "outline"}
                  onClick={() => setBudgetScenario("conservative")}
                  className="w-full"
                >
                  Select Plan
                </Button>
              </CardContent>
            </Card>

            <Card className={budgetScenario === "moderate" ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle>Moderate</CardTitle>
                <p className="text-sm text-muted-foreground">{scenarios.moderate.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{scenarios.moderate.range}</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-4">
                  {formatCurrency(scenarios.moderate.total)}
                </p>
                <Button
                  variant={budgetScenario === "moderate" ? "default" : "outline"}
                  onClick={() => setBudgetScenario("moderate")}
                  className="w-full"
                >
                  Select Plan
                </Button>
              </CardContent>
            </Card>

            <Card className={budgetScenario === "aggressive" ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle>Premium</CardTitle>
                <p className="text-sm text-muted-foreground">{scenarios.aggressive.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{scenarios.aggressive.range}</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-4">
                  {formatCurrency(scenarios.aggressive.total)}
                </p>
                <Button
                  variant={budgetScenario === "aggressive" ? "default" : "outline"}
                  onClick={() => setBudgetScenario("aggressive")}
                  className="w-full"
                >
                  Select Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ROI Analysis */}
        <TabsContent value="roi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Return on Investment Projections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Retention Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(roi.retention_savings)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productivity Gains</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(roi.productivity_gains)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net ROI (Moderate Plan)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(roi.net_roi)}
                  </p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Calculation Methodology:</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <strong>Retention Savings:</strong> {roi.formulas?.retention_savings}
                  </li>
                  <li>
                    <strong>Productivity Gains:</strong> {roi.formulas?.productivity_gains}
                  </li>
                  <li>
                    <strong>Net ROI:</strong> {roi.formulas?.net_roi}
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Research Sources:</h4>
                <ul className="text-sm space-y-1">
                  {roi.sources?.map((source: string, i: number) => (
                    <li key={i}>• {source}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Track Real Value with Jericho:</strong> Monitor completion rates, employee feedback, and actual performance improvements to validate these projections.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Always Available - Self-Serve Resources */}
        <TabsContent value="always-available" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Always Available: Self-Serve Learning</CardTitle>
              <p className="text-sm text-muted-foreground">
                Universal skills that don't require formal cohorts - available on-demand via curated resources
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-blue-900">Implementation Model</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 text-blue-600" />
                    <span>Curate LinkedIn Learning playlists or similar platforms (~$300/person/year)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-0.5 text-blue-600" />
                    <span>Managers assign resources as needed based on individual development plans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-blue-600" />
                    <span>Check-ins during 1-on-1s for accountability and progress tracking</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Universal Skills (No Formal Training Needed)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    'Time Management',
                    'Prioritization',
                    'Multi-tasking',
                    'Collaboration (basic)',
                    'Resilience',
                    'Conflict Resolution (basic)',
                    'Cross-functional Partnership',
                    'Influencing (basic)',
                    'Decision Making (basic)',
                    'Organizational Awareness',
                    'Basic Tool Proficiency',
                    'Email & Calendar Management'
                  ].map((skill) => (
                    <div key={skill} className="p-3 bg-white border rounded-lg">
                      <span className="text-sm">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-green-900">Estimated Cost</h4>
                <p className="text-2xl font-bold text-green-700 mb-2">
                  {formatCurrency(summary.total_employees * 300)} annually
                </p>
                <p className="text-sm text-green-800">
                  ${300}/person/year × {summary.total_employees} employees = {formatCurrency(summary.total_employees * 300 * 3)} over 3 years
                </p>
                <p className="text-xs text-green-700 mt-2">
                  This is NOT included in the Year 1-3 training budget above - it's a separate ongoing operational expense
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Why Self-Serve vs. Formal Cohorts?</h4>
                <p className="text-sm">
                  These are foundational professional skills that:
                </p>
                <ul className="text-sm space-y-1 mt-2 ml-4 list-disc">
                  <li>Apply universally across all roles</li>
                  <li>Can be learned effectively through self-paced content</li>
                  <li>Don't require specialized facilitation or group learning</li>
                  <li>Are better reinforced through practice and manager coaching</li>
                  <li>Would dilute focus from mission-critical skill gaps if formalized</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Library */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Curated Learning Resources</CardTitle>
              <p className="text-sm text-muted-foreground">
                Resources automatically sync from your library based on capability matches
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                <BookOpen className="inline h-4 w-4 mr-2" />
                Resources are dynamically matched to training hotspots and displayed in recommended solutions above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
