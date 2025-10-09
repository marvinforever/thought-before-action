import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SelfAssessCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
}

interface CapabilityAssessment {
  id: string;
  capability_id: string;
  capability_name: string;
  current_level: string;
  target_level: string;
  self_assessed_level?: string;
  self_assessment_notes?: string;
}

const LEVELS = ["foundational", "advancing", "independent", "mastery"];

const getLevelLabel = (level: string) => {
  const labels: Record<string, string> = {
    foundational: "Foundational",
    advancing: "Advancing",
    independent: "Independent",
    mastery: "Mastery"
  };
  return labels[level] || level;
};

export function SelfAssessCapabilitiesDialog({ open, onOpenChange, profileId }: SelfAssessCapabilitiesDialogProps) {
  const [capabilities, setCapabilities] = useState<CapabilityAssessment[]>([]);
  const [assessments, setAssessments] = useState<Record<string, { level: string; notes: string }>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadCapabilities();
    }
  }, [open, profileId]);

  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          capability_id,
          current_level,
          target_level,
          self_assessed_level,
          self_assessment_notes,
          capabilities (
            name
          )
        `)
        .eq("profile_id", profileId);

      if (error) throw error;

      const formatted = data?.map((ec: any) => ({
        id: ec.id,
        capability_id: ec.capability_id,
        capability_name: ec.capabilities?.name || "Unknown",
        current_level: ec.current_level,
        target_level: ec.target_level,
        self_assessed_level: ec.self_assessed_level,
        self_assessment_notes: ec.self_assessment_notes
      })) || [];

      setCapabilities(formatted);

      // Initialize assessments with existing self-assessments
      const initialAssessments: Record<string, { level: string; notes: string }> = {};
      formatted.forEach((cap) => {
        initialAssessments[cap.id] = {
          level: cap.self_assessed_level || cap.current_level,
          notes: cap.self_assessment_notes || ""
        };
      });
      setAssessments(initialAssessments);
    } catch (error) {
      console.error("Error loading capabilities:", error);
      toast.error("Failed to load capabilities");
    } finally {
      setLoading(false);
    }
  };

  const handleLevelChange = (capabilityId: string, level: string) => {
    setAssessments((prev) => ({
      ...prev,
      [capabilityId]: { ...prev[capabilityId], level }
    }));
  };

  const handleNotesChange = (capabilityId: string, notes: string) => {
    setAssessments((prev) => ({
      ...prev,
      [capabilityId]: { ...prev[capabilityId], notes }
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const updates = Object.entries(assessments).map(([id, assessment]) => ({
        id,
        self_assessed_level: assessment.level,
        self_assessment_notes: assessment.notes,
        self_assessed_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("employee_capabilities")
        .upsert(updates);

      if (error) throw error;

      toast.success("Self-assessment completed successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting self-assessment:", error);
      toast.error("Failed to save self-assessment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Self-Assess Your Capabilities</DialogTitle>
          <DialogDescription>
            Review each capability and assess your current skill level. Add notes to provide context for your assessment.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : capabilities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No capabilities assigned yet.
          </p>
        ) : (
          <div className="space-y-6">
            {capabilities.map((cap) => (
              <div key={cap.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-semibold">{cap.capability_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Target: {getLevelLabel(cap.target_level)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Your Current Level</Label>
                  <Select
                    value={assessments[cap.id]?.level || cap.current_level}
                    onValueChange={(value) => handleLevelChange(cap.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {getLevelLabel(level)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes about your experience with this capability..."
                    value={assessments[cap.id]?.notes || ""}
                    onChange={(e) => handleNotesChange(cap.id, e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Self-Assessment"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
