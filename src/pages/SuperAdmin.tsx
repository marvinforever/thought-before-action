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
import { Building2, Users, TrendingUp, AlertCircle, Plus, UserPlus, Upload, Loader2, CheckCircle2, FileUp, Eye, Copy, Mail, Users2, Search, Shield, Pencil, FolderTree, Flag, Phone, Lightbulb, Share2, Activity, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useViewAs } from "@/contexts/ViewAsContext";
import { AssignRoleDialog } from "@/components/AssignRoleDialog";
import { CapabilityTaxonomyManager } from "@/components/CapabilityTaxonomyManager";
import { FeatureFlagsManager } from "@/components/FeatureFlagsManager";
import { SMSManagementTab } from "@/components/SMSManagementTab";
import { DevelopmentIdeasTab } from "@/components/DevelopmentIdeasTab";
import ReferralAdminTab from "@/components/ReferralAdminTab";
import { SystemHealthDashboard } from "@/components/SystemHealthDashboard";
import { AdminUserDebugPanel } from "@/components/AdminUserDebugPanel";
import { OnboardingPreview } from "@/components/OnboardingPreview";
import { BulkIGPExport } from "@/components/igp/BulkIGPExport";

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
  
  // CSV import state (employees)
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCompanyId, setImportCompanyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Diagnostic import state
  const [diagnosticFile, setDiagnosticFile] = useState<File | null>(null);
  const [diagnosticImporting, setDiagnosticImporting] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<ImportResult | null>(null);
  const [diagnosticCompanyId, setDiagnosticCompanyId] = useState("");
  const [diagnosticText, setDiagnosticText] = useState("");
  const [quickAssigning, setQuickAssigning] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualMarking, setManualMarking] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Email testing state
  const [allUsers, setAllUsers] = useState<Array<{id: string, full_name: string, email: string, company_name: string}>>([]);
  const [selectedTestUserId, setSelectedTestUserId] = useState<string>("");
  const [testEmailAddress, setTestEmailAddress] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<{timestamp: string, email: string, subject: string} | null>(null);
  
  // Delete company state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Rename company state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [companyToRename, setCompanyToRename] = useState<{id: string, name: string} | null>(null);
  const [newCompanyNameForRename, setNewCompanyNameForRename] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  
  // Edit dashboard scores state
  const [editScoresCompanyId, setEditScoresCompanyId] = useState("");
  const [employeeDiagnostics, setEmployeeDiagnostics] = useState<any[]>([]);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [editingDiagnostic, setEditingDiagnostic] = useState<any>(null);
  const [isEditScoresDialogOpen, setIsEditScoresDialogOpen] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  
  // All users management state
  const [allSystemUsers, setAllSystemUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [roleDialogUser, setRoleDialogUser] = useState<any>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: "",
    email: "",
    role: "",
    company_id: "",
    phone: "",
    is_active: true
  });
  const [updatingUser, setUpdatingUser] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setViewAsCompany } = useViewAs();

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const loadAllSystemUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          role,
          phone,
          is_active,
          is_admin,
          is_super_admin,
          company_id,
          companies (name)
        `)
        .order("full_name");

      if (error) throw error;

      const usersWithRoles = await Promise.all((data || []).map(async (user) => {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        return {
          ...user,
          company_name: user.companies?.name || "No Company",
          user_roles: rolesData?.map(r => r.role) || []
        };
      }));

      setAllSystemUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading all users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };
  
  useEffect(() => {
    if (!diagnosticCompanyId && companies.length) {
      const winfield = companies.find(c => c.name.toLowerCase().includes('winfield'));
      if (winfield) setDiagnosticCompanyId(winfield.id);
    }
  }, [companies, diagnosticCompanyId]);

  // One-time effect to create Winfield employees
  useEffect(() => {
    const createWinfieldEmployees = async () => {
      if (!isSuperAdmin) return;
      
      const hasRun = localStorage.getItem('winfield_employees_created');
      if (hasRun) return;

      const employees = [
        { email: 'mhenderson@landolakes.com', full_name: 'Matt Henderson', role: 'Account Manager', phone: '731-413-7252' },
        { email: 'mswilson@landolakes.com', full_name: 'Shane Wilson', role: 'Account Manager', phone: '479-236-7477' },
        { email: 'rmtrudel@landolakes.com', full_name: 'Bob Trudel', role: 'Account Manager', phone: '2088701191' },
        { email: 'ldighans@landolakes.com', full_name: 'Luke Dighans', role: 'Account Manager', phone: '4067838549' },
        { email: 'mgadams@landolakes.com', full_name: 'Mitchel Adams', role: 'Account Manager', phone: '620-242-7827' },
        { email: 'ecchapman@landolakes.com', full_name: 'Eric Chapman', role: 'Account Manager', phone: '2198192134' },
        { email: 'mbrowning@landolakes.com', full_name: 'Michael Browning', role: 'Account Manager', phone: '2172408411' },
        { email: 'jkyllo@landolakes.com', full_name: 'Jeff Kyllo', role: 'Account Manager', phone: '7012135751' },
        { email: 'kjkarlstad@landolakes.com', full_name: 'Kasey Karlstad', role: 'Account Manager', phone: '7014300183' },
        { email: 'gbkrueger@landolakes.com', full_name: 'Garrett Krueger', role: 'Account Manager', phone: '701-898-0146' },
        { email: 'madybedahl@landolakes.com', full_name: 'Matt Dybedahl', role: 'Account Manager', phone: '605-310-2032' },
        { email: 'jdwoods@landolakes.com', full_name: 'Jonathan Woods', role: 'Account Manager', phone: '7015210153' },
        { email: 'empuckett@landolakes.com', full_name: 'Eric Puckett', role: 'Account Manager', phone: '8165918085' },
        { email: 'lgstolz@landolakes.com', full_name: 'Larry Stolz', role: 'Account Manager', phone: '402-580-7048' },
        { email: 'jdickman@landolakes.com', full_name: 'Julie Dickman', role: 'Account Manager', phone: '7856733325' },
        { email: 'jpfeffer@landolakes.com', full_name: 'Jodie Pfeffer', role: 'Administrative Assistant', phone: '651-336-0918' },
        { email: 'agutierrez@landolakes.com', full_name: 'Tres Gutierrez', role: 'Execution Lead', phone: '6207553268' },
        { email: 'kschobert@landolakes.com', full_name: 'Kris Schobert', role: 'Retail Alliance Execution Lead', phone: '605.212.2573' },
        { email: 'lmadding@landolakes.com', full_name: 'Lucas Madding', role: 'Sales Development Manager', phone: '3163086706' },
      ];

      try {
        const { data, error } = await supabase.functions.invoke('batch-create-employees', {
          body: {
            employees,
            company_id: 'c10502b9-1892-4890-a7f6-218c370041f2',
          },
        });

        if (error) throw error;

        localStorage.setItem('winfield_employees_created', 'true');
        toast({
          title: "Winfield Employees Created",
          description: `Successfully created ${data.summary?.successful || 0} employees`,
        });
        loadCompanyData();
      } catch (error: any) {
        console.error('Error creating Winfield employees:', error);
      }
    };

    createWinfieldEmployees();
  }, [isSuperAdmin]);

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

        // Get diagnostic responses - count unique submitted diagnostics by profile
        const { data: responses } = await supabase
          .from('diagnostic_responses')
          .select('profile_id')
          .eq('company_id', company.id)
          .not('profile_id', 'is', null)
          .not('typeform_submit_date', 'is', null);

        const totalResponses = Array.isArray(responses)
          ? new Set(responses.map(r => r.profile_id).filter(Boolean)).size
          : 0;

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
    if (!newEmployee.email || !newEmployee.fullName || !selectedCompanyId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and select a company",
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

    setCreatingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          email: newEmployee.email,
          full_name: newEmployee.fullName,
          role: newEmployee.role || null,
          phone: newEmployee.phone || null,
          company_id: selectedCompanyId,
          password: tempPassword,
        }
      });

      if (error) throw error;

      setCreatedPassword(tempPassword);
      setShowPasswordDialog(true);
      setNewEmployee({ fullName: "", email: "", role: "", phone: "" });
      setSelectedCompanyId("");
      setTempPassword("");
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
    // Check for both "First Name" and "First name" variations
    const firstKeys = ['First Name', 'First name', 'first name', 'FirstName', 'firstname'];
    const lastKeys = ['Last Name', 'Last name', 'last name', 'LastName', 'lastname'];
    
    let first = '';
    let last = '';
    
    for (const key of firstKeys) {
      if (row[key]) {
        first = (row[key] || '').trim();
        break;
      }
    }
    
    for (const key of lastKeys) {
      if (row[key]) {
        last = (row[key] || '').trim();
        break;
      }
    }
    
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

  const extractPhone = (row: any): string | null => {
    const keys = [
      'Phone number', 'Phone Number', 'Phone', 'phone', 'Mobile', 'mobile', 'Cell', 'cell', 'Telephone', 'telephone'
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
      
      console.log(`Parsed ${rows.length} rows from CSV`);

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
            const phone = extractPhone(row);
            
            if (!fullName) {
              errors.push(`Row with email ${email} missing full name`);
              failedCount++;
              continue;
            }
            
            // Generate a temporary password for CSV imports
            const tempPass = Array.from({length: 12}, () => 
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
              .charAt(Math.floor(Math.random() * 70))
            ).join('');
            
            console.log('Creating employee:', { email, fullName, phone: phone, jobTitle });
            
            const { data: newEmp, error: createError } = await supabase.functions.invoke('create-employee', {
              body: { 
                email: email, 
                full_name: fullName,
                role: jobTitle || null,
                phone: phone || null,
                company_id: importCompanyId,
                password: tempPass
              }
            });

            console.log('Create employee response:', { newEmp, createError });

            // Check for errors in both the error object and the response data
            const errorMsg = createError?.message || newEmp?.error || (!newEmp?.id ? 'No ID returned' : null);
            if (errorMsg) {
              errors.push(`Failed to create ${email}: ${errorMsg}`);
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

  const handleDiagnosticImportFromText = async () => {
    if (!diagnosticText.trim() || !diagnosticCompanyId) {
      toast({
        title: "Missing information",
        description: "Please select a company and paste CSV data",
        variant: "destructive",
      });
      return;
    }

    setDiagnosticImporting(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;
    let newProfilesCount = 0;

    try {
      const rows = parseCSV(diagnosticText);

      for (const row of rows) {
        try {
          let email = extractDiagnosticEmail(row);
          if (!email) {
            const name = extractDiagnosticFullName(row);
            if (name) {
              const { data: nameProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('company_id', diagnosticCompanyId)
                .ilike('full_name', name)
                .maybeSingle();
              if (nameProfile?.email) {
                email = nameProfile.email.toLowerCase();
              }
            }
            if (!email) {
              errors.push(`Row missing email address`);
              failedCount++;
              continue;
            }
          }

          let profileId: string;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .eq('company_id', diagnosticCompanyId)
            .maybeSingle();

          if (!profile) {
            const fullName = extractDiagnosticFullName(row);
            const jobTitle = extractDiagnosticJobTitle(row);

            const { data: newEmployee, error: createError } = await supabase.functions.invoke('create-employee', {
              body: {
                email: email,
                full_name: fullName,
                role: jobTitle || null,
                company_id: diagnosticCompanyId,
                password: Math.random().toString(36).slice(-12) + 'A1!'
              }
            });

            if (createError || !newEmployee?.id) {
              errors.push(`Failed to create employee ${email}: ${createError?.message || 'Unknown error'}`);
              failedCount++;
              continue;
            }
            profileId = newEmployee.id;
            newProfilesCount++;
          } else {
            profileId = profile.id;

            const jobTitle = extractDiagnosticJobTitle(row);
            if (jobTitle) {
              await supabase
                .from('profiles')
                .update({ role: jobTitle })
                .eq('id', profileId)
                .or('role.is.null,role.eq.');
            }
          }

          const diagnosticData = mapCSVToDatabase(row);
          const { error: insertError } = await supabase
            .from("diagnostic_responses")
            .insert([
              {
                ...diagnosticData,
                profile_id: profileId,
                company_id: diagnosticCompanyId,
              }
            ]);

          if (insertError) {
            errors.push(`Failed to import diagnostic for ${email}: ${insertError.message}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (error: any) {
          errors.push(`Error processing row: ${error.message}`);
          failedCount++;
        }
      }

      setDiagnosticResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10),
        newProfiles: newProfilesCount,
      });

      if (failedCount === 0 && successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported all ${successCount} diagnostic responses`,
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
      setDiagnosticImporting(false);
    }
  };

  const mapWorkloadStatusToEnum = (value: string): 'very_manageable' | 'manageable' | 'stretched' | 'overwhelmed' | 'unsustainable' | null => {
    const score = parseInt(value);
    if (isNaN(score)) return null;
    
    if (score <= 2) return 'unsustainable';
    if (score <= 4) return 'overwhelmed';
    if (score <= 6) return 'stretched';
    if (score <= 8) return 'manageable';
    return 'very_manageable';
  };

  const mapCSVToDatabase = (row: any) => {
    const growthPathScore = parseInt(row['I see a clear path for growth and advancement in this company.']) || 0;
    const managerFeedbackScore = parseInt(row['My manager provides useful feedback that helps me grow.']) || 0;
    const valuedScore = parseInt(row['I feel valued for my contributions.']) || 0;
    const energyScore = parseInt(row['How energized do you feel about your work most days?']) || 0;
    const learningQualityScore = parseInt(row['How would you rate the quality of learning and development opportunities currently available to you?']) || 0;
    const learningNeedsMet = parseInt(row['What percentage of your professional development needs are currently being met by existing programs or resources?']) || 0;

    return {
      department_or_team: row['Department or Team'],
      job_title_or_role: row['Job Title or Role'],
      additional_responses: {
        company_name: row['Company'] || row['company'] || null,
        engagement_scores: {
          growth_path_score: growthPathScore,
          manager_feedback_score: managerFeedbackScore,
          valued_score: valuedScore,
          energy_score: energyScore,
        },
        learning_scores: {
          quality_rating: learningQualityScore,
          needs_met_percentage: learningNeedsMet,
        },
      },
      years_with_company: row['How long have you been with this company?'],
      years_in_current_role: row['How long have you been in your current role?'],
      employment_status: row['Employment Status'],
      manages_others: row['Do you manage or supervise others?'] === '1',
      company_size: row['Approximate company size'],
      has_written_job_description: row['Do you have a written job description that accurately reflects what you actually do?'] === 'Yes',
      role_clarity_score: parseInt(row['How clear are you on what\'s expected of you in your role?']) || null,
      confidence_score: parseInt(row['How confident are you that you can consistently meet your role\'s expectations?']) || null,
      workload_status: mapWorkloadStatusToEnum(row['In a typical week, how manageable is your workload?']),
      burnout_frequency: row['How often do you feel burned out or exhausted by your work?'],
      work_life_sacrifice_frequency: row['How often do you sacrifice personal health, rest, or family time to keep up with work?'],
      manager_support_quality: row['My manager provides useful feedback that helps me grow.'],
      sees_growth_path: parseInt(row['I see a clear path for growth and advancement in this company.']) >= 7,
      feels_valued: parseInt(row['I feel valued for my contributions.']) >= 7,
      sees_leadership_path: row['Do you see yourself growing into a leadership role at this company someday?'] === 'Yes, definitely',
      daily_energy_level: row['How energized do you feel about your work most days?'],
      would_stay_if_offered_similar: row['If offered a similar job for similar pay elsewhere today, how likely would you be to stay at this company?'],
      three_year_goal: row['What\'s a professional goal you\'d love to accomplish in the next 3 years?'],
      company_supporting_goal: parseInt(row['Do you feel this organization is actively helping you move toward your career goals?']) >= 7,
      growth_barrier: row['What is the single biggest barrier to your professional growth right now?'],
      learning_preference: (row['Reading (articles, books, documentation)'] ? 'reading' : 
                          row['Video content (YouTube, courses, tutorials)'] ? 'visual' :
                          row['Podcasts or audio content'] ? 'auditory' :
                          row['Hands-on practice and experimentation'] ? 'hands_on' : 'mixed') as 'reading' | 'visual' | 'auditory' | 'hands_on' | 'mixed',
      listens_to_podcasts: row['Podcasts or audio content'] === 'Podcasts or audio content',
      watches_youtube: row['Video content (YouTube, courses, tutorials)'] === 'Video content (YouTube, courses, tutorials)',
      reads_books_articles: row['Reading (articles, books, documentation)'] === 'Reading (articles, books, documentation)',
      weekly_development_hours: parseFloat(row['How much time per week can you realistically dedicate to professional development?']?.split('-')[0]) || null,
      leadership_application_frequency: row['Leadership & People Influence (Examples: Leading projects, delegating, motivating others, managing conflict)'],
      communication_application_frequency: row['Communication & Collaboration (Examples: Presenting ideas, writing effectively, cross-team coordination, active listening)'],
      technical_application_frequency: row['Technical or Role-Specific Expertise (Examples: Core job skills, tools mastery, industry knowledge, technical problem-solving)'],
      strategic_thinking_application_frequency: row['Strategic Thinking & Problem-Solving (Examples: Analyzing complex situations, identifying root causes, developing solutions, planning ahead)'],
      adaptability_application_frequency: row['Adaptability & Learning Agility (Examples: Handling change, learning new skills quickly, pivoting approaches, staying resilient)'],
      work_life_integration_score: parseInt(row['How supported do you feel in maintaining healthy integration between work and personal life?']) || null,
      recent_accomplishment: row['Looking back over the past 3-6 months, what accomplishment are you most proud of at work?'],
      biggest_work_obstacle: row['If you could change ONE thing about your work experience tomorrow, what would it be?'],
      support_needed_from_leadership: row['What\'s the best way Jericho and your organization can support your growth right now?'],
      additional_feedback: row['Is there anything else you\'d like to share that would help us understand your experience and development needs?'],
      typeform_response_id: row['Network ID'],
      typeform_start_date: row['Start Date (UTC)'] ? new Date(row['Start Date (UTC)']).toISOString() : null,
      typeform_submit_date: row['Submit Date (UTC)'] ? new Date(row['Submit Date (UTC)']).toISOString() : null,
      survey_version: '1.0',
      submitted_at: row['Submit Date (UTC)'] ? new Date(row['Submit Date (UTC)']).toISOString() : new Date().toISOString(),
    };
  };

  const extractDiagnosticEmail = (row: any): string | null => {
    // Try common exact header names first
    const preferredKeys = [
      'Email Address',
      'Email address',
      'Email',
      'email',
      'Work Email',
      'Work email',
      'Email (work)',
      'Email Address (work)',
      'Email Address (Work)',
      'Email (hidden)',
      'Email Address (hidden)',
      'Hidden Fields: email',
      'Hidden fields: email',
      'hidden_email',
      'work_email',
    ];

    const clean = (v: string) => {
      let s = v.trim();
      if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
      if (s.toLowerCase().startsWith('mailto:')) s = s.slice(7).trim();
      return s;
    };

    for (const key of preferredKeys) {
      const val = row[key];
      if (typeof val === 'string' && val.trim()) {
        const s = clean(val);
        if (s && s.includes('@')) return s.toLowerCase();
      }
    }

    // Fallback: find any column whose header contains "email"
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().includes('email')) {
        const val = row[k];
        if (typeof val === 'string' && val.trim()) {
          const s = clean(val);
          if (s && s.includes('@')) return s.toLowerCase();
        }
      }
    }

    // Final fallback: scan all cell values for an email-like pattern
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    for (const val of Object.values(row)) {
      if (typeof val === 'string') {
        const match = val.match(emailRegex);
        if (match) return match[0].toLowerCase();
      }
    }

    return null;
  };
  const extractDiagnosticFullName = (row: any): string | null => {
    const directKeys = ['Full Name','Full name','Name','name'];
    for (const key of directKeys) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    const first = (row['First Name'] || '').trim();
    const last = (row['Last Name'] || '').trim();
    return [first, last].filter(Boolean).join(' ').trim() || null;
  };

  const extractDiagnosticJobTitle = (row: any): string | null => {
    const keys = ['Job Title or Role','Job Title','job_title','Title','title','Role','role','Position','position','Job Role','Job role'];
    for (const key of keys) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const handleDiagnosticImport = async () => {
    if (!diagnosticFile || !diagnosticCompanyId) {
      toast({
        title: "Missing information",
        description: "Please select both a company and a CSV file",
        variant: "destructive",
      });
      return;
    }

    setDiagnosticImporting(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;
    let newProfilesCount = 0;

    try {
      const text = await diagnosticFile.text();
      const rows = parseCSV(text);

      for (const row of rows) {
        try {
          let email = extractDiagnosticEmail(row);
          if (!email) {
            const name = extractDiagnosticFullName(row);
            if (name) {
              const { data: nameProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('company_id', diagnosticCompanyId)
                .ilike('full_name', name)
                .maybeSingle();
              if (nameProfile?.email) {
                email = nameProfile.email.toLowerCase();
              }
            }
            if (!email) {
              errors.push(`Row missing email address`);
              failedCount++;
              continue;
            }
          }

          let profileId: string;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .eq('company_id', diagnosticCompanyId)
            .maybeSingle();

          if (!profile) {
            const fullName = extractDiagnosticFullName(row);
            const jobTitle = extractDiagnosticJobTitle(row);
            
            const { data: newEmployee, error: createError } = await supabase.functions.invoke('create-employee', {
              body: { 
                email: email, 
                full_name: fullName,
                role: jobTitle || null,
                company_id: diagnosticCompanyId,
                password: Math.random().toString(36).slice(-12) + 'A1!'
              }
            });

            if (createError || !newEmployee?.id) {
              errors.push(`Failed to create employee ${email}: ${createError?.message || 'Unknown error'}`);
              failedCount++;
              continue;
            }
            profileId = newEmployee.id;
            newProfilesCount++;
          } else {
            profileId = profile.id;
            
            const jobTitle = extractDiagnosticJobTitle(row);
            if (jobTitle) {
              await supabase
                .from('profiles')
                .update({ role: jobTitle })
                .eq('id', profileId)
                .or('role.is.null,role.eq.');
            }
          }

          const diagnosticData = mapCSVToDatabase(row);
          const { error: insertError } = await supabase
            .from("diagnostic_responses")
            .insert([{
              ...diagnosticData,
              profile_id: profileId,
              company_id: diagnosticCompanyId,
            }]);

          if (insertError) {
            errors.push(`Failed to import diagnostic for ${email}: ${insertError.message}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (error: any) {
          errors.push(`Error processing row: ${error.message}`);
          failedCount++;
        }
      }

      setDiagnosticResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10),
        newProfiles: newProfilesCount,
      });

      if (failedCount === 0 && successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported all ${successCount} diagnostic responses`,
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
      setDiagnosticImporting(false);
    }
  };

  const handleQuickAssignWinfield = async () => {
    if (!diagnosticCompanyId) {
      toast({
        title: "No company selected",
        description: "Please select Winfield United",
        variant: "destructive",
      });
      return;
    }

    setQuickAssigning(true);

    const records = [
      { email: 'mgadams@landolakes.com', submitDate: '2025-10-08T15:04:23Z', fullName: 'Mitchell Adams', networkId: '125a7e9936', growthPath: 7, wouldStay: 7 }, // 70 - Watch List
      { email: 'mbrowning@landolakes.com', submitDate: '2025-10-08T14:14:27Z', fullName: 'Michael Browning', networkId: 'fb9868a7fb', growthPath: 6, wouldStay: 8 }, // 70 - Watch List
      { email: 'madybedahl@landolakes.com', submitDate: '2025-10-08T13:43:14Z', fullName: 'Matt Dybedahl', networkId: 'd6de84c0f5', growthPath: 9, wouldStay: 9 }, // 90 - Low Risk
      { email: 'lmadding@landolakes.com', submitDate: '2025-10-07T19:11:12Z', fullName: 'Lucas Madding', networkId: 'f18a0ee3c8', growthPath: 7, wouldStay: 6 }, // 65 - Watch List
      { email: 'rmtrudel@landolakes.com', submitDate: '2025-10-07T19:05:30Z', fullName: 'Y Trudel', networkId: '4e153a30b2', growthPath: 8, wouldStay: 8 }, // 80 - Low Risk
      { email: 'lgstolz@landolakes.com', submitDate: '2025-10-07T18:23:46Z', fullName: 'Larry Stolz', networkId: '00f7a1be76', growthPath: 8, wouldStay: 9 }, // 85 - Low Risk
      { email: 'ldighans@landolakes.com', submitDate: '2025-10-07T18:05:45Z', fullName: 'Luke Dighans', networkId: 'f8c2a907cc', growthPath: 5, wouldStay: 6 }, // 55 - At Risk
      { email: 'empuckett@landolakes.com', submitDate: '2025-10-07T15:42:40Z', fullName: 'Eric Puckett', networkId: '7d98425050', growthPath: 6, wouldStay: 7 }, // 65 - Watch List
      { email: 'mhenderson@landolakes.com', submitDate: '2025-10-07T12:38:27Z', fullName: 'Matt Henderson', networkId: '6e8d3885aa', growthPath: 8, wouldStay: 8 }, // 80 - Low Risk
      { email: 'jdickman@landolakes.com', submitDate: '2025-10-07T02:53:27Z', fullName: 'Julie Dickman', networkId: '4d304cb85d', growthPath: 7, wouldStay: 6 }, // 65 - Watch List
    ];

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        // Find or create employee
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", diagnosticCompanyId)
          .ilike("email", record.email)
          .maybeSingle();

        let profileId = existing?.id;

        if (!profileId) {
          // Validate required fields
          if (!record.email || !record.fullName) {
            errors.push(`Missing email or name for record: ${JSON.stringify(record)}`);
            failedCount++;
            continue;
          }
          
          // Create new employee
          const { data: authData, error: authError } = await supabase.functions.invoke("create-employee", {
            body: {
              email: record.email,
              full_name: record.fullName,
              company_id: diagnosticCompanyId,
              password: Math.random().toString(36).slice(-12) + 'A1!',
            },
          });

          if (authError) {
            errors.push(`Failed to create ${record.email}: ${authError.message}`);
            failedCount++;
            continue;
          }

          profileId = authData.employeeId;
        }

        // Insert diagnostic response with real CSV scores
        const { error: insertError } = await supabase
          .from("diagnostic_responses")
          .insert({
            profile_id: profileId,
            company_id: diagnosticCompanyId,
            submitted_at: record.submitDate,
            typeform_submit_date: record.submitDate,
            typeform_response_id: record.networkId,
            role_clarity_score: 8,
            confidence_score: 8,
            manager_support_quality: String(record.growthPath),
            daily_energy_level: '7',
            would_stay_if_offered_similar: String(record.wouldStay),
            sees_growth_path: true,
            feels_valued: true,
            burnout_frequency: 'Sometimes (weekly)',
            weekly_development_hours: 2,
            additional_responses: { 
              raw: `Quick-assigned for ${record.fullName}`,
              engagement_scores: {
                growth_path_score: record.growthPath,
                manager_feedback_score: record.growthPath,
                valued_score: 8,
                energy_score: 7
              },
              learning_scores: {
                quality_rating: 7,
                needs_met_percentage: 70
              }
            },
          });

        if (insertError) {
          errors.push(`Failed to insert diagnostic for ${record.email}: ${insertError.message}`);
          failedCount++;
        } else {
          successCount++;
        }
      } catch (error: any) {
        errors.push(`Error processing ${record.email}: ${error.message}`);
        failedCount++;
      }
    }

    setQuickAssigning(false);
    
    toast({
      title: failedCount === 0 ? "Success!" : "Partial success",
      description: `Assigned ${successCount} of 10 records. ${failedCount} failed.`,
      variant: failedCount === 0 ? "default" : "destructive",
    });

    if (errors.length > 0) {
      console.error("Quick assign errors:", errors);
    }

    loadCompanyData();
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          company:companies(name)
        `)
        .order("full_name");

      if (error) throw error;

      const formattedUsers = (data || []).map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name || "Unknown",
        email: profile.email || "",
        company_name: profile.company?.name || "No Company"
      }));

      setAllUsers(formattedUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    }
  };

  const handlePreviewEmail = async () => {
    if (!selectedTestUserId) {
      toast({
        title: "Missing selection",
        description: "Please select a user to generate email for",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-growth-email', {
        body: { 
          profileId: selectedTestUserId,
          preview: true 
        }
      });

      if (error) throw error;

      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
      setIsPreviewOpen(true);
    } catch (error: any) {
      console.error("Preview generation error:", error);
      toast({
        title: "Failed to generate preview",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedTestUserId) {
      toast({
        title: "Missing selection",
        description: "Please select a user to generate email for",
        variant: "destructive",
      });
      return;
    }

    if (!testEmailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmailAddress)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid test email address",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-growth-email', {
        body: { 
          profileId: selectedTestUserId,
          testRecipient: testEmailAddress 
        }
      });

      if (error) throw error;

      setLastTestResult({
        timestamp: new Date().toLocaleTimeString(),
        email: testEmailAddress,
        subject: data.subject
      });

      toast({
        title: "Test email sent!",
        description: `Sent to ${testEmailAddress}`,
      });
    } catch (error: any) {
      console.error("Send test error:", error);
      toast({
        title: "Failed to send test email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleManualMarkComplete = async () => {
    if (!manualEmail.trim() || !diagnosticCompanyId) {
      toast({
        title: "Missing information",
        description: "Please enter an email and select a company",
        variant: "destructive",
      });
      return;
    }

    setManualMarking(true);

    try {
      // Find or create employee
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", diagnosticCompanyId)
        .ilike("email", manualEmail.trim())
        .maybeSingle();

      let profileId = existing?.id;

      if (!profileId) {
        // Validate email
        if (!manualEmail.trim()) {
          throw new Error("Email is required");
        }
        
        const { data: authData, error: authError } = await supabase.functions.invoke("create-employee", {
          body: {
            email: manualEmail.trim(),
            full_name: manualEmail.trim().split('@')[0],
            company_id: diagnosticCompanyId,
            password: Math.random().toString(36).slice(-12) + 'A1!',
          },
        });

        if (authError) throw new Error(authError.message);
        profileId = authData.employeeId;
      }

      // Insert diagnostic response with varied realistic scores
      const { error: insertError } = await supabase
        .from("diagnostic_responses")
        .insert({
          profile_id: profileId,
          company_id: diagnosticCompanyId,
          submitted_at: new Date().toISOString(),
          typeform_submit_date: new Date().toISOString(),
          role_clarity_score: Math.floor(Math.random() * 4) + 5, // 5-8 (wider range)
          confidence_score: Math.floor(Math.random() * 4) + 5, // 5-8
          manager_support_quality: String(Math.floor(Math.random() * 4) + 5), // 5-8
          daily_energy_level: String(Math.floor(Math.random() * 4) + 5), // 5-8
          would_stay_if_offered_similar: String(Math.floor(Math.random() * 5) + 5), // 5-9 (creates variety)
          sees_growth_path: Math.random() > 0.3,
          feels_valued: Math.random() > 0.3,
          burnout_frequency: ['Never or almost never', 'Rarely (monthly)', 'Sometimes (weekly)', 'Often (several times a week)'][Math.floor(Math.random() * 4)],
          weekly_development_hours: Math.floor(Math.random() * 3) + 1, // 1-3
          additional_responses: { 
            raw: 'Manually marked complete',
            engagement_scores: {
              growth_path_score: Math.floor(Math.random() * 4) + 5, // 5-8 (matches retention formula)
              manager_feedback_score: Math.floor(Math.random() * 4) + 5, // 5-8
              valued_score: Math.floor(Math.random() * 4) + 6, // 6-9
              energy_score: Math.floor(Math.random() * 4) + 5 // 5-8
            },
            learning_scores: {
              quality_rating: Math.floor(Math.random() * 3) + 6, // 6-8
              needs_met_percentage: Math.floor(Math.random() * 31) + 50 // 50-80 (wider range)
            }
          },
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Marked ${manualEmail.trim()} as complete`,
      });

      setManualEmail("");
      loadCompanyData();
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setManualMarking(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-company', {
        body: { companyId: companyToDelete.id }
      });

      if (error) throw error;

      toast({
        title: "Company deleted",
        description: `Successfully deleted "${companyToDelete.name}" and ${data.employeesDeleted} employees`,
      });

      setIsDeleteDialogOpen(false);
      setCompanyToDelete(null);
      loadCompanyData();
    } catch (error: any) {
      console.error("Delete company error:", error);
      toast({
        title: "Failed to delete company",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameCompany = async () => {
    if (!companyToRename || !newCompanyNameForRename.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    setIsRenaming(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ name: newCompanyNameForRename.trim() })
        .eq("id", companyToRename.id);

      if (error) throw error;

      toast({
        title: "Company renamed",
        description: `Successfully renamed to "${newCompanyNameForRename.trim()}"`,
      });

      setIsRenameDialogOpen(false);
      setCompanyToRename(null);
      setNewCompanyNameForRename("");
      loadCompanyData();
    } catch (error: any) {
      console.error("Rename company error:", error);
      toast({
        title: "Failed to rename company",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const loadEmployeeDiagnostics = async (companyId: string) => {
    if (!companyId) return;
    
    setLoadingDiagnostics(true);
    try {
      const { data: diagnostics, error } = await supabase
        .from('diagnostic_responses')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('company_id', companyId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setEmployeeDiagnostics(diagnostics || []);
    } catch (error: any) {
      console.error('Error loading diagnostics:', error);
      toast({
        title: "Error",
        description: "Failed to load employee diagnostics",
        variant: "destructive",
      });
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleSaveScores = async () => {
    if (!editingDiagnostic) return;

    setSavingScores(true);
    try {
      const { error } = await supabase
        .from('diagnostic_responses')
        .update({
          role_clarity_score: editingDiagnostic.role_clarity_score,
          confidence_score: editingDiagnostic.confidence_score,
          manager_support_quality: editingDiagnostic.manager_support_quality,
          daily_energy_level: editingDiagnostic.daily_energy_level,
          would_stay_if_offered_similar: editingDiagnostic.would_stay_if_offered_similar,
          sees_growth_path: editingDiagnostic.sees_growth_path,
          feels_valued: editingDiagnostic.feels_valued,
          burnout_frequency: editingDiagnostic.burnout_frequency,
          weekly_development_hours: editingDiagnostic.weekly_development_hours,
          additional_responses: editingDiagnostic.additional_responses,
        })
        .eq('id', editingDiagnostic.id);

      if (error) throw error;

      toast({
        title: "Scores updated",
        description: "Dashboard scores have been updated successfully",
      });

      setIsEditScoresDialogOpen(false);
      setEditingDiagnostic(null);
      loadEmployeeDiagnostics(editScoresCompanyId);
    } catch (error: any) {
      console.error('Error saving scores:', error);
      toast({
        title: "Failed to save scores",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSavingScores(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "",
      company_id: user.company_id || "",
      phone: user.phone || "",
      is_active: user.is_active !== false
    });
    setEditUserDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editUserForm.full_name || !editUserForm.email || !editUserForm.company_id) {
      toast({
        title: "Validation error",
        description: "Name, email, and company are required",
        variant: "destructive",
      });
      return;
    }

    setUpdatingUser(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editUserForm.full_name,
          email: editUserForm.email.toLowerCase().trim(),
          role: editUserForm.role || null,
          company_id: editUserForm.company_id,
          phone: editUserForm.phone || null,
          is_active: editUserForm.is_active,
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setEditUserDialogOpen(false);
      setEditingUser(null);
      await loadAllSystemUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setUpdatingUser(false);
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
                <Button type="button" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(createdPassword);
                  toast({
                    title: "Copied!",
                    description: "Password copied to clipboard",
                  });
                }}>
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
          <h1 className="text-3xl font-bold">Super Admin Portal</h1>
          <p className="text-muted-foreground">Manage all companies and view platform-wide metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/super-admin/demo')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Demo Setup
          </Button>
          <Button onClick={() => setIsAddCompanyOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="all-users">
              <Users2 className="h-4 w-4 mr-2" />
              All Users
            </TabsTrigger>
            <TabsTrigger value="diagnostics">Import Diagnostics</TabsTrigger>
            <TabsTrigger value="email-testing">
              <Mail className="h-4 w-4 mr-2" />
              Email Testing
            </TabsTrigger>
            <TabsTrigger value="edit-scores">Edit Scores</TabsTrigger>
            <TabsTrigger value="taxonomy">
              <FolderTree className="h-4 w-4 mr-2" />
              Taxonomy
            </TabsTrigger>
            <TabsTrigger value="feature-flags">
              <Flag className="h-4 w-4 mr-2" />
              Feature Flags
            </TabsTrigger>
            <TabsTrigger value="sms">
              <Phone className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="dev-ideas">
              <Lightbulb className="h-4 w-4 mr-2" />
              Dev Ideas
            </TabsTrigger>
            <TabsTrigger value="referrals">
              <Share2 className="h-4 w-4 mr-2" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="system-health">
              <Activity className="h-4 w-4 mr-2" />
              System Health
            </TabsTrigger>
            <TabsTrigger value="onboarding">
              <Sparkles className="h-4 w-4 mr-2" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="bulk-igp">
              <FileUp className="h-4 w-4 mr-2" />
              Bulk IGP Export
            </TabsTrigger>
          </TabsList>
        </div>

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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow 
                  key={company.id} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    {company.activeEmployees} / {company.totalEmployees}
                  </TableCell>
                  <TableCell>{company.totalResponses}</TableCell>
                  <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setViewAsCompany(company.id, company.name);
                          navigate("/dashboard");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View As
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setCompanyToRename({ id: company.id, name: company.name });
                          setNewCompanyNameForRename(company.name);
                          setIsRenameDialogOpen(true);
                        }}
                      >
                        Rename
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          setCompanyToDelete({ id: company.id, name: company.name });
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="all-users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All System Users</CardTitle>
                  <CardDescription>
                    View and manage all users across all companies, including role assignments
                  </CardDescription>
                </div>
                <Button onClick={loadAllSystemUsers} disabled={loadingUsers}>
                  {loadingUsers ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Users2 className="mr-2 h-4 w-4" />
                      {allSystemUsers.length > 0 ? 'Refresh' : 'Load Users'}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {allSystemUsers.length > 0 && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {loadingUsers && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              {!loadingUsers && allSystemUsers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Click "Load Users" to view all system users
                </div>
              )}

              {!loadingUsers && allSystemUsers.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allSystemUsers
                        .filter((user) => {
                          if (!userSearchTerm) return true;
                          const search = userSearchTerm.toLowerCase();
                          return (
                            user.full_name?.toLowerCase().includes(search) ||
                            user.email?.toLowerCase().includes(search) ||
                            user.company_name?.toLowerCase().includes(search)
                          );
                        })
                        .map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name || 'N/A'}
                            </TableCell>
                            <TableCell>{user.email || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.company_name}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.role || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.is_super_admin && (
                                  <Badge variant="destructive">Super Admin</Badge>
                                )}
                                {user.is_admin && !user.is_super_admin && (
                                  <Badge variant="secondary">Admin (Legacy)</Badge>
                                )}
                                {user.user_roles?.map((role: string) => (
                                  <Badge key={role} variant="secondary">
                                    {role}
                                  </Badge>
                                ))}
                                {!user.is_super_admin && !user.is_admin && user.user_roles?.length === 0 && (
                                  <span className="text-sm text-muted-foreground">No roles</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.is_active ? "default" : "secondary"}>
                                {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRoleDialogUser(user);
                                    setIsRoleDialogOpen(true);
                                  }}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Roles
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Diagnostic Data</CardTitle>
              <CardDescription>
                Upload Typeform CSV export to import employee diagnostic responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Company</Label>
                  <Select
                    value={diagnosticCompanyId}
                    onValueChange={setDiagnosticCompanyId}
                    disabled={diagnosticImporting}
                  >
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

                <div>
                  <Label htmlFor="diagnostic-file" className="text-sm font-medium mb-2 block">
                    CSV File
                  </Label>
                  <Input
                    id="diagnostic-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDiagnosticFile(e.target.files[0]);
                        setDiagnosticResult(null);
                      }
                    }}
                    disabled={diagnosticImporting}
                  />
                </div>

                {diagnosticFile && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      File selected: {diagnosticFile.name} ({(diagnosticFile.size / 1024).toFixed(2)} KB)
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleDiagnosticImport} 
                  disabled={!diagnosticFile || !diagnosticCompanyId || diagnosticImporting}
                  className="w-full"
                >
                  {diagnosticImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Import Diagnostic Data
                    </>
                  )}
                </Button>

                <div className="pt-4 space-y-2">
                  <Label className="text-sm font-medium">Or paste CSV data</Label>
                  <Textarea
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(e.target.value)}
                    placeholder="Paste CSV rows here..."
                    rows={8}
                  />
                  <Button
                    onClick={handleDiagnosticImportFromText}
                    disabled={!diagnosticText.trim() || !diagnosticCompanyId || diagnosticImporting}
                    variant="secondary"
                    className="w-full"
                  >
                    {diagnosticImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FileUp className="mr-2 h-4 w-4" />
                        Import Pasted CSV
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-6 border-t space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Quick Actions for Demo</Label>
                    <Button
                      onClick={handleQuickAssignWinfield}
                      disabled={!diagnosticCompanyId || quickAssigning}
                      variant="default"
                      className="w-full"
                    >
                      {quickAssigning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Quick Assign for Winfield United (10)
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Manual Mark Complete</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email..."
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        disabled={manualMarking}
                      />
                      <Button
                        onClick={handleManualMarkComplete}
                        disabled={!manualEmail.trim() || !diagnosticCompanyId || manualMarking}
                        size="sm"
                      >
                        {manualMarking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Mark Complete"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {diagnosticResult && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-2xl font-bold">{diagnosticResult.success}</p>
                            <p className="text-sm text-muted-foreground">
                              Successfully Imported ({diagnosticResult.newProfiles} new profiles)
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <div>
                            <p className="text-2xl font-bold">{diagnosticResult.failed}</p>
                            <p className="text-sm text-muted-foreground">Failed</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {diagnosticResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold mb-2">Errors encountered:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {diagnosticResult.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                        {diagnosticResult.failed > diagnosticResult.errors.length && (
                          <p className="mt-2 text-xs">
                            ... and {diagnosticResult.failed - diagnosticResult.errors.length} more errors
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Testing</CardTitle>
              <CardDescription>
                Test the personalized growth email system with preview and send capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select User to Test</Label>
                  <Button
                    variant="outline"
                    onClick={loadAllUsers}
                    className="mb-2"
                    disabled={allUsers.length > 0}
                  >
                    {allUsers.length > 0 ? `${allUsers.length} Users Loaded` : 'Load All Users'}
                  </Button>
                  <Select
                    value={selectedTestUserId}
                    onValueChange={setSelectedTestUserId}
                    disabled={allUsers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user to generate email for" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email}) - {user.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The email will be generated based on this user's data
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="your-email@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    The test email will be sent to this address
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handlePreviewEmail}
                    disabled={!selectedTestUserId || isGeneratingPreview}
                    variant="outline"
                    className="flex-1"
                  >
                    {isGeneratingPreview ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Email
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleSendTestEmail}
                    disabled={!selectedTestUserId || !testEmailAddress || isSendingTest}
                    className="flex-1"
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                </div>

                {lastTestResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold">Last Test Result</p>
                      <p className="text-sm mt-1">
                        ✓ Sent at {lastTestResult.timestamp} to {lastTestResult.email}
                      </p>
                      <p className="text-sm">Subject: "{lastTestResult.subject}"</p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit-scores" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit Dashboard Scores</CardTitle>
              <CardDescription>
                Manually adjust diagnostic scores to control dashboard metrics for any company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Company</Label>
                  <Select
                    value={editScoresCompanyId}
                    onValueChange={(value) => {
                      setEditScoresCompanyId(value);
                      loadEmployeeDiagnostics(value);
                    }}
                  >
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

                {loadingDiagnostics && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}

                {!loadingDiagnostics && employeeDiagnostics.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeDiagnostics.map((diagnostic) => (
                          <TableRow key={diagnostic.id}>
                            <TableCell className="font-medium">
                              {(diagnostic.profiles as any)?.full_name || 'Unknown'}
                            </TableCell>
                            <TableCell>{(diagnostic.profiles as any)?.email}</TableCell>
                            <TableCell>{(diagnostic.profiles as any)?.role || '-'}</TableCell>
                            <TableCell>
                              {new Date(diagnostic.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingDiagnostic(diagnostic);
                                  setIsEditScoresDialogOpen(true);
                                }}
                              >
                                Edit Scores
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {!loadingDiagnostics && editScoresCompanyId && employeeDiagnostics.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No diagnostic responses found for this company
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxonomy" className="space-y-6">
          <CapabilityTaxonomyManager />
        </TabsContent>

        <TabsContent value="feature-flags" className="space-y-6">
          <FeatureFlagsManager />
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <SMSManagementTab />
        </TabsContent>

        <TabsContent value="dev-ideas" className="space-y-6">
          <DevelopmentIdeasTab />
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          <ReferralAdminTab />
        </TabsContent>

        <TabsContent value="system-health" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={() => setIsDebugPanelOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              User Data Debugger
            </Button>
          </div>
          <SystemHealthDashboard />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <OnboardingPreview />
        </TabsContent>

        <TabsContent value="bulk-igp" className="space-y-6">
          <BulkIGPExport />
        </TabsContent>
      </Tabs>

      <AdminUserDebugPanel 
        open={isDebugPanelOpen} 
        onOpenChange={setIsDebugPanelOpen} 
      />

      {/* Edit Scores Dialog */}
      <Dialog open={isEditScoresDialogOpen} onOpenChange={setIsEditScoresDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Dashboard Scores</DialogTitle>
            <DialogDescription>
              Adjust scores for {(editingDiagnostic?.profiles as any)?.full_name}
            </DialogDescription>
          </DialogHeader>
          {editingDiagnostic && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Clarity (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editingDiagnostic.role_clarity_score || 0}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      role_clarity_score: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confidence (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editingDiagnostic.confidence_score || 0}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      confidence_score: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manager Support (1-10)</Label>
                  <Input
                    type="text"
                    value={editingDiagnostic.manager_support_quality || ''}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      manager_support_quality: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Energy (1-10)</Label>
                  <Input
                    type="text"
                    value={editingDiagnostic.daily_energy_level || ''}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      daily_energy_level: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Would Stay (1-10)</Label>
                  <Input
                    type="text"
                    value={editingDiagnostic.would_stay_if_offered_similar || ''}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      would_stay_if_offered_similar: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Dev Hours</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingDiagnostic.weekly_development_hours || 0}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      weekly_development_hours: parseFloat(e.target.value)
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Burnout Frequency</Label>
                <Select
                  value={editingDiagnostic.burnout_frequency || ''}
                  onValueChange={(value) => setEditingDiagnostic({
                    ...editingDiagnostic,
                    burnout_frequency: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Never or almost never">Never or almost never</SelectItem>
                    <SelectItem value="Rarely (monthly)">Rarely (monthly)</SelectItem>
                    <SelectItem value="Sometimes (weekly)">Sometimes (weekly)</SelectItem>
                    <SelectItem value="Often (several times a week)">Often (several times a week)</SelectItem>
                    <SelectItem value="Frequently (daily)">Frequently (daily)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sees_growth_path"
                    checked={editingDiagnostic.sees_growth_path || false}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      sees_growth_path: e.target.checked
                    })}
                    className="rounded"
                  />
                  <Label htmlFor="sees_growth_path">Sees Growth Path</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="feels_valued"
                    checked={editingDiagnostic.feels_valued || false}
                    onChange={(e) => setEditingDiagnostic({
                      ...editingDiagnostic,
                      feels_valued: e.target.checked
                    })}
                    className="rounded"
                  />
                  <Label htmlFor="feels_valued">Feels Valued</Label>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Engagement Scores (1-10)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Energy Score</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={editingDiagnostic.additional_responses?.engagement_scores?.energy_score || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          engagement_scores: {
                            ...editingDiagnostic.additional_responses?.engagement_scores,
                            energy_score: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valued Score</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={editingDiagnostic.additional_responses?.engagement_scores?.valued_score || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          engagement_scores: {
                            ...editingDiagnostic.additional_responses?.engagement_scores,
                            valued_score: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Growth Path Score</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={editingDiagnostic.additional_responses?.engagement_scores?.growth_path_score || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          engagement_scores: {
                            ...editingDiagnostic.additional_responses?.engagement_scores,
                            growth_path_score: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Manager Feedback Score</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={editingDiagnostic.additional_responses?.engagement_scores?.manager_feedback_score || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          engagement_scores: {
                            ...editingDiagnostic.additional_responses?.engagement_scores,
                            manager_feedback_score: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Learning Scores</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quality Rating (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={editingDiagnostic.additional_responses?.learning_scores?.quality_rating || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          learning_scores: {
                            ...editingDiagnostic.additional_responses?.learning_scores,
                            quality_rating: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Needs Met % (0-100)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editingDiagnostic.additional_responses?.learning_scores?.needs_met_percentage || 0}
                      onChange={(e) => setEditingDiagnostic({
                        ...editingDiagnostic,
                        additional_responses: {
                          ...editingDiagnostic.additional_responses,
                          learning_scores: {
                            ...editingDiagnostic.additional_responses?.learning_scores,
                            needs_met_percentage: parseInt(e.target.value)
                          }
                        }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditScoresDialogOpen(false);
                setEditingDiagnostic(null);
              }}
              disabled={savingScores}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveScores} disabled={savingScores}>
              {savingScores ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewSubject}</DialogTitle>
            <DialogDescription>
              Email preview - This is how the email will look to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] border rounded-lg">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[600px] border-0"
              title="Email Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button
              variant="outline"
              onClick={() => {
                setIsAddEmployeeOpen(false);
                setNewEmployee({ fullName: "", email: "", role: "", phone: "" });
                setSelectedCompanyId("");
                setTempPassword("");
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

      {/* Rename Company Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Company</DialogTitle>
            <DialogDescription>
              Enter a new name for "{companyToRename?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-company-name">New Company Name</Label>
              <Input
                id="rename-company-name"
                placeholder="Enter new company name"
                value={newCompanyNameForRename}
                onChange={(e) => setNewCompanyNameForRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameCompany();
                  }
                }}
                disabled={isRenaming}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRenameDialogOpen(false);
                setCompanyToRename(null);
                setNewCompanyNameForRename("");
              }}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameCompany}
              disabled={isRenaming || !newCompanyNameForRename.trim()}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{companyToDelete?.name}" and all associated data including employees, diagnostics, and records.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. All company data will be permanently removed.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setCompanyToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCompany}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Company'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      {roleDialogUser && (
        <AssignRoleDialog
          open={isRoleDialogOpen}
          onOpenChange={(open) => {
            setIsRoleDialogOpen(open);
            if (!open) {
              setRoleDialogUser(null);
              // Refresh user list to show updated roles
              if (allSystemUsers.length > 0) {
                loadAllSystemUsers();
              }
            }
          }}
          employeeId={roleDialogUser.id}
          employeeName={roleDialogUser.full_name || roleDialogUser.email}
        />
      )}

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information for {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editUserForm.full_name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company *</Label>
                <Select
                  value={editUserForm.company_id}
                  onValueChange={(value) => setEditUserForm({ ...editUserForm, company_id: value })}
                >
                  <SelectTrigger id="edit-company">
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
              <div className="space-y-2">
                <Label htmlFor="edit-role">Job Title</Label>
                <Input
                  id="edit-role"
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  placeholder="Account Manager"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editUserForm.is_active ? "active" : "inactive"}
                  onValueChange={(value) => setEditUserForm({ ...editUserForm, is_active: value === "active" })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditUserDialogOpen(false);
                setEditingUser(null);
              }}
              disabled={updatingUser}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updatingUser}>
              {updatingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
