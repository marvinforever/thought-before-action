import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Flame, TrendingUp, Archive, Trash2, Calendar, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

type GreatnessKey = {
  id: string;
  earned_at: string;
  streak_length: number;
  habit_id: string | null;
};

type HabitCompletion = {
  habit_id: string;
  completed_date: string;
};

type HabitCompletionStats = {
  [habitId: string]: {
    totalDays: number;
    weeklyCompletions: number;
  };
};

export default function GreatnessTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [completionStats, setCompletionStats] = useState<HabitCompletionStats>({});
  const [greatnessKeys, setGreatnessKeys] = useState<GreatnessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [backdateOpen, setBackdateOpen] = useState(false);
  const [backdateHabitId, setBackdateHabitId] = useState<string | null>(null);
  const [backdateStart, setBackdateStart] = useState("");
  const [backdateSubmitting, setBackdateSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadHabits();
    loadTodayCompletions();
    loadCompletionStats();
    loadGreatnessKeys();
  }, []);

  const loadGreatnessKeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("greatness_keys")
        .select("*")
        .eq("profile_id", user.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      setGreatnessKeys(data || []);
    } catch (error: any) {
      console.error("Error loading greatness keys:", error);
    }
  };

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

  const loadCompletionStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all completions for the user
      const { data: allCompletions, error } = await supabase
        .from("habit_completions")
        .select("habit_id, completed_date")
        .eq("profile_id", user.id);

      if (error) throw error;

      // Calculate stats for each habit
      const stats: HabitCompletionStats = {};
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      allCompletions?.forEach(completion => {
        if (!stats[completion.habit_id]) {
          stats[completion.habit_id] = { totalDays: 0, weeklyCompletions: 0 };
        }
        stats[completion.habit_id].totalDays++;

        const completionDate = new Date(completion.completed_date);
        if (completionDate >= sevenDaysAgo) {
          stats[completion.habit_id].weeklyCompletions++;
        }
      });

      setCompletionStats(stats);
    } catch (error: any) {
      console.error("Error loading completion stats:", error);
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
      await loadCompletionStats();
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

      // Check if user earned a Greatness Key (7-day streak)
      if (completed && currentStreak === 7) {
        await awardGreatnessKey(habitId, currentStreak);
      }

    } catch (error) {
      console.error("Error updating streak:", error);
    }
  };

  const awardGreatnessKey = async (habitId: string, streakLength: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Check if key already awarded for this streak
      const { data: existingKey } = await supabase
        .from("greatness_keys")
        .select("id")
        .eq("habit_id", habitId)
        .eq("streak_length", streakLength)
        .single();

      if (existingKey) return; // Already awarded

      const { error } = await supabase
        .from("greatness_keys")
        .insert({
          profile_id: user.id,
          company_id: profile.company_id,
          habit_id: habitId,
          streak_length: streakLength,
        });

      if (error) throw error;

      await loadGreatnessKeys();

      toast({
        title: "🔑 Greatness Key Earned!",
        description: `You've maintained a ${streakLength}-day streak! The key to greatness is consistency.`,
      });
    } catch (error: any) {
      console.error("Error awarding greatness key:", error);
    }
  };

  const openBackdate = (habitId: string) => {
    setBackdateHabitId(habitId);
    setBackdateStart(new Date().toISOString().split('T')[0]);
    setBackdateOpen(true);
  };

  const backdateHabit = async () => {
    try {
      if (!backdateHabitId || !backdateStart) return;
      setBackdateSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = new Date(backdateStart);
      start.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (start > today) {
        toast({ title: 'Invalid date', description: 'Start date cannot be in the future', variant: 'destructive' });
        setBackdateSubmitting(false);
        return;
      }

      // Build all dates from start to today
      const dates: string[] = [];
      for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Fetch existing completions to avoid duplicates
      const { data: existing } = await supabase
        .from('habit_completions')
        .select('completed_date')
        .eq('habit_id', backdateHabitId)
        .gte('completed_date', dates[0])
        .lte('completed_date', dates[dates.length - 1]);

      const existingSet = new Set((existing || []).map(e => e.completed_date));
      const rows = dates
        .filter(d => !existingSet.has(d))
        .map(d => ({ habit_id: backdateHabitId, profile_id: user.id, completed_date: d }));

      // Insert in chunks to avoid payload limits
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          const { error } = await supabase.from('habit_completions').insert(chunk);
          if (error) throw error;
        }
      }

      // Refresh data and streaks
      await updateStreak(backdateHabitId, true);
      await loadTodayCompletions();
      await loadCompletionStats();
      await loadHabits();

      toast({ title: 'Backdated successfully', description: `Logged ${rows.length} day(s) of consistency.` });
      setBackdateOpen(false);
      setBackdateHabitId(null);
    } catch (e) {
      console.error('Backdate error', e);
      toast({ title: 'Error', description: 'Failed to backdate habit', variant: 'destructive' });
    } finally {
      setBackdateSubmitting(false);
    }
  };

  const isHabitCompleted = (habitId: string) => {
    return completions.some(c => c.habit_id === habitId);
  };

  const getWeeklyProgress = (habitId: string) => {
    const stats = completionStats[habitId];
    if (!stats) return 0;
    return Math.round((stats.weeklyCompletions / 7) * 100);
  };

  const getTotalCompletions = (habitId: string) => {
    return completionStats[habitId]?.totalDays || 0;
  };

  const archiveHabit = async (habitId: string) => {
    try {
      const { error } = await supabase
        .from("leading_indicators")
        .update({ is_active: false })
        .eq("id", habitId);

      if (error) throw error;

      toast({
        title: "Habit Archived",
        description: "Habit has been archived successfully",
      });

      await loadHabits();
    } catch (error: any) {
      console.error("Error archiving habit:", error);
      toast({
        title: "Error",
        description: "Failed to archive habit",
        variant: "destructive",
      });
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      // Delete all completions first
      await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", habitId);

      // Then delete the habit
      const { error } = await supabase
        .from("leading_indicators")
        .delete()
        .eq("id", habitId);

      if (error) throw error;

      toast({
        title: "Habit Deleted",
        description: "Habit and all completion data have been permanently deleted",
      });

      await loadHabits();
    } catch (error: any) {
      console.error("Error deleting habit:", error);
      toast({
        title: "Error",
        description: "Failed to delete habit",
        variant: "destructive",
      });
    }
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
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Greatness Tracker
              </CardTitle>
              {greatnessKeys.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-2xl">🔑</span>
                  <span className="font-semibold">{greatnessKeys.length} Greatness Keys</span>
                  <span className="text-muted-foreground">- The key to greatness is consistency</span>
                </div>
              )}
            </div>
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
                const totalCompletions = getTotalCompletions(habit.id);

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
                           <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <span className="font-bold">{habit.current_streak}</span>
                              <span className="text-muted-foreground">day streak</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingHabit(habit)}
                              className="h-8 w-8 p-0"
                              title="Edit habit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openBackdate(habit.id)}
                              className="h-8 w-8 p-0"
                              title="Backdate habit"
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => archiveHabit(habit.id)}
                              className="h-8 w-8 p-0"
                              title="Archive habit"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHabit(habit.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete habit permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {habit.habit_description && (
                          <p className="text-sm text-muted-foreground">
                            {habit.habit_description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          <span>✅ Completed {totalCompletions} {totalCompletions === 1 ? 'day' : 'days'}</span>
                          {habit.longest_streak > 0 && (
                            <span>🏆 Best: {habit.longest_streak} days</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>This week</span>
                            <span>{weeklyProgress}%</span>
                          </div>
                          <Progress value={weeklyProgress} className="h-2" />
                        </div>
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
        open={showAddDialog || !!editingHabit}
        onClose={() => {
          setShowAddDialog(false);
          setEditingHabit(null);
        }}
        onHabitAdded={loadHabits}
        editingHabit={editingHabit}
      />
    </>
  );
}
