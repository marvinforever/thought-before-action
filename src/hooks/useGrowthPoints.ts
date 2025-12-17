import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserScore {
  profile_id: string;
  company_id: string;
  total_points: number;
  weekly_points: number;
  monthly_points: number;
  streak_multiplier: number;
  last_activity_date: string | null;
}

interface LeaderboardEntry {
  profile_id: string;
  full_name: string | null;
  total_points: number;
  weekly_points: number;
  monthly_points: number;
  rank: number;
}

export function useGrowthPoints() {
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_scores")
        .select("*")
        .eq("profile_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data;
    } catch (err) {
      console.error("Error fetching user score:", err);
      return null;
    }
  };

  const fetchLeaderboard = async (period: "total" | "weekly" | "monthly" = "total") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return [];

      const pointsColumn = period === "weekly" ? "weekly_points" : period === "monthly" ? "monthly_points" : "total_points";

      // Get all scores for company
      const { data: scores, error } = await supabase
        .from("user_scores")
        .select(`
          profile_id,
          total_points,
          weekly_points,
          monthly_points
        `)
        .eq("company_id", profile.company_id)
        .order(pointsColumn, { ascending: false });

      if (error) throw error;

      // Get profile names
      const profileIds = scores?.map(s => s.profile_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Build leaderboard with ranks
      const leaderboardData: LeaderboardEntry[] = (scores || []).map((score, index) => ({
        profile_id: score.profile_id,
        full_name: profileMap.get(score.profile_id) || "Unknown",
        total_points: score.total_points,
        weekly_points: score.weekly_points,
        monthly_points: score.monthly_points,
        rank: index + 1
      }));

      // Find user's rank
      const userEntry = leaderboardData.find(e => e.profile_id === user.id);
      if (userEntry) {
        setUserRank(userEntry.rank);
      }

      return leaderboardData;
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      return [];
    }
  };

  const refresh = async (period: "total" | "weekly" | "monthly" = "total") => {
    setLoading(true);
    setError(null);
    try {
      const [score, board] = await Promise.all([
        fetchUserScore(),
        fetchLeaderboard(period)
      ]);
      setUserScore(score);
      setLeaderboard(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load points data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return {
    userScore,
    leaderboard,
    userRank,
    loading,
    error,
    refresh
  };
}
