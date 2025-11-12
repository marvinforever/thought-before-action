import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Download,
  Users,
  Calendar,
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
            <CardTitle className="text-sm font-medium">Training Hotspots</CardTitle>
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
          <TabsTrigger value="cohorts">Training Hotspots</TabsTrigger>
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
                  {cohorts.filter(c => c.delivery_quarter?.includes('2026') && c.employee_count >= 4).length} hotspots
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="2027">
                2027 (Year 2 - Scale)
                <Badge variant="outline" className="ml-2">
                  {cohorts.filter(c => c.delivery_quarter?.includes('2027') && c.employee_count >= 4).length} hotspots
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="2028">
                2028 (Year 3 - Optimize)
                <Badge variant="outline" className="ml-2">
                  {cohorts.filter(c => c.delivery_quarter?.includes('2028') && c.employee_count >= 4).length} hotspots
                </Badge>
              </TabsTrigger>
            </TabsList>

            {[
              { year: "2026", theme: "Foundation", description: "Build the base that everything else depends on. Leadership, management fundamentals, and revenue-critical skills." },
              { year: "2027", theme: "Scale", description: "Expand to operational excellence and build internal capability. Foundation is solid, now scale up." },
              { year: "2028", theme: "Optimize", description: "Specialized capabilities, advanced skills, and preparing for future growth." }
            ].map(({ year, theme, description }) => {
              // Filter cohorts for this year with at least 4 people
              const yearCohorts = cohorts.filter((cohort) => 
                cohort.delivery_quarter?.includes(year) && cohort.employee_count >= 4
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
                          <p className="text-2xl font-bold">{yearCohorts.length}</p>
                          <p className="text-xs text-muted-foreground">training hotspots</p>
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
                      return (
                        <Card key={cohort.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <CardTitle className="flex items-center gap-2 flex-wrap">
                                  {cohort.cohort_name}
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

      </Tabs>
    </div>
  );
}
