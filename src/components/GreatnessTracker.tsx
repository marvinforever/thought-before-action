import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Flame, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import AddHabitDialog from "./AddHabitDialog";

type Habit = {
  id: string;
  habit_name: string;
  habit_description: string | null;
  current_streak: number;
  longest_streak: number;
  linked_capability_id: string | null;
  linked_goal_id: string | null;
  is_active: boolean;
};

type HabitCompletion = {
  habit_id: string;
  completed_date: string;
};

export default function GreatnessTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadHabits();
    loadTodayCompletions();
  }, []);

  const loadHabits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("leading_indicators")
        .select("*")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHabits(data || []);
    } catch (error: any) {
      console.error("Error loading habits:", error);
      toast({
        title: "Error",
        description: "Failed to load habits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTodayCompletions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("habit_completions")
        .select("habit_id, completed_date")
        .eq("profile_id", user.id)
        .eq("completed_date", today);

      if (error) throw error;
      setCompletions(data || []);
    } catch (error: any) {
      console.error("Error loading completions:", error);
    }
  };

  const toggleHabitCompletion = async (habitId: string, isCompleted: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      if (isCompleted) {
        // Remove completion
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("completed_date", today);

        if (error) throw error;

        setCompletions(prev => prev.filter(c => c.habit_id !== habitId));
        
        // Update streak
        await updateStreak(habitId, false);
      } else {
        // Add completion
        const { error } = await supabase
          .from("habit_completions")
          .insert({
            habit_id: habitId,
            profile_id: user.id,
            completed_date: today,
          });

        if (error) throw error;

        setCompletions(prev => [...prev, { habit_id: habitId, completed_date: today }]);
        
        // Update streak
        await updateStreak(habitId, true);
      }

      await loadHabits();
    } catch (error: any) {
      console.error("Error toggling completion:", error);
      toast({
        title: "Error",
        description: "Failed to update habit",
        variant: "destructive",
      });
    }
  };

  const updateStreak = async (habitId: string, completed: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get recent completions for this habit
      const { data: recentCompletions } = await supabase
        .from("habit_completions")
        .select("completed_date")
        .eq("habit_id", habitId)
        .order("completed_date", { ascending: false })
        .limit(30);

      if (!recentCompletions) return;

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      const dates = recentCompletions.map(c => new Date(c.completed_date));

      for (let i = 0; i < dates.length; i++) {
        const daysDiff = Math.floor((today.getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === i) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Get current habit data
      const { data: habitData } = await supabase
        .from("leading_indicators")
        .select("longest_streak")
        .eq("id", habitId)
        .single();

      const longestStreak = Math.max(currentStreak, habitData?.longest_streak || 0);

      // Update habit streaks
      await supabase
        .from("leading_indicators")
        .update({
          current_streak: currentStreak,
          longest_streak: longestStreak,
        })
        .eq("id", habitId);

    } catch (error) {
      console.error("Error updating streak:", error);
    }
  };

  const isHabitCompleted = (habitId: string) => {
    return completions.some(c => c.habit_id === habitId);
  };

  const getWeeklyProgress = (habitId: string) => {
    // This would calculate the weekly completion rate
    // For now, returning a placeholder
    return 71; // 5/7 days = 71%
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Greatness Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading habits...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Greatness Tracker
            </CardTitle>
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Habit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No habits yet. Start building your daily excellence!
              </p>
              <Button onClick={() => setShowAddDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Habit
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {habits.map((habit) => {
                const completed = isHabitCompleted(habit.id);
                const weeklyProgress = getWeeklyProgress(habit.id);

                return (
                  <div
                    key={habit.id}
                    className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={completed}
                        onCheckedChange={() => toggleHabitCompletion(habit.id, completed)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{habit.habit_name}</h4>
                          <div className="flex items-center gap-1 text-sm">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="font-bold">{habit.current_streak}</span>
                            <span className="text-muted-foreground">day streak</span>
                          </div>
                        </div>
                        {habit.habit_description && (
                          <p className="text-sm text-muted-foreground">
                            {habit.habit_description}
                          </p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>This week</span>
                            <span>{weeklyProgress}%</span>
                          </div>
                          <Progress value={weeklyProgress} className="h-2" />
                        </div>
                        {habit.longest_streak > 0 && (
                          <p className="text-xs text-muted-foreground">
                            🏆 Best streak: {habit.longest_streak} days
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddHabitDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onHabitAdded={loadHabits}
      />
    </>
  );
}
