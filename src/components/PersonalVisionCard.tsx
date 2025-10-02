import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Edit, Save, X } from "lucide-react";

type PersonalGoals = {
  id: string;
  one_year_vision: string | null;
  three_year_vision: string | null;
};

export default function PersonalVisionCard() {
  const [goals, setGoals] = useState<PersonalGoals | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [oneYearVision, setOneYearVision] = useState("");
  const [threeYearVision, setThreeYearVision] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadVisions();
  }, []);

  const loadVisions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("personal_goals")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setGoals(data);
        setOneYearVision(data.one_year_vision || "");
        setThreeYearVision(data.three_year_vision || "");
      }
    } catch (error: any) {
      console.error("Error loading visions:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const payload = {
        profile_id: user.id,
        company_id: profile.company_id,
        one_year_vision: oneYearVision || null,
        three_year_vision: threeYearVision || null,
      };

      const { error } = await supabase
        .from("personal_goals")
        .upsert(payload, { onConflict: 'profile_id' });

      if (error) throw error;

      toast({
        title: "Vision saved",
        description: "Your personal vision has been updated",
      });

      setIsEditing(false);
      await loadVisions();
    } catch (error: any) {
      toast({
        title: "Error saving vision",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOneYearVision(goals?.one_year_vision || "");
    setThreeYearVision(goals?.three_year_vision || "");
    setIsEditing(false);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              My Vision
            </CardTitle>
            <CardDescription>
              Where do you see yourself in the future?
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-semibold mb-2 block">
            1 Year Vision
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            One year from now, what do you want the story to be?
          </p>
          {isEditing ? (
            <Textarea
              value={oneYearVision}
              onChange={(e) => setOneYearVision(e.target.value)}
              placeholder="Describe your vision for one year from now..."
              className="min-h-[100px]"
            />
          ) : (
            <p className="text-sm p-4 bg-muted/50 rounded-md min-h-[100px]">
              {oneYearVision || "No vision set yet. Click edit to add your 1-year vision."}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold mb-2 block">
            3 Year Vision
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Three years from now, what do you want the story to be?
          </p>
          {isEditing ? (
            <Textarea
              value={threeYearVision}
              onChange={(e) => setThreeYearVision(e.target.value)}
              placeholder="Describe your vision for three years from now..."
              className="min-h-[100px]"
            />
          ) : (
            <p className="text-sm p-4 bg-muted/50 rounded-md min-h-[100px]">
              {threeYearVision || "No vision set yet. Click edit to add your 3-year vision."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
