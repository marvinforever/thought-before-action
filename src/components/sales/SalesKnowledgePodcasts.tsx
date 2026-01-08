import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Pause, 
  Loader2, 
  Sparkles, 
  BookOpen,
  ChevronDown,
  ChevronUp,
  Headphones,
  RefreshCw,
  Target
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

interface Episode {
  index: number;
  title: string;
  keyPoint: string;
  script?: string;
  audioUrl?: string;
  audioBase64?: string;
}

interface PodcastData {
  episodes: Episode[];
  generatedEpisodes: Record<number, { script: string; audioUrl?: string; audioBase64?: string }>;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  sales_companies: { name: string } | null;
}

export const SalesKnowledgePodcasts = ({ userId }: SalesKnowledgePodcastsProps) => {
  const { toast } = useToast();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingEpisode, setGeneratingEpisode] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [podcastData, setPodcastData] = useState<Record<string, PodcastData>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
    fetchDeals();
  }, [userId]);

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

  const fetchDeals = async () => {
    const { data } = await supabase
      .from("sales_deals")
      .select("id, deal_name, stage, sales_companies(name)")
      .eq("profile_id", userId)
      .order("priority");
    
    if (data) {
      setDeals(data);
    }
  };

  const generateEpisode = async (item: KnowledgeItem, episodeIndex: number) => {
    setGenerating(item.id);
    setGeneratingEpisode(episodeIndex);
    
    try {
      const response = await supabase.functions.invoke("generate-sales-podcast", {
        body: { 
          knowledgeId: item.id, 
          chunkIndex: episodeIndex,
          dealId: selectedDealId,
        },
      });

      if (response.error) throw response.error;

      const { allEpisodes, episodeNumber, script, audioUrl, audioBase64, episodeTitle, keyPoint } = response.data;
      
      setPodcastData(prev => {
        const existing = prev[item.id] || { episodes: [], generatedEpisodes: {} };
        return {
          ...prev,
          [item.id]: {
            episodes: allEpisodes || existing.episodes,
            generatedEpisodes: {
              ...existing.generatedEpisodes,
              [episodeIndex]: { script, audioUrl, audioBase64 }
            }
          }
        };
      });

      toast({ 
        title: `Episode ${episodeNumber} ready!`, 
        description: episodeTitle 
      });
    } catch (error) {
      console.error("Podcast generation error:", error);
      toast({ 
        title: "Generation failed", 
        description: "Couldn't create episode. Try again.",
        variant: "destructive" 
      });
    } finally {
      setGenerating(null);
      setGeneratingEpisode(null);
    }
  };

  const playEpisode = (itemId: string, episodeIndex: number) => {
    const data = podcastData[itemId]?.generatedEpisodes[episodeIndex];
    if (!data) return;

    const key = `${itemId}-${episodeIndex}`;

    // Stop any currently playing
    if (playing && audioElements[playing]) {
      audioElements[playing].pause();
    }

    let audio = audioElements[key];
    if (!audio) {
      const audioSrc = data.audioUrl || `data:audio/mpeg;base64,${data.audioBase64}`;
      audio = new Audio(audioSrc);
      audio.onended = () => setPlaying(null);
      setAudioElements(prev => ({ ...prev, [key]: audio }));
    }

    audio.play();
    setPlaying(key);
  };

  const pauseEpisode = (itemId: string, episodeIndex: number) => {
    const key = `${itemId}-${episodeIndex}`;
    if (audioElements[key]) {
      audioElements[key].pause();
      setPlaying(null);
    }
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Bite-Sized Training
          </h3>
          <p className="text-sm text-muted-foreground">
            {knowledge.length} modules • Each breaks into 3-5 quick lessons
          </p>
        </div>
        
        {deals.length > 0 && (
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedDealId || "general"} onValueChange={(v) => setSelectedDealId(v === "general" ? null : v)}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Apply to deal..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General training</SelectItem>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.deal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedDealId && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
          <span className="font-medium">🎯 Deal Mode:</span> Episodes will be customized with examples for your selected deal
        </div>
      )}

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {knowledge.map((item) => {
            const data = podcastData[item.id];
            const hasEpisodes = data?.episodes && data.episodes.length > 0;
            const isExpanded = expandedItem === item.id;
            const isGeneratingThis = generating === item.id;
            
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium">{item.title}</h4>
                        {item.stage && (
                          <Badge variant="secondary" className="text-xs">
                            {stageLabels[item.stage] || item.stage}
                          </Badge>
                        )}
                        {hasEpisodes && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Headphones className="h-3 w-3" />
                            {data.episodes.length} episodes
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.content.substring(0, 150)}...
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasEpisodes ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-1"
                          onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          Episodes
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => generateEpisode(item, 0)}
                          disabled={isGeneratingThis}
                          className="gap-1"
                        >
                          {isGeneratingThis ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Create Episodes
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Episodes List */}
                  {hasEpisodes && isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      {data.episodes.map((episode, idx) => {
                        const generated = data.generatedEpisodes[episode.index];
                        const key = `${item.id}-${episode.index}`;
                        const isPlaying = playing === key;
                        const isGeneratingEp = isGeneratingThis && generatingEpisode === episode.index;

                        return (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {episode.index + 1}.
                                </span>
                                <span className="text-sm font-medium truncate">
                                  {episode.title}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {episode.keyPoint}
                              </p>
                            </div>

                            <div className="w-full sm:w-auto shrink-0 sm:ml-3 flex gap-1 justify-end">
                              {generated ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant={isPlaying ? "secondary" : "default"}
                                    onClick={() =>
                                      isPlaying
                                        ? pauseEpisode(item.id, episode.index)
                                        : playEpisode(item.id, episode.index)
                                    }
                                    className="gap-1"
                                  >
                                    {isPlaying ? (
                                      <>
                                        <Pause className="h-3 w-3" />
                                        Pause
                                      </>
                                    ) : (
                                      <>
                                        <Play className="h-3 w-3" />
                                        Play
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => generateEpisode(item, episode.index)}
                                    disabled={isGeneratingThis}
                                    title="Regenerate episode"
                                  >
                                    <RefreshCw className={`h-3 w-3 ${isGeneratingEp ? "animate-spin" : ""}`} />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateEpisode(item, episode.index)}
                                  disabled={isGeneratingThis}
                                  className="gap-1"
                                >
                                  {isGeneratingEp ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  Generate
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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