import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Search, FileText, UserPlus, Trash2, UserX, UserCheck, MoreVertical, Brain, Target, Pencil, Users2, Copy, CheckCircle2, Shield, KeyRound, Mail, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { JobDescriptionDialog } from "@/components/JobDescriptionDialog";
import { EmployeeCapabilitiesDialog } from "@/components/EmployeeCapabilitiesDialog";
import { AssignCapabilitiesDialog } from "@/components/AssignCapabilitiesDialog";
import { AssignManagerDialog } from "@/components/AssignManagerDialog";
import { ViewAsCompanyBanner } from "@/components/ViewAsCompanyBanner";
import { BatchJobDescriptionDialog } from "@/components/BatchJobDescriptionDialog";
import { AssignRoleDialog } from "@/components/AssignRoleDialog";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import { useViewAs } from "@/contexts/ViewAsContext";
import { IGPDocument } from "@/components/igp/IGPDocument";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  role: string;
  has_diagnostic: boolean;
  is_active: boolean;
  company_id: string;
  company_name?: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ fullName: "", email: "", role: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [jobDescEmployee, setJobDescEmployee] = useState<Employee | null>(null);
  const [capabilitiesEmployee, setCapabilitiesEmployee] = useState<Employee | null>(null);
  const [assignCapabilitiesEmployee, setAssignCapabilitiesEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ fullName: "", email: "", role: "", phone: "" });
  const [updating, setUpdating] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [managerAssignEmployee, setManagerAssignEmployee] = useState<Employee | null>(null);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<Employee | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [batchJobDescOpen, setBatchJobDescOpen] = useState(false);
  const [roleDialogEmployee, setRoleDialogEmployee] = useState<Employee | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [companies, setCompanies] = useState<Array<{id: string, name: string}>>([]);
  const [selectedCompanyForCreate, setSelectedCompanyForCreate] = useState<string>("");
  const [showWelcomeEmailDialog, setShowWelcomeEmailDialog] = useState(false);
  const [employeeForWelcomeEmail, setEmployeeForWelcomeEmail] = useState<Employee | null>(null);
  const [showBulkWelcomeEmailDialog, setShowBulkWelcomeEmailDialog] = useState(false);
  const [isSendingWelcomeEmails, setIsSendingWelcomeEmails] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { viewAsCompanyId } = useViewAs();

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
    } else {
      newSelection.add(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const toggleAllEmployees = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const getSelectedEmployeesData = () => {
    return employees.filter(e => selectedEmployees.has(e.id));
  };

  useEffect(() => {
    loadEmployees();
  }, [viewAsCompanyId]);

  const loadEmployees = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Check if viewing as another company (super admin feature)
      let companyId = viewAsCompanyId;
      let superAdminStatus = false;
      
      if (!companyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, is_super_admin")
          .eq("id", session.session.user.id)
          .single();

        if (!profile) return;
        
        superAdminStatus = profile.is_super_admin || false;
        setIsSuperAdmin(superAdminStatus);

        // If super admin and not viewing as a company, show all
        if (!superAdminStatus) {
          companyId = profile.company_id;
        }
      } else {
        // When viewing as a company, we're in super admin mode
        setIsSuperAdmin(true);
      }

      let query = supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          role,
          is_active,
          company_id,
          companies (name),
          diagnostic_responses (id)
        `);

      // Filter by company if specified
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data: profilesData } = await query;

      if (profilesData) {
        const mappedEmployees = profilesData.map((p: any) => ({
          id: p.id,
          full_name: p.full_name || "N/A",
          email: p.email || "N/A",
          role: p.role || "",
          has_diagnostic: p.diagnostic_responses && p.diagnostic_responses.length > 0,
          is_active: p.is_active !== false,
          company_id: p.company_id,
          company_name: p.companies?.name || "N/A",
        }));
        setEmployees(mappedEmployees);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompaniesForCreate = async () => {
    try {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      
      if (data) {
        setCompanies(data);
      }
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const generateStrongPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setTempPassword(password);
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.email || !newEmployee.fullName) {
      toast({
        title: "Validation error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    if (!tempPassword) {
      toast({
        title: "Validation error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }

    if (tempPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    // For super admins, require company selection
    if (isSuperAdmin && !selectedCompanyForCreate) {
      toast({
        title: "Validation error",
        description: "Please select a company",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          email: newEmployee.email,
          full_name: newEmployee.fullName,
          role: newEmployee.role || null,
          phone: newEmployee.phone || null,
          password: tempPassword,
          company_id: isSuperAdmin ? selectedCompanyForCreate : undefined,
        }
      });

      if (error) throw error;

      setCreatedPassword(tempPassword);
      setShowPasswordDialog(true);
      setNewEmployee({ fullName: "", email: "", role: "", phone: "" });
      setTempPassword("");
      setDialogOpen(false);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSuspendEmployee = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: employee.is_active ? "Employee suspended" : "Employee reactivated",
      });

      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });

      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (employee: Employee) => {
    setEditEmployee(employee);
    setEditFormData({
      fullName: employee.full_name,
      email: employee.email,
      role: employee.role || "",
      phone: "", // Phone is not in the Employee interface, will be loaded if needed
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editEmployee || !editFormData.fullName || !editFormData.email) {
      toast({
        title: "Validation error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editFormData.fullName,
          email: editFormData.email.toLowerCase().trim(),
          role: editFormData.role || null,
          phone: editFormData.phone || null,
        })
        .eq("id", editEmployee.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee updated successfully",
      });

      setEditDialogOpen(false);
      setEditEmployee(null);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  // Get unique companies for the filter dropdown
  const uniqueCompanies = Array.from(new Set(employees.map(emp => emp.company_name).filter(Boolean)));

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesCompany = selectedCompany === "all" || emp.company_name === selectedCompany;
    
    return matchesSearch && matchesCompany;
  });

  const copyPasswordToClipboard = () => {
    navigator.clipboard.writeText(createdPassword);
    toast({
      title: "Copied!",
      description: "Password copied to clipboard",
    });
  };

  const handlePasswordResetSuccess = (password: string) => {
    setCreatedPassword(password);
    setShowPasswordDialog(true);
    setResetPasswordDialogOpen(false);
    setResetPasswordEmployee(null);
  };

  const handleSendWelcomeEmail = async (employee: Employee) => {
    setEmployeeForWelcomeEmail(employee);
    setShowWelcomeEmailDialog(true);
  };

  const handleConfirmSendWelcomeEmail = async () => {
    if (!employeeForWelcomeEmail) return;

    try {
      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + "!1";
      
      // Reset the employee's password
      const { error: resetError } = await supabase.functions.invoke('reset-employee-password', {
        body: {
          employee_id: employeeForWelcomeEmail.id,
          new_password: tempPassword
        }
      });

      if (resetError) throw resetError;

      // Send the welcome email - use production URL, not preview URL
      const loginUrl = 'https://thought-before-action.lovable.app/sales-agent';
      const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          email: employeeForWelcomeEmail.email,
          fullName: employeeForWelcomeEmail.full_name,
          password: tempPassword,
          loginUrl
        }
      });

      if (emailError) throw emailError;

      toast({
        title: "Welcome email sent",
        description: `Welcome email sent to ${employeeForWelcomeEmail.full_name}`,
      });
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send welcome email",
        variant: "destructive",
      });
    } finally {
      setShowWelcomeEmailDialog(false);
      setEmployeeForWelcomeEmail(null);
    }
  };

  const handleBulkSendWelcomeEmails = () => {
    setShowBulkWelcomeEmailDialog(true);
  };

  const handleConfirmBulkSendWelcomeEmails = async () => {
    setIsSendingWelcomeEmails(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Use production URL, not preview URL
      const loginUrl = 'https://thought-before-action.lovable.app/sales-agent';
      
      for (const employeeId of Array.from(selectedEmployees)) {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) continue;

        try {
          // Generate a random temporary password
          const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + "!1";
          
          // Reset the employee's password
          const { error: resetError } = await supabase.functions.invoke('reset-employee-password', {
            body: {
              employee_id: employee.id,
              new_password: tempPassword
            }
          });

          if (resetError) throw resetError;

          // Send the welcome email
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: employee.email,
              fullName: employee.full_name,
              password: tempPassword,
              loginUrl
            }
          });

          if (emailError) throw emailError;
          
          successCount++;
        } catch (error) {
          console.error(`Failed to send welcome email to ${employee.full_name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Welcome emails sent",
          description: `Successfully sent ${successCount} welcome email${successCount !== 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : ''}`,
        });
      }
      
      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Error",
          description: "Failed to send welcome emails",
          variant: "destructive",
        });
      }

      setSelectedEmployees(new Set());
    } catch (error: any) {
      console.error('Error in bulk send:', error);
      toast({
        title: "Error",
        description: "An error occurred while sending welcome emails",
        variant: "destructive",
      });
    } finally {
      setIsSendingWelcomeEmails(false);
      setShowBulkWelcomeEmailDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <ViewAsCompanyBanner />
      
      {/* Password Display Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Employee Created Successfully
            </DialogTitle>
            <DialogDescription>
              Save this password now - it won't be shown again
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={createdPassword}
                  readOnly
                  className="font-mono bg-muted"
                />
                <Button type="button" variant="outline" onClick={copyPasswordToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Share this password securely with the employee. They should change it after their first login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPasswordDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your team and their diagnostics</p>
        </div>
        <div className="flex gap-2">
          {selectedEmployees.size > 0 && (
            <>
              <Button onClick={() => setBatchJobDescOpen(true)} variant="default">
                <Brain className="mr-2 h-4 w-4" />
                Batch Assign ({selectedEmployees.size})
              </Button>
              <Button onClick={handleBulkSendWelcomeEmails} variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Send Welcome Emails ({selectedEmployees.size})
              </Button>
            </>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (open && isSuperAdmin) {
              // Load companies when dialog opens for super admins
              loadCompaniesForCreate();
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee profile manually
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={newEmployee.fullName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                  placeholder="John Doe"
                  />
                </div>
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="company">Company *</Label>
                    <Select value={selectedCompanyForCreate} onValueChange={setSelectedCompanyForCreate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
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
                )}
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
                  <Label htmlFor="role">Role (Optional)</Label>
                  <Input
                    id="role"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Enter or generate password"
                    />
                    <Button type="button" variant="outline" onClick={generateStrongPassword}>
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters. This password will be shown once after creation.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEmployee} disabled={creating}>
                  {creating ? "Creating..." : "Create Employee"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {isSuperAdmin && uniqueCompanies.length > 0 && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map((company) => (
                    <SelectItem key={company} value={company || ""}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleAllEmployees}
                      aria-label="Select all employees"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isSuperAdmin && <TableHead>Company</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Diagnostic</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className={!employee.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={() => toggleEmployeeSelection(employee.id)}
                          aria-label={`Select ${employee.full_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.role || <span className="text-muted-foreground">—</span>}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <Badge variant="outline">{employee.company_name}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {employee.is_active ? (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Suspended</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.has_diagnostic ? (
                          <Badge variant="default" className="bg-success">
                            <FileText className="mr-1 h-3 w-3" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                            <DropdownMenuItem onClick={() => handleEditClick(employee)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Employee
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCapabilitiesEmployee(employee)}>
                              <Target className="mr-2 h-4 w-4" />
                              View Capabilities
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAssignCapabilitiesEmployee(employee)}>
                              <Target className="mr-2 h-4 w-4" />
                              Assign Capabilities
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setJobDescEmployee(employee)}>
                              <Brain className="mr-2 h-4 w-4" />
                              Analyze Job Description
                            </DropdownMenuItem>
                            <IGPDocument
                              profileId={employee.id}
                              employeeName={employee.full_name}
                              variant="menuItem"
                            />
                            <DropdownMenuItem onClick={() => {
                              setManagerAssignEmployee(employee);
                              setManagerDialogOpen(true);
                            }}>
                              <Users2 className="mr-2 h-4 w-4" />
                              Assign Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setRoleDialogEmployee(employee);
                              setRoleDialogOpen(true);
                            }}>
                              <Shield className="mr-2 h-4 w-4" />
                              Manage Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setResetPasswordEmployee(employee);
                              setResetPasswordDialogOpen(true);
                            }}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendWelcomeEmail(employee)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Welcome Email
                            </DropdownMenuItem>
                              {employee.is_active ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Suspend
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName">Full Name *</Label>
              <Input
                id="editFullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Input
                id="editRole"
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={updating}>
              {updating ? "Updating..." : "Update Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEmployee?.full_name}? This action cannot be undone and will permanently remove all their data including diagnostic responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEmployee(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {jobDescEmployee && (
        <JobDescriptionDialog
          open={!!jobDescEmployee}
          onOpenChange={(open) => {
            if (!open) {
              setJobDescEmployee(null);
              loadEmployees();
            }
          }}
          employee={jobDescEmployee}
        />
      )}

      {capabilitiesEmployee && (
        <EmployeeCapabilitiesDialog
          open={!!capabilitiesEmployee}
          onOpenChange={(open) => {
            if (!open) setCapabilitiesEmployee(null);
          }}
          employee={capabilitiesEmployee}
        />
      )}

      {assignCapabilitiesEmployee && (
        <AssignCapabilitiesDialog
          open={!!assignCapabilitiesEmployee}
          onOpenChange={(open) => {
            if (!open) setAssignCapabilitiesEmployee(null);
          }}
          employee={assignCapabilitiesEmployee}
        />
      )}

      {managerAssignEmployee && (
        <AssignManagerDialog
          open={managerDialogOpen}
          onOpenChange={(open) => {
            setManagerDialogOpen(open);
            if (!open) {
              setManagerAssignEmployee(null);
              loadEmployees();
            }
          }}
          employee={{
            id: managerAssignEmployee.id,
            full_name: managerAssignEmployee.full_name,
            company_id: managerAssignEmployee.company_id
          }}
        />
      )}

      {resetPasswordEmployee && (
        <ResetPasswordDialog
          open={resetPasswordDialogOpen}
          onOpenChange={(open) => {
            setResetPasswordDialogOpen(open);
            if (!open) setResetPasswordEmployee(null);
          }}
          employeeId={resetPasswordEmployee.id}
          employeeName={resetPasswordEmployee.full_name}
          onSuccess={handlePasswordResetSuccess}
        />
      )}

      {roleDialogEmployee && (
        <AssignRoleDialog
          open={roleDialogOpen}
          onOpenChange={(open) => {
            setRoleDialogOpen(open);
            if (!open) {
              setRoleDialogEmployee(null);
            }
          }}
          employeeId={roleDialogEmployee.id}
          employeeName={roleDialogEmployee.full_name}
        />
      )}

      <BatchJobDescriptionDialog
        open={batchJobDescOpen}
        onOpenChange={(open) => {
          setBatchJobDescOpen(open);
          if (!open) {
            setSelectedEmployees(new Set());
            loadEmployees();
          }
        }}
        employees={getSelectedEmployeesData()}
      />

      <AlertDialog open={showWelcomeEmailDialog} onOpenChange={setShowWelcomeEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Welcome Email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a NEW temporary password for {employeeForWelcomeEmail?.full_name} and send them a welcome email with login credentials to {employeeForWelcomeEmail?.email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSendWelcomeEmail}>
              Send Welcome Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkWelcomeEmailDialog} onOpenChange={setShowBulkWelcomeEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Welcome Emails?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate NEW temporary passwords for {selectedEmployees.size} employee{selectedEmployees.size !== 1 ? 's' : ''} and send them welcome emails with login credentials.
              <div className="mt-4 max-h-48 overflow-y-auto">
                <p className="font-semibold mb-2">Selected employees:</p>
                <ul className="list-disc list-inside space-y-1">
                  {Array.from(selectedEmployees).map(id => {
                    const emp = employees.find(e => e.id === id);
                    return emp ? <li key={id}>{emp.full_name} ({emp.email})</li> : null;
                  })}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSendingWelcomeEmails}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkSendWelcomeEmails} disabled={isSendingWelcomeEmails}>
              {isSendingWelcomeEmails ? "Sending..." : "Send All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Employees;