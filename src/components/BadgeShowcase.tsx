import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface BadgeData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_emoji: string;
  category: string;
  tier: number;
  requirement_type: string;
  requirement_value: number | null;
  display_order: number;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badges: BadgeData;
}

interface BadgeShowcaseProps {
  className?: string;
  compact?: boolean;
  onNewBadge?: (badge: BadgeData) => void;
}

export function BadgeShowcase({ className, compact = false, onNewBadge }: BadgeShowcaseProps) {
  const [allBadges, setAllBadges] = useState<BadgeData[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousEarnedCount, setPreviousEarnedCount] = useState<number | null>(null);

  useEffect(() => {
    loadBadges();
  }, []);

  // Check for newly earned badges
  useEffect(() => {
    if (previousEarnedCount !== null && earnedBadges.length > previousEarnedCount) {
      // Find the newest badge
      const newestBadge = earnedBadges
        .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())[0];
      if (newestBadge && onNewBadge) {
        onNewBadge(newestBadge.badges);
      }
    }
    setPreviousEarnedCount(earnedBadges.length);
  }, [earnedBadges.length]);

  const loadBadges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all badges and user's earned badges in parallel
      const [badgesResult, earnedResult] = await Promise.all([
        supabase
          .from('badges')
          .select('*')
          .order('display_order'),
        supabase
          .from('user_badges')
          .select('*, badges(*)')
          .eq('profile_id', user.id)
      ]);

      if (badgesResult.data) {
        setAllBadges(badgesResult.data as BadgeData[]);
      }
      if (earnedResult.data) {
        setEarnedBadges(earnedResult.data as UserBadge[]);
      }

      // Trigger badge check
      await supabase.rpc('check_and_award_badges', { user_id: user.id });
      
      // Refetch earned badges after check
      const { data: updatedEarned } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('profile_id', user.id);
      
      if (updatedEarned) {
        setEarnedBadges(updatedEarned as UserBadge[]);
      }
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEarned = (badgeId: string) => {
    return earnedBadges.some(eb => eb.badge_id === badgeId);
  };

  const getEarnedDate = (badgeId: string) => {
    const earned = earnedBadges.find(eb => eb.badge_id === badgeId);
    return earned ? new Date(earned.earned_at).toLocaleDateString() : null;
  };

  const earnedCount = earnedBadges.length;
  const totalCount = allBadges.length;

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-2">
          <div className="h-5 bg-muted rounded w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-10 bg-muted rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    // Compact mode - just show earned badges inline
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-1", className)}>
          {earnedBadges.slice(0, 5).map((ub) => (
            <Tooltip key={ub.id}>
              <TooltipTrigger asChild>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-xl cursor-default"
                >
                  {ub.badges.icon_emoji}
                </motion.span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{ub.badges.name}</p>
                <p className="text-xs text-muted-foreground">{ub.badges.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {earnedBadges.length > 5 && (
            <span className="text-xs text-muted-foreground">+{earnedBadges.length - 5}</span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Group badges by category
  const badgesByCategory = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) acc[badge.category] = [];
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, BadgeData[]>);

  const categoryLabels: Record<string, string> = {
    milestone: "Milestones",
    goals: "Goals",
    streak: "Streaks",
    habits: "Habits"
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            🏆 Badges
            <Badge variant="secondary" className="text-xs">
              {earnedCount}/{totalCount}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {Object.entries(badgesByCategory).map(([category, badges]) => (
            <div key={category}>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                {categoryLabels[category] || category}
              </p>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {badges.map((badge) => {
                    const earned = isEarned(badge.id);
                    const earnedDate = getEarnedDate(badge.id);
                    
                    return (
                      <Tooltip key={badge.id}>
                        <TooltipTrigger asChild>
                          <motion.div
                            initial={earned ? { scale: 0 } : false}
                            animate={{ scale: 1 }}
                            className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center text-2xl cursor-default transition-all",
                              earned 
                                ? "bg-primary/10 border-2 border-primary shadow-sm" 
                                : "bg-muted/50 opacity-40 grayscale"
                            )}
                          >
                            {badge.icon_emoji}
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <p className="font-semibold">{badge.name}</p>
                          <p className="text-xs text-muted-foreground">{badge.description}</p>
                          {earned && earnedDate && (
                            <p className="text-xs text-primary mt-1">Earned: {earnedDate}</p>
                          )}
                          {!earned && (
                            <p className="text-xs text-muted-foreground mt-1 italic">Not yet earned</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
