import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, Pause, Loader2, Sparkles, BookOpen, ChevronDown, ChevronUp,
  Headphones, RefreshCw, Target, Download, FileText, MessageSquareQuote,
  CheckCircle2, XCircle, Lightbulb, Zap
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const METHODOLOGIES = [
  { id: "spin", name: "SPIN Selling", desc: "Situation, Problem, Implication, Need-Payoff questions", icon: "🔍" },
  { id: "challenger", name: "The Challenger Sale", desc: "Teach, Tailor, Take Control", icon: "⚡" },
  { id: "sandler", name: "Sandler Selling System", desc: "Pain discovery & upfront contracts", icon: "🎯" },
  { id: "meddic", name: "MEDDIC", desc: "Metrics, Economic Buyer, Decision, Pain, Champion", icon: "📊" },
  { id: "gap", name: "Gap Selling", desc: "Current state → Future state — sell the gap", icon: "🌉" },
  { id: "miller_heiman", name: "Miller Heiman", desc: "Stakeholder mapping & buying influences", icon: "🗺️" },
  { id: "consultative", name: "Consultative Selling", desc: "Solution-focused through deep understanding", icon: "🤝" },
  { id: "value", name: "Value Selling", desc: "Quantify ROI and business value", icon: "💰" },
  { id: "integrity", name: "Integrity Selling", desc: "Ethics-first trust building", icon: "🛡️" },
  { id: "fanatical_prospecting", name: "Fanatical Prospecting", desc: "High-activity multi-channel outreach", icon: "🔥" },
];

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  sales_companies: { name: string } | null;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
  location: string | null;
  operation_details?: any;
  grower_history?: string;
}

interface Episode {
  index: number;
  title: string;
  keyPoint: string;
}

interface CoachingCard {
  headline: string;
  technique: string;
  whatToSay: string[];
  whatToAvoid: string[];
  tryThis: string;
  proTip: string;
}

interface GeneratedEpisode {
  script: string;
  audioUrl?: string;
  coachingCard?: CoachingCard;
}

interface MethodologyData {
  episodes: Episode[];
  generatedEpisodes: Record<number, GeneratedEpisode>;
}

interface Props {
  userId: string;
  companyId?: string;
  deals: Deal[];
  customers: Customer[];
}

export const SalesMethodologyTraining = ({ userId, companyId, deals, customers }: Props) => {
  const { toast } = useToast();
  const [selectedMethodology, setSelectedMethodology] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingEpisode, setGeneratingEpisode] = useState<number | null>(null);
  const [methodologyData, setMethodologyData] = useState<Record<string, MethodologyData>>({});
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});

  const selectedDeal = useMemo(() => deals.find(d => d.id === selectedDealId), [deals, selectedDealId]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  const toggleTranscript = (key: string) => {
    setExpandedTranscripts(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const generateEpisode = async (methodologyId: string, episodeIndex: number) => {
    setGenerating(methodologyId);
    setGeneratingEpisode(episodeIndex);

    try {
      const body: Record<string, unknown> = {
        methodologyId,
        chunkIndex: episodeIndex,
      };

      if (selectedDeal) {
        body.dealContext = {
          dealName: selectedDeal.deal_name,
          companyName: selectedDeal.sales_companies?.name,
          stage: selectedDeal.stage,
          notes: selectedDeal.notes,
        };
      }

      if (selectedCustomer) {
        body.customerContext = {
          name: selectedCustomer.name,
          location: selectedCustomer.location,
          operationDetails: selectedCustomer.operation_details,
          growerHistory: selectedCustomer.grower_history,
        };
      }

      const response = await supabase.functions.invoke("generate-methodology-training", { body });

      if (response.error) throw response.error;

      const { allEpisodes, episodeNumber, script, audioUrl, coachingCard, episodeTitle } = response.data;

      setMethodologyData(prev => {
        const existing = prev[methodologyId] || { episodes: [], generatedEpisodes: {} };
        return {
          ...prev,
          [methodologyId]: {
            episodes: allEpisodes || existing.episodes,
            generatedEpisodes: {
              ...existing.generatedEpisodes,
              [episodeIndex]: { script, audioUrl, coachingCard }
            }
          }
        };
      });

      // Auto-expand
      setExpandedMethod(methodologyId);

      toast({ title: `Episode ${episodeNumber} ready!`, description: episodeTitle });
    } catch (error) {
      console.error("Methodology training error:", error);
      toast({ title: "Generation failed", description: "Couldn't create training. Try again.", variant: "destructive" });
    } finally {
      setGenerating(null);
      setGeneratingEpisode(null);
    }
  };

  const playEpisode = (methodId: string, episodeIndex: number) => {
    const data = methodologyData[methodId]?.generatedEpisodes[episodeIndex];
    if (!data?.audioUrl) return;
    const key = `${methodId}-${episodeIndex}`;
    if (playing && audioElements[playing]) audioElements[playing].pause();

    let audio = audioElements[key];
    if (!audio) {
      audio = new Audio(data.audioUrl);
      audio.onended = () => setPlaying(null);
      setAudioElements(prev => ({ ...prev, [key]: audio }));
    }
    audio.play();
    setPlaying(key);
  };

  const pauseEpisode = (methodId: string, episodeIndex: number) => {
    const key = `${methodId}-${episodeIndex}`;
    if (audioElements[key]) { audioElements[key].pause(); setPlaying(null); }
  };

  const downloadEpisode = async (methodId: string, episodeIndex: number, title: string) => {
    const data = methodologyData[methodId]?.generatedEpisodes[episodeIndex];
    if (!data?.audioUrl) return;
    try {
      const resp = await fetch(data.audioUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Sales Methodology Training
          </h3>
          <p className="text-sm text-muted-foreground">
            Master any sales language — personalized to your deals & products
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Customer selector */}
          <Select value={selectedCustomerId || "general"} onValueChange={v => setSelectedCustomerId(v === "general" ? null : v)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Customer..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="general">General</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Deal selector */}
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedDealId || "none"} onValueChange={v => setSelectedDealId(v === "none" ? null : v)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Apply to deal..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">No specific deal</SelectItem>
                {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.deal_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Personalized banner */}
      {(selectedDealId || selectedCustomerId) && (
        <div className="border rounded-lg p-3 text-sm flex items-center gap-2 flex-wrap bg-purple-500/10 border-purple-500/20">
          <span className="font-medium">🎯 Personalized Mode:</span>
          {selectedCustomerId && <span>Training for <strong>{selectedCustomer?.name}</strong></span>}
          {selectedCustomerId && selectedDealId && <span>+</span>}
          {selectedDealId && <span>deal: <strong>{selectedDeal?.deal_name}</strong></span>}
        </div>
      )}

      {/* Methodology Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {METHODOLOGIES.map(method => {
          const data = methodologyData[method.id];
          const hasEpisodes = data?.episodes?.length > 0;
          const isExpanded = expandedMethod === method.id;
          const isGeneratingThis = generating === method.id;

          return (
            <Card key={method.id} className={`overflow-hidden transition-all ${
              isExpanded ? 'md:col-span-2 border-purple-500/40 bg-purple-500/5' : ''
            } ${hasEpisodes && !isExpanded ? 'border-purple-500/20' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg">{method.icon}</span>
                      <h4 className="font-medium">{method.name}</h4>
                      {hasEpisodes && (
                        <Badge variant="outline" className="text-xs gap-1 border-purple-500/30 text-purple-600">
                          <Headphones className="h-3 w-3" />
                          {data.episodes.length} lessons
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{method.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasEpisodes ? (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => setExpandedMethod(isExpanded ? null : method.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Lessons
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => generateEpisode(method.id, 0)}
                        disabled={isGeneratingThis}
                        className="gap-1 bg-purple-600 hover:bg-purple-700 text-white">
                        {isGeneratingThis ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                        ) : (
                          <><Sparkles className="h-4 w-4" />Learn This</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Episodes */}
                {hasEpisodes && isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {data.episodes.map((episode, idx) => {
                      const generated = data.generatedEpisodes[episode.index];
                      const key = `${method.id}-${episode.index}`;
                      const isPlaying = playing === key;
                      const isGeneratingEp = isGeneratingThis && generatingEpisode === episode.index;

                      return (
                        <div key={idx} className="p-3 rounded-lg bg-background space-y-3">
                          {/* Episode header */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">{episode.index + 1}.</span>
                                <span className="text-sm font-medium">{episode.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{episode.keyPoint}</p>
                            </div>
                            <div className="flex gap-1 justify-end shrink-0">
                              {generated ? (
                                <>
                                  <Button size="sm" variant={isPlaying ? "secondary" : "default"}
                                    onClick={() => isPlaying ? pauseEpisode(method.id, episode.index) : playEpisode(method.id, episode.index)}
                                    className="gap-1">
                                    {isPlaying ? <><Pause className="h-3 w-3" />Pause</> : <><Play className="h-3 w-3" />Play</>}
                                  </Button>
                                  <Button size="sm" variant={expandedTranscripts.has(key) ? "secondary" : "outline"}
                                    onClick={() => toggleTranscript(key)} className="gap-1">
                                    <FileText className="h-3 w-3" />{expandedTranscripts.has(key) ? "Hide" : "Read"}
                                  </Button>
                                  {generated.coachingCard && (
                                    <Button size="sm" variant={expandedCards.has(key) ? "secondary" : "outline"}
                                      onClick={() => toggleCard(key)} className="gap-1"
                                      title="Coaching card">
                                      <MessageSquareQuote className="h-3 w-3" />Card
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost"
                                    onClick={() => downloadEpisode(method.id, episode.index, episode.title)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost"
                                    onClick={() => generateEpisode(method.id, episode.index)}
                                    disabled={isGeneratingThis}>
                                    <RefreshCw className={`h-3 w-3 ${isGeneratingEp ? "animate-spin" : ""}`} />
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline"
                                  onClick={() => generateEpisode(method.id, episode.index)}
                                  disabled={isGeneratingThis} className="gap-1">
                                  {isGeneratingEp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  Generate
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Transcript */}
                          {generated?.script && expandedTranscripts.has(key) && (
                            <div className="pt-2 border-t border-border/50">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">Transcript</span>
                              </div>
                              <ScrollArea className="max-h-64 rounded-md border bg-muted/30 p-3">
                                <div className="text-sm whitespace-pre-wrap leading-relaxed">{generated.script}</div>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Coaching Card */}
                          {generated?.coachingCard && expandedCards.has(key) && (
                            <div className="pt-2 border-t border-border/50">
                              <CoachingCardView card={generated.coachingCard} />
                            </div>
                          )}
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
    </div>
  );
};

function CoachingCardView({ card }: { card: CoachingCard }) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquareQuote className="h-4 w-4 text-purple-500" />
        <span className="font-semibold text-sm">{card.headline}</span>
        <Badge variant="secondary" className="text-xs">{card.technique}</Badge>
      </div>

      {/* What to say */}
      <div>
        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> What to Say
        </p>
        <ul className="space-y-1">
          {card.whatToSay.map((phrase, i) => (
            <li key={i} className="text-sm bg-green-500/10 rounded px-2 py-1 italic">"{phrase}"</li>
          ))}
        </ul>
      </div>

      {/* What to avoid */}
      <div>
        <p className="text-xs font-medium text-red-500 mb-1 flex items-center gap-1">
          <XCircle className="h-3 w-3" /> Avoid
        </p>
        <ul className="space-y-1">
          {card.whatToAvoid.map((phrase, i) => (
            <li key={i} className="text-sm text-muted-foreground">• {phrase}</li>
          ))}
        </ul>
      </div>

      {/* Try this */}
      <div className="flex items-start gap-2 bg-amber-500/10 rounded-lg p-2">
        <Target className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Try This on Your Next Call</p>
          <p className="text-sm">{card.tryThis}</p>
        </div>
      </div>

      {/* Pro tip */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
        <span><strong>Pro Tip:</strong> {card.proTip}</span>
      </div>
    </div>
  );
}
