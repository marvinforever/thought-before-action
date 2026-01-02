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
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PodcastEpisodeHistory } from "./PodcastEpisodeHistory";
import { YesterdayChallengeCheckIn } from "./YesterdayChallengeCheckIn";

interface PodcastEpisode {
  id: string;
  episode_date: string;
  title: string;
  script: string;
  audio_url: string | null;
  intro_music_url: string | null;
  outro_music_url: string | null;
  duration_seconds: number | null;
  listened_at: string | null;
  topics_covered: string[];
}

interface DailyPodcastPlayerProps {
  profileId: string;
  companyId: string;
}

type PlaybackPhase = 'intro' | 'main' | 'outro' | 'idle';

export const DailyPodcastPlayer = ({ profileId, companyId }: DailyPodcastPlayerProps) => {
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioVersion, setAudioVersion] = useState(0);
  const introRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const outroRef = useRef<HTMLAudioElement | null>(null);
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
        setAudioVersion(Date.now());
      }
    } catch (error) {
      console.error('Error fetching episode:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEpisode = async (regenerate = false) => {
    try {
      setGenerating(true);
      
      const today = format(new Date(), 'yyyy-MM-dd');

      // Delete any existing episode for today (handles both regeneration and stale data)
      if (regenerate || episode) {
        const { error: deleteError } = await supabase
          .from('podcast_episodes')
          .delete()
          .eq('profile_id', profileId)
          .eq('episode_date', today);
        
        if (deleteError) {
          console.error('Error deleting existing episode:', deleteError);
        }
        setEpisode(null);
      }
      
      // Step 1: Generate script and music in parallel
      toast({
        title: "Generating your brief...",
        description: "Creating personalized script and music",
      });

      const [scriptResult, introResult, outroResult] = await Promise.all([
        supabase.functions.invoke('generate-podcast-script', {
          body: { profileId, companyId }
        }),
        supabase.functions.invoke('generate-podcast-music', {
          body: { type: 'intro' }
        }),
        supabase.functions.invoke('generate-podcast-music', {
          body: { type: 'outro' }
        })
      ]);

      if (scriptResult.error || !scriptResult.data?.success) {
        throw new Error(scriptResult.data?.error || 'Failed to generate script');
      }

      const scriptData = scriptResult.data;
      const introUrl = introResult.data?.audioUrl;
      const outroUrl = outroResult.data?.audioUrl;

      toast({
        title: "Script generated!",
        description: "Now converting to audio...",
      });

      // Step 2: Generate voice audio
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { 
          script: scriptData.script,
          profileId,
          episodeDate: today,
          voice: 'jericho',
          storeAudio: true
        }
      });

      if (ttsError || !ttsData?.success) {
        throw new Error(ttsData?.error || 'Failed to generate audio');
      }

      // Step 3: Save episode to database with music URLs and new tracking fields
      // Use upsert to avoid unique constraint issues (one episode per user per day)
      const { data: insertData, error: insertError } = await supabase
        .from('podcast_episodes')
        .upsert(
          {
            profile_id: profileId,
            company_id: companyId,
            episode_date: today,
            title: scriptData.title,
            script: scriptData.script,
            audio_url: ttsData.audioUrl,
            intro_music_url: introUrl || null,
            outro_music_url: outroUrl || null,
            duration_seconds: ttsData.durationSeconds,
            content_type: 'hybrid',
            topics_covered: scriptData.topicsCovered,
            // New fields for enhanced tracking
            capability_id: scriptData.capabilityId || null,
            capability_focus_index: scriptData.capabilityFocusIndex ?? 0,
            daily_challenge: scriptData.dailyChallenge || null,
          },
          { onConflict: 'profile_id,episode_date' }
        )
        .select()
        .single();

      if (insertError) throw insertError;

      setEpisode({
        ...insertData,
        topics_covered: (insertData.topics_covered as string[]) || []
      });
      setAudioVersion(Date.now());

      toast({
        title: regenerate ? "Episode regenerated! 🎧" : "Your Growth Brief is ready! 🎧",
        description: introUrl ? "Press play - includes intro & outro music!" : "Press play to listen.",
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

  const startPlayback = () => {
    // If we have intro music, start with that
    if (episode?.intro_music_url && introRef.current) {
      setPlaybackPhase('intro');
      introRef.current.volume = isMuted ? 0 : volume;
      introRef.current.play();
      setIsPlaying(true);
      // Mark as listened on first play
      if (episode && !episode.listened_at) {
        markAsListened();
      }
    } else if (audioRef.current) {
      // No intro, start main audio directly
      setPlaybackPhase('main');
      audioRef.current.play();
      setIsPlaying(true);
      if (episode && !episode.listened_at) {
        markAsListened();
      }
    }
  };

  // Crossfade: Start fading intro and begin main audio slightly before intro ends
  useEffect(() => {
    if (playbackPhase !== 'intro' || !introRef.current || !audioRef.current) return;
    
    const intro = introRef.current;
    const main = audioRef.current;
    let fadeInterval: number | null = null;
    
    const handleIntroTimeUpdate = () => {
      const timeRemaining = intro.duration - intro.currentTime;
      
      // Start crossfade 1.5 seconds before intro ends
      if (timeRemaining <= 1.5 && timeRemaining > 0) {
        // Start main audio if not already playing
        if (main.paused && main.currentTime === 0) {
          main.volume = 0;
          main.play();
          
          // Fade intro down and main up over 1.5 seconds
          const fadeSteps = 30; // 30 steps over 1.5 seconds = 50ms per step
          let step = 0;
          const introStartVol = intro.volume;
          const targetMainVol = isMuted ? 0 : volume;
          
          fadeInterval = window.setInterval(() => {
            step++;
            const progress = step / fadeSteps;
            intro.volume = Math.max(0, introStartVol * (1 - progress));
            main.volume = targetMainVol * progress;
            
            if (step >= fadeSteps && fadeInterval) {
              clearInterval(fadeInterval);
            }
          }, 50);
        }
      }
    };
    
    intro.addEventListener('timeupdate', handleIntroTimeUpdate);
    
    return () => {
      intro.removeEventListener('timeupdate', handleIntroTimeUpdate);
      if (fadeInterval) clearInterval(fadeInterval);
    };
  }, [playbackPhase, volume, isMuted]);

  const handleIntroEnded = () => {
    // Intro finished - main audio should already be playing from crossfade
    setPlaybackPhase('main');
    if (audioRef.current && audioRef.current.paused) {
      // Fallback in case crossfade didn't trigger
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play();
    }
  };

  const handleMainEnded = () => {
    // Main content finished, play outro if available
    if (episode?.outro_music_url && outroRef.current) {
      setPlaybackPhase('outro');
      outroRef.current.volume = isMuted ? 0 : volume;
      outroRef.current.play();
    } else {
      // No outro, we're done
      handleEnded();
    }
  };

  const handleOutroEnded = () => {
    handleEnded();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      // Pause whichever is playing
      introRef.current?.pause();
      audioRef.current?.pause();
      outroRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (playbackPhase === 'idle' || currentTime === 0) {
        startPlayback();
      } else {
        // Resume current phase
        if (playbackPhase === 'intro' && introRef.current) {
          introRef.current.play();
        } else if (playbackPhase === 'main' && audioRef.current) {
          audioRef.current.play();
        } else if (playbackPhase === 'outro' && outroRef.current) {
          outroRef.current.play();
        }
        setIsPlaying(true);
      }
    }
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
    // Apply volume to all audio elements
    if (introRef.current) introRef.current.volume = newVolume;
    if (audioRef.current) audioRef.current.volume = newVolume;
    if (outroRef.current) outroRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    const newVolume = newMuted ? 0 : (volume || 0.5);
    
    if (introRef.current) introRef.current.volume = newVolume;
    if (audioRef.current) audioRef.current.volume = newVolume;
    if (outroRef.current) outroRef.current.volume = newVolume;
    
    setIsMuted(newMuted);
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    
    if (introRef.current) introRef.current.playbackRate = nextSpeed;
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
    if (outroRef.current) outroRef.current.playbackRate = nextSpeed;
  };

  const restart = () => {
    // Stop everything and reset
    introRef.current?.pause();
    audioRef.current?.pause();
    outroRef.current?.pause();
    
    if (introRef.current) introRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (outroRef.current) outroRef.current.currentTime = 0;
    
    setCurrentTime(0);
    setPlaybackPhase('idle');
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackPhase('idle');
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
              onClick={() => generateEpisode(false)} 
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
    <div>
      {/* Yesterday's Challenge Check-in */}
      <YesterdayChallengeCheckIn profileId={profileId} />
      
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
      <CardContent className="p-4">
        {/* Hidden audio elements */}
        {episode.intro_music_url && (
          <audio
            ref={introRef}
            src={`${episode.intro_music_url}?v=${audioVersion}`}
            onEnded={handleIntroEnded}
          />
        )}
        {episode.audio_url && (
          <audio
            ref={audioRef}
            src={`${episode.audio_url}?v=${audioVersion}`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleMainEnded}
          />
        )}
        {episode.outro_music_url && (
          <audio
            ref={outroRef}
            src={`${episode.outro_music_url}?v=${audioVersion}`}
            onEnded={handleOutroEnded}
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
          <div className="flex items-center gap-2">
            {episode.listened_at && (
              <Badge variant="secondary" className="text-xs">
                Played
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => generateEpisode(true)}
              disabled={generating}
              className="h-8 w-8"
              title="Regenerate episode"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
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

              {/* Speed & Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cyclePlaybackSpeed}
                  className="h-8 px-2 text-xs font-medium min-w-[3rem]"
                  title="Playback speed"
                >
                  {playbackSpeed}x
                </Button>
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

        {/* Episode History */}
        <PodcastEpisodeHistory profileId={profileId} />
      </CardContent>
    </Card>
    </div>
  );
};
