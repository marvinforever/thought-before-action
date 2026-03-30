import { useState, useEffect, useMemo } from "react";
import { SalesMethodologyTraining } from "./SalesMethodologyTraining";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Target,
  Lightbulb,
  TrendingUp,
  Download,
  Package,
  FileText,
  Eye,
  EyeOff,
  Users
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Categories that are considered "product training" vs "sales training"
const PRODUCT_CATEGORIES = ['product_catalog', 'product_sheet', 'product_knowledge', 'technical', 'products', 'biologicals', 'seed', 'chemicals', 'crop_protection'];
const isProductTraining = (category: string | null) => {
  if (!category) return false;
  const lowerCat = category.toLowerCase();
  return PRODUCT_CATEGORIES.some(pc => lowerCat.includes(pc) || lowerCat === pc);
};
import { useToast } from "@/hooks/use-toast";


interface SalesKnowledgePodcastsProps {
  userId: string;
  companyId?: string;
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

interface Customer {
  id: string;
  name: string;
  location: string | null;
}

interface ExtractedProduct {
  name: string;
  knowledgeId: string;
  source: string; // Parent catalog title
}

interface SuggestedTraining {
  knowledgeItem: KnowledgeItem;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  relevantTo?: string;
}

export const SalesKnowledgePodcasts = ({ userId, companyId }: SalesKnowledgePodcastsProps) => {
  const { toast } = useToast();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingEpisode, setGeneratingEpisode] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [podcastData, setPodcastData] = useState<Record<string, PodcastData>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [showSuggested, setShowSuggested] = useState(true);

  const toggleTranscript = (key: string) => {
    setExpandedTranscripts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchKnowledge();
    fetchDeals();
    fetchCustomers();
  }, [userId, companyId]);

  // Generate training suggestions based on deals and their stages
  const suggestedTrainings = useMemo((): SuggestedTraining[] => {
    if (!knowledge.length || !deals.length) return [];

    const suggestions: SuggestedTraining[] = [];
    const usedIds = new Set<string>();

    // Map deal stages to relevant training categories and stages
    const stageToTraining: Record<string, { stages: string[]; categories: string[]; keywords: string[] }> = {
      lead: { 
        stages: ['prospecting'], 
        categories: ['prospecting', 'cold_calling', 'sales_scripts'], 
        keywords: ['opening', 'introduction', 'first call', 'prospecting', 'lead'] 
      },
      qualified: { 
        stages: ['discovery'], 
        categories: ['discovery', 'objection_handling', 'product_catalog'], 
        keywords: ['discovery', 'questions', 'needs', 'qualify', 'assessment'] 
      },
      proposal: { 
        stages: ['proposal'], 
        categories: ['proposal', 'product_catalog', 'pricing', 'competitor_intel'], 
        keywords: ['proposal', 'value', 'roi', 'pricing', 'competition', 'comparison'] 
      },
      negotiation: { 
        stages: ['closing', 'proposal'], 
        categories: ['objection_handling', 'closing', 'competitor_intel'], 
        keywords: ['objection', 'negotiation', 'closing', 'discount', 'terms'] 
      },
      closed_won: { 
        stages: ['follow_up'], 
        categories: ['follow_up', 'upsell'], 
        keywords: ['onboarding', 'follow up', 'upsell', 'cross-sell', 'retention'] 
      },
      closed_lost: { 
        stages: ['prospecting', 'discovery'], 
        categories: ['prospecting', 'objection_handling'], 
        keywords: ['lost', 'recovery', 'win back', 'lessons'] 
      },
    };

    // Analyze deals and find matching training
    const dealsByStage = deals.reduce((acc, deal) => {
      const stage = deal.stage?.toLowerCase() || 'lead';
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(deal);
      return acc;
    }, {} as Record<string, Deal[]>);

    // Prioritize stages with the most deals
    const sortedStages = Object.entries(dealsByStage)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [stage, stageDeals] of sortedStages) {
      const trainingMap = stageToTraining[stage] || stageToTraining['qualified'];
      
      // Find matching knowledge items
      for (const item of knowledge) {
        if (usedIds.has(item.id)) continue;

        const itemStage = item.stage?.toLowerCase() || '';
        const itemCategory = item.category?.toLowerCase() || '';
        const itemContent = (item.title + ' ' + item.content).toLowerCase();
        const itemTags = (item.tags || []).map(t => t.toLowerCase());

        // Check for stage match
        const stageMatch = trainingMap.stages.some(s => itemStage.includes(s));
        // Check for category match
        const categoryMatch = trainingMap.categories.some(c => itemCategory.includes(c));
        // Check for keyword match in content
        const keywordMatch = trainingMap.keywords.some(k => 
          itemContent.includes(k) || itemTags.some(t => t.includes(k))
        );

        if (stageMatch || categoryMatch || keywordMatch) {
          const priority = stageDeals.length >= 3 ? 'high' : stageDeals.length >= 2 ? 'medium' : 'low';
          const dealNames = stageDeals.slice(0, 2).map(d => d.deal_name).join(', ');
          
          suggestions.push({
            knowledgeItem: item,
            reason: `${stageDeals.length} deal${stageDeals.length > 1 ? 's' : ''} in ${stage} stage`,
            priority,
            relevantTo: dealNames + (stageDeals.length > 2 ? ` +${stageDeals.length - 2} more` : ''),
          });
          usedIds.add(item.id);

          // Limit suggestions per stage
          if (suggestions.filter(s => s.reason.includes(stage)).length >= 2) break;
        }
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
  }, [knowledge, deals]);

  // Extract products from knowledge base content (### headers)
  const extractedProducts = useMemo((): ExtractedProduct[] => {
    const products: ExtractedProduct[] = [];
    
    for (const item of knowledge) {
      if (!isProductTraining(item.category)) continue;
      
      // Extract ### headers (product names) from markdown
      const productMatches = item.content.match(/###\s*([^\n(]+)/g);
      if (productMatches) {
        for (const match of productMatches) {
          const name = match.replace(/###\s*/, '').trim();
          // Filter out headers that are too short or too long
          if (name.length > 2 && name.length < 60) {
            products.push({
              name,
              knowledgeId: item.id,
              source: item.title
            });
          }
        }
      }
    }
    return products;
  }, [knowledge]);

  // Group products by their source catalog
  const productsBySource = useMemo(() => {
    const grouped: Record<string, ExtractedProduct[]> = {};
    for (const product of extractedProducts) {
      if (!grouped[product.source]) {
        grouped[product.source] = [];
      }
      grouped[product.source].push(product);
    }
    return grouped;
  }, [extractedProducts]);

  const fetchKnowledge = async () => {
    // Build query - filter by company if provided, otherwise show global items only
    let query = supabase
      .from("sales_knowledge")
      .select("id, title, content, stage, category, tags")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    
    if (companyId) {
      // Show items for this company OR global items (no company_id)
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      // No company - only show global items
      query = query.is("company_id", null);
    }

    const { data, error } = await query;

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

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("sales_companies")
      .select("id, name, location")
      .eq("profile_id", userId)
      .order("name");
    
    if (data) {
      setCustomers(data);
    }
  };

  const generateEpisode = async (
    item: KnowledgeItem, 
    episodeIndex: number, 
    productOverride?: string,
    // For complementary training: pass the primary product context
    complementaryContext?: { primaryProductName: string; primaryProductKnowledgeId: string }
  ) => {
    setGenerating(item.id);
    setGeneratingEpisode(episodeIndex);
    
    try {
      // Determine if this is complementary training mode
      // This happens when:
      // 1. User has selected a product (selectedProductName)
      // 2. They're generating training for a DIFFERENT catalog's product (productOverride)
      // 3. The productOverride comes from a different knowledge item than selectedKnowledgeId
      const isComplementaryMode = complementaryContext || (
        selectedProductName && 
        selectedKnowledgeId && 
        productOverride && 
        item.id !== selectedKnowledgeId
      );

      const body: Record<string, unknown> = { 
        knowledgeId: item.id, 
        chunkIndex: episodeIndex,
        dealId: selectedDealId,
        customerId: selectedCustomerId,
        productName: productOverride || selectedProductName,
      };

      // Add primary product context for complementary training
      if (isComplementaryMode) {
        if (complementaryContext) {
          body.primaryProductName = complementaryContext.primaryProductName;
          body.primaryProductKnowledgeId = complementaryContext.primaryProductKnowledgeId;
        } else if (selectedProductName && selectedKnowledgeId) {
          body.primaryProductName = selectedProductName;
          body.primaryProductKnowledgeId = selectedKnowledgeId;
        }
      }

      const response = await supabase.functions.invoke("generate-sales-podcast", { body });

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

  const downloadEpisode = async (itemId: string, episodeIndex: number, episodeTitle: string) => {
    const data = podcastData[itemId]?.generatedEpisodes[episodeIndex];
    if (!data) return;

    try {
      let blob: Blob;
      
      if (data.audioUrl) {
        // Fetch from URL
        const response = await fetch(data.audioUrl);
        blob = await response.blob();
      } else if (data.audioBase64) {
        // Convert base64 to blob
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'audio/mpeg' });
      } else {
        throw new Error('No audio data available');
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${episodeTitle.replace(/[^a-z0-9]/gi, '_')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `${episodeTitle}.mp3`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Could not download the episode",
        variant: "destructive",
      });
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

  // Get non-suggested items
  const suggestedIds = new Set(suggestedTrainings.map(s => s.knowledgeItem.id));
  const otherKnowledge = knowledge.filter(k => !suggestedIds.has(k.id));

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
        
        <div className="flex items-center gap-4 flex-wrap">
          {/* Product Selection */}
          {extractedProducts.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Product
              </label>
              <Select 
                value={selectedProductName ? `${selectedKnowledgeId}::${selectedProductName}` : "all"} 
                onValueChange={(v) => {
                  if (v === "all") {
                    setSelectedProductName(null);
                    setSelectedKnowledgeId(null);
                  } else {
                    const [knowledgeId, ...nameParts] = v.split("::");
                    setSelectedKnowledgeId(knowledgeId);
                    setSelectedProductName(nameParts.join("::"));
                  }
                }}
              >
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Products</SelectItem>
                  {Object.entries(productsBySource).map(([source, products]) => (
                    <div key={source}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t first:border-t-0">
                        {source}
                      </div>
                      {products.map((product, idx) => (
                        <SelectItem key={`${product.knowledgeId}-${idx}`} value={`${product.knowledgeId}::${product.name}`}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Customer Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Customer Context
            </label>
            <Select value={selectedCustomerId || "none"} onValueChange={(v) => setSelectedCustomerId(v === "none" ? null : v)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="No customer" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">No Customer Filter</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Deal Selection */}
          {deals.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Apply to Deal
              </label>
              <Select value={selectedDealId || "none"} onValueChange={(v) => setSelectedDealId(v === "none" ? null : v)}>
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue placeholder="No deal" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">No Deal Filter</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{deal.deal_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({deal.stage}{deal.sales_companies?.name ? ` · ${deal.sales_companies.name}` : ''})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Personalized Mode Banner */}
      {(selectedProductName || selectedDealId || selectedCustomerId) && (
        <div className={`border rounded-lg p-3 text-sm flex items-center gap-2 flex-wrap ${
          selectedProductName 
            ? 'bg-orange-500/10 border-orange-500/20' 
            : 'bg-primary/10 border-primary/20'
        }`}>
          <span className="font-medium">{selectedProductName ? '📦' : '🎯'} Personalized Mode:</span> 
          {selectedProductName && (
            <span>Training on <strong className="text-orange-600">{selectedProductName}</strong></span>
          )}
          {selectedProductName && selectedCustomerId && <span>for</span>}
          {selectedCustomerId && !selectedProductName && <span>Episodes customized for</span>}
          {selectedCustomerId && <span><strong>{customers.find(c => c.id === selectedCustomerId)?.name}</strong></span>}
          {(selectedProductName || selectedCustomerId) && selectedDealId && <span>+</span>}
          {selectedDealId && <span>deal: <strong>{deals.find(d => d.id === selectedDealId)?.deal_name}</strong></span>}
        </div>
      )}

      {/* Suggested Trainings Section */}
      {suggestedTrainings.length > 0 && (
        <div className="space-y-3">
          <button 
            onClick={() => setShowSuggested(!showSuggested)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <div className="flex items-center gap-2 flex-1">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">Suggested for Your Pipeline</span>
              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                {suggestedTrainings.length} recommended
              </Badge>
            </div>
            {showSuggested ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSuggested && (
            <div className="space-y-2 pl-6 border-l-2 border-amber-500/30">
              {suggestedTrainings.map(({ knowledgeItem: item, reason, priority, relevantTo }) => {
                const data = podcastData[item.id];
                const hasEpisodes = data?.episodes && data.episodes.length > 0;
                const isExpanded = expandedItem === item.id;
                const isGeneratingThis = generating === item.id;

                return (
                  <Card key={item.id} className="overflow-hidden border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <TrendingUp className={`h-4 w-4 ${priority === 'high' ? 'text-red-500' : priority === 'medium' ? 'text-amber-500' : 'text-blue-500'}`} />
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
                          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                            💡 {reason} {relevantTo && `• ${relevantTo}`}
                          </p>
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
                              className="gap-1 bg-amber-500 hover:bg-amber-600"
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
                                className="p-3 rounded-lg bg-background space-y-2"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                                          variant={expandedTranscripts.has(key) ? "secondary" : "outline"}
                                          onClick={() => toggleTranscript(key)}
                                          title={expandedTranscripts.has(key) ? "Hide transcript" : "Show transcript"}
                                          className="gap-1"
                                        >
                                          <FileText className="h-3 w-3" />
                                          {expandedTranscripts.has(key) ? "Hide" : "Read"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => downloadEpisode(item.id, episode.index, episode.title)}
                                          title="Download MP3"
                                        >
                                          <Download className="h-3 w-3" />
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

                                {/* Transcript Section */}
                                {generated?.script && expandedTranscripts.has(key) && (
                                  <div className="mt-2 pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs font-medium text-muted-foreground">Transcript</span>
                                    </div>
                                    <ScrollArea className="max-h-64 rounded-md border bg-muted/30 p-3">
                                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                        {generated.script}
                                      </div>
                                    </ScrollArea>
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
          )}
        </div>
      )}

      {/* All Training Modules */}
      {otherKnowledge.length > 0 && (
        <div className="space-y-3">
          {suggestedTrainings.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm text-muted-foreground">All Training Modules</span>
            </div>
          )}
          <div className="space-y-3 pr-4">
          {otherKnowledge.map((item) => {
            const data = podcastData[item.id];
            const hasEpisodes = data?.episodes && data.episodes.length > 0;
            const isExpanded = expandedItem === item.id;
            const isGeneratingThis = generating === item.id;
            const isProduct = isProductTraining(item.category);
            
            return (
              <Card key={item.id} className={`overflow-hidden ${isProduct ? 'border-orange-500/30 bg-orange-500/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isProduct && <Package className="h-4 w-4 text-orange-500" />}
                        <h4 className="font-medium">{item.title}</h4>
                        {isProduct && (
                          <Badge className="text-xs bg-orange-500/20 text-orange-600 border-orange-500/30">
                            Product Training
                          </Badge>
                        )}
                        {item.stage && !isProduct && (
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
                          className={`gap-1 ${isProduct ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
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
                            className="p-3 rounded-lg bg-muted/50 space-y-2"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                                      variant={expandedTranscripts.has(key) ? "secondary" : "outline"}
                                      onClick={() => toggleTranscript(key)}
                                      title={expandedTranscripts.has(key) ? "Hide transcript" : "Show transcript"}
                                      className="gap-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      {expandedTranscripts.has(key) ? "Hide" : "Read"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => downloadEpisode(item.id, episode.index, episode.title)}
                                      title="Download MP3"
                                    >
                                      <Download className="h-3 w-3" />
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

                            {/* Transcript Section */}
                            {generated?.script && expandedTranscripts.has(key) && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-xs font-medium text-muted-foreground">Transcript</span>
                                </div>
                                <ScrollArea className="max-h-64 rounded-md border bg-background/50 p-3">
                                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                    {generated.script}
                                  </div>
                                </ScrollArea>
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
      )}

      {/* Sales Methodology Training */}
      <div className="pt-4 mt-4 border-t">
        <SalesMethodologyTraining
          userId={userId}
          companyId={companyId}
          deals={deals}
          customers={customers}
        />
      </div>
    </div>
  );
};