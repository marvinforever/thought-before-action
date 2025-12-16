import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, Compass, Award, CheckCircle, Circle, Flame } from "lucide-react";

interface ViewGrowthPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id?: string;
  };
}

interface GrowthData {
  vision: {
    one_year: string | null;
    three_year: string | null;
  };
  goals: Array<{
    id: string;
    goal_text: string | null;
    category: string;
    completed: boolean;
    by_when: string | null;
  }>;
  habits: Array<{
    id: string;
    habit_name: string;
    habit_description: string | null;
    target_frequency: string;
    current_streak: number;
  }>;
  achievements: Array<{
    id: string;
    achievement_text: string;
    category: string;
    achieved_date: string | null;
  }>;
}

export function ViewGrowthPlanDialog({
  open,
  onOpenChange,
  employee,
}: ViewGrowthPlanDialogProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GrowthData>({
    vision: { one_year: null, three_year: null },
    goals: [],
    habits: [],
    achievements: [],
  });

  useEffect(() => {
    if (open) {
      loadGrowthData();
    }
  }, [open, employee.id]);

  const loadGrowthData = async () => {
    setLoading(true);
    try {
      // Load all data in parallel
      const [visionRes, goalsRes, habitsRes, achievementsRes] = await Promise.all([
        // Professional vision from personal_goals
        supabase
          .from("personal_goals")
          .select("one_year_vision, three_year_vision")
          .eq("profile_id", employee.id)
          .maybeSingle(),
        
        // Professional 90-day goals only (category field stores personal/professional)
        supabase
          .from("ninety_day_targets")
          .select("id, goal_text, category, completed, by_when")
          .eq("profile_id", employee.id)
          .eq("category", "professional")
          .order("created_at", { ascending: false }),
        
        // Professional habits only
        supabase
          .from("leading_indicators")
          .select("id, habit_name, habit_description, target_frequency, current_streak")
          .eq("profile_id", employee.id)
          .eq("habit_type", "professional")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        
        // All achievements (achievements don't have personal/professional classification)
        supabase
          .from("achievements")
          .select("id, achievement_text, category, achieved_date")
          .eq("profile_id", employee.id)
          .order("achieved_date", { ascending: false })
          .limit(10),
      ]);

      setData({
        vision: {
          one_year: visionRes.data?.one_year_vision || null,
          three_year: visionRes.data?.three_year_vision || null,
        },
        goals: goalsRes.data || [],
        habits: habitsRes.data || [],
        achievements: achievementsRes.data || [],
      });
    } catch (error) {
      console.error("Error loading growth data:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasVision = data.vision.one_year || data.vision.three_year;
  const hasGoals = data.goals.length > 0;
  const hasHabits = data.habits.length > 0;
  const hasAchievements = data.achievements.length > 0;
  const hasAnyData = hasVision || hasGoals || hasHabits || hasAchievements;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            {employee.full_name}'s Growth Plan
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading growth data...
            </div>
          ) : !hasAnyData ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No growth data available yet</p>
              <p className="text-sm mt-1">
                Encourage {employee.full_name.split(" ")[0]} to set their vision and goals
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Professional Vision */}
              {hasVision && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Compass className="h-4 w-4 text-accent" />
                      Professional Vision
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.vision.one_year && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          1-Year Vision
                        </div>
                        <p className="text-sm">{data.vision.one_year}</p>
                      </div>
                    )}
                    {data.vision.three_year && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          3-Year Vision
                        </div>
                        <p className="text-sm">{data.vision.three_year}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 90-Day Goals */}
              {hasGoals && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-accent" />
                      90-Day Goals
                      <Badge variant="secondary" className="ml-auto">
                        {data.goals.filter(g => g.completed).length}/{data.goals.length} complete
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.goals.map((goal) => (
                        <div
                          key={goal.id}
                          className="flex items-start gap-2 p-2 rounded bg-muted/50"
                        >
                          {goal.completed ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${goal.completed ? "line-through text-muted-foreground" : ""}`}>
                              {goal.goal_text || "No description"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {goal.category}
                              </Badge>
                              {goal.by_when && (
                                <span className="text-xs text-muted-foreground">
                                  Due: {new Date(goal.by_when).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Professional Habits */}
              {hasHabits && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Flame className="h-4 w-4 text-accent" />
                      Professional Habits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.habits.map((habit) => (
                        <div
                          key={habit.id}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{habit.habit_name}</p>
                            {habit.habit_description && (
                              <p className="text-xs text-muted-foreground">
                                {habit.habit_description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {habit.target_frequency}
                            </Badge>
                            {habit.current_streak > 0 && (
                              <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
                                🔥 {habit.current_streak}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Achievements */}
              {hasAchievements && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4 text-accent" />
                      Recent Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.achievements.map((achievement) => (
                        <div
                          key={achievement.id}
                          className="flex items-start gap-2 p-2 rounded bg-muted/50"
                        >
                          <Award className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{achievement.achievement_text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {achievement.category}
                              </Badge>
                              {achievement.achieved_date && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(achievement.achieved_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
