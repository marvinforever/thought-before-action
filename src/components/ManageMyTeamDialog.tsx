import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useViewAs } from "@/contexts/ViewAsContext";

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_assigned: boolean;
  assigned_to_other?: boolean;
  company_name?: string;
  company_id?: string;
};

interface ManageMyTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamUpdated: () => void;
}

export function ManageMyTeamDialog({ open, onOpenChange, onTeamUpdated }: ManageMyTeamDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialAssignments, setInitialAssignments] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open, viewAsCompanyId]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin') || false;
      const hasSuperAdminRole = roles?.some(r => r.role === 'super_admin') || false;
      const hasCoachRole = roles?.some(r => r.role === 'coach') || false;
      setIsSuperAdmin(hasSuperAdminRole);
      setIsCoach(hasCoachRole);

      // Determine if coach should use cross-company mode
      // Coach mode: coach role + NOT in view-as mode (view-as takes precedence for super_admin+coach)
      const useCoachMode = hasCoachRole && !viewAsCompanyId;

      // Determine which company to use (only relevant when NOT in coach mode)
      let companyId = viewAsCompanyId;
      
      if (!companyId && !useCoachMode) {
        const { data: managerProfile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!managerProfile?.company_id) throw new Error("Company not found");
        companyId = managerProfile.company_id;
      }

      // Get employees - coaches get ALL active profiles across companies
      let allEmployees: any[] = [];
      
      if (useCoachMode) {
        // Coach mode: fetch all active users across all companies with company name
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, company_id, companies(name)")
          .eq("is_active", true)
          .neq("id", user.id)
          .order("full_name");
        
        if (error) throw error;
        allEmployees = (data || []).map((emp: any) => ({
          ...emp,
          company_name: emp.companies?.name || "Unknown Company",
        }));
      } else {
        // Standard mode: company-scoped
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, company_id")
          .eq("company_id", companyId!)
          .eq("is_active", true)
          .neq("id", user.id)
          .order("full_name");
        
        if (error) throw error;
        allEmployees = data || [];
      }

      // Get current assignments for this manager
      const { data: assignments, error: assignError } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      if (assignError) throw assignError;

      // Get ALL assignments (to mark employees assigned to other managers)
      // For coaches, we skip the "assigned to other" restriction
      let otherManagerAssignments = new Set<string>();
      if (!useCoachMode && companyId) {
        const { data: allAssignments, error: allAssignError } = await supabase
          .from("manager_assignments")
          .select("employee_id, manager_id")
          .eq("company_id", companyId);

        if (allAssignError) throw allAssignError;

        otherManagerAssignments = new Set(
          allAssignments?.filter(a => a.manager_id !== user.id).map(a => a.employee_id) || []
        );
      }

      const myAssignments = new Set(assignments?.map(a => a.employee_id) || []);
      setInitialAssignments(myAssignments);
      setSelectedIds(new Set(myAssignments));

      const employeesWithStatus = allEmployees.map(emp => {
        const isMyEmployee = myAssignments.has(emp.id);
        const isOtherManagerEmployee = otherManagerAssignments.has(emp.id);
        
        return {
          ...emp,
          full_name: emp.full_name || "Unknown",
          email: emp.email || "",
          role: emp.role || "",
          is_assigned: isMyEmployee,
          assigned_to_other: isOtherManagerEmployee && !isAdmin && !useCoachMode,
          company_name: emp.company_name,
          company_id: emp.company_id,
        };
      });

      setEmployees(employeesWithStatus);
    } catch (error: any) {
      toast({
        title: "Error loading employees",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedIds(newSelected);
  };

  const isViewAsMode = !!viewAsCompanyId;
  const canEdit = !isViewAsMode || isSuperAdmin;

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Cannot modify team in View As mode",
        description: "You don't have permission to modify team assignments for this company.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const useCoachMode = isCoach && !viewAsCompanyId;

      // Determine what changed
      const toAdd = Array.from(selectedIds).filter(id => !initialAssignments.has(id));
      const toRemove = Array.from(initialAssignments).filter(id => !selectedIds.has(id));

      // Remove unselected assignments
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("manager_assignments")
          .delete()
          .eq("manager_id", user.id)
          .in("employee_id", toRemove);

        if (deleteError) throw deleteError;
      }

      // Add new assignments
      if (toAdd.length > 0) {
        // For coach mode, use each employee's own company_id
        // For standard mode, use the target company
        let targetCompanyId = viewAsCompanyId;
        if (!targetCompanyId && !useCoachMode) {
          const { data: managerProfile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", user.id)
            .single();
          if (!managerProfile?.company_id) throw new Error("Company not found");
          targetCompanyId = managerProfile.company_id;
        }

        const newAssignments = toAdd.map(employeeId => {
          // In coach mode, look up employee's company_id from loaded data
          const emp = employees.find(e => e.id === employeeId);
          const empCompanyId = useCoachMode ? (emp?.company_id || targetCompanyId) : targetCompanyId;
          
          return {
            manager_id: user.id,
            employee_id: employeeId,
            company_id: empCompanyId,
            assigned_by: user.id,
          };
        });

        const { error: upsertError } = await supabase
          .from("manager_assignments")
          .upsert(newAssignments, { onConflict: 'manager_id,employee_id' });

        if (upsertError) throw upsertError;
      }

      toast({
        title: "Team updated",
        description: `${toAdd.length} added, ${toRemove.length} removed`,
      });

      onTeamUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error updating team",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase()) ||
    emp.role.toLowerCase().includes(search.toLowerCase()) ||
    (emp.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by company for coach mode display
  const useCoachDisplay = isCoach && !viewAsCompanyId;
  
  const selectedCount = selectedIds.size;
  const changesCount = 
    Array.from(selectedIds).filter(id => !initialAssignments.has(id)).length +
    Array.from(initialAssignments).filter(id => !selectedIds.has(id)).length;

  // Group employees by company for coach display
  const groupedEmployees = useCoachDisplay
    ? filteredEmployees.reduce<Record<string, Employee[]>>((acc, emp) => {
        const key = emp.company_name || "Unknown Company";
        if (!acc[key]) acc[key] = [];
        acc[key].push(emp);
        return acc;
      }, {})
    : null;

  const renderEmployeeRow = (employee: Employee) => (
    <div
      key={employee.id}
      className={`flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 ${!canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
      onClick={() => canEdit && handleToggleEmployee(employee.id)}
    >
      <Checkbox
        checked={selectedIds.has(employee.id)}
        onCheckedChange={() => canEdit && handleToggleEmployee(employee.id)}
        disabled={!canEdit}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{employee.full_name}</p>
          {employee.role && (
            <Badge variant="secondary" className="text-xs">
              {employee.role}
            </Badge>
          )}
          {employee.is_assigned && (
            <Badge variant="default" className="text-xs">
              On Your Team
            </Badge>
          )}
          {useCoachDisplay && employee.company_name && (
            <Badge variant="outline" className="text-xs">
              {employee.company_name}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manage My Team
          </DialogTitle>
          <DialogDescription>
            {!canEdit 
              ? "Viewing team for another company (read-only mode)"
              : useCoachDisplay
                ? "As a coach, select employees from any company to add to your team."
                : isViewAsMode
                  ? "Managing team as Super Admin. Select employees to add/remove as direct reports."
                  : "Select employees to add to your direct reports. Uncheck to remove from your team."
            }
          </DialogDescription>
        </DialogHeader>

        {isViewAsMode && !canEdit && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-200 text-sm">
            ⚠️ You are in View As mode. Changes are disabled because you don't have permission to modify this company's team.
          </div>
        )}

        {isViewAsMode && canEdit && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-blue-800 dark:text-blue-200 text-sm">
            ℹ️ Managing team as Super Admin for this company.
          </div>
        )}

        {useCoachDisplay && !isViewAsMode && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-emerald-800 dark:text-emerald-200 text-sm">
            🎯 Coach Mode — You can add employees from any company to your team.
          </div>
        )}

        <div className="space-y-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={useCoachDisplay ? "Search employees or companies..." : "Search employees..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedCount} selected {canEdit && changesCount > 0 && `(${changesCount} changes)`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No employees found
                  </div>
                ) : groupedEmployees ? (
                  // Coach mode: grouped by company
                  Object.entries(groupedEmployees)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([companyName, emps]) => (
                      <div key={companyName} className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 pb-1 px-1">
                          {companyName} ({emps.length})
                        </p>
                        {emps.map(renderEmployeeRow)}
                      </div>
                    ))
                ) : (
                  // Standard mode: flat list
                  filteredEmployees.map(renderEmployeeRow)
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {!canEdit ? 'Close' : 'Cancel'}
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={submitting || changesCount === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save Changes`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
