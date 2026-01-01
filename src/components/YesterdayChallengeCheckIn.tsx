import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface YesterdayChallenge {
  id: string;
  daily_challenge: string;
  challenge_completed_at: string | null;
  episode_date: string;
}

interface YesterdayChallengeCheckInProps {
  profileId: string;
  onComplete?: () => void;
}

export const YesterdayChallengeCheckIn = ({ profileId, onComplete }: YesterdayChallengeCheckInProps) => {
  const [challenge, setChallenge] = useState<YesterdayChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchYesterdaysChallenge();
  }, [profileId]);

  const fetchYesterdaysChallenge = async () => {
    try {
      setLoading(true);
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('podcast_episodes')
        .select('id, daily_challenge, challenge_completed_at, episode_date')
        .eq('profile_id', profileId)
        .eq('episode_date', yesterday)
        .maybeSingle();

      if (error) throw error;
      
      // Only show if there's a challenge and it hasn't been responded to yet
      if (data?.daily_challenge && data.challenge_completed_at === null) {
        setChallenge(data);
      }
    } catch (error) {
      console.error('Error fetching yesterday\'s challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (completed: boolean) => {
    if (!challenge) return;
    
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('podcast_episodes')
        .update({ 
          challenge_completed_at: completed ? new Date().toISOString() : 'skipped'
        })
        .eq('id', challenge.id);

      if (error) throw error;

      toast({
        title: completed ? "Great work! 🎉" : "No worries!",
        description: completed 
          ? "Challenge completed! Keep building that momentum." 
          : "Today's a new opportunity. Let's crush today's challenge!",
      });

      setDismissed(true);
      onComplete?.();
    } catch (error) {
      console.error('Error updating challenge status:', error);
      toast({
        title: "Error",
        description: "Couldn't save your response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !challenge || dismissed) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-amber-500/20 flex-shrink-0">
          <Target className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">Yesterday's Challenge</h4>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
              Check-in
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {challenge.daily_challenge}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={() => handleResponse(true)}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Did it!
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={() => handleResponse(false)}
              disabled={updating}
            >
              <XCircle className="h-3.5 w-3.5" />
              Didn't get to it
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
