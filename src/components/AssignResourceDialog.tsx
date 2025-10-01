import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Capability = {
  id: string;
  name: string;
};

type AssignResourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceTitle: string;
  defaultCapabilityId?: string | null;
};

export default function AssignResourceDialog({
  open,
  onOpenChange,
  resourceId,
  resourceTitle,
  defaultCapabilityId,
}: AssignResourceDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
      if (defaultCapabilityId) {
        setSelectedCapabilityId(defaultCapabilityId);
      }
    }
  }, [open, defaultCapabilityId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return;

      // Load employees in the same company
      const { data: employeeData, error: employeeError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("full_name");

      if (employeeError) throw employeeError;
      setEmployees(employeeData as Employee[]);

      // Load capabilities
      const { data: capabilityData, error: capabilityError } = await supabase
        .from("capabilities")
        .select("id, name")
        .order("name");

      if (capabilityError) throw capabilityError;
      setCapabilities(capabilityData as Capability[]);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: "Employee required",
        description: "Please select an employee to assign this resource to",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("content_recommendations")
        .insert({
          profile_id: selectedEmployeeId,
          resource_id: resourceId,
          employee_capability_id: selectedCapabilityId || null,
          status: "pending",
          match_score: null,
          ai_reasoning: "Manually assigned by admin",
        });

      if (error) throw error;

      toast({
        title: "Resource assigned",
        description: `Successfully assigned "${resourceTitle}" to the selected employee`,
      });

      onOpenChange(false);
      setSelectedEmployeeId("");
      setSelectedCapabilityId("");
    } catch (error: any) {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Resource to Growth Plan</DialogTitle>
          <DialogDescription>
            Assign "{resourceTitle}" to an employee's growth plan
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capability">Capability (Optional)</Label>
              <Select
                value={selectedCapabilityId}
                onValueChange={setSelectedCapabilityId}
              >
                <SelectTrigger id="capability">
                  <SelectValue placeholder="Link to a capability (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {capabilities.map((capability) => (
                    <SelectItem key={capability.id} value={capability.id}>
                      {capability.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Resource"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
