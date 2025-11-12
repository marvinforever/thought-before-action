import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type CapabilityLevel = {
  level: 'foundational' | 'advancing' | 'independent' | 'mastery';
  description: string;
};

interface CreateCapabilityDialogProps {
  open: boolean;
  onClose: () => void;
  onCapabilityCreated: () => void;
  editingCapability?: any;
}

const LEVEL_LABELS = {
  foundational: "Foundational (Awareness)",
  advancing: "Advancing (Working Knowledge)",
  independent: "Independent (Skill)",
  mastery: "Mastery"
};

const LEVEL_DESCRIPTIONS = {
  foundational: "Basic awareness and understanding of core concepts",
  advancing: "Developing practical skills with guidance",
  independent: "Can perform independently with consistent quality",
  mastery: "Expert level, can teach and innovate"
};

export default function CreateCapabilityDialog({ 
  open, 
  onClose, 
  onCapabilityCreated,
  editingCapability 
}: CreateCapabilityDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [levels, setLevels] = useState<CapabilityLevel[]>([
    { level: 'foundational', description: '' },
    { level: 'advancing', description: '' },
    { level: 'independent', description: '' },
    { level: 'mastery', description: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingCapability) {
      setName(editingCapability.name || "");
      setCategory(editingCapability.category || "");
      setDescription(editingCapability.description || "");
      setFullDescription(editingCapability.full_description || "");
      
      // Load existing levels
      if (editingCapability.levels && editingCapability.levels.length > 0) {
        const levelMap = {
          foundational: editingCapability.levels.find((l: any) => l.level === 'foundational')?.description || '',
          advancing: editingCapability.levels.find((l: any) => l.level === 'advancing')?.description || '',
          independent: editingCapability.levels.find((l: any) => l.level === 'independent')?.description || '',
          mastery: editingCapability.levels.find((l: any) => l.level === 'mastery')?.description || ''
        };
        setLevels([
          { level: 'foundational', description: levelMap.foundational },
          { level: 'advancing', description: levelMap.advancing },
          { level: 'independent', description: levelMap.independent },
          { level: 'mastery', description: levelMap.mastery }
        ]);
      }
    } else {
      // Reset for new capability
      setName("");
      setCategory("");
      setDescription("");
      setFullDescription("");
      setLevels([
        { level: 'foundational', description: '' },
        { level: 'advancing', description: '' },
        { level: 'independent', description: '' },
        { level: 'mastery', description: '' }
      ]);
    }
  }, [editingCapability, open]);

  const updateLevelDescription = (level: string, description: string) => {
    setLevels(prev => prev.map(l => 
      l.level === level ? { ...l, description } : l
    ));
  };

  const handleGenerateWithJericho = async () => {
    if (!name.trim()) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter a capability name first", 
        variant: "destructive" 
      });
      return;
    }
    if (!category.trim()) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter a category first", 
        variant: "destructive" 
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-capability-content', {
        body: {
          capabilityName: name.trim(),
          category: category.trim()
        }
      });

      if (error) throw error;

      // Populate all fields with AI-generated content
      setDescription(data.shortDescription || '');
      setFullDescription(data.fullDescription || '');
      setLevels([
        { level: 'foundational', description: data.foundational || '' },
        { level: 'advancing', description: data.advancing || '' },
        { level: 'independent', description: data.independent || '' },
        { level: 'mastery', description: data.mastery || '' }
      ]);

      toast({
        title: "Content Generated!",
        description: "Jericho has written the capability content. Review and edit as needed."
      });
    } catch (error: any) {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Capability name is required", variant: "destructive" });
      return;
    }
    if (!category.trim()) {
      toast({ title: "Error", description: "Category is required", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Error", description: "Short description is required", variant: "destructive" });
      return;
    }

    // Check if all four levels have descriptions
    const incompleteLevels = levels.filter(l => !l.description.trim());
    if (incompleteLevels.length > 0) {
      toast({ 
        title: "Error", 
        description: "All four capability levels must have descriptions", 
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company associated with user");

      if (editingCapability) {
        // Update existing capability
        const { error: capError } = await supabase
          .from("capabilities")
          .update({
            name: name.trim(),
            category: category.trim(),
            description: description.trim(),
            full_description: fullDescription.trim() || null,
          })
          .eq("id", editingCapability.id);

        if (capError) throw capError;

        // Delete existing levels and recreate
        await supabase
          .from("capability_levels")
          .delete()
          .eq("capability_id", editingCapability.id);

        const levelsToInsert = levels.map(level => ({
          capability_id: editingCapability.id,
          level: level.level,
          description: level.description.trim()
        }));

        const { error: levelsError } = await supabase
          .from("capability_levels")
          .insert(levelsToInsert);

        if (levelsError) throw levelsError;

        toast({
          title: "Success",
          description: "Custom capability updated successfully"
        });
      } else {
        // Create new capability
        const { data: newCap, error: capError } = await supabase
          .from("capabilities")
          .insert({
            name: name.trim(),
            category: category.trim(),
            description: description.trim(),
            full_description: fullDescription.trim() || null,
            is_custom: true,
            status: 'approved',
            created_by_company_id: profile.company_id
          })
          .select()
          .single();

        if (capError) throw capError;

        // Insert all four levels
        const levelsToInsert = levels.map(level => ({
          capability_id: newCap.id,
          level: level.level,
          description: level.description.trim()
        }));

        const { error: levelsError } = await supabase
          .from("capability_levels")
          .insert(levelsToInsert);

        if (levelsError) throw levelsError;

        toast({
          title: "Success",
          description: "Custom capability created successfully. It's now available for your team."
        });
      }

      onCapabilityCreated();
      onClose();
    } catch (error: any) {
      console.error("Error saving capability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save capability",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCapability ? "Edit Custom Capability" : "Create Custom Capability"}
          </DialogTitle>
          <DialogDescription>
            Define a company-specific capability with four progression levels: Foundational (Awareness), Advancing (Working Knowledge), Independent (Skill), and Mastery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Basic Information</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateWithJericho}
                  disabled={generating || !name.trim() || !category.trim()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Let Jericho Write This
                    </>
                  )}
                </Button>
              </div>
              {!name.trim() || !category.trim() ? (
                <Alert>
                  <AlertDescription className="text-sm">
                    Enter a name and category first, then let Jericho generate the content for you.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Capability Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Data Analysis, Customer Communication"
                  disabled={generating}
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Technical Skills, Leadership, Communication"
                  disabled={generating}
                />
              </div>

              <div>
                <Label htmlFor="description">Short Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this capability (1-2 sentences)"
                  rows={2}
                  disabled={generating}
                />
              </div>

              <div>
                <Label htmlFor="fullDescription">Full Description (Optional)</Label>
                <Textarea
                  id="fullDescription"
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  placeholder="Detailed explanation of this capability and why it matters"
                  rows={3}
                  disabled={generating}
                />
              </div>
            </CardContent>
          </Card>

          {/* Four Progression Levels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Four Progression Levels *</CardTitle>
              <DialogDescription>
                Define what each level looks like. All four levels are required.
              </DialogDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {levels.map((level) => (
                <div key={level.level} className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      {LEVEL_LABELS[level.level]}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {LEVEL_DESCRIPTIONS[level.level]}
                  </p>
                  <Textarea
                    value={level.description}
                    onChange={(e) => updateLevelDescription(level.level, e.target.value)}
                    placeholder={`Describe what ${LEVEL_LABELS[level.level]} looks like for this capability...`}
                    rows={3}
                    disabled={generating}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving || generating}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || generating}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCapability ? "Update Capability" : "Create Capability"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
