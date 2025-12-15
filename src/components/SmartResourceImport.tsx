import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Link2, Loader2, CheckCircle2, XCircle, Edit2, Save, 
  Sparkles, AlertCircle, Search, X, ChevronDown, ChevronUp,
  ListVideo
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type ContentType = 'video' | 'book' | 'article' | 'podcast' | 'course';

interface Capability {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

interface ExtractedResource {
  url: string;
  title: string;
  description: string;
  content_type: ContentType;
  thumbnail_url?: string;
  author?: string;
  duration_minutes?: number | null;
  is_valid: boolean;
  is_duplicate: boolean;
  existing_resource_id?: string;
  error?: string;
  suggested_capability_ids: string[];
  selectedCapabilities: string[];
  editing: boolean;
}

export default function SmartResourceImport() {
  const [urlInput, setUrlInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedResources, setExtractedResources] = useState<ExtractedResource[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [importing, setImporting] = useState(false);
  const [capabilitySearch, setCapabilitySearch] = useState("");
  const [expandedResource, setExpandedResource] = useState<number | null>(null);
  const { toast } = useToast();

  // Parse URLs from input (supports newline, comma, or space separated)
  const parseUrls = (input: string): string[] => {
    return input
      .split(/[\n,\s]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
  };

  const urlCount = useMemo(() => parseUrls(urlInput).length, [urlInput]);
  
  // Detect if any URL contains a playlist
  const hasPlaylist = useMemo(() => {
    return parseUrls(urlInput).some(url => url.includes('list='));
  }, [urlInput]);

  const handleExtract = async () => {
    const urls = parseUrls(urlInput);
    
    if (urls.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter at least one valid URL (starting with http:// or https://)",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    
    try {
      // Get company ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const result = await supabase.functions.invoke('smart-extract-resource', {
        body: { urls, companyId: profile.company_id }
      });

      if (result.error) throw result.error;

      if (result.data.success && result.data.resources) {
        const resourcesWithState = result.data.resources.map((r: any) => ({
          ...r,
          selectedCapabilities: r.suggested_capability_ids || [],
          editing: false
        }));
        
        setExtractedResources(resourcesWithState);
        setCapabilities(result.data.capabilities || []);
        setUrlInput("");
        
        const duplicates = resourcesWithState.filter((r: ExtractedResource) => r.is_duplicate).length;
        const valid = resourcesWithState.filter((r: ExtractedResource) => r.is_valid && !r.is_duplicate).length;
        
        toast({
          title: "Extraction complete",
          description: `Found ${valid} new resource(s)${duplicates > 0 ? `, ${duplicates} duplicate(s)` : ''}`,
        });
      } else {
        throw new Error(result.data.error || 'Failed to extract metadata');
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast({
        title: "Extraction failed",
        description: error.message || "Could not extract resource metadata",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleUpdateResource = (index: number, updates: Partial<ExtractedResource>) => {
    setExtractedResources(prev => 
      prev.map((r, i) => i === index ? { ...r, ...updates } : r)
    );
  };

  const toggleCapability = (resourceIndex: number, capabilityId: string) => {
    setExtractedResources(prev => 
      prev.map((r, i) => {
        if (i !== resourceIndex) return r;
        const current = r.selectedCapabilities || [];
        const updated = current.includes(capabilityId)
          ? current.filter(id => id !== capabilityId)
          : [...current, capabilityId];
        return { ...r, selectedCapabilities: updated };
      })
    );
  };

  const removeResource = (index: number) => {
    setExtractedResources(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportAll = async () => {
    const resourcesToImport = extractedResources.filter(r => r.is_valid && !r.is_duplicate);
    
    if (resourcesToImport.length === 0) {
      toast({
        title: "Nothing to import",
        description: "No valid resources to import",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      toast({ title: "Error", description: "No company found", variant: "destructive" });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const resource of resourcesToImport) {
        const { data: insertedResource, error: insertError } = await supabase
          .from('resources')
          .insert({
            title: resource.title,
            description: resource.description,
            url: resource.url,
            external_url: resource.url,
            content_type: resource.content_type,
            authors: resource.author,
            estimated_time_minutes: resource.duration_minutes,
            company_id: profile.company_id,
            is_active: true
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Resource insert error:', insertError);
          errorCount++;
          continue;
        }

        // Link capabilities
        if (resource.selectedCapabilities.length > 0) {
          const capabilityLinks = resource.selectedCapabilities.map(capId => ({
            resource_id: insertedResource.id,
            capability_id: capId
          }));

          const { error: linkError } = await supabase
            .from('resource_capabilities')
            .insert(capabilityLinks);
          
          if (linkError) {
            console.error('Failed to link capabilities:', linkError);
          }
        }

        successCount++;
      }

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} resource(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });

      if (successCount > 0) {
        // Remove imported resources from the list
        setExtractedResources(prev => prev.filter(r => r.is_duplicate || !r.is_valid));
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Filter capabilities based on search
  const filteredCapabilities = useMemo(() => {
    if (!capabilitySearch.trim()) return capabilities;
    const search = capabilitySearch.toLowerCase();
    return capabilities.filter(c => 
      c.name.toLowerCase().includes(search) ||
      (c.category && c.category.toLowerCase().includes(search))
    );
  }, [capabilities, capabilitySearch]);

  // Group capabilities by category
  const groupedCapabilities = useMemo(() => {
    const groups: Record<string, Capability[]> = {};
    filteredCapabilities.forEach(cap => {
      const category = cap.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(cap);
    });
    return groups;
  }, [filteredCapabilities]);

  const importableCount = extractedResources.filter(r => r.is_valid && !r.is_duplicate).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Import
        </CardTitle>
        <CardDescription>
          Paste one or more URLs (YouTube, articles, courses, etc.) - AI will extract metadata and suggest relevant capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL Input */}
        <div className="space-y-2">
          <Label htmlFor="resource-urls">Paste URLs (one per line or comma-separated)</Label>
          <Textarea
            id="resource-urls"
            placeholder={`https://www.youtube.com/watch?v=abc123
https://example.com/article
https://coursera.org/course/...`}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                {urlCount > 0 ? `${urlCount} URL${urlCount > 1 ? 's' : ''} detected` : 'No URLs detected'}
              </span>
              {hasPlaylist && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <ListVideo className="h-4 w-4" />
                  <span>YouTube Playlist detected — will extract all videos</span>
                </div>
              )}
            </div>
            <Button 
              onClick={handleExtract} 
              disabled={extracting || urlCount === 0}
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {hasPlaylist ? 'Extracting playlist...' : 'Analyzing...'}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extract & Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Extracted Resources */}
        {extractedResources.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Review Resources ({extractedResources.length})
              </h3>
              <Button 
                onClick={handleImportAll}
                disabled={importing || importableCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Import {importableCount} Resource{importableCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-3">
              {extractedResources.map((resource, index) => (
                <ResourceCard
                  key={index}
                  resource={resource}
                  index={index}
                  capabilities={capabilities}
                  groupedCapabilities={groupedCapabilities}
                  capabilitySearch={capabilitySearch}
                  setCapabilitySearch={setCapabilitySearch}
                  filteredCapabilities={filteredCapabilities}
                  isExpanded={expandedResource === index}
                  onToggleExpand={() => setExpandedResource(expandedResource === index ? null : index)}
                  onUpdate={(updates) => handleUpdateResource(index, updates)}
                  onToggleCapability={(capId) => toggleCapability(index, capId)}
                  onRemove={() => removeResource(index)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ResourceCardProps {
  resource: ExtractedResource;
  index: number;
  capabilities: Capability[];
  groupedCapabilities: Record<string, Capability[]>;
  capabilitySearch: string;
  setCapabilitySearch: (search: string) => void;
  filteredCapabilities: Capability[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ExtractedResource>) => void;
  onToggleCapability: (capId: string) => void;
  onRemove: () => void;
}

function ResourceCard({
  resource,
  capabilities,
  groupedCapabilities,
  capabilitySearch,
  setCapabilitySearch,
  filteredCapabilities,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onToggleCapability,
  onRemove
}: ResourceCardProps) {
  const selectedCapNames = capabilities
    .filter(c => resource.selectedCapabilities.includes(c.id))
    .map(c => c.name);

  const isDuplicate = resource.is_duplicate;
  const isInvalid = !resource.is_valid;
  const isImportable = resource.is_valid && !resource.is_duplicate;

  return (
    <Card className={`${isDuplicate ? 'border-yellow-500/50 bg-yellow-500/5' : ''} ${isInvalid ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="pt-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {resource.thumbnail_url && (
              <img 
                src={resource.thumbnail_url} 
                alt=""
                className="w-24 h-16 object-cover rounded shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              {resource.editing ? (
                <Input
                  value={resource.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  className="font-semibold"
                />
              ) : (
                <h4 className="font-semibold truncate">{resource.title}</h4>
              )}
              {resource.author && (
                <p className="text-sm text-muted-foreground">By {resource.author}</p>
              )}
              <p className="text-xs text-muted-foreground truncate">{resource.url}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {isDuplicate && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Duplicate
              </Badge>
            )}
            {isInvalid && (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Invalid
              </Badge>
            )}
            {isImportable && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            )}
            <Badge>{resource.content_type}</Badge>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Description (editable) */}
        {resource.editing ? (
          <Textarea
            value={resource.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            placeholder="Add a description..."
          />
        ) : resource.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
        ) : null}

        {/* AI Suggested Capabilities */}
        {isImportable && resource.suggested_capability_ids.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI suggested:
            </span>
            {resource.suggested_capability_ids.map(capId => {
              const cap = capabilities.find(c => c.id === capId);
              if (!cap) return null;
              const isSelected = resource.selectedCapabilities.includes(capId);
              return (
                <Badge
                  key={capId}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => onToggleCapability(capId)}
                >
                  {cap.name}
                  {isSelected && <CheckCircle2 className="h-3 w-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Selected Capabilities Display */}
        {selectedCapNames.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Linked:</span>
            {selectedCapNames.map(name => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))}
          </div>
        )}

        {/* Expandable Section */}
        {isImportable && (
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={onToggleExpand}
            >
              <span className="text-sm">
                {isExpanded ? 'Hide capability selector' : 'Add more capabilities'}
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {isExpanded && (
              <div className="mt-3 space-y-3">
                {/* Capability Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search capabilities..."
                    value={capabilitySearch}
                    onChange={(e) => setCapabilitySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Capability List */}
                <ScrollArea className="h-64 border rounded-md p-2">
                  {Object.entries(groupedCapabilities).map(([category, caps]) => (
                    <div key={category} className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{category}</p>
                      <div className="space-y-1">
                        {caps.map(cap => {
                          const isSelected = resource.selectedCapabilities.includes(cap.id);
                          return (
                            <label
                              key={cap.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent ${isSelected ? 'bg-primary/10' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleCapability(cap.id)}
                                className="rounded"
                              />
                              <span className="text-sm">{cap.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredCapabilities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No capabilities match "{capabilitySearch}"
                    </p>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Edit/Save Toggle */}
        {isImportable && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ editing: !resource.editing })}
            >
              {resource.editing ? (
                <><Save className="h-4 w-4 mr-1" /> Done</>
              ) : (
                <><Edit2 className="h-4 w-4 mr-1" /> Edit</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
