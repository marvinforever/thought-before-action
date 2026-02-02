import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingMilestone {
  id: string;
  label: string;
  description: string;
  points: number;
  completed: boolean;
  videoUrl?: string;
  route?: string; // Navigation route for this milestone
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
    has_completed_diagnostic: boolean;
    has_first_daily_brief: boolean;
  }>({
    has_personal_vision: false,
    has_90_day_goals: false,
    has_active_habits: false,
    has_self_assessed_capabilities: false,
    has_chatted_with_jericho: false,
    has_received_resource: false,
    has_recent_achievements: false,
    has_completed_diagnostic: false,
    has_first_daily_brief: false,
  });

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("useOnboardingProgress: No user found");
        setLoading(false);
        return;
      }

      console.log("useOnboardingProgress: Refreshing for user", user.id);

      // First refresh the completeness data via the database function
      const { error: rpcError } = await supabase.rpc('refresh_user_completeness', { user_id: user.id });
      if (rpcError) {
        console.error("useOnboardingProgress: RPC error", rpcError);
      }

      // Then fetch the updated data
      const { data, error } = await supabase
        .from("user_data_completeness")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      console.log("useOnboardingProgress: Data fetched", { data, error });

      if (error) throw error;

      // Track whether they've generated their first daily brief / welcome episode
      const { data: podcastEpisode, error: podcastError } = await supabase
        .from('podcast_episodes')
        .select('id')
        .eq('profile_id', user.id)
        .limit(1);

      if (podcastError) {
        console.error('useOnboardingProgress: podcast lookup error', podcastError);
      }

      const hasFirstDailyBrief = Boolean(podcastEpisode && podcastEpisode.length > 0);

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
          has_completed_diagnostic: data.has_completed_diagnostic || false,
          has_first_daily_brief: hasFirstDailyBrief,
        });
      } else {
        console.log("useOnboardingProgress: No data found, showing new user state");
        // No data means new user - show onboarding
        setScore(0);
        setPhase("new");
        setCompleteness((prev) => ({ ...prev, has_first_daily_brief: hasFirstDailyBrief }));
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

  // Allow other parts of the app (e.g. Jericho chat) to trigger an onboarding refresh
  useEffect(() => {
    const handler = () => {
      refresh();
    };

    window.addEventListener('onboardingProgressRefresh', handler as EventListener);
    return () => window.removeEventListener('onboardingProgressRefresh', handler as EventListener);
  }, [refresh]);

  // Video URLs - replace with your actual tutorial video URLs
  // Supports: YouTube, Vimeo, or direct video file URLs
  const tutorialVideos: Record<string, string | undefined> = {
    first_daily_brief: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Placeholder - replace with real URL
    jericho_chat: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    diagnostic: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    vision: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    habit: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    goal: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    achievement: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    capability: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    resource: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  };

  const milestones: OnboardingMilestone[] = [
    {
      id: "first_daily_brief",
      label: "Make Your First Daily Brief",
      description: "Generate your personalized welcome episode",
      points: 20,
      completed: completeness.has_first_daily_brief,
      videoUrl: tutorialVideos.first_daily_brief,
      route: "/dashboard/my-growth-plan", // Scroll to podcast player
    },
    {
      id: "jericho_chat",
      label: "Chat with Jericho",
      description: "Say hello to your AI career coach",
      points: 10,
      completed: completeness.has_chatted_with_jericho,
      videoUrl: tutorialVideos.jericho_chat,
      route: "/dashboard/my-growth-plan#jericho", // Opens Jericho chat
    },
    {
      id: "diagnostic",
      label: "Complete Your Check-In",
      description: "Tell Jericho: 'I want to do my check-in'",
      points: 16,
      completed: completeness.has_completed_diagnostic,
      videoUrl: tutorialVideos.diagnostic,
      route: "/dashboard/my-growth-plan#jericho", // Opens Jericho for diagnostic
    },
    {
      id: "vision",
      label: "Set Your Vision",
      description: "Define your 1-year and 3-year goals",
      points: 12,
      completed: completeness.has_personal_vision,
      videoUrl: tutorialVideos.vision,
      route: "/dashboard/my-growth-plan#vision", // Scroll to vision card
    },
    {
      id: "habit",
      label: "Create a Habit",
      description: "Add your first daily or weekly habit",
      points: 12,
      completed: completeness.has_active_habits,
      videoUrl: tutorialVideos.habit,
      route: "/dashboard/my-growth-plan#habits", // Scroll to greatness tracker
    },
    {
      id: "goal",
      label: "Set a 90-Day Goal",
      description: "Create your first quarterly target",
      points: 15,
      completed: completeness.has_90_day_goals,
      videoUrl: tutorialVideos.goal,
      route: "/dashboard/my-growth-plan#goals", // Scroll to 90-day tracker
    },
    {
      id: "achievement",
      label: "Log an Achievement",
      description: "Celebrate something you're proud of",
      points: 10,
      completed: completeness.has_recent_achievements,
      videoUrl: tutorialVideos.achievement,
      route: "/dashboard/my-growth-plan", // Navigate to growth plan page (achievements section is visible there)
    },
    {
      id: "capability",
      label: "Self-Assess Capabilities",
      description: "Rate your skills across all assigned capabilities",
      points: 15,
      completed: completeness.has_self_assessed_capabilities,
      videoUrl: tutorialVideos.capability,
      route: "/dashboard/my-capabilities", // Navigate to capabilities page
    },
    {
      id: "resource",
      label: "Get a Resource",
      description: "Receive a personalized learning recommendation",
      points: 10,
      completed: completeness.has_received_resource,
      videoUrl: tutorialVideos.resource,
      route: "/dashboard/my-resources", // Navigate to resources page
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
