import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RequestCapabilityLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeCapability: {
    id: string;
    capability_id: string;
    current_level: string;
    capability_name: string;
  };
}

const LEVELS = ["foundational", "advancing", "independent", "mastery"];

export function RequestCapabilityLevelDialog({
  open,
  onOpenChange,
  employeeCapability,
}: RequestCapabilityLevelDialogProps) {
  const [requestedLevel, setRequestedLevel] = useState<string>("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requestedLevel || !evidence.trim()) {
      toast.error("Please select a level and provide evidence");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("capability_level_requests").insert({
        profile_id: user.id,
        company_id: profile.company_id,
        capability_id: employeeCapability.capability_id,
        current_level: employeeCapability.current_level,
        requested_level: requestedLevel,
        evidence_text: evidence,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Request submitted! Your manager will review it.");
      onOpenChange(false);
      setRequestedLevel("");
      setEvidence("");
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Level Change</DialogTitle>
          <DialogDescription>
            Request a level change for {employeeCapability.capability_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Level</Label>
            <div className="text-sm font-medium">Level {employeeCapability.current_level === 'foundational' ? '1' : employeeCapability.current_level === 'advancing' ? '2' : employeeCapability.current_level === 'independent' ? '3' : '4'}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requested-level">Requested Level</Label>
            <Select value={requestedLevel} onValueChange={setRequestedLevel}>
              <SelectTrigger id="requested-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((level, index) => (
                  <SelectItem key={level} value={level}>
                    Level {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence / Justification</Label>
            <Textarea
              id="evidence"
              placeholder="Describe specific examples of how you've demonstrated this capability level..."
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
