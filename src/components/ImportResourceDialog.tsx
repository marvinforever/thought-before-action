import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, CheckCircle2, XCircle, Edit2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface ImportResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCapabilityId?: string;
  onImportComplete?: () => void;
}

export default function ImportResourceDialog({ 
  open, 
  onOpenChange, 
  preselectedCapabilityId,
  onImportComplete 
}: ImportResourceDialogProps) {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedResources, setExtractedResources] = useState<ExtractedResource[]>([]);
  const [capabilities, setCapabilities] = useState<SimpleCapability[]>([]);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCapabilities();
    }
  }, [open]);

  useEffect(() => {
    // Auto-select the preselected capability when resources are extracted
    if (preselectedCapabilityId && extractedResources.length > 0) {
      setExtractedResources(prev =>
        prev.map(r => ({
          ...r,
          selectedCapabilities: r.selectedCapabilities?.length 
            ? r.selectedCapabilities 
            : [preselectedCapabilityId]
        }))
      );
    }
  }, [preselectedCapabilityId, extractedResources.length]);

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
      const result: any = await supabase.functions.invoke('extract-resource-metadata', {
        body: { url: url.trim() }
      });

      if (result.error) throw result.error;

      if (result.data.success && result.data.resources) {
        const resourcesWithDefaults = result.data.resources.map((r: any) => ({
          ...r,
          editing: false,
          selectedCapabilities: preselectedCapabilityId ? [preselectedCapabilityId] : [],
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
        const isSelected = current.includes(capabilityId);
        return {
          ...r,
          selectedCapabilities: isSelected
            ? current.filter(id => id !== capabilityId)
            : [...current, capabilityId]
        };
      })
    );
  };

  const handleImportAll = async () => {
    setImporting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company associated");

      let importedCount = 0;

      for (const resource of extractedResources) {
        if (!resource.is_valid) continue;

        const { data: insertedResource, error: resourceError } = await supabase
          .from('resources')
          .insert({
            title: resource.title,
            description: resource.description,
            content_type: resource.content_type,
            external_url: resource.url,
            authors: resource.author,
            estimated_time_minutes: resource.duration_minutes,
            is_active: true,
            company_id: profile.company_id
          })
          .select()
          .single();

        if (resourceError) {
          console.error('Failed to insert resource:', resourceError);
          continue;
        }

        if (resource.selectedCapabilities && resource.selectedCapabilities.length > 0) {
          const capabilityLinks = resource.selectedCapabilities.map(capId => ({
            resource_id: insertedResource.id,
            capability_id: capId,
            capability_level: resource.capabilityLevel || 'foundational'
          }));

          const { error: linkError } = await supabase
            .from('resource_capabilities')
            .insert(capabilityLinks);

          if (linkError) {
            console.error('Failed to link capabilities:', linkError);
          }
        }

        importedCount++;
      }

      if (importedCount > 0) {
        toast({
          title: "Success",
          description: `Imported ${importedCount} resource(s)`,
        });
        setExtractedResources([]);
        onImportComplete?.();
        onOpenChange(false);
      } else {
        toast({
          title: "No resources imported",
          description: "All resources failed validation or import",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error.message || "Could not import resources",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Learning Resource</DialogTitle>
          <DialogDescription>
            Paste a URL to import YouTube videos, podcasts, books, courses, or articles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste YouTube, podcast, book, or course URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              />
              <Button onClick={handleExtract} disabled={extracting || !url.trim()}>
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Extract
                  </>
                )}
              </Button>
            </div>

            <Tabs defaultValue="video" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="podcast">Podcast</TabsTrigger>
                <TabsTrigger value="book">Book</TabsTrigger>
                <TabsTrigger value="course">Course</TabsTrigger>
                <TabsTrigger value="article">Article</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {extractedResources.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Review & Import</h3>
                <Button 
                  onClick={handleImportAll} 
                  disabled={importing || extractedResources.every(r => !r.is_valid)}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import All (${extractedResources.filter(r => r.is_valid).length})`
                  )}
                </Button>
              </div>

              {extractedResources.map((resource, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {resource.is_valid ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                      )}
                      
                      <div className="flex-1 space-y-2">
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
                          <>
                            <div>
                              <h4 className="font-semibold">{resource.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {resource.description}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                              {resource.author && <span>By {resource.author}</span>}
                              {resource.content_type && (
                                <Badge variant="outline">{resource.content_type}</Badge>
                              )}
                              {resource.duration_minutes && (
                                <span>{resource.duration_minutes} min</span>
                              )}
                            </div>

                            {!resource.is_valid && resource.error && (
                              <p className="text-sm text-red-500">{resource.error}</p>
                            )}
                          </>
                        )}

                        <div className="space-y-2">
                          <Label>Link to Capabilities</Label>
                          <div className="flex flex-wrap gap-2">
                            {capabilities.map((cap) => (
                              <Badge
                                key={cap.id}
                                variant={resource.selectedCapabilities?.includes(cap.id) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => toggleCapability(index, cap.id)}
                              >
                                {cap.name}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {resource.selectedCapabilities && resource.selectedCapabilities.length > 0 && (
                          <div className="space-y-2">
                            <Label>Capability Level</Label>
                            <Select
                              value={resource.capabilityLevel}
                              onValueChange={(value) => handleUpdateResource(index, { capabilityLevel: value as CapabilityLevel })}
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
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateResource(index, { editing: !resource.editing })}
                    >
                      {resource.editing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
