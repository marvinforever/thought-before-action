import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, TrendingUp, Flame, Star } from "lucide-react";
import { useGrowthPoints } from "@/hooks/useGrowthPoints";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState as useStateReact } from "react";

export function CompanyLeaderboard() {
  const { leaderboard, userScore, userRank, loading, refresh } = useGrowthPoints();
  const [period, setPeriod] = useState<"total" | "weekly" | "monthly">("total");
  const [currentUserId, setCurrentUserId] = useStateReact<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    refresh(period);
  }, [period]);

  const getPointsForPeriod = (entry: typeof leaderboard[0]) => {
    switch (period) {
      case "weekly":
        return entry.weekly_points;
      case "monthly":
        return entry.monthly_points;
      default:
        return entry.total_points;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case 2:
        return "bg-gray-100 text-gray-800 border-gray-300";
      case 3:
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Company Leaderboard
            </CardTitle>
            <CardDescription>
              See how you rank against your colleagues
            </CardDescription>
          </div>
          {userScore && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                <Star className="h-5 w-5 fill-primary" />
                {userScore.total_points.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Your Total Points</p>
            </div>
          )}
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekly">This Week</TabsTrigger>
            <TabsTrigger value="monthly">This Month</TabsTrigger>
            <TabsTrigger value="total">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No scores yet. Start earning points!</p>
            <p className="text-sm mt-1">
              Chat with Jericho, complete goals, and log habits to climb the leaderboard.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((entry) => {
              const isCurrentUser = entry.profile_id === currentUserId;
              const points = getPointsForPeriod(entry);

              return (
                <div
                  key={entry.profile_id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isCurrentUser 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-muted/50"
                  } ${entry.rank <= 3 ? getRankBadgeClass(entry.rank) : ""}`}
                >
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(entry.rank)}
                  </div>

                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={isCurrentUser ? "bg-primary text-primary-foreground" : ""}>
                      {getInitials(entry.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}>
                      {entry.full_name || "Unknown"}
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 font-semibold">
                    <Flame className="h-4 w-4 text-orange-500" />
                    {points.toLocaleString()}
                  </div>
                </div>
              );
            })}

            {/* Show current user if not in top 10 */}
            {userRank && userRank > 10 && currentUserId && (
              <>
                <div className="flex items-center justify-center py-2 text-muted-foreground">
                  <span className="text-xs">• • •</span>
                </div>
                {leaderboard
                  .filter(e => e.profile_id === currentUserId)
                  .map(entry => (
                    <div
                      key={entry.profile_id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
                    >
                      <div className="flex items-center justify-center w-8">
                        <span className="text-sm font-medium text-muted-foreground">{entry.rank}</span>
                      </div>

                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(entry.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-primary">
                          {entry.full_name || "Unknown"}
                          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 font-semibold">
                        <Flame className="h-4 w-4 text-orange-500" />
                        {getPointsForPeriod(entry).toLocaleString()}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {/* Streak multiplier info */}
        {userScore && userScore.streak_multiplier > 1 && (
          <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <Flame className="h-4 w-4" />
              <span className="text-sm font-medium">
                {userScore.streak_multiplier}x Streak Bonus Active!
              </span>
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
              Keep your daily streak going to earn more points
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
