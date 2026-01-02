import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, CheckCircle2, Clock, Calendar, XCircle, Headphones } from "lucide-react";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";

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
    challenge_completed_at?: string | null;
  };
}

export const PodcastEpisodeCard = ({ episode }: PodcastEpisodeCardProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  const episodeDate = new Date(episode.episode_date + 'T12:00:00');
  const daysAgo = differenceInDays(new Date(), episodeDate);

  const getRelativeDate = () => {
    if (isToday(episodeDate)) return "Today";
    if (isYesterday(episodeDate)) return "Yesterday";
    if (daysAgo <= 7) return `${daysAgo} days ago`;
    return format(episodeDate, 'MMM d');
  };

  const getEpisodeNumber = () => {
    // Create a pseudo-episode number based on the date
    const baseDate = new Date('2024-01-01');
    return Math.max(1, differenceInDays(episodeDate, baseDate) + 1);
  };

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card border-border/50 hover:border-primary/30 transition-all duration-300 group">
      <CardContent className="p-4 space-y-3">
        {/* Header with episode number and date */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm group-hover:bg-primary/20 transition-colors">
              #{getEpisodeNumber()}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {getRelativeDate()}
              </p>
              <p className="text-sm font-medium text-foreground/80">
                {format(episodeDate, 'EEEE, MMMM d')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {episode.duration_seconds && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                {formatDuration(episode.duration_seconds)}
              </div>
            )}
            {episode.listened_at && (
              <Badge variant="secondary" className="text-xs gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                <Headphones className="h-3 w-3" />
                Played
              </Badge>
            )}
          </div>
        </div>

        {/* Title - make it feel special */}
        <div className="pl-[52px]">
          <h4 className="font-semibold text-base leading-tight text-foreground group-hover:text-primary transition-colors">
            {episode.title}
          </h4>
          
          {/* Capability focus badge */}
          {episode.capability_name && (
            <Badge variant="outline" className="text-xs mt-2 bg-primary/5">
              Focus: {episode.capability_name}
            </Badge>
          )}
        </div>

        {/* Daily Challenge - prominently displayed */}
        {episode.daily_challenge && (
          <div className={`rounded-lg p-3 ml-[52px] ${
            episode.challenge_completed_at && episode.challenge_completed_at !== 'skipped'
              ? 'bg-green-500/10 border border-green-500/20'
              : episode.challenge_completed_at === 'skipped'
              ? 'bg-muted/50 border border-border'
              : 'bg-primary/5 border border-primary/20'
          }`}>
            <div className="flex items-start gap-2">
              {episode.challenge_completed_at && episode.challenge_completed_at !== 'skipped' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              ) : episode.challenge_completed_at === 'skipped' ? (
                <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              ) : (
                <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-xs font-medium ${
                    episode.challenge_completed_at && episode.challenge_completed_at !== 'skipped'
                      ? 'text-green-600'
                      : episode.challenge_completed_at === 'skipped'
                      ? 'text-muted-foreground'
                      : 'text-primary'
                  }`}>
                    Daily Challenge
                  </p>
                  {episode.challenge_completed_at && episode.challenge_completed_at !== 'skipped' && (
                    <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                      Completed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground">{episode.daily_challenge}</p>
              </div>
            </div>
          </div>
        )}

        {/* Topics */}
        {episode.topics_covered && episode.topics_covered.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-[52px]">
            {episode.topics_covered.map((topic, i) => (
              <Badge key={i} variant="secondary" className="text-xs capitalize bg-muted/50">
                {topic}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
