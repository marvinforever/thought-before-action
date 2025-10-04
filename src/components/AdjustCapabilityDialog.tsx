import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp } from "lucide-react";

const LEVELS = [
  { value: "foundational", label: "Foundational" },
  { value: "advancing", label: "Advancing" },
  { value: "independent", label: "Independent" },
  { value: "mastery", label: "Mastery" },
];

interface AdjustCapabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeCapability: {
    id: string;
    current_level: string;
    target_level: string;
    priority: number;
    capability_name: string;
    employee_id: string;
    employee_name: string;
  };
}

export function AdjustCapabilityDialog({ open, onOpenChange, employeeCapability }: AdjustCapabilityDialogProps) {
  const [currentLevel, setCurrentLevel] = useState(employeeCapability.current_level);
  const [targetLevel, setTargetLevel] = useState(employeeCapability.target_level);
  const [priority, setPriority] = useState(String(employeeCapability.priority));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get manager's name
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Update the capability
      const { error: updateError } = await supabase
        .from("employee_capabilities")
        .update({
          current_level: currentLevel as any,
          target_level: targetLevel as any,
          priority: parseInt(priority),
        })
        .eq("id", employeeCapability.id);

      if (updateError) throw updateError;

      // Log the adjustment
      const { error: logError } = await supabase
        .from("capability_adjustments")
        .insert({
          employee_capability_id: employeeCapability.id,
          profile_id: employeeCapability.employee_id,
          adjusted_by: user.id,
          previous_level: employeeCapability.current_level,
          new_level: currentLevel,
          previous_priority: employeeCapability.priority,
          new_priority: parseInt(priority),
          adjustment_reason: reason || null,
        });

      if (logError) throw logError;

      // Send notification
      const { error: notifyError } = await supabase.functions.invoke("notify-capability-change", {
        body: {
          employeeId: employeeCapability.employee_id,
          employeeName: employeeCapability.employee_name,
          managerName: managerProfile?.full_name || "Your manager",
          capabilityName: employeeCapability.capability_name,
          previousLevel: employeeCapability.current_level,
          newLevel: currentLevel,
          previousPriority: employeeCapability.priority,
          newPriority: parseInt(priority),
          reason,
        },
      });

      if (notifyError) {
        console.error("Notification error:", notifyError);
        // Don't fail the whole operation if notification fails
      }

      toast({
        title: "Capability updated",
        description: "The capability has been updated and the employee has been notified",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error updating capability",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Adjust Capability Level
          </DialogTitle>
          <DialogDescription>
            Update {employeeCapability.employee_name}'s progress in {employeeCapability.capability_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Level</Label>
            <Select value={currentLevel} onValueChange={setCurrentLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Level</Label>
            <Select value={targetLevel} onValueChange={setTargetLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priority (1-5)</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason for Change (Optional)</Label>
            <Textarea
              placeholder="Explain why you're making this adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Capability"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
