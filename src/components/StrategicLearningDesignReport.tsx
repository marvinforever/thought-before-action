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

        // Load cohorts
        const { data: cohortData, error: cohortError } = await supabase
          .from("training_cohorts" as any)
          .select("*")
          .eq("report_id", (latestReport as any).id)
          .order("priority");

        if (cohortError) throw cohortError;
        setCohorts((cohortData as any) || []);

        // Extract all unique employee IDs from cohorts and fetch their profiles
        if (cohortData && cohortData.length > 0) {
          const allEmployeeIds = new Set<string>();
          cohortData.forEach((cohort: any) => {
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
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
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
            <CardTitle className="text-sm font-medium">Investment Needed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(selectedBudget)}</div>
            <p className="text-xs text-muted-foreground">
              {budgetScenario.charAt(0).toUpperCase() + budgetScenario.slice(1)} scenario
            </p>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="narrative">Executive Summary</TabsTrigger>
          <TabsTrigger value="cohorts">Training Hotspots</TabsTrigger>
          <TabsTrigger value="budget">Budget Scenarios</TabsTrigger>
          <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
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
        </TabsContent>

        {/* Training Hotspots */}
        <TabsContent value="cohorts" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Who Needs What Training</h3>
            <Select value={budgetScenario} onValueChange={(v: any) => setBudgetScenario(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative ($0-$150)</SelectItem>
                <SelectItem value="moderate">Moderate ($500-$2K)</SelectItem>
                <SelectItem value="aggressive">Premium ($2K-$5K)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cohorts.map((cohort) => {
            const cost =
              budgetScenario === "conservative"
                ? (cohort.estimated_cost_conservative || 0)
                : budgetScenario === "moderate"
                ? (cohort.estimated_cost_moderate || 0)
                : (cohort.estimated_cost_aggressive || 0);

            const solution = cohort.recommended_solutions?.[
              budgetScenario === "conservative" ? 0 : budgetScenario === "moderate" ? 1 : 2
            ];

            return (
              <Card key={cohort.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {cohort.cohort_name}
                        <Badge className={getSeverityColor(cohort.gap_severity || 'low')}>
                          {(cohort.gap_severity || 'low').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">Priority {cohort.priority}</Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {cohort.employee_count} employees • {cohort.current_level} → {cohort.target_level}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(cost)}</p>
                      <p className="text-sm text-muted-foreground">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {cohort.delivery_quarter}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {solution && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold mb-2">💡 Recommended Solution:</p>
                      <p className="text-lg">{solution.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {solution.vendor} • {formatCurrency(solution.cost_per_person)}/person
                      </p>
                      {solution.link && (
                        <a
                          href={solution.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View Course →
                        </a>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="font-semibold mb-2">Employees in this cohort:</p>
                    <div className="flex flex-wrap gap-2">
                      {cohort.employee_ids.slice(0, 10).map((id, i) => {
                        const profile = employeeProfiles.get(id);
                        const displayName = profile?.full_name || `Employee ${i + 1}`;
                        return (
                          <Badge key={id} variant="secondary" title={profile?.email}>
                            {displayName}
                          </Badge>
                        );
                      })}
                      {cohort.employee_ids.length > 10 && (
                        <Badge variant="outline">+{cohort.employee_ids.length - 10} more</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
