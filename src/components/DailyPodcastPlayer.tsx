import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Headphones,
  Sparkles,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PodcastEpisode {
  id: string;
  episode_date: string;
  title: string;
  script: string;
  audio_url: string | null;
  duration_seconds: number | null;
  listened_at: string | null;
  topics_covered: string[];
}

interface DailyPodcastPlayerProps {
  profileId: string;
  companyId: string;
}

export const DailyPodcastPlayer = ({ profileId, companyId }: DailyPodcastPlayerProps) => {
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodaysEpisode();
  }, [profileId]);

  const fetchTodaysEpisode = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('podcast_episodes')
        .select('*')
        .eq('profile_id', profileId)
        .eq('episode_date', today)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setEpisode({
          ...data,
          topics_covered: (data.topics_covered as string[]) || []
        });
      }
    } catch (error) {
      console.error('Error fetching episode:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEpisode = async () => {
    try {
      setGenerating(true);
      
      // Step 1: Generate script
      const { data: scriptData, error: scriptError } = await supabase.functions.invoke('generate-podcast-script', {
        body: { profileId, companyId }
      });

      if (scriptError || !scriptData?.success) {
        throw new Error(scriptData?.error || 'Failed to generate script');
      }

      toast({
        title: "Script generated!",
        description: "Now converting to audio...",
      });

      const today = format(new Date(), 'yyyy-MM-dd');

      // Step 2: Generate audio
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { 
          script: scriptData.script,
          profileId,
          episodeDate: today,
          voice: 'brian',
          storeAudio: true
        }
      });

      if (ttsError || !ttsData?.success) {
        throw new Error(ttsData?.error || 'Failed to generate audio');
      }

      // Step 3: Save episode to database
      const { data: insertData, error: insertError } = await supabase
        .from('podcast_episodes')
        .insert({
          profile_id: profileId,
          company_id: companyId,
          episode_date: today,
          title: scriptData.title,
          script: scriptData.script,
          audio_url: ttsData.audioUrl,
          duration_seconds: ttsData.durationSeconds,
          content_type: 'hybrid',
          topics_covered: scriptData.topicsCovered
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setEpisode({
        ...insertData,
        topics_covered: (insertData.topics_covered as string[]) || []
      });

      toast({
        title: "Your Growth Brief is ready! 🎧",
        description: "Press play to listen to today's personalized episode.",
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating episode:', error);
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
      // Mark as listened on first play
      if (episode && !episode.listened_at) {
        markAsListened();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const markAsListened = async () => {
    if (!episode) return;
    
    await supabase
      .from('podcast_episodes')
      .update({ listened_at: new Date().toISOString() })
      .eq('id', episode.id);
    
    setEpisode({ ...episode, listened_at: new Date().toISOString() });
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading your growth brief...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No episode yet - show generate button
  if (!episode) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Your Daily Growth Brief</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get a personalized 2-minute audio briefing with your progress, insights, and today's challenge.
              </p>
            </div>
            <Button 
              onClick={generateEpisode} 
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating your episode...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Today's Brief
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Episode exists - show player
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
      <CardContent className="p-4">
        {/* Hidden audio element */}
        {episode.audio_url && (
          <audio
            ref={audioRef}
            src={episode.audio_url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{episode.title}</h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(episode.episode_date + 'T12:00:00'), 'MMMM d, yyyy')}
                {episode.duration_seconds && ` • ${Math.round(episode.duration_seconds / 60)} min`}
              </p>
            </div>
          </div>
          {episode.listened_at && (
            <Badge variant="secondary" className="text-xs">
              Played
            </Badge>
          )}
        </div>

        {/* Topics */}
        {episode.topics_covered.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {episode.topics_covered.map((topic, i) => (
              <Badge key={i} variant="outline" className="text-xs capitalize">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Player controls */}
        {episode.audio_url ? (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={restart}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={togglePlayPause}
                  className="h-10 w-10 rounded-full"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Audio generation in progress...
          </div>
        )}

        {/* Transcript */}
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs gap-1">
              {showTranscript ? (
                <>Hide Transcript <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Show Transcript <ChevronDown className="h-3 w-3" /></>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 p-3 bg-background/50 rounded-lg text-sm leading-relaxed max-h-48 overflow-y-auto">
              {episode.script.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-2 last:mb-0">
                  {paragraph.replace(/\[pause\]/gi, '').trim()}
                </p>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
