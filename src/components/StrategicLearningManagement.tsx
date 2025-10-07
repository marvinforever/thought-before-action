import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Users, Calendar, TrendingUp } from "lucide-react";

interface StrategicLearningManagementProps {
  companyId: string | null;
}

interface Capability {
  id: string;
  name: string;
  category: string;
}

export const StrategicLearningManagement = ({ companyId }: StrategicLearningManagementProps) => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [showInvestmentDialog, setShowInvestmentDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  const loadData = async () => {
    try {
      // Load capabilities
      const { data: capData } = await supabase
        .from("capabilities")
        .select("id, name, category")
        .order("name");

      setCapabilities(capData || []);

      // Load priorities
      const { data: prioData } = await supabase
        .from("company_learning_priorities" as any)
        .select(`
          *,
          capabilities (name, category)
        `)
        .eq("company_id", companyId)
        .order("priority_level");

      setPriorities(prioData as any || []);

      // Load investments
      const { data: invData } = await supabase
        .from("learning_investments" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      setInvestments(invData as any || []);

      // Load enrollments with details
      const { data: enrData } = await supabase
        .from("learning_investment_enrollments" as any)
        .select(`
          *,
          profiles (full_name, email),
          learning_investments (title)
        `)
        .eq("company_id", companyId)
        .order("enrolled_at", { ascending: false });

      setEnrollments(enrData as any || []);
    } catch (error) {
      console.error("Error loading strategic learning data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPriority = async (formData: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !companyId) return;

      const { error } = await supabase
        .from("company_learning_priorities" as any)
        .insert({
          company_id: companyId,
          capability_id: formData.capabilityId,
          priority_level: parseInt(formData.priorityLevel),
          target_quarter: formData.targetQuarter,
          target_year: parseInt(formData.targetYear),
          budget_allocated: parseFloat(formData.budgetAllocated) || 0,
          rationale: formData.rationale,
          created_by: session.session.user.id,
        });

      if (error) throw error;

      toast({
        title: "Priority Added",
        description: "Strategic learning priority has been added",
      });

      loadData();
      setShowPriorityDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add priority",
        variant: "destructive",
      });
    }
  };

  const handleAddInvestment = async (formData: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !companyId) return;

      const { error } = await supabase
        .from("learning_investments" as any)
        .insert({
          company_id: companyId,
          title: formData.title,
          investment_type: formData.investmentType,
          cost: parseFloat(formData.cost) || 0,
          seats_available: formData.seatsAvailable ? parseInt(formData.seatsAvailable) : null,
          target_audience: formData.targetAudience,
          description: formData.description,
          vendor: formData.vendor,
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
          created_by: session.session.user.id,
        });

      if (error) throw error;

      toast({
        title: "Investment Added",
        description: "Learning investment has been added",
      });

      loadData();
      setShowInvestmentDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add investment",
        variant: "destructive",
      });
    }
  };

  const handleApproveEnrollment = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from("learning_investment_enrollments" as any)
        .update({ status: "enrolled" })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({
        title: "Enrollment Approved",
        description: "Employee has been enrolled in the program",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve enrollment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const totalBudget = priorities.reduce((sum, p) => sum + (p.budget_allocated || 0), 0);
  const totalInvestmentCost = investments.reduce((sum, i) => sum + (i.cost || 0), 0);
  const activeEnrollments = enrollments.filter(e => e.status === 'enrolled' || e.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Allocated to priorities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{investments.length}</div>
            <p className="text-xs text-muted-foreground">${totalInvestmentCost.toLocaleString()} total cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEnrollments}</div>
            <p className="text-xs text-muted-foreground">{enrollments.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {investments.length > 0 
                ? Math.round((enrollments.length / investments.length) * 100) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Avg enrollments per program</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategic Priorities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Strategic Learning Priorities</CardTitle>
              <CardDescription>Company-wide capability focus areas by quarter</CardDescription>
            </div>
            <AddPriorityDialog 
              open={showPriorityDialog}
              onOpenChange={setShowPriorityDialog}
              capabilities={capabilities}
              onSubmit={handleAddPriority}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {priorities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No strategic priorities set yet. Add your first priority to get started.
              </div>
            ) : (
              priorities.map((priority) => (
                <div key={priority.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge>P{priority.priority_level}</Badge>
                        <Badge variant="outline">{priority.target_quarter} {priority.target_year}</Badge>
                        <span className="font-semibold">{priority.capabilities.name}</span>
                      </div>
                      {priority.rationale && (
                        <p className="text-sm text-muted-foreground">{priority.rationale}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Budget</div>
                      <div className="font-semibold">${priority.budget_allocated.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Learning Investments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Learning Investments</CardTitle>
              <CardDescription>Funded programs and resources</CardDescription>
            </div>
            <AddInvestmentDialog
              open={showInvestmentDialog}
              onOpenChange={setShowInvestmentDialog}
              onSubmit={handleAddInvestment}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {investments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No learning investments yet. Add your first program to get started.
              </div>
            ) : (
              investments.map((investment) => (
                <div key={investment.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{investment.title}</h4>
                        <Badge variant="outline">{investment.investment_type}</Badge>
                      </div>
                      {investment.description && (
                        <p className="text-sm text-muted-foreground">{investment.description}</p>
                      )}
                      {investment.target_audience && (
                        <p className="text-sm"><strong>For:</strong> {investment.target_audience}</p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-bold">${investment.cost.toLocaleString()}</div>
                      {investment.seats_available && (
                        <div className="text-xs text-muted-foreground">
                          {investment.seats_used}/{investment.seats_available} seats used
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Enrollment Requests */}
      {enrollments.filter(e => e.status === 'requested').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Enrollment Requests</CardTitle>
            <CardDescription>Review and approve employee requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enrollments
                .filter(e => e.status === 'requested')
                .map((enrollment) => (
                  <div key={enrollment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{enrollment.profiles.full_name || enrollment.profiles.email}</div>
                        <div className="text-sm text-muted-foreground">
                          {enrollment.learning_investments.title}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleApproveEnrollment(enrollment.id)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Dialog Components
const AddPriorityDialog = ({ open, onOpenChange, capabilities, onSubmit }: any) => {
  const [formData, setFormData] = useState({
    capabilityId: "",
    priorityLevel: "1",
    targetQuarter: "Q1",
    targetYear: new Date().getFullYear().toString(),
    budgetAllocated: "",
    rationale: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      capabilityId: "",
      priorityLevel: "1",
      targetQuarter: "Q1",
      targetYear: new Date().getFullYear().toString(),
      budgetAllocated: "",
      rationale: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Priority
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Strategic Learning Priority</DialogTitle>
          <DialogDescription>Define a capability focus area for the organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Capability</Label>
              <Select value={formData.capabilityId} onValueChange={(v) => setFormData({ ...formData, capabilityId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select capability" />
                </SelectTrigger>
                <SelectContent>
                  {capabilities.map((cap: Capability) => (
                    <SelectItem key={cap.id} value={cap.id}>
                      {cap.name} ({cap.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority Level (1-5)</Label>
              <Select value={formData.priorityLevel} onValueChange={(v) => setFormData({ ...formData, priorityLevel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quarter</Label>
              <Select value={formData.targetQuarter} onValueChange={(v) => setFormData({ ...formData, targetQuarter: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Q1", "Q2", "Q3", "Q4"].map(q => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={formData.targetYear} onChange={(e) => setFormData({ ...formData, targetYear: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Budget ($)</Label>
              <Input type="number" value={formData.budgetAllocated} onChange={(e) => setFormData({ ...formData, budgetAllocated: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rationale</Label>
            <Textarea 
              value={formData.rationale} 
              onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
              placeholder="Why is this capability a priority?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add Priority</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddInvestmentDialog = ({ open, onOpenChange, onSubmit }: any) => {
  const [formData, setFormData] = useState({
    title: "",
    investmentType: "course",
    cost: "",
    seatsAvailable: "",
    targetAudience: "",
    description: "",
    vendor: "",
    startDate: "",
    endDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      title: "",
      investmentType: "course",
      cost: "",
      seatsAvailable: "",
      targetAudience: "",
      description: "",
      vendor: "",
      startDate: "",
      endDate: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Learning Investment</DialogTitle>
          <DialogDescription>Create a new funded learning program</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Program Title *</Label>
            <Input required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.investmentType} onValueChange={(v) => setFormData({ ...formData, investmentType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="tool">Tool/Platform</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cost ($) *</Label>
              <Input required type="number" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seats Available (optional)</Label>
              <Input type="number" value={formData.seatsAvailable} onChange={(e) => setFormData({ ...formData, seatsAvailable: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vendor/Provider</Label>
              <Input value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Input value={formData.targetAudience} onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })} placeholder="e.g., Senior Engineers, All Managers" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add Investment</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};