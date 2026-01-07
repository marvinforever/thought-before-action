import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Pause, 
  Loader2, 
  Sparkles, 
  BookOpen,
  Volume2,
  Clock,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesKnowledgePodcastsProps {
  userId: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  stage: string | null;
  category: string | null;
  tags: string[] | null;
}

export const SalesKnowledgePodcasts = ({ userId }: SalesKnowledgePodcastsProps) => {
  const { toast } = useToast();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [generatedPodcasts, setGeneratedPodcasts] = useState<Record<string, { audioUrl?: string; audioBase64?: string; script: string }>>({});

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    const { data, error } = await supabase
      .from("sales_knowledge")
      .select("id, title, content, stage, category, tags")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setKnowledge(data);
    }
    setLoading(false);
  };

  const generatePodcast = async (item: KnowledgeItem) => {
    setGenerating(item.id);
    
    try {
      const response = await supabase.functions.invoke("generate-sales-podcast", {
        body: { knowledgeId: item.id },
      });

      if (response.error) throw response.error;

      const { audioUrl, audioBase64, script } = response.data;
      
      setGeneratedPodcasts(prev => ({
        ...prev,
        [item.id]: { audioUrl, audioBase64, script }
      }));

      toast({ title: "Podcast generated!", description: `"${item.title}" is ready to play.` });
    } catch (error) {
      console.error("Podcast generation error:", error);
      toast({ 
        title: "Generation failed", 
        description: "Couldn't create podcast. Try again.",
        variant: "destructive" 
      });
    } finally {
      setGenerating(null);
    }
  };

  const playPodcast = (itemId: string) => {
    const podcast = generatedPodcasts[itemId];
    if (!podcast) return;

    // Stop any currently playing
    if (playing && audioElements[playing]) {
      audioElements[playing].pause();
    }

    // Create or get audio element
    let audio = audioElements[itemId];
    if (!audio) {
      const audioSrc = podcast.audioUrl || `data:audio/mpeg;base64,${podcast.audioBase64}`;
      audio = new Audio(audioSrc);
      audio.onended = () => setPlaying(null);
      setAudioElements(prev => ({ ...prev, [itemId]: audio }));
    }

    audio.play();
    setPlaying(itemId);
  };

  const pausePodcast = (itemId: string) => {
    if (audioElements[itemId]) {
      audioElements[itemId].pause();
      setPlaying(null);
    }
  };

  const hasPodcast = (item: KnowledgeItem) => {
    return generatedPodcasts[item.id] || item.tags?.includes('has_podcast');
  };

  const stageLabels: Record<string, string> = {
    prospecting: "Prospecting",
    discovery: "Discovery",
    proposal: "Proposal",
    closing: "Closing",
    follow_up: "Follow Up",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Sales Training Library
          </h3>
          <p className="text-sm text-muted-foreground">
            {knowledge.length} training modules • Click to generate audio podcasts
          </p>
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="grid gap-3">
          {knowledge.map((item) => {
            const podcast = generatedPodcasts[item.id];
            const isGenerating = generating === item.id;
            const isPlaying = playing === item.id;
            
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{item.title}</h4>
                        {item.stage && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {stageLabels[item.stage] || item.stage}
                          </Badge>
                        )}
                        {item.category && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.content.substring(0, 150)}...
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {podcast ? (
                        <>
                          <Button
                            size="sm"
                            variant={isPlaying ? "secondary" : "default"}
                            onClick={() => isPlaying ? pausePodcast(item.id) : playPodcast(item.id)}
                            className="gap-1"
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="h-4 w-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4" />
                                Play
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => generatePodcast(item)}
                            disabled={isGenerating}
                          >
                            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => generatePodcast(item)}
                          disabled={isGenerating}
                          className="gap-1"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Create Podcast
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Show script preview if generated */}
                  {podcast?.script && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Volume2 className="h-3 w-3" />
                        <span>Podcast Script</span>
                        <Clock className="h-3 w-3 ml-2" />
                        <span>~{Math.round(podcast.script.split(' ').length / 150)} min</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 italic">
                        "{podcast.script.substring(0, 200)}..."
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
