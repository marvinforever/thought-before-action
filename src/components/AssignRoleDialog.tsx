import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2 } from "lucide-react";

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

type Role = "user" | "manager" | "admin" | "super_admin";

const roleDescriptions: Record<Role, string> = {
  user: "Standard employee access",
  manager: "Can manage team members and view team analytics",
  admin: "Full company access and employee management",
  super_admin: "Platform-wide access (Momentum Company only)"
};

export function AssignRoleDialog({ open, onOpenChange, employeeId, employeeName }: AssignRoleDialogProps) {
  const [currentRoles, setCurrentRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCurrentRoles();
    }
  }, [open, employeeId]);

  const loadCurrentRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", employeeId);

      if (error) throw error;
      setCurrentRoles(data?.map(r => r.role as Role) || []);
    } catch (error: any) {
      console.error("Error loading roles:", error);
      toast({
        title: "Error",
        description: "Failed to load current roles",
        variant: "destructive",
      });
    }
  };

  const handleAddRole = async (role: Role) => {
    setLoading(true);
    try {
      console.log("Attempting to add role:", role, "to user:", employeeId);
      
      const { data, error } = await supabase
        .from("user_roles")
        .insert({ user_id: employeeId, role })
        .select();

      console.log("Insert result:", { data, error });

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      // Verify the insert actually worked
      const { data: verifyData, error: verifyError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", employeeId)
        .eq("role", role);

      console.log("Verification result:", { verifyData, verifyError });

      if (!verifyData || verifyData.length === 0) {
        throw new Error("Role was not saved - RLS policy may be blocking the insert");
      }

      toast({
        title: "Success",
        description: `${role} role assigned to ${employeeName}`,
      });

      await loadCurrentRoles();
    } catch (error: any) {
      console.error("Full error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (role: Role) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", employeeId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${role} role removed from ${employeeName}`,
      });

      loadCurrentRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const availableRoles: Role[] = ["user", "manager", "admin", "super_admin"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Roles - {employeeName}
          </DialogTitle>
          <DialogDescription>
            Assign or remove roles to control access levels and permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Roles */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Current Roles</h3>
            <div className="flex flex-wrap gap-2">
              {currentRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles assigned</p>
              ) : (
                currentRoles.map((role) => (
                  <Badge key={role} variant="secondary" className="gap-2">
                    {role}
                    <button
                      onClick={() => handleRemoveRole(role)}
                      disabled={loading}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Available Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Available Roles</h3>
            <div className="space-y-2">
              {availableRoles.map((role) => {
                const hasRole = currentRoles.includes(role);
                return (
                  <div
                    key={role}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
                        {hasRole && (
                          <Badge variant="outline" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {roleDescriptions[role]}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={hasRole ? "outline" : "default"}
                      onClick={() => hasRole ? handleRemoveRole(role) : handleAddRole(role)}
                      disabled={loading}
                    >
                      {hasRole ? "Remove" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Users can have multiple roles. Manager role is required to access
              team management features and assign direct reports.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
