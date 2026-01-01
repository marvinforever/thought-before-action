import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, CheckCircle2, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PodcastEpisodeCardProps {
  episode: {
    id: string;
    episode_date: string;
    title: string;
    duration_seconds: number | null;
    listened_at: string | null;
    topics_covered: string[];
    daily_challenge: string | null;
    capability_name?: string | null;
  };
}

export const PodcastEpisodeCard = ({ episode }: PodcastEpisodeCardProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4 space-y-3">
        {/* Header with date and listened status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(episode.episode_date + 'T12:00:00'), 'EEEE, MMMM d')}</span>
          </div>
          <div className="flex items-center gap-2">
            {episode.duration_seconds && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(episode.duration_seconds)}
              </div>
            )}
            {episode.listened_at && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Played
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm">{episode.title}</h4>

        {/* Capability focus badge */}
        {episode.capability_name && (
          <Badge variant="outline" className="text-xs">
            {episode.capability_name}
          </Badge>
        )}

        {/* Daily Challenge - prominently displayed */}
        {episode.daily_challenge && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-primary mb-1">Daily Challenge</p>
                <p className="text-sm text-foreground">{episode.daily_challenge}</p>
              </div>
            </div>
          </div>
        )}

        {/* Topics */}
        {episode.topics_covered && episode.topics_covered.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {episode.topics_covered.map((topic, i) => (
              <Badge key={i} variant="secondary" className="text-xs capitalize">
                {topic}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
