import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SelfAssessCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
}

interface CapabilityLevel {
  level: string;
  description: string;
}

interface CapabilityAssessment {
  id: string;
  capability_id: string;
  capability_name: string;
  current_level: string;
  target_level: string;
  self_assessed_level?: string;
  self_assessment_notes?: string;
  level_descriptions?: CapabilityLevel[];
}

const LEVELS = ["foundational", "advancing", "independent", "mastery"];

const getLevelLabel = (level: string) => {
  const labels: Record<string, string> = {
    foundational: "L1 - Foundational",
    advancing: "L2 - Advancing",
    independent: "L3 - Independent",
    mastery: "L4 - Mastery"
  };
  return labels[level] || level;
};

const getLevelNumber = (level: string) => {
  const numbers: Record<string, string> = {
    foundational: "L1",
    advancing: "L2",
    independent: "L3",
    mastery: "L4"
  };
  return numbers[level] || "";
};

export function SelfAssessCapabilitiesDialog({ open, onOpenChange, profileId }: SelfAssessCapabilitiesDialogProps) {
  const [capabilities, setCapabilities] = useState<CapabilityAssessment[]>([]);
  const [assessments, setAssessments] = useState<Record<string, { level: string; notes: string }>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedCapability, setExpandedCapability] = useState<string | null>(null);

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

      // Fetch level descriptions for each capability
      const capabilityIds = data?.map((ec: any) => ec.capability_id) || [];
      const { data: levelData, error: levelError } = await supabase
        .from("capability_levels")
        .select("capability_id, level, description")
        .in("capability_id", capabilityIds);

      if (levelError) {
        console.error("Error loading level descriptions:", levelError);
      }

      // Group level descriptions by capability_id
      const levelsByCapability = new Map<string, CapabilityLevel[]>();
      levelData?.forEach((level: any) => {
        if (!levelsByCapability.has(level.capability_id)) {
          levelsByCapability.set(level.capability_id, []);
        }
        levelsByCapability.get(level.capability_id)?.push({
          level: level.level,
          description: level.description
        });
      });

      const formatted = data?.map((ec: any) => ({
        id: ec.id,
        capability_id: ec.capability_id,
        capability_name: ec.capabilities?.name || "Unknown",
        current_level: ec.current_level,
        target_level: ec.target_level,
        self_assessed_level: ec.self_assessed_level,
        self_assessment_notes: ec.self_assessment_notes,
        level_descriptions: levelsByCapability.get(ec.capability_id) || []
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
                    Manager's Target for You: {getLevelLabel(cap.target_level)}
                  </p>
                </div>

                <Collapsible
                  open={expandedCapability === cap.id}
                  onOpenChange={() => setExpandedCapability(expandedCapability === cap.id ? null : cap.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="text-sm font-medium">
                        {expandedCapability === cap.id ? "Hide" : "Show"} Level Definitions
                      </span>
                      {expandedCapability === cap.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {cap.level_descriptions?.length > 0 ? (
                      cap.level_descriptions
                        .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
                        .map((levelDesc) => (
                          <div
                            key={levelDesc.level}
                            className={`p-3 rounded-md border-l-4 ${
                              levelDesc.level === cap.target_level
                                ? "border-primary bg-primary/5"
                                : "border-muted bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">
                                {getLevelNumber(levelDesc.level)}
                              </span>
                              <span className="text-sm font-medium">
                                {getLevelLabel(levelDesc.level)}
                              </span>
                              {levelDesc.level === cap.target_level && (
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                  Your Target
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {levelDesc.description}
                            </p>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No level descriptions available for this capability.
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2">
                  <Label>Where are you today?</Label>
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
                    placeholder="Share examples or context about your current skill level..."
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
