import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingMilestone {
  id: string;
  label: string;
  description: string;
  points: number;
  completed: boolean;
  action?: () => void;
}

export interface OnboardingProgress {
  score: number;
  phase: "new" | "in_progress" | "complete";
  milestones: OnboardingMilestone[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useOnboardingProgress(): OnboardingProgress {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"new" | "in_progress" | "complete">("new");
  const [completeness, setCompleteness] = useState<{
    has_personal_vision: boolean;
    has_90_day_goals: boolean;
    has_active_habits: boolean;
    has_self_assessed_capabilities: boolean;
    has_chatted_with_jericho: boolean;
    has_received_resource: boolean;
    has_recent_achievements: boolean;
  }>({
    has_personal_vision: false,
    has_90_day_goals: false,
    has_active_habits: false,
    has_self_assessed_capabilities: false,
    has_chatted_with_jericho: false,
    has_received_resource: false,
    has_recent_achievements: false,
  });

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First refresh the completeness data via the database function
      await supabase.rpc('refresh_user_completeness', { user_id: user.id });

      // Then fetch the updated data
      const { data, error } = await supabase
        .from("user_data_completeness")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setScore(data.onboarding_score || 0);
        setPhase((data.onboarding_phase as "new" | "in_progress" | "complete") || "new");
        setCompleteness({
          has_personal_vision: data.has_personal_vision || false,
          has_90_day_goals: data.has_90_day_goals || false,
          has_active_habits: data.has_active_habits || false,
          has_self_assessed_capabilities: data.has_self_assessed_capabilities || false,
          has_chatted_with_jericho: data.has_chatted_with_jericho || false,
          has_received_resource: data.has_received_resource || false,
          has_recent_achievements: data.has_recent_achievements || false,
        });
      }
    } catch (error) {
      console.error("Error loading onboarding progress:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const milestones: OnboardingMilestone[] = [
    {
      id: "jericho_chat",
      label: "Chat with Jericho",
      description: "Say hello to your AI career coach",
      points: 10,
      completed: completeness.has_chatted_with_jericho,
    },
    {
      id: "vision",
      label: "Set Your Vision",
      description: "Define your 1-year and 3-year goals",
      points: 15,
      completed: completeness.has_personal_vision,
    },
    {
      id: "habit",
      label: "Create a Habit",
      description: "Add your first daily or weekly habit",
      points: 15,
      completed: completeness.has_active_habits,
    },
    {
      id: "goal",
      label: "Set a 90-Day Goal",
      description: "Create your first quarterly target",
      points: 20,
      completed: completeness.has_90_day_goals,
    },
    {
      id: "achievement",
      label: "Log an Achievement",
      description: "Celebrate something you're proud of",
      points: 10,
      completed: completeness.has_recent_achievements,
    },
    {
      id: "capability",
      label: "Self-Assess a Capability",
      description: "Rate your skills in at least one area",
      points: 20,
      completed: completeness.has_self_assessed_capabilities,
    },
    {
      id: "resource",
      label: "Get a Resource",
      description: "Receive a personalized learning recommendation",
      points: 10,
      completed: completeness.has_received_resource,
    },
  ];

  return {
    score,
    phase,
    milestones,
    loading,
    refresh,
  };
}
