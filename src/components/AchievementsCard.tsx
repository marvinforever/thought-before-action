import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Achievement = {
  id: string;
  category: string;
  achievement_text: string;
  achieved_date: string | null;
};

type Recognition = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  recognition_date: string;
  given_by_name: string;
};

export default function AchievementsCard() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [isAdding, setIsAdding] = useState<{ category: string } | null>(null);
  const [editingAchievement, setEditingAchievement] = useState<string | null>(null);
  const [newAchievement, setNewAchievement] = useState({ text: "", date: "" });
  const [editData, setEditData] = useState({ text: "", date: "" });
  const { toast } = useToast();

  useEffect(() => {
    loadAchievements();
    loadRecognitions();
  }, []);

  const loadAchievements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("profile_id", user.id)
        .order("achieved_date", { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error: any) {
      console.error("Error loading achievements:", error);
    }
  };

  const loadRecognitions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("recognition_notes")
        .select(`
          id,
          title,
          description,
          category,
          recognition_date,
          profiles!recognition_notes_given_by_fkey(full_name)
        `)
        .eq("given_to", user.id)
        .order("recognition_date", { ascending: false });

      if (error) throw error;
      
      const formattedData = data?.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        recognition_date: r.recognition_date,
        given_by_name: (r.profiles as any)?.full_name || "Manager"
      })) || [];
      
      setRecognitions(formattedData);
    } catch (error: any) {
      console.error("Error loading recognitions:", error);
    }
  };

  const handleAddAchievement = async (category: string) => {
    if (!newAchievement.text.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("achievements")
        .insert({
          profile_id: user.id,
          company_id: profile.company_id,
          category,
          achievement_text: newAchievement.text,
          achieved_date: newAchievement.date || null,
        });

      if (error) throw error;

      toast({
        title: "Achievement added",
        description: "Congratulations on your accomplishment!",
      });

      setIsAdding(null);
      setNewAchievement({ text: "", date: "" });
      await loadAchievements();
    } catch (error: any) {
      toast({
        title: "Error adding achievement",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditAchievement = async (id: string) => {
    if (!editData.text.trim()) return;

    try {
      const { error } = await supabase
        .from("achievements")
        .update({
          achievement_text: editData.text,
          achieved_date: editData.date || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Achievement updated",
        description: "Your accomplishment has been updated",
      });

      setEditingAchievement(null);
      setEditData({ text: "", date: "" });
      await loadAchievements();
    } catch (error: any) {
      toast({
        title: "Error updating achievement",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    try {
      const { error } = await supabase
        .from("achievements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Achievement deleted",
        description: "The achievement has been removed",
      });

      await loadAchievements();
    } catch (error: any) {
      toast({
        title: "Error deleting achievement",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEditing = (achievement: Achievement) => {
    setEditingAchievement(achievement.id);
    setEditData({
      text: achievement.achievement_text,
      date: achievement.achieved_date || "",
    });
  };

  const getAchievementsByCategory = (category: string) => {
    return achievements.filter(a => a.category === category);
  };

  const renderRecognitionsList = () => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Manager Recognition</h4>
          <Badge variant="secondary">{recognitions.length}</Badge>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {recognitions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No manager recognition yet
            </p>
          ) : (
            recognitions.map((recognition) => (
              <Card key={recognition.id} className="border-l-4 border-l-primary bg-primary/5">
                <CardContent className="pt-3 pb-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{recognition.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{recognition.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(recognition.recognition_date).toLocaleDateString()}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">From {recognition.given_by_name}</span>
                      {recognition.category && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <Badge variant="outline" className="text-xs">{recognition.category}</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAchievementsList = (category: string) => {
    const categoryAchievements = getAchievementsByCategory(category);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm capitalize">{category}</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding({ category })}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {isAdding?.category === category && (
          <Card className="border-primary">
            <CardContent className="pt-4 space-y-3">
              <Input
                value={newAchievement.text}
                onChange={(e) => setNewAchievement({ ...newAchievement, text: e.target.value })}
                placeholder="Describe your achievement..."
              />
              <Input
                type="date"
                value={newAchievement.date}
                onChange={(e) => setNewAchievement({ ...newAchievement, date: e.target.value })}
                placeholder="Achievement date (optional)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAddAchievement(category)}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setIsAdding(null);
                  setNewAchievement({ text: "", date: "" });
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {categoryAchievements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No {category} achievements yet
            </p>
          ) : (
            categoryAchievements.map((achievement) => {
              const isEditing = editingAchievement === achievement.id;
              
              if (isEditing) {
                return (
                  <Card key={achievement.id} className="border-primary">
                    <CardContent className="pt-4 space-y-3">
                      <Input
                        value={editData.text}
                        onChange={(e) => setEditData({ ...editData, text: e.target.value })}
                        placeholder="Describe your achievement..."
                      />
                      <Input
                        type="date"
                        value={editData.date}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        placeholder="Achievement date (optional)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditAchievement(achievement.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingAchievement(null);
                          setEditData({ text: "", date: "" });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={achievement.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm">{achievement.achievement_text}</p>
                        {achievement.achieved_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(achievement.achieved_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(achievement)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAchievement(achievement.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Celebrations & Achievements
        </CardTitle>
        <CardDescription>
          Track and celebrate your accomplishments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {renderAchievementsList("personal")}
          {renderAchievementsList("professional")}
          {renderRecognitionsList()}
        </div>
      </CardContent>
    </Card>
  );
}
