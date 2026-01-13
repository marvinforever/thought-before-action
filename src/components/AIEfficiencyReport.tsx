import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "@/components/ui/gauge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Loader2, Zap, Clock, DollarSign, Users, TrendingUp, Download, RefreshCw, Lightbulb, Rocket, Search, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  has_job_description: boolean;
}

interface ExecutiveSummary {
  headline: string;
  employees_analyzed: number;
  avg_hours_saved_per_employee: number;
  annual_hours_saved: number;
  annual_value_estimate: number;
  ai_readiness_score: number;
  top_opportunity_role: string;
  top_opportunity_department: string;
}

interface RoleAnalysis {
  role: string;
  employee_count: number;
  total_hours_saved: number;
  avg_readiness_score: number;
  top_tools: string[];
}

interface DepartmentAnalysis {
  department: string;
  employee_count: number;
  total_hours_saved: number;
  avg_readiness_score: number;
}

interface QuickWin {
  task: string;
  affected_employees: number;
  total_weekly_hours_saved: number;
  recommended_tool: string;
}

interface RoadmapPhase {
  phase: number;
  title: string;
  focus: string;
  estimated_hours_saved?: number;
  tools?: string[];
}

interface AIEfficiencyReportData {
  id: string;
  company_id: string;
  executive_summary: ExecutiveSummary;
  role_analysis: RoleAnalysis[];
  department_analysis: DepartmentAnalysis[];
  total_estimated_hours_saved: number;
  total_employees_analyzed: number;
  efficiency_score: number;
  quick_wins: QuickWin[];
  implementation_roadmap: RoadmapPhase[];
  generated_at: string;
}

export function AIEfficiencyReport() {
  const [report, setReport] = useState<AIEfficiencyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadReport();
  }, [viewAsCompanyId]);

  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let companyId = viewAsCompanyId;
    if (!companyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      companyId = profile?.company_id;
    }
    return companyId;
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      // Get all employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('full_name');

      // Get employees with job descriptions
      const { data: jobDescs } = await supabase
        .from('job_descriptions')
        .select('profile_id')
        .eq('is_current', true);

      const profilesWithJD = new Set(jobDescs?.map((j: any) => j.profile_id) || []);

      const employeeList: Employee[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Unknown',
        email: p.email || '',
        role: p.role || '',
        department: 'General',
        has_job_description: profilesWithJD.has(p.id),
      }));

      setEmployees(employeeList);
      
      // Select all employees with job descriptions by default
      const defaultSelected = new Set(
        employeeList.filter(e => e.has_job_description).map(e => e.id)
      );
      setSelectedEmployeeIds(defaultSelected);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      // Get the most recent report that hasn't expired
      const { data } = await supabase
        .from('ai_efficiency_reports')
        .select('*')
        .eq('company_id', companyId)
        .gte('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setReport(data as unknown as AIEfficiencyReportData);
      } else {
        // Load employees for selection if no report exists
        await loadEmployees();
      }
    } catch (error) {
      console.error('Error loading AI efficiency report:', error);
      // Load employees for selection
      await loadEmployees();
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (selectedEmployeeIds.size === 0) {
      toast({
        title: "No employees selected",
        description: "Please select at least one employee to analyze.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const companyId = await getCompanyId();
      if (!companyId) throw new Error('No company ID');

      toast({
        title: "Analyzing AI opportunities...",
        description: `Analyzing ${selectedEmployeeIds.size} employee${selectedEmployeeIds.size > 1 ? 's' : ''}. This may take a few minutes.`,
      });

      const { data, error } = await supabase.functions.invoke('analyze-ai-efficiency', {
        body: { 
          companyId,
          employeeIds: Array.from(selectedEmployeeIds),
        },
      });

      if (error) throw error;

      toast({
        title: "Analysis complete!",
        description: `Analyzed ${data.employeesAnalyzed} employees for AI efficiency opportunities.`,
      });

      await loadReport();
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Error generating report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployeeIds(newSelected);
  };

  const selectAll = () => {
    const eligibleIds = employees.filter(e => e.has_job_description).map(e => e.id);
    setSelectedEmployeeIds(new Set(eligibleIds));
  };

  const selectNone = () => {
    setSelectedEmployeeIds(new Set());
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.role.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.department.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    const eligibleCount = employees.filter(e => e.has_job_description).length;
    const selectedCount = selectedEmployeeIds.size;

    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <Zap className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>AI Efficiency Analysis</CardTitle>
          <CardDescription>
            Discover how AI can transform your organization's productivity. 
            Select which employees to analyze below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee Selection */}
          <Collapsible open={showEmployeeSelector} onOpenChange={setShowEmployeeSelector}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedCount} of {eligibleCount} eligible employees selected
                </span>
                {showEmployeeSelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
              </div>

              {loadingEmployees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer ${!emp.has_job_description ? 'opacity-50' : ''}`}
                        onClick={() => emp.has_job_description && toggleEmployee(emp.id)}
                      >
                        <Checkbox
                          checked={selectedEmployeeIds.has(emp.id)}
                          onCheckedChange={() => emp.has_job_description && toggleEmployee(emp.id)}
                          disabled={!emp.has_job_description}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{emp.full_name}</span>
                            {emp.role && <Badge variant="secondary" className="text-xs">{emp.role}</Badge>}
                            {!emp.has_job_description && (
                              <Badge variant="outline" className="text-xs text-amber-600">No JD</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                        </div>
                      </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No employees found</p>
                    )}
                  </div>
                </ScrollArea>
              )}
              
              {eligibleCount === 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-200 text-sm">
                  ⚠️ No employees have job descriptions. Add job descriptions to enable AI efficiency analysis.
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="text-center pt-4">
            <Button 
              onClick={generateReport} 
              disabled={generating || selectedCount === 0} 
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing {selectedCount} employees...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Analyze {selectedCount} Employee{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Only employees with job descriptions can be analyzed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = report.executive_summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Efficiency Report</h2>
          <p className="text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReport} disabled={generating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Executive Summary Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="pt-6">
          <p className="text-xl font-semibold text-center mb-6">{summary.headline}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{summary.annual_hours_saved.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Hours Saved/Year</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">${(summary.annual_value_estimate / 1000).toFixed(0)}K</div>
              <div className="text-sm text-muted-foreground">Estimated Value</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{summary.employees_analyzed}</div>
              <div className="text-sm text-muted-foreground">Employees Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{summary.avg_hours_saved_per_employee}h</div>
              <div className="text-sm text-muted-foreground">Avg Hours/Employee/Week</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Readiness Score */}
      <div className="flex justify-center">
        <Gauge
          value={Math.round(report.efficiency_score)}
          max={100}
          size={200}
          label="AI Readiness Score"
          description="How prepared your org is for AI adoption"
          colorScheme={report.efficiency_score >= 70 ? 'success' : report.efficiency_score >= 40 ? 'warning' : 'danger'}
        />
      </div>

      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="opportunities">Quick Wins</TabsTrigger>
          <TabsTrigger value="roles">By Role</TabsTrigger>
          <TabsTrigger value="departments">By Department</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Quick Win Opportunities
              </CardTitle>
              <CardDescription>
                High-impact, easy-to-implement AI automations across your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(report.quick_wins || []).map((win, idx) => (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium capitalize">{win.task}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Affects {win.affected_employees} employees • Save {win.total_weekly_hours_saved.toFixed(1)}h/week
                        </p>
                      </div>
                      <Badge variant="secondary">{win.recommended_tool}</Badge>
                    </div>
                  </div>
                ))}
                {(!report.quick_wins || report.quick_wins.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">
                    No common quick wins identified. Check individual role analysis for opportunities.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                AI Efficiency by Role
              </CardTitle>
              <CardDescription>
                Which roles have the highest AI automation potential
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {(report.role_analysis || []).map((role, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{role.role}</h4>
                        <Badge>{role.employee_count} employees</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Weekly Hours Saved</div>
                          <div className="text-lg font-semibold flex items-center gap-1">
                            <Clock className="h-4 w-4 text-primary" />
                            {role.total_hours_saved.toFixed(1)}h
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">AI Readiness</div>
                          <Progress value={role.avg_readiness_score} className="mt-1" />
                        </div>
                      </div>
                      {role.top_tools && role.top_tools.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {role.top_tools.map((tool, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{tool}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI Efficiency by Department
              </CardTitle>
              <CardDescription>
                Department-level automation opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(report.department_analysis || []).map((dept, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{dept.department}</h4>
                      <Badge variant="secondary">{dept.employee_count} employees</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Weekly Hours Saved</div>
                        <div className="text-lg font-semibold">{dept.total_hours_saved.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">AI Readiness</div>
                        <Progress value={dept.avg_readiness_score} className="mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Implementation Roadmap
              </CardTitle>
              <CardDescription>
                Phased approach to AI adoption in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(report.implementation_roadmap || []).map((phase, idx) => (
                  <div key={idx} className="relative pl-8 pb-6 last:pb-0">
                    {/* Timeline line */}
                    {idx < (report.implementation_roadmap?.length || 0) - 1 && (
                      <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-border" />
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      {phase.phase}
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium">{phase.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{phase.focus}</p>
                      
                      {phase.estimated_hours_saved && (
                        <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                          <Clock className="h-4 w-4" />
                          {phase.estimated_hours_saved.toFixed(0)} hours/week saved
                        </div>
                      )}
                      
                      {phase.tools && phase.tools.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {phase.tools.map((tool, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{tool}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
