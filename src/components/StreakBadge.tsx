import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StreakBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function StreakBadge({ className, showLabel = true }: StreakBadgeProps) {
  const [streak, setStreak] = useState<{
    currentStreak: number;
    longestStreak: number;
    totalLogins: number;
  }>({
    currentStreak: 0,
    longestStreak: 0,
    totalLogins: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAndUpdateStreak = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];

        // Try to get existing streak
        const { data: existingStreak } = await supabase
          .from("login_streaks")
          .select("*")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (existingStreak) {
          const lastLogin = existingStreak.last_login_date;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let newStreak = existingStreak.current_streak;
          let longestStreak = existingStreak.longest_streak;

          // If last login was yesterday, increment streak
          if (lastLogin === yesterdayStr) {
            newStreak += 1;
            if (newStreak > longestStreak) {
              longestStreak = newStreak;
            }
          } else if (lastLogin !== today) {
            // If last login wasn't today or yesterday, reset streak
            newStreak = 1;
          }

          // Update if it's a new day
          if (lastLogin !== today) {
            await supabase
              .from("login_streaks")
              .update({
                current_streak: newStreak,
                longest_streak: longestStreak,
                last_login_date: today,
                total_logins: existingStreak.total_logins + 1,
              })
              .eq("profile_id", user.id);
            
            // Award points for daily login
            await supabase.rpc('award_points', {
              p_profile_id: user.id,
              p_activity_type: 'daily_login',
              p_description: `Day ${newStreak} login streak`
            });
          }

          setStreak({
            currentStreak: newStreak,
            longestStreak,
            totalLogins: existingStreak.total_logins + (lastLogin !== today ? 1 : 0),
          });
        } else {
          // Create new streak record
          await supabase
            .from("login_streaks")
            .insert({
              profile_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_login_date: today,
              total_logins: 1,
            });

          // Award points for first login
          await supabase.rpc('award_points', {
            p_profile_id: user.id,
            p_activity_type: 'daily_login',
            p_description: 'First login'
          });

          setStreak({
            currentStreak: 1,
            longestStreak: 1,
            totalLogins: 1,
          });
        }
      } catch (error) {
        console.error("Error loading streak:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAndUpdateStreak();
  }, []);

  if (loading || streak.currentStreak === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30",
            className
          )}>
            <Flame className={cn(
              "h-4 w-4",
              streak.currentStreak >= 7 ? "text-orange-500" : "text-orange-400"
            )} />
            {showLabel && (
              <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                {streak.currentStreak} day streak
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{streak.currentStreak} Day Streak!</p>
            <p className="text-xs text-muted-foreground">
              Best: {streak.longestStreak} days • Total: {streak.totalLogins} logins
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
