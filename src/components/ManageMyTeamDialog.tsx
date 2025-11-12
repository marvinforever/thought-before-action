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

      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin') || false;

      // Determine which company to use
      let companyId = viewAsCompanyId;
      
      if (!companyId) {
        // Get manager's company if not viewing as another company
        const { data: managerProfile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!managerProfile?.company_id) throw new Error("Company not found");
        companyId = managerProfile.company_id;
      }

      // Get all employees in the company (except the manager themselves)
      const { data: allEmployees, error: employeesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .neq("id", user.id)
        .order("full_name");

      if (employeesError) throw employeesError;

      // Get current assignments for this manager
      const { data: assignments, error: assignError } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      if (assignError) throw assignError;

      // Get ALL assignments in the company (to mark employees assigned to other managers)
      const { data: allAssignments, error: allAssignError } = await supabase
        .from("manager_assignments")
        .select("employee_id, manager_id")
        .eq("company_id", companyId);

      if (allAssignError) throw allAssignError;

      const myAssignments = new Set(assignments?.map(a => a.employee_id) || []);
      const otherManagerAssignments = new Set(
        allAssignments?.filter(a => a.manager_id !== user.id).map(a => a.employee_id) || []
      );
      
      setInitialAssignments(myAssignments);
      setSelectedIds(new Set(myAssignments));

      const employeesWithStatus = (allEmployees || []).map(emp => {
        const isMyEmployee = myAssignments.has(emp.id);
        const isOtherManagerEmployee = otherManagerAssignments.has(emp.id);
        
        return {
          ...emp,
          full_name: emp.full_name || "Unknown",
          email: emp.email || "",
          role: emp.role || "",
          is_assigned: isMyEmployee,
          assigned_to_other: isOtherManagerEmployee && !isAdmin, // Only show restriction for non-admins
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

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!managerProfile?.company_id) throw new Error("Company not found");

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

      // First, delete any existing assignments for these employees (from other managers)
      // This will only work if user is admin, otherwise it will fail due to RLS
      if (toAdd.length > 0) {
        // Try to remove existing assignments (will only succeed for admins)
        await supabase
          .from("manager_assignments")
          .delete()
          .in("employee_id", toAdd);

        // Add new assignments
        const newAssignments = toAdd.map(employeeId => ({
          manager_id: user.id,
          employee_id: employeeId,
          company_id: managerProfile.company_id,
          assigned_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from("manager_assignments")
          .insert(newAssignments);

        if (insertError) {
          // If insert fails due to unique constraint, it means employee is assigned elsewhere
          if (insertError.code === '23505') {
            throw new Error('Some employees are already assigned to other managers. Only admins can reassign between managers.');
          }
          throw insertError;
        }
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
    emp.role.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = selectedIds.size;
  const changesCount = 
    Array.from(selectedIds).filter(id => !initialAssignments.has(id)).length +
    Array.from(initialAssignments).filter(id => !selectedIds.has(id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manage My Team
          </DialogTitle>
          <DialogDescription>
            Select employees to add to your direct reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedCount} selected {changesCount > 0 && `(${changesCount} changes)`}
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
                ) : (
                  filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        employee.assigned_to_other 
                          ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                      onClick={() => !employee.assigned_to_other && handleToggleEmployee(employee.id)}
                      title={employee.assigned_to_other ? 'Already assigned to another manager' : ''}
                    >
                      <Checkbox
                        checked={selectedIds.has(employee.id)}
                        onCheckedChange={() => handleToggleEmployee(employee.id)}
                        disabled={employee.assigned_to_other}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{employee.full_name}</p>
                          {employee.role && (
                            <Badge variant="secondary" className="text-xs">
                              {employee.role}
                            </Badge>
                          )}
                          {employee.assigned_to_other && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Assigned to other manager
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting || changesCount === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save Changes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
