import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Award, Zap, ChevronLeft, Link, Target, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecognitionTemplate {
  id: string;
  title: string;
  description_prompt: string | null;
  category: string | null;
}

interface Capability {
  id: string;
  name: string;
}

interface Goal {
  id: string;
  goal_text: string | null;
}

interface RecognitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
  };
  isPeerRecognition?: boolean;
}

type RecognitionMode = "select" | "template" | "quick" | "detailed";

const IMPACT_LEVELS = [
  { value: "small_win", label: "Small Win", description: "Day-to-day excellence", icon: "⭐" },
  { value: "significant", label: "Significant", description: "Above and beyond", icon: "🌟" },
  { value: "exceptional", label: "Exceptional", description: "Outstanding contribution", icon: "🏆" },
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", description: "Only you and them", icon: Users },
  { value: "team", label: "Team", description: "Visible to team", icon: Users },
  { value: "company", label: "Company", description: "Visible to everyone", icon: Users },
];

export function RecognitionDialog({ open, onOpenChange, employee, isPeerRecognition = false }: RecognitionDialogProps) {
  const [mode, setMode] = useState<RecognitionMode>("select");
  const [templates, setTemplates] = useState<RecognitionTemplate[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<RecognitionTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("team");
  const [impactLevel, setImpactLevel] = useState<string>("small_win");
  const [linkedCapabilityId, setLinkedCapabilityId] = useState<string>("");
  const [linkedGoalId, setLinkedGoalId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadEmployeeCapabilitiesAndGoals();
      // Reset state
      setMode("select");
      setSelectedTemplate(null);
      setTitle("");
      setDescription("");
      setCategory("");
      setVisibility("team");
      setImpactLevel("small_win");
      setLinkedCapabilityId("");
      setLinkedGoalId("");
    }
  }, [open, employee.id]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("recognition_templates")
        .select("*")
        .order("display_order");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadEmployeeCapabilitiesAndGoals = async () => {
    try {
      // Load capabilities for this employee
      const { data: capData } = await supabase
        .from("employee_capabilities")
        .select("capability:capabilities(id, name)")
        .eq("profile_id", employee.id)
        .not("capability_id", "is", null);

      const caps = capData?.map((c: any) => c.capability).filter(Boolean) || [];
      setCapabilities(caps);

      // Note: goal linking is disabled as the FK constraint points to personal_goals 
      // which doesn't have individual goals - only visions
      setGoals([]);
    } catch (error) {
      console.error("Error loading employee data:", error);
    }
  };

  const handleSelectTemplate = (template: RecognitionTemplate) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setCategory(template.category || "");
    setDescription("");
    setMode("detailed");
  };

  const handleQuickKudos = () => {
    setMode("quick");
    setTitle("Quick Kudos");
    setVisibility("team");
    setImpactLevel("small_win");
  };

  const handleSubmit = async () => {
    const isQuick = mode === "quick";
    
    if (!isQuick && !title.trim()) {
      toast({
        title: "Missing title",
        description: "Please provide a title for this recognition",
        variant: "destructive",
      });
      return;
    }

    if (!isQuick && !description.trim()) {
      toast({
        title: "Missing description",
        description: "Please describe what they did",
        variant: "destructive",
      });
      return;
    }

    if (isQuick && !description.trim()) {
      toast({
        title: "Missing message",
        description: "Write a quick note about what they did",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get giver's name
      const { data: giverProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      // Get recipient's email
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", employee.id)
        .single();

      const finalTitle = isQuick ? "Quick Kudos 👏" : title.trim();
      const selectedCapability = capabilities.find(c => c.id === linkedCapabilityId);
      const selectedGoal = goals.find(g => g.id === linkedGoalId);

      const { data: recognitionData, error } = await supabase
        .from("recognition_notes")
        .insert({
          given_by: user.id,
          given_to: employee.id,
          company_id: employee.company_id,
          title: finalTitle,
          description: description.trim(),
          category: category || null,
          visibility,
          impact_level: impactLevel,
          capability_id: linkedCapabilityId && linkedCapabilityId !== "none" ? linkedCapabilityId : null,
          goal_id: linkedGoalId && linkedGoalId !== "none" ? linkedGoalId : null,
          template_id: selectedTemplate?.id || null,
          is_quick_kudos: isQuick,
        })
        .select()
        .single();

      if (error) throw error;

      // Also insert into analytics
      await supabase.from("recognition_analytics").insert({
        company_id: employee.company_id,
        giver_id: user.id,
        receiver_id: employee.id,
        recognition_id: recognitionData.id,
        capability_id: linkedCapabilityId || null,
        category: category || null,
        impact_level: impactLevel,
      });

      // Send email notification to recipient
      if (recipientProfile?.email) {
        try {
          await supabase.functions.invoke("send-recognition-notification", {
            body: {
              recipientEmail: recipientProfile.email,
              recipientName: employee.full_name,
              giverName: giverProfile?.full_name || "A colleague",
              title: finalTitle,
              description: description.trim(),
              impactLevel,
              category: category || undefined,
              capabilityName: selectedCapability?.name || undefined,
              goalText: selectedGoal?.goal_text || undefined,
              isQuickKudos: isQuick,
            },
          });
          console.log("Recognition notification email sent");
        } catch (emailError) {
          console.error("Failed to send recognition email:", emailError);
          // Don't fail the whole operation if email fails
        }
      }

      toast({
        title: isQuick ? "Kudos sent! 🎉" : "Recognition sent!",
        description: `${employee.full_name} has been notified via email`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error sending recognition",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderModeSelect = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
          onClick={handleQuickKudos}
        >
          <Zap className="h-6 w-6 text-amber-500" />
          <div className="text-center">
            <p className="font-medium">Quick Kudos</p>
            <p className="text-xs text-muted-foreground">Fast recognition</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
          onClick={() => setMode("template")}
        >
          <Award className="h-6 w-6 text-primary" />
          <div className="text-center">
            <p className="font-medium">Detailed Recognition</p>
            <p className="text-xs text-muted-foreground">With templates</p>
          </div>
        </Button>
      </div>

      {isPeerRecognition && (
        <p className="text-xs text-center text-muted-foreground">
          Peer recognition - celebrating your teammates 🤝
        </p>
      )}
    </div>
  );

  const renderTemplateSelect = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="mb-2">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <p className="text-sm text-muted-foreground mb-3">Choose a template to get started:</p>

      {loadingTemplates ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-2 max-h-[300px] overflow-y-auto">
          {templates.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              className="h-auto p-3 justify-start text-left hover:border-primary hover:bg-primary/5"
              onClick={() => handleSelectTemplate(template)}
            >
              <div>
                <p className="font-medium">{template.title}</p>
                {template.category && (
                  <Badge variant="secondary" className="mt-1 text-xs">{template.category}</Badge>
                )}
              </div>
            </Button>
          ))}

          <Button
            variant="ghost"
            className="h-auto p-3 justify-start text-left border-dashed border-2"
            onClick={() => {
              setSelectedTemplate(null);
              setMode("detailed");
            }}
          >
            <div>
              <p className="font-medium">Custom Recognition</p>
              <p className="text-xs text-muted-foreground">Write your own</p>
            </div>
          </Button>
        </div>
      )}
    </div>
  );

  const renderQuickKudos = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="mb-2">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="text-center mb-4">
        <Zap className="h-10 w-10 text-amber-500 mx-auto mb-2" />
        <h3 className="font-semibold">Quick Kudos</h3>
        <p className="text-sm text-muted-foreground">Send a quick shout-out</p>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder={`Nice work, ${employee.full_name.split(' ')[0]}! I noticed...`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          autoFocus
        />
      </div>

      <div className="flex gap-2">
        {IMPACT_LEVELS.map((level) => (
          <Button
            key={level.value}
            type="button"
            variant={impactLevel === level.value ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setImpactLevel(level.value)}
          >
            <span className="mr-1">{level.icon}</span>
            {level.label}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderDetailedForm = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setMode(selectedTemplate ? "template" : "select")} className="mb-2">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {selectedTemplate && (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 mb-4">
          <p className="text-sm font-medium">{selectedTemplate.title}</p>
          {selectedTemplate.description_prompt && (
            <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.description_prompt}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          placeholder="e.g., Great presentation to the client"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <Textarea
          placeholder={selectedTemplate?.description_prompt || "Describe what they did and why it was great..."}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      {/* Impact Level */}
      <div className="space-y-2">
        <Label>Impact Level</Label>
        <div className="grid grid-cols-3 gap-2">
          {IMPACT_LEVELS.map((level) => (
            <Button
              key={level.value}
              type="button"
              variant={impactLevel === level.value ? "default" : "outline"}
              size="sm"
              className="h-auto py-2 flex-col"
              onClick={() => setImpactLevel(level.value)}
            >
              <span className="text-lg">{level.icon}</span>
              <span className="text-xs">{level.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Link to Capability */}
      {capabilities.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Link to Capability (optional)
          </Label>
                <Select value={linkedCapabilityId || "none"} onValueChange={(val) => setLinkedCapabilityId(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a capability" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">None</SelectItem>
                    {capabilities.map((cap) => (
                      <SelectItem key={cap.id} value={cap.id}>
                        {cap.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
        </div>
      )}

      {/* Link to Goal */}
      {goals.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            Link to Goal (optional)
          </Label>
                <Select value={linkedGoalId || "none"} onValueChange={(val) => setLinkedGoalId(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">None</SelectItem>
                    {goals.filter(g => g.goal_text).map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.goal_text!.length > 50 ? goal.goal_text!.substring(0, 50) + "..." : goal.goal_text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
        </div>
      )}

      {/* Visibility */}
      <div className="space-y-2">
        <Label>Visibility</Label>
        <Select value={visibility} onValueChange={setVisibility}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {VISIBILITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category override */}
      {!selectedTemplate?.category && (
        <div className="space-y-2">
          <Label>Category (optional)</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {["Leadership", "Teamwork", "Innovation", "Problem Solving", "Customer Focus", "Communication", "Going Above & Beyond", "Other"].map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (mode) {
      case "select":
        return renderModeSelect();
      case "template":
        return renderTemplateSelect();
      case "quick":
        return renderQuickKudos();
      case "detailed":
        return renderDetailedForm();
    }
  };

  const showSubmitButton = mode === "quick" || mode === "detailed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {isPeerRecognition ? "Recognize" : "Recognize"} {employee.full_name}
          </DialogTitle>
          <DialogDescription>
            {mode === "select" 
              ? "Celebrate great work to build culture and combat recency bias"
              : mode === "quick"
              ? "Send a quick shout-out"
              : "Document the achievement"
            }
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        {showSubmitButton && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "quick" ? (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Send Kudos
                </>
              ) : (
                "Send Recognition"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
