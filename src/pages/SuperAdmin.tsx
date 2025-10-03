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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, TrendingUp, AlertCircle, Plus, UserPlus, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PendingCapabilitiesTab } from "@/components/PendingCapabilitiesTab";
import { StandardCapWatchlistTab } from "@/components/StandardCapWatchlistTab";

interface CompanyStats {
  id: string;
  name: string;
  totalEmployees: number;
  activeEmployees: number;
  totalResponses: number;
  createdAt: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  newProfiles: number;
}

const SuperAdmin = () => {
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Employee management state
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [newEmployee, setNewEmployee] = useState({ fullName: "", email: "", role: "", phone: "" });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  
  // CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCompanyId, setImportCompanyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
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
          .select("id")
          .eq("company_id", company.id);

        const totalResponses = responses?.length || 0;

        return {
          id: company.id,
          name: company.name,
          totalEmployees,
          activeEmployees,
          totalResponses,
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

  const handleCreateEmployee = async () => {
    if (!newEmployee.email || !newEmployee.fullName || !selectedCompanyId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and select a company",
        variant: "destructive",
      });
      return;
    }

    setCreatingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          email: newEmployee.email,
          full_name: newEmployee.fullName,
          role: newEmployee.role || null,
          phone: newEmployee.phone || null,
          company_id: selectedCompanyId,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee created successfully",
      });

      setNewEmployee({ fullName: "", email: "", role: "", phone: "" });
      setSelectedCompanyId("");
      setIsAddEmployeeOpen(false);
      loadCompanyData();
    } catch (error: any) {
      toast({
        title: "Failed to create employee",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const parseCSV = (text: string): any[] => {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n');
    
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseLine(lines[0]);
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = parseLine(line);
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i] || null;
        });
        return obj;
      });
  };

  const extractEmail = (row: any): string | null => {
    const keys = ['Email Address','Email address','Email','email'];
    for (const key of keys) {
      const val = row[key];
      if (typeof val === 'string' && val.trim()) {
        return val.trim().toLowerCase();
      }
    }
    return null;
  };

  const extractFullName = (row: any): string | null => {
    const directKeys = ['Full Name','Full name','Name','name'];
    for (const key of directKeys) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    const first = (row['First Name'] || '').trim();
    const last = (row['Last Name'] || '').trim();
    return [first, last].filter(Boolean).join(' ').trim() || null;
  };

  const extractJobTitle = (row: any): string | null => {
    const keys = [
      'Job Title or Role','Job Title','job_title','Title','title','Role','role','Position','position','Job Role','Job role'
    ];
    for (const key of keys) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const handleCSVImport = async () => {
    if (!file || !importCompanyId) {
      toast({
        title: "Missing information",
        description: "Please select both a company and a CSV file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;
    let newProfilesCount = 0;

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      for (const row of rows) {
        try {
          const email = extractEmail(row);
          if (!email) {
            errors.push(`Row missing email address`);
            failedCount++;
            continue;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .eq('company_id', importCompanyId)
            .maybeSingle();

          if (!profile) {
            const fullName = extractFullName(row);
            const jobTitle = extractJobTitle(row);
            const { data: newEmp, error: createError } = await supabase.functions.invoke('create-employee', {
              body: { 
                email: email, 
                full_name: fullName,
                role: jobTitle || null,
                company_id: importCompanyId
              }
            });

            if (createError || !newEmp?.id) {
              errors.push(`Failed to create ${email}: ${createError?.message || 'Unknown error'}`);
              failedCount++;
              continue;
            }
            newProfilesCount++;
            successCount++;
          } else {
            // Update existing profile with job title if not already set
            const jobTitle = extractJobTitle(row);
            if (jobTitle) {
              await supabase
                .from('profiles')
                .update({ role: jobTitle })
                .eq('id', profile.id)
                .or('role.is.null,role.eq.');
            }
            successCount++;
          }
        } catch (error: any) {
          errors.push(`Error processing row: ${error.message}`);
          failedCount++;
        }
      }

      setImportResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10),
        newProfiles: newProfilesCount,
      });

      if (failedCount === 0 && successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} employees`,
        });
      }
      
      loadCompanyData();
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending Capabilities</TabsTrigger>
          <TabsTrigger value="watchlist">Standard Cap Watchlist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {/* Employee Management */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Management</CardTitle>
          <CardDescription>Add employees manually or import via CSV</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => setIsAddEmployeeOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </CardContent>
      </Card>

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
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow 
                  key={company.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate("/dashboard/employees")}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    {company.activeEmployees} / {company.totalEmployees}
                  </TableCell>
                  <TableCell>{company.totalResponses}</TableCell>
                  <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="pending">
          <PendingCapabilitiesTab />
        </TabsContent>

        <TabsContent value="watchlist">
          <StandardCapWatchlistTab />
        </TabsContent>
      </Tabs>

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

      {/* Add Employee Dialog */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee profile and assign to a company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={newEmployee.fullName}
                onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddEmployeeOpen(false);
                setNewEmployee({ fullName: "", email: "", role: "", phone: "" });
                setSelectedCompanyId("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
              {creatingEmployee ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Employees from CSV</DialogTitle>
            <DialogDescription>
              Select a company and upload a CSV file with employee data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-company">Company *</Label>
              <Select value={importCompanyId} onValueChange={setImportCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File *</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
              />
            </div>
            {file && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  File selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}
            {importResult && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold">{importResult.success}</p>
                          <p className="text-sm text-muted-foreground">Imported ({importResult.newProfiles} new)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="text-2xl font-bold">{importResult.failed}</p>
                          <p className="text-sm text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {importResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Errors:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {importResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportOpen(false);
                setFile(null);
                setImportCompanyId("");
                setImportResult(null);
              }}
            >
              Close
            </Button>
            <Button onClick={handleCSVImport} disabled={!file || !importCompanyId || importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
