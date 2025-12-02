import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, Youtube, Podcast, FileText, GraduationCap, Loader2, Check, ExternalLink, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

interface Capability {
  id: string;
  name: string;
  category: string | null;
  resourceCount?: number;
}

interface DiscoveredResource {
  title: string;
  url: string;
  description: string;
  content_type: string;
  source: string;
  isValid?: boolean;
  isImporting?: boolean;
  isImported?: boolean;
}

export function DiscoverResources() {
  const { toast } = useToast();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<string>("");
  const [capabilitySearch, setCapabilitySearch] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["youtube", "podcasts", "articles", "courses"]);
  const [isSearching, setIsSearching] = useState(false);
  const [resources, setResources] = useState<DiscoveredResource[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    // Get capabilities with resource counts
    const { data: caps } = await supabase
      .from("capabilities")
      .select("id, name, category")
      .order("name");

    if (!caps) return;

    // Get resource counts per capability
    const { data: resourceCaps } = await supabase
      .from("resource_capabilities")
      .select("capability_id, resources!inner(company_id)")
      .eq("resources.company_id", profile.company_id);

    const countMap: { [key: string]: number } = {};
    resourceCaps?.forEach(rc => {
      countMap[rc.capability_id] = (countMap[rc.capability_id] || 0) + 1;
    });

    setCapabilities(caps.map(c => ({
      ...c,
      resourceCount: countMap[c.id] || 0,
    })));
  };

  const togglePlatform = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSearch = async () => {
    if (!selectedCapability) {
      toast({ title: "Select a capability", description: "Please select a capability to search for", variant: "destructive" });
      return;
    }

    const capability = capabilities.find(c => c.id === selectedCapability);
    if (!capability) return;

    setIsSearching(true);
    setResources([]);

    try {
      const { data, error } = await supabase.functions.invoke("search-web-resources", {
        body: { capabilityName: capability.name, platforms },
      });

      if (error) throw error;

      setResources(data.resources || []);
      
      if (data.resources?.length === 0) {
        toast({ title: "No resources found", description: "Try different platforms or a different capability" });
      } else {
        toast({ title: `Found ${data.resources.length} resources`, description: "Review and import the ones you want" });
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (resource: DiscoveredResource, index: number) => {
    if (!companyId || !selectedCapability) return;

    setResources(prev => prev.map((r, i) => i === index ? { ...r, isImporting: true } : r));

    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from("resources")
        .select("id")
        .eq("url", resource.url)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Already exists", description: "This resource is already in your library" });
        setResources(prev => prev.map((r, i) => i === index ? { ...r, isImporting: false, isImported: true } : r));
        return;
      }

      // Insert resource
      const { data: newResource, error: insertError } = await supabase
        .from("resources")
        .insert({
          company_id: companyId,
          title: resource.title,
          url: resource.url,
          description: resource.description,
          content_type: resource.content_type as any,
          source: resource.source,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Link to capability
      await supabase
        .from("resource_capabilities")
        .insert({
          resource_id: newResource.id,
          capability_id: selectedCapability,
        });

      setResources(prev => prev.map((r, i) => i === index ? { ...r, isImporting: false, isImported: true } : r));
      toast({ title: "Imported!", description: `${resource.title} added to your library` });

    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      setResources(prev => prev.map((r, i) => i === index ? { ...r, isImporting: false } : r));
    }
  };

  const handleImportAll = async () => {
    const unimported = resources.filter(r => !r.isImported);
    for (let i = 0; i < resources.length; i++) {
      if (!resources[i].isImported) {
        await handleImport(resources[i], i);
      }
    }
  };

  const filteredCapabilities = capabilities.filter(c =>
    c.name.toLowerCase().includes(capabilitySearch.toLowerCase())
  );

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video": return <Youtube className="h-4 w-4" />;
      case "podcast": return <Podcast className="h-4 w-4" />;
      case "course": return <GraduationCap className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const selectedCap = capabilities.find(c => c.id === selectedCapability);

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Discover Resources for a Capability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Capability Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Capability</label>
            <Select value={selectedCapability} onValueChange={setSelectedCapability}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a capability to find resources for..." />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search capabilities..."
                    value={capabilitySearch}
                    onChange={(e) => setCapabilitySearch(e.target.value)}
                    className="mb-2"
                  />
                </div>
                {filteredCapabilities.map(cap => (
                  <SelectItem key={cap.id} value={cap.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{cap.name}</span>
                      <Badge variant={cap.resourceCount === 0 ? "destructive" : "secondary"} className="text-xs">
                        {cap.resourceCount} resources
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCap && selectedCap.resourceCount === 0 && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                This capability has no resources yet!
              </p>
            )}
          </div>

          {/* Platform Filters */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Platforms to Search</label>
            <div className="flex flex-wrap gap-2">
              <Toggle
                pressed={platforms.includes("youtube")}
                onPressedChange={() => togglePlatform("youtube")}
                className="gap-2"
              >
                <Youtube className="h-4 w-4" /> YouTube
              </Toggle>
              <Toggle
                pressed={platforms.includes("podcasts")}
                onPressedChange={() => togglePlatform("podcasts")}
                className="gap-2"
              >
                <Podcast className="h-4 w-4" /> Podcasts
              </Toggle>
              <Toggle
                pressed={platforms.includes("articles")}
                onPressedChange={() => togglePlatform("articles")}
                className="gap-2"
              >
                <FileText className="h-4 w-4" /> Articles
              </Toggle>
              <Toggle
                pressed={platforms.includes("courses")}
                onPressedChange={() => togglePlatform("courses")}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4" /> Courses
              </Toggle>
            </div>
          </div>

          {/* Search Button */}
          <Button 
            onClick={handleSearch} 
            disabled={!selectedCapability || isSearching || platforms.length === 0}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching the web...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search for Resources
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {resources.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Found {resources.length} Resources
            </CardTitle>
            <Button 
              onClick={handleImportAll}
              disabled={resources.every(r => r.isImported)}
              size="sm"
            >
              Import All ({resources.filter(r => !r.isImported).length})
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resources.map((resource, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg flex items-start justify-between gap-4 ${
                    resource.isImported ? "bg-muted/50 opacity-75" : ""
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getContentIcon(resource.content_type)}
                      <h4 className="font-medium">{resource.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{resource.source}</Badge>
                      <a 
                        href={resource.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={resource.isImported ? "ghost" : "default"}
                    onClick={() => handleImport(resource, index)}
                    disabled={resource.isImporting || resource.isImported}
                  >
                    {resource.isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : resource.isImported ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Imported
                      </>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
