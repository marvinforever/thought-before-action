import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  BookOpen,
  Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useViewAs } from "@/contexts/ViewAsContext";

interface LearningPriority {
  id: string;
  capability_id: string;
  priority_level: number;
  target_quarter: string;
  target_year: number;
  budget_allocated: number;
  rationale: string;
  capabilities: {
    name: string;
    category: string;
  };
}

interface LearningInvestment {
  id: string;
  title: string;
  investment_type: string;
  cost: number;
  seats_available: number | null;
  seats_used: number;
  target_audience: string;
  description: string;
  vendor: string;
  start_date: string | null;
  end_date: string | null;
}

interface Enrollment {
  id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  learning_investments: {
    title: string;
    investment_type: string;
  };
}

export const CompanyStrategicLearningTab = () => {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [priorities, setPriorities] = useState<LearningPriority[]>([]);
  const [investments, setInvestments] = useState<LearningInvestment[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<string>("");
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadData();
  }, [viewAsCompanyId]);

  const loadData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Determine company ID (either from viewAs context or user's profile)
      let effectiveCompanyId = viewAsCompanyId;
      
      if (!effectiveCompanyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, is_admin")
          .eq("id", session.session.user.id)
          .maybeSingle();

        if (!profile?.company_id) return;
        effectiveCompanyId = profile.company_id;
        setIsAdmin(profile.is_admin || false);
      } else {
        // When viewing as another company, check if current user is super admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_super_admin")
          .eq("id", session.session.user.id)
          .maybeSingle();
        
        setIsAdmin(profile?.is_super_admin || false);
      }
      
      setCompanyId(effectiveCompanyId);

      // Load learning priorities
      const { data: prioritiesData } = await supabase
        .from("company_learning_priorities" as any)
        .select(`
          *,
          capabilities (
            name,
            category
          )
        `)
        .eq("company_id", effectiveCompanyId)
        .order("priority_level", { ascending: true });

      setPriorities(prioritiesData as any || []);

      // Load learning investments
      const { data: investmentsData } = await supabase
        .from("learning_investments" as any)
        .select("*")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      setInvestments(investmentsData as any || []);

      // Load my enrollments
      const { data: enrollmentsData } = await supabase
        .from("learning_investment_enrollments" as any)
        .select(`
          *,
          learning_investments (
            title,
            investment_type
          )
        `)
        .eq("profile_id", session.session.user.id)
        .order("enrolled_at", { ascending: false });

      setMyEnrollments(enrollmentsData as any || []);
    } catch (error) {
      console.error("Error loading strategic learning data:", error);
      toast({
        title: "Error",
        description: "Failed to load strategic learning data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEnrollment = async (investmentId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !companyId) return;

      const { error } = await supabase
        .from("learning_investment_enrollments" as any)
        .insert({
          investment_id: investmentId,
          profile_id: session.session.user.id,
          company_id: companyId,
          status: "requested",
        });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your enrollment request has been submitted for approval",
      });

      loadData();
      setShowRequestForm(false);
      setSelectedInvestment("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Company Strategic Learning Plan</h2>
          <p className="text-muted-foreground">
            Organizational capability priorities and funded learning opportunities
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strategic Priorities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{priorities.length}</div>
            <p className="text-xs text-muted-foreground">
              {priorities.filter(p => p.target_quarter === currentQuarter && p.target_year === currentYear).length} this quarter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{investments.length}</div>
            <p className="text-xs text-muted-foreground">Company-funded resources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Enrollments</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myEnrollments.length}</div>
            <p className="text-xs text-muted-foreground">
              {myEnrollments.filter(e => e.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${priorities.reduce((sum, p) => sum + (p.budget_allocated || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Allocated this year</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="priorities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="priorities">Strategic Priorities</TabsTrigger>
          <TabsTrigger value="investments">Available Programs</TabsTrigger>
          <TabsTrigger value="my-learning">My Enrollments</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Manage</TabsTrigger>}
        </TabsList>

        <TabsContent value="priorities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Capability Priorities</CardTitle>
              <CardDescription>
                Strategic focus areas for organizational development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {priorities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No strategic priorities set yet
                  </div>
                ) : (
                  priorities.map((priority) => (
                    <div key={priority.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Priority {priority.priority_level}</Badge>
                            <Badge>{priority.target_quarter} {priority.target_year}</Badge>
                            <Badge variant="secondary">{priority.capabilities.category}</Badge>
                          </div>
                          <h4 className="font-semibold text-lg">{priority.capabilities.name}</h4>
                        </div>
                        {priority.budget_allocated > 0 && (
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Budget</div>
                            <div className="font-semibold">${priority.budget_allocated.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                      {priority.rationale && (
                        <p className="text-sm text-muted-foreground">{priority.rationale}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company-Funded Learning Programs</CardTitle>
              <CardDescription>
                Request access to courses, certifications, and resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {investments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No learning programs available yet
                </div>
              ) : (
                investments.map((investment) => {
                  const isEnrolled = myEnrollments.some(e => e.learning_investments && 'id' in e.learning_investments);
                  const seatsAvailable = investment.seats_available 
                    ? investment.seats_available - investment.seats_used 
                    : null;

                  return (
                    <div key={investment.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{investment.title}</h4>
                            <Badge variant="outline">{investment.investment_type}</Badge>
                          </div>
                          {investment.vendor && (
                            <p className="text-sm text-muted-foreground">Provider: {investment.vendor}</p>
                          )}
                          {investment.description && (
                            <p className="text-sm text-muted-foreground mt-2">{investment.description}</p>
                          )}
                          {investment.target_audience && (
                            <p className="text-sm"><strong>For:</strong> {investment.target_audience}</p>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <div className="text-lg font-bold">${investment.cost.toLocaleString()}</div>
                          {seatsAvailable !== null && (
                            <div className="text-xs text-muted-foreground">
                              {seatsAvailable} of {investment.seats_available} seats left
                            </div>
                          )}
                          {!isEnrolled && (seatsAvailable === null || seatsAvailable > 0) && (
                            <Button 
                              size="sm" 
                              onClick={() => handleRequestEnrollment(investment.id)}
                            >
                              Request Access
                            </Button>
                          )}
                          {isEnrolled && (
                            <Badge variant="default">Enrolled</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Learning Enrollments</CardTitle>
              <CardDescription>Track your progress in company-funded programs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myEnrollments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    You haven't enrolled in any programs yet
                  </div>
                ) : (
                  myEnrollments.map((enrollment) => (
                    <div key={enrollment.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{enrollment.learning_investments.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            enrollment.status === 'completed' ? 'default' :
                            enrollment.status === 'in_progress' ? 'secondary' :
                            'outline'
                          }
                        >
                          {enrollment.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin: Manage Strategic Learning</CardTitle>
                <CardDescription>
                  View full details in the Executive Dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-2">Admin Features Available</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Set company-wide capability priorities by quarter</li>
                        <li>• Add and manage paid learning programs</li>
                        <li>• Track enrollment and utilization metrics</li>
                        <li>• Monitor learning investment ROI</li>
                        <li>• Approve enrollment requests</li>
                      </ul>
                      <Button className="mt-4" onClick={() => window.location.href = '/dashboard/manager'}>
                        Go to Executive Dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};