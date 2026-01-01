import { useState, useEffect } from "react";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PodcastEpisodeCard } from "./PodcastEpisodeCard";
import { format } from "date-fns";

interface Episode {
  id: string;
  episode_date: string;
  title: string;
  duration_seconds: number | null;
  listened_at: string | null;
  topics_covered: string[];
  daily_challenge: string | null;
  capability_name: string | null;
}

interface PodcastEpisodeHistoryProps {
  profileId: string;
}

export const PodcastEpisodeHistory = ({ profileId }: PodcastEpisodeHistoryProps) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchPastEpisodes();
  }, [profileId]);

  const fetchPastEpisodes = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('podcast_episodes')
        .select(`
          id,
          episode_date,
          title,
          duration_seconds,
          listened_at,
          topics_covered,
          daily_challenge,
          capability_id,
          capabilities(name)
        `)
        .eq('profile_id', profileId)
        .lt('episode_date', today)
        .order('episode_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedEpisodes: Episode[] = (data || []).map((ep) => ({
        id: ep.id,
        episode_date: ep.episode_date,
        title: ep.title,
        duration_seconds: ep.duration_seconds,
        listened_at: ep.listened_at,
        topics_covered: (ep.topics_covered as string[]) || [],
        daily_challenge: ep.daily_challenge,
        capability_name: (ep.capabilities as { name: string } | null)?.name || null,
      }));

      setEpisodes(formattedEpisodes);
    } catch (error) {
      console.error('Error fetching past episodes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading episode history...</span>
      </div>
    );
  }

  if (episodes.length === 0) {
    return null; // Don't show history section if no past episodes
  }

  const displayedEpisodes = showAll ? episodes : episodes.slice(0, 5);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between py-2 px-3 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Previous Episodes</span>
            <Badge variant="secondary" className="text-xs">
              {episodes.length}
            </Badge>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {displayedEpisodes.map((episode) => (
            <PodcastEpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
        {episodes.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-2 text-muted-foreground"
          >
            {showAll ? 'Show Less' : `Show All (${episodes.length})`}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
