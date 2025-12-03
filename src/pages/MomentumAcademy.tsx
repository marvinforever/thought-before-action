import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BookOpen, 
  Plus, 
  Search, 
  ExternalLink, 
  Clock, 
  Sparkles,
  FileText,
  Link2,
  Eye,
  Trash2,
  Globe,
  RefreshCw,
  Youtube,
  Podcast,
  Loader2,
  Database
} from "lucide-react";

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  content_type: string;
  source_url: string | null;
  source_name: string | null;
  source_author: string | null;
  reading_time_minutes: number | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

interface Domain {
  id: string;
  name: string;
}

export default function MomentumAcademy() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPublished, setFilterPublished] = useState<string>("all");
  
  const [createOpen, setCreateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptExtracted, setTranscriptExtracted] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [extractedMetadata, setExtractedMetadata] = useState<{
    type?: string;
    title?: string;
  } | null>(null);
  const [newArticle, setNewArticle] = useState({
    content_type: "original",
    source_content: "",
    source_url: "",
    source_name: "",
    source_author: "",
    domain_ids: [] as string[],
  });

  useEffect(() => {
    fetchArticles();
    fetchDomains();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('academy_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      toast({ title: "Error", description: "Failed to load articles", variant: "destructive" });
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  const fetchDomains = async () => {
    const { data, error } = await supabase
      .from('capability_domains')
      .select('id, name')
      .order('display_order');

    if (!error && data) {
      setDomains(data);
    }
  };

  const extractTranscript = async () => {
    if (!transcriptUrl.trim()) {
      toast({ title: "Error", description: "Please enter a URL", variant: "destructive" });
      return;
    }

    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-content-transcript', {
        body: { url: transcriptUrl },
      });

      if (error) throw error;

      if (data.success) {
        setNewArticle({
          ...newArticle,
          source_content: data.transcript,
          source_url: data.metadata?.source_url || transcriptUrl,
          source_name: data.metadata?.source_name || "",
          source_author: data.metadata?.author || "",
        });
        setTranscriptExtracted(true);
        setExtractedMetadata({
          type: data.type,
          title: data.metadata?.title,
        });
        
        if (data.requiresManualTranscript) {
          toast({ 
            title: "Partial extraction", 
            description: "Please paste the full transcript in the content area below" 
          });
        } else {
          toast({ title: "Success", description: "Transcript extracted! Review and edit below." });
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to extract transcript", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Extract error:', error);
      toast({ title: "Error", description: error.message || "Failed to extract content", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const generateArticle = async () => {
    if (!newArticle.source_content.trim()) {
      toast({ title: "Error", description: "Please provide source content", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // Save to knowledge library if enabled
      if (saveToLibrary && newArticle.source_content.length > 100) {
        const wordCount = newArticle.source_content.split(/\s+/).length;
        const { error: libraryError } = await supabase
          .from('knowledge_sources')
          .insert({
            title: extractedMetadata?.title || newArticle.source_name || 'Untitled Source',
            source_url: newArticle.source_url || null,
            source_type: 'transcript',
            source_platform: newArticle.source_name || extractedMetadata?.type || 'manual',
            author: newArticle.source_author || null,
            transcript: newArticle.source_content,
            word_count: wordCount,
            domain_ids: newArticle.domain_ids,
          });
        
        if (libraryError) {
          console.error('Failed to save to library:', libraryError);
          // Don't block article generation, just log the error
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-academy-article', {
        body: newArticle,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Article generated successfully!" });
      resetCreateDialog();
      fetchArticles();
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({ title: "Error", description: error.message || "Failed to generate article", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const resetCreateDialog = () => {
    setCreateOpen(false);
    setTranscriptUrl("");
    setTranscriptExtracted(false);
    setSaveToLibrary(true);
    setExtractedMetadata(null);
    setNewArticle({
      content_type: "original",
      source_content: "",
      source_url: "",
      source_name: "",
      source_author: "",
      domain_ids: [],
    });
  };

  const togglePublished = async (article: Article) => {
    const newStatus = !article.is_published;
    const { error } = await supabase
      .from('academy_articles')
      .update({ 
        is_published: newStatus,
        published_at: newStatus ? new Date().toISOString() : null
      })
      .eq('id', article.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: newStatus ? "Article published" : "Article unpublished" });
      fetchArticles();
    }
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    const { error } = await supabase
      .from('academy_articles')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete article", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Article deleted" });
      fetchArticles();
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || article.content_type === filterType;
    const matchesPublished = filterPublished === "all" || 
      (filterPublished === "published" && article.is_published) ||
      (filterPublished === "draft" && !article.is_published);
    return matchesSearch && matchesType && matchesPublished;
  });

  const getContentTypeBadge = (type: string) => {
    switch (type) {
      case 'original':
        return <Badge className="bg-primary">Original</Badge>;
      case 'curated':
        return <Badge variant="secondary">Curated</Badge>;
      case 'aggregated':
        return <Badge variant="outline">Aggregated</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Momentum Academy
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage learning content for the public blog and Jericho recommendations
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/academy', '_blank')}>
            <Globe className="h-4 w-4 mr-2" />
            View Public Blog
          </Button>
          <Dialog open={createOpen} onOpenChange={(open) => {
            if (!open) resetCreateDialog();
            else setCreateOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Create New Article</DialogTitle>
                <DialogDescription>
                  Paste a YouTube or podcast URL to extract transcript, or enter content directly
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-4">
                  {/* URL Extraction Section */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <Label className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <Podcast className="h-4 w-4 text-purple-500" />
                      Extract from URL (YouTube, Podcast, etc.)
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://youtube.com/watch?v=... or podcast URL"
                        value={transcriptUrl}
                        onChange={(e) => setTranscriptUrl(e.target.value)}
                        disabled={extracting}
                      />
                      <Button 
                        onClick={extractTranscript} 
                        disabled={extracting || !transcriptUrl.trim()}
                        variant="secondary"
                      >
                        {extracting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Extract"
                        )}
                      </Button>
                    </div>
                    {transcriptExtracted && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        ✓ Content extracted - review and edit below
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or enter manually</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Content Type</Label>
                    <Select 
                      value={newArticle.content_type} 
                      onValueChange={(v) => setNewArticle({ ...newArticle, content_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Original (from transcripts/courses)
                          </div>
                        </SelectItem>
                        <SelectItem value="curated">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            Curated (summarize external content)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(newArticle.content_type === 'curated' || transcriptExtracted) && (
                    <>
                      <div className="space-y-2">
                        <Label>Source URL</Label>
                        <Input 
                          placeholder="https://example.com/article"
                          value={newArticle.source_url}
                          onChange={(e) => setNewArticle({ ...newArticle, source_url: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Source Name</Label>
                          <Input 
                            placeholder="YouTube, HBR, etc."
                            value={newArticle.source_name}
                            onChange={(e) => setNewArticle({ ...newArticle, source_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Author</Label>
                          <Input 
                            placeholder="John Smith"
                            value={newArticle.source_author}
                            onChange={(e) => setNewArticle({ ...newArticle, source_author: e.target.value })}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>
                      {transcriptExtracted 
                        ? 'Extracted Transcript (review & edit)' 
                        : newArticle.content_type === 'original' 
                          ? 'Source Content (transcript, notes, etc.)' 
                          : 'Content to Summarize'}
                    </Label>
                    <Textarea 
                      placeholder="Paste your content here..."
                      className="min-h-[200px] font-mono text-sm"
                      value={newArticle.source_content}
                      onChange={(e) => setNewArticle({ ...newArticle, source_content: e.target.value })}
                    />
                    {newArticle.source_content && (
                      <p className="text-xs text-muted-foreground">
                        {newArticle.source_content.length.toLocaleString()} characters
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Capability Domains (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {domains.map((domain) => (
                        <Badge 
                          key={domain.id}
                          variant={newArticle.domain_ids.includes(domain.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const ids = newArticle.domain_ids.includes(domain.id)
                              ? newArticle.domain_ids.filter(id => id !== domain.id)
                              : [...newArticle.domain_ids, domain.id];
                            setNewArticle({ ...newArticle, domain_ids: ids });
                          }}
                        >
                          {domain.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Save to Knowledge Library */}
                  <div className="flex items-center space-x-3 p-3 border rounded-lg bg-muted/30">
                    <Checkbox 
                      id="saveToLibrary" 
                      checked={saveToLibrary}
                      onCheckedChange={(checked) => setSaveToLibrary(checked === true)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="saveToLibrary" className="flex items-center gap-2 cursor-pointer">
                        <Database className="h-4 w-4 text-primary" />
                        Save to Knowledge Library
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Store this transcript for Jericho to reference when generating future content
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={resetCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={generateArticle} disabled={generating || !newArticle.source_content.trim()}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Article
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{articles.length}</div>
            <p className="text-sm text-muted-foreground">Total Articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{articles.filter(a => a.is_published).length}</div>
            <p className="text-sm text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{articles.filter(a => a.content_type === 'original').length}</div>
            <p className="text-sm text-muted-foreground">Original</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{articles.filter(a => a.content_type === 'curated').length}</div>
            <p className="text-sm text-muted-foreground">Curated</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search articles..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="original">Original</SelectItem>
            <SelectItem value="curated">Curated</SelectItem>
            <SelectItem value="aggregated">Aggregated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPublished} onValueChange={setFilterPublished}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Articles List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading articles...</div>
      ) : filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No articles yet</h3>
            <p className="text-muted-foreground mb-4">Create your first Momentum Academy article</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Article
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getContentTypeBadge(article.content_type)}
                      {article.is_published ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                      {article.reading_time_minutes && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {article.reading_time_minutes} min read
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold truncate">{article.title}</h3>
                    {article.summary && (
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{article.summary}</p>
                    )}
                    {article.source_name && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Source: {article.source_name}
                        {article.source_author && ` by ${article.source_author}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => window.open(`/academy/${article.slug}`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Switch 
                      checked={article.is_published}
                      onCheckedChange={() => togglePublished(article)}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteArticle(article.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
