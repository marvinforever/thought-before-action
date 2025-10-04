import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Manager = {
  id: string;
  full_name: string;
  email: string;
};

interface AssignManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
  };
  currentManagerId?: string;
}

export function AssignManagerDialog({ open, onOpenChange, employee, currentManagerId }: AssignManagerDialogProps) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>(currentManagerId || "");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadManagers();
      setSelectedManagerId(currentManagerId || "");
    }
  }, [open, currentManagerId]);

  const loadManagers = async () => {
    setLoading(true);
    try {
      // Get all users with manager, admin, or super_admin role in the company
      const { data: managerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["manager", "admin", "super_admin"]);

      if (rolesError) throw rolesError;

      const managerIds = managerRoles?.map(r => r.user_id) || [];

      // Get profile details for these managers in the same company
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", managerIds)
        .eq("company_id", employee.company_id)
        .neq("id", employee.id); // Don't show the employee themselves

      if (profilesError) throw profilesError;

      setManagers(profiles || []);
    } catch (error: any) {
      toast({
        title: "Error loading managers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedManagerId) {
      toast({
        title: "No manager selected",
        description: "Please select a manager",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert the manager assignment
      const { error } = await supabase
        .from("manager_assignments")
        .upsert({
          employee_id: employee.id,
          manager_id: selectedManagerId,
          company_id: employee.company_id,
          assigned_by: user.id,
        }, {
          onConflict: "employee_id"
        });

      if (error) throw error;

      toast({
        title: "Manager assigned",
        description: `Manager successfully assigned to ${employee.full_name}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error assigning manager",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("manager_assignments")
        .delete()
        .eq("employee_id", employee.id);

      if (error) throw error;

      toast({
        title: "Manager removed",
        description: `Manager assignment removed from ${employee.full_name}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error removing manager",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Manager</DialogTitle>
          <DialogDescription>
            Assign a manager to {employee.full_name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Manager</label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {currentManagerId && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Manager"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={submitting || !selectedManagerId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
