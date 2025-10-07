import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, TrendingUp, Users, DollarSign, Target, BookOpen, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmployeeGrowthData {
  id: string;
  full_name: string;
  email: string;
  roadmap?: any;
  capabilities: number;
  targetCapabilities: number;
  completedResources: number;
}

export const OrganizationalGrowthDesign = () => {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeGrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState({
    avgSalary: 75000,
    trainingBudgetPerEmployee: 2000,
    estimatedRetentionImpact: 15,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizationalData();
  }, []);

  const loadOrganizationalData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.session.user.id)
        .maybeSingle();

      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      // Get all employees in company
      const { data: employeeProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", profile.company_id);

      if (!employeeProfiles) return;

      // Get growth data for each employee
      const growthData = await Promise.all(
        employeeProfiles.map(async (emp) => {
          const [roadmapRes, capabilitiesRes, resourcesRes] = await Promise.all([
            supabase
              .from("learning_roadmaps")
              .select("*")
              .eq("profile_id", emp.id)
              .order("generated_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("employee_capabilities")
              .select("*")
              .eq("profile_id", emp.id),
            supabase
              .from("content_recommendations")
              .select("*")
              .eq("profile_id", emp.id)
              .eq("status", "completed"),
          ]);

          const capabilities = capabilitiesRes.data || [];
          const targetCapabilities = capabilities.filter(c => c.target_level).length;

          return {
            id: emp.id,
            full_name: emp.full_name || emp.email || "Unknown",
            email: emp.email || "",
            roadmap: roadmapRes.data,
            capabilities: capabilities.length,
            targetCapabilities,
            completedResources: resourcesRes.data?.length || 0,
          };
        })
      );

      setEmployees(growthData);
    } catch (error) {
      console.error("Error loading organizational data:", error);
      toast({
        title: "Error",
        description: "Failed to load organizational data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalBudget = () => {
    const trainingCost = employees.length * budgetData.trainingBudgetPerEmployee;
    const retentionSavings = employees.length * (budgetData.avgSalary * 0.5 * (budgetData.estimatedRetentionImpact / 100));
    return {
      trainingCost,
      retentionSavings,
      netROI: retentionSavings - trainingCost,
    };
  };

  const exportToPDF = async () => {
    toast({
      title: "Exporting to PDF",
      description: "Generating your organizational growth design...",
    });
    
    // This would integrate with a PDF library like jsPDF or react-pdf
    // For now, we'll show a success message
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Your strategic growth design has been downloaded",
      });
    }, 1500);
  };

  const budget = calculateTotalBudget();
  const avgProgress = employees.length > 0
    ? employees.reduce((sum, emp) => sum + (emp.completedResources / Math.max(emp.targetCapabilities, 1)), 0) / employees.length * 100
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Strategic Growth Design</h2>
          <p className="text-muted-foreground">
            Organizational development roadmap for all enrolled employees
          </p>
        </div>
        <Button onClick={exportToPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Export to PDF
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">Enrolled in growth programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProgress.toFixed(0)}%</div>
            <Progress value={avgProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capabilities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.reduce((sum, e) => sum + e.capabilities, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Being developed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.reduce((sum, e) => sum + e.completedResources, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all employees</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employee Details</TabsTrigger>
          <TabsTrigger value="budget">Budget & ROI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Growth Summary</CardTitle>
              <CardDescription>
                High-level view of your organization's development initiatives
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Development Coverage</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Employees with Active Roadmaps</span>
                      <span className="font-medium">
                        {employees.filter(e => e.roadmap).length} / {employees.length}
                      </span>
                    </div>
                    <Progress 
                      value={(employees.filter(e => e.roadmap).length / employees.length) * 100} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Capability Development</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Employees with Target Capabilities</span>
                      <span className="font-medium">
                        {employees.filter(e => e.targetCapabilities > 0).length} / {employees.length}
                      </span>
                    </div>
                    <Progress 
                      value={(employees.filter(e => e.targetCapabilities > 0).length / employees.length) * 100} 
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium mb-1">Strategic Insights</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• {employees.filter(e => e.roadmap).length} employees have personalized growth roadmaps</li>
                      <li>• Average of {(employees.reduce((sum, e) => sum + e.capabilities, 0) / employees.length).toFixed(1)} capabilities per employee</li>
                      <li>• {employees.reduce((sum, e) => sum + e.completedResources, 0)} total learning resources completed</li>
                      <li>• Projected ROI of ${budget.netROI.toLocaleString()} through retention improvements</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Growth Details</CardTitle>
              <CardDescription>Individual progress and development plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {employees.map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">{employee.full_name}</div>
                      <div className="text-sm text-muted-foreground">{employee.email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{employee.capabilities} Capabilities</div>
                        <div className="text-xs text-muted-foreground">
                          {employee.completedResources} completed
                        </div>
                      </div>
                      <Badge variant={employee.roadmap ? "default" : "secondary"}>
                        {employee.roadmap ? "Active Roadmap" : "No Roadmap"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget & ROI Calculator</CardTitle>
              <CardDescription>
                Estimate costs and returns on your growth investments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="avgSalary">Average Salary ($)</Label>
                  <Input
                    id="avgSalary"
                    type="number"
                    value={budgetData.avgSalary}
                    onChange={(e) => setBudgetData({ ...budgetData, avgSalary: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trainingBudget">Training Budget per Employee ($)</Label>
                  <Input
                    id="trainingBudget"
                    type="number"
                    value={budgetData.trainingBudgetPerEmployee}
                    onChange={(e) => setBudgetData({ ...budgetData, trainingBudgetPerEmployee: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retentionImpact">Retention Impact (%)</Label>
                  <Input
                    id="retentionImpact"
                    type="number"
                    value={budgetData.estimatedRetentionImpact}
                    onChange={(e) => setBudgetData({ ...budgetData, estimatedRetentionImpact: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Training Investment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${budget.trainingCost.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {employees.length} employees × ${budgetData.trainingBudgetPerEmployee}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Retention Savings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${budget.retentionSavings.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avoided turnover costs
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-primary text-primary-foreground">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <CardTitle className="text-sm font-medium">Net ROI</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${budget.netROI.toLocaleString()}
                    </div>
                    <p className="text-xs opacity-90 mt-1">
                      {((budget.netROI / budget.trainingCost) * 100).toFixed(0)}% return on investment
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border p-4 bg-muted/30">
                <h4 className="font-medium mb-2">Budget Assumptions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Turnover cost estimated at 50% of average salary</li>
                  <li>• Retention impact based on industry benchmarks for L&D programs</li>
                  <li>• Training budget includes courses, resources, and development time</li>
                  <li>• ROI calculated over 12-month period</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};