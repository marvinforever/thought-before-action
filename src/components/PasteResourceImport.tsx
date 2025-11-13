import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, CheckCircle2, XCircle, Edit2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ContentType = 'video' | 'book' | 'article' | 'podcast' | 'course';
type CapabilityLevel = 'foundational' | 'advancing' | 'independent' | 'mastery';

interface ExtractedResource {
  url: string;
  title: string;
  description: string;
  content_type: ContentType;
  thumbnail_url?: string;
  author?: string;
  duration_minutes?: number | null;
  is_valid: boolean;
  error?: string;
  editing?: boolean;
  selectedCapabilities?: string[];
  capabilityLevel?: CapabilityLevel;
}

interface SimpleCapability {
  id: string;
  name: string;
}

export default function PasteResourceImport() {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedResources, setExtractedResources] = useState<ExtractedResource[]>([]);
  const [capabilities, setCapabilities] = useState<SimpleCapability[]>([]);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const loadCapabilities = async () => {
    try {
      const { data, error } = await supabase
        .from('capabilities')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      
      if (data) {
        setCapabilities(data);
      }
    } catch (err) {
      console.error('Failed to load capabilities:', err);
    }
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    
    try {
      await loadCapabilities();
      
      const result: any = await supabase.functions.invoke('extract-resource-metadata', {
        body: { url: url.trim() }
      });

      if (result.error) throw result.error;

      if (result.data.success && result.data.resources) {
        const resourcesWithDefaults = result.data.resources.map((r: any) => ({
          ...r,
          editing: false,
          selectedCapabilities: [],
          capabilityLevel: 'foundational' as CapabilityLevel
        }));
        
        setExtractedResources(resourcesWithDefaults);
        setUrl("");
        
        toast({
          title: "Success",
          description: `Extracted ${result.data.resources.length} resource(s)`,
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

  const handleImportAll = async () => {
    const userResult: any = await supabase.auth.getUser();
    if (!userResult.data?.user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive",
      });
      return;
    }

    const profileResult: any = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userResult.data.user.id)
      .single();

    if (!profileResult.data?.company_id) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const resource of extractedResources) {
        if (!resource.is_valid) {
          errorCount++;
          continue;
        }

        const insertResult: any = await supabase
          .from('resources')
          .insert({
            title: resource.title,
            description: resource.description,
            url: resource.url,
            content_type: resource.content_type,
            authors: resource.author,
            estimated_time_minutes: resource.duration_minutes,
            company_id: profileResult.data.company_id,
            is_active: true
          })
          .select('id')
          .single();

        if (insertResult.error) {
          console.error('Resource insert error:', insertResult.error);
          errorCount++;
          continue;
        }

        if (resource.selectedCapabilities && resource.selectedCapabilities.length > 0) {
          const capabilityLinks = resource.selectedCapabilities.map(capId => ({
            resource_id: insertResult.data.id,
            capability_id: capId,
            capability_level: resource.capabilityLevel || 'foundational'
          }));

          await supabase
            .from('resource_capabilities')
            .insert(capabilityLinks);
        }

        successCount++;
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} resource(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });

      if (successCount > 0) {
        setExtractedResources([]);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Paste & Import Resources
        </CardTitle>
        <CardDescription>
          Paste a YouTube video, playlist, or any resource URL to import it instantly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="resource-url">Resource URL</Label>
          <div className="flex gap-2">
            <Input
              id="resource-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
            />
            <Button 
              onClick={handleExtract} 
              disabled={extracting || !url.trim()}
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract'
              )}
            </Button>
          </div>
        </div>

        {extractedResources.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Review & Import ({extractedResources.length})
              </h3>
              <Button 
                onClick={handleImportAll}
                disabled={importing || extractedResources.every(r => !r.is_valid)}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import All'
                )}
              </Button>
            </div>

            {extractedResources.map((resource, index) => (
              <Card key={index} className={!resource.is_valid ? 'border-destructive' : ''}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {resource.is_valid ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Invalid URL
                        </Badge>
                      )}
                      {resource.error && (
                        <p className="text-sm text-muted-foreground mt-1">{resource.error}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateResource(index, { editing: !resource.editing })}
                    >
                      {resource.editing ? (
                        <><Save className="h-4 w-4 mr-1" /> Save</>
                      ) : (
                        <><Edit2 className="h-4 w-4 mr-1" /> Edit</>
                      )}
                    </Button>
                  </div>

                  {resource.thumbnail_url && (
                    <img 
                      src={resource.thumbnail_url} 
                      alt={resource.title}
                      className="w-full h-48 object-cover rounded"
                    />
                  )}

                  {resource.editing ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={resource.title}
                          onChange={(e) => handleUpdateResource(index, { title: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={resource.description}
                          onChange={(e) => handleUpdateResource(index, { description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>URL</Label>
                        <Input
                          value={resource.url}
                          onChange={(e) => handleUpdateResource(index, { url: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold">{resource.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>
                      {resource.author && (
                        <p className="text-sm text-muted-foreground">By {resource.author}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Badge>{resource.content_type}</Badge>
                    {resource.duration_minutes && (
                      <Badge variant="outline">{resource.duration_minutes} min</Badge>
                    )}
                  </div>

                  {resource.is_valid && (
                    <div className="space-y-3 pt-3 border-t">
                      <Label>Link to Capabilities (optional)</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {capabilities.map(cap => (
                          <label
                            key={cap.id}
                            className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={resource.selectedCapabilities?.includes(cap.id)}
                              onChange={() => toggleCapability(index, cap.id)}
                              className="rounded"
                            />
                            <span className="text-sm">{cap.name}</span>
                          </label>
                        ))}
                      </div>

                      {resource.selectedCapabilities && resource.selectedCapabilities.length > 0 && (
                        <div className="space-y-2">
                          <Label>Capability Level</Label>
                          <Select
                            value={resource.capabilityLevel}
                            onValueChange={(value: CapabilityLevel) => handleUpdateResource(index, { capabilityLevel: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="foundational">Foundational</SelectItem>
                              <SelectItem value="advancing">Advancing</SelectItem>
                              <SelectItem value="independent">Independent</SelectItem>
                              <SelectItem value="mastery">Mastery</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
