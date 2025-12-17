import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAwardPoints() {
  const { toast } = useToast();

  const awardPoints = async (
    activityType: string,
    description?: string,
    showToast: boolean = true
  ): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase.rpc('award_points', {
        p_profile_id: user.id,
        p_activity_type: activityType,
        p_description: description || null
      });

      if (error) {
        console.error('Error awarding points:', error);
        return 0;
      }

      const points = data || 0;

      if (showToast && points > 0) {
        toast({
          title: `+${points} pts`,
          description: getPointsMessage(activityType),
          duration: 2000,
        });
      }

      return points;
    } catch (error) {
      console.error('Error awarding points:', error);
      return 0;
    }
  };

  return { awardPoints };
}

function getPointsMessage(activityType: string): string {
  const messages: Record<string, string> = {
    daily_login: "Daily login bonus!",
    chat_conversation: "Chat with Jericho",
    diagnostic_first: "Completed diagnostic!",
    diagnostic_repeat: "Updated diagnostic!",
    goal_created: "Goal created!",
    goal_completed: "Goal completed!",
    habit_created: "New habit added!",
    habit_completed: "Habit completed!",
    greatness_key: "Greatness key earned!",
    achievement_logged: "Achievement logged!",
    capability_assessed: "Capability assessed!",
    resource_viewed: "Resource viewed!",
    resource_completed: "Resource completed!",
    badge_earned: "Badge earned!",
    vision_set: "Vision set!",
  };
  return messages[activityType] || "Points earned!";
}
