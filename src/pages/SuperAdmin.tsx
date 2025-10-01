import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Users, TrendingUp, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyStats {
  id: string;
  name: string;
  totalEmployees: number;
  activeEmployees: number;
  totalResponses: number;
  avgRetentionRisk: number;
  avgBurnout: number;
  createdAt: string;
}

const SuperAdmin = () => {
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_super_admin) {
        toast({
          title: "Access Denied",
          description: "You don't have super admin permissions",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsSuperAdmin(true);
      loadCompanyData();
    } catch (error) {
      console.error("Error checking super admin access:", error);
      navigate("/dashboard");
    }
  };

  const loadCompanyData = async () => {
    try {
      // Get all companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (companiesError) throw companiesError;

      // Get stats for each company
      const statsPromises = (companiesData || []).map(async (company) => {
        // Get employee counts
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, is_active")
          .eq("company_id", company.id);

        const totalEmployees = profiles?.length || 0;
        const activeEmployees = profiles?.filter(p => p.is_active).length || 0;

        // Get diagnostic responses
        const { data: responses } = await supabase
          .from("diagnostic_responses")
          .select("burnout_frequency, daily_energy_level")
          .eq("company_id", company.id);

        const totalResponses = responses?.length || 0;

        // Calculate averages
        const burnoutScores = responses?.map(r => {
          const freq = r.burnout_frequency?.toLowerCase() || "";
          if (freq.includes("never")) return 10;
          if (freq.includes("rarely")) return 30;
          if (freq.includes("sometimes")) return 50;
          if (freq.includes("often")) return 70;
          if (freq.includes("always")) return 90;
          return 50;
        }) || [];

        const energyScores = responses?.map(r => {
          const energy = r.daily_energy_level?.toLowerCase() || "";
          if (energy.includes("high")) return 90;
          if (energy.includes("moderate")) return 50;
          if (energy.includes("low")) return 20;
          return 50;
        }) || [];

        const avgBurnout = burnoutScores.length > 0 
          ? Math.round(burnoutScores.reduce((a, b) => a + b, 0) / burnoutScores.length)
          : 0;

        const avgEnergy = energyScores.length > 0
          ? Math.round(energyScores.reduce((a, b) => a + b, 0) / energyScores.length)
          : 0;

        const avgRetentionRisk = Math.round((avgBurnout + (100 - avgEnergy)) / 2);

        return {
          id: company.id,
          name: company.name,
          totalEmployees,
          activeEmployees,
          totalResponses,
          avgRetentionRisk,
          avgBurnout,
          createdAt: company.created_at,
        };
      });

      const stats = await Promise.all(statsPromises);
      setCompanies(stats);
    } catch (error) {
      console.error("Error loading company data:", error);
      toast({
        title: "Error",
        description: "Failed to load company data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from("companies")
        .insert({ name: newCompanyName.trim() });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company created successfully",
      });

      setIsAddCompanyOpen(false);
      setNewCompanyName("");
      loadCompanyData();
    } catch (error) {
      console.error("Error creating company:", error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">Critical</Badge>;
    if (score >= 50) return <Badge className="bg-orange-500">High</Badge>;
    if (score >= 30) return <Badge className="bg-yellow-500">Medium</Badge>;
    return <Badge className="bg-green-500">Low</Badge>;
  };

  if (loading || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalEmployees = companies.reduce((sum, c) => sum + c.totalEmployees, 0);
  const totalActive = companies.reduce((sum, c) => sum + c.activeEmployees, 0);
  const totalResponses = companies.reduce((sum, c) => sum + c.totalResponses, 0);
  const avgRisk = companies.length > 0
    ? Math.round(companies.reduce((sum, c) => sum + c.avgRetentionRisk, 0) / companies.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Portal</h1>
          <p className="text-muted-foreground">Manage all companies and view platform-wide metrics</p>
        </div>
        <Button onClick={() => setIsAddCompanyOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">{totalActive} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Retention Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRisk}%</div>
            {getRiskBadge(avgRisk)}
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Companies Overview</CardTitle>
          <CardDescription>View and manage all companies on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Retention Risk</TableHead>
                <TableHead>Burnout</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    {company.activeEmployees} / {company.totalEmployees}
                  </TableCell>
                  <TableCell>{company.totalResponses}</TableCell>
                  <TableCell>{getRiskBadge(company.avgRetentionRisk)}</TableCell>
                  <TableCell>{company.avgBurnout}%</TableCell>
                  <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Company Dialog */}
      <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Create a new company to add employees to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="Enter company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateCompany();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCompanyOpen(false);
                setNewCompanyName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCompany} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
