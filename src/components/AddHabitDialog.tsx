import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Habit = {
  id: string;
  habit_name: string;
  habit_description: string | null;
  target_frequency?: string;
};

type AddHabitDialogProps = {
  open: boolean;
  onClose: () => void;
  onHabitAdded: () => void;
  editingHabit?: Habit | null;
};

type SuggestedHabit = {
  habit_name: string;
  habit_description: string;
  reasoning: string;
};

export default function AddHabitDialog({ open, onClose, onHabitAdded, editingHabit }: AddHabitDialogProps) {
  const [habitName, setHabitName] = useState("");
  const [habitDescription, setHabitDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [saving, setSaving] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedHabit[]>([]);
  const { toast } = useToast();

  // Load editing habit data when dialog opens
  useEffect(() => {
    if (editingHabit) {
      setHabitName(editingHabit.habit_name);
      setHabitDescription(editingHabit.habit_description || "");
      setFrequency(editingHabit.target_frequency || "daily");
    } else if (!open) {
      // Reset form when dialog closes
      setHabitName("");
      setHabitDescription("");
      setFrequency("daily");
      setSuggestions([]);
    }
  }, [editingHabit, open]);

  const handleGetSuggestions = async () => {
    setLoadingAI(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("suggest-habits", {
        body: { user_id: user.id },
      });

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast({
          title: "AI Suggestions Ready",
          description: `Generated ${data.suggestions.length} Kaizen micro-habits for you`,
        });
      }
    } catch (error: any) {
      console.error("Error getting AI suggestions:", error);
      toast({
        title: "Error",
        description: "Failed to get AI suggestions. Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleUseSuggestion = (suggestion: SuggestedHabit) => {
    setHabitName(suggestion.habit_name);
    setHabitDescription(suggestion.habit_description);
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!habitName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a habit name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingHabit) {
        // Update existing habit
        const { error } = await supabase
          .from("leading_indicators")
          .update({
            habit_name: habitName.trim(),
            habit_description: habitDescription.trim() || null,
            target_frequency: frequency,
          })
          .eq("id", editingHabit.id)
          .eq("profile_id", user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Habit updated successfully",
        });
      } else {
        // Create new habit
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) throw new Error("Company not found");

        const { error } = await supabase.from("leading_indicators").insert({
          profile_id: user.id,
          company_id: profile.company_id,
          habit_name: habitName.trim(),
          habit_description: habitDescription.trim() || null,
          target_frequency: frequency,
          is_active: true,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Habit added to your Greatness Tracker",
        });
      }

      onHabitAdded();
      handleClose();
    } catch (error: any) {
      console.error("Error saving habit:", error);
      toast({
        title: "Error",
        description: editingHabit ? "Failed to update habit" : "Failed to save habit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setHabitName("");
    setHabitDescription("");
    setFrequency("daily");
    setSuggestions([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingHabit ? "Edit Habit" : "Add New Habit"}</DialogTitle>
          <DialogDescription>
            {editingHabit 
              ? "Update your habit details below."
              : "Create a Kaizen micro-habit. Small, daily actions lead to extraordinary results."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {suggestions.length === 0 || editingHabit ? (
            <>
              <div>
                <Label htmlFor="habit-name">Habit Name</Label>
                <Input
                  id="habit-name"
                  placeholder="e.g., Read 10 pages, Write 200 words, Review 1 resource"
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="habit-description">Description (Optional)</Label>
                <Textarea
                  id="habit-description"
                  placeholder="What does this habit help you achieve?"
                  value={habitDescription}
                  onChange={(e) => setHabitDescription(e.target.value)}
                  className="mt-1.5 min-h-[80px]"
                />
              </div>

              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Every day)</SelectItem>
                    <SelectItem value="weekdays">Weekdays (Monday - Friday)</SelectItem>
                    <SelectItem value="weekly">Weekly (Once per week)</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly (Twice per week)</SelectItem>
                    <SelectItem value="monthly">Monthly (Once per month)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  How often should you complete this habit?
                </p>
              </div>

              {!editingHabit && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleGetSuggestions}
                    disabled={loadingAI}
                    className="w-full gap-2"
                  >
                    {loadingAI ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Getting AI Suggestions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">AI-Suggested Kaizen Habits</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSuggestions([])}
                >
                  Create Manually
                </Button>
              </div>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-2 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleUseSuggestion(suggestion)}
                >
                  <div className="flex items-start justify-between">
                    <h5 className="font-semibold">{suggestion.habit_name}</h5>
                    <Button size="sm" variant="outline">
                      Use This
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.habit_description}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    💡 {suggestion.reasoning}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          {suggestions.length === 0 && (
            <Button onClick={handleSave} disabled={saving || !habitName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingHabit ? "Updating..." : "Saving..."}
                </>
              ) : (
                editingHabit ? "Update Habit" : "Add Habit"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
