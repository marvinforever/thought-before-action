import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Video, Headphones, ExternalLink, Star, Loader2, UserPlus } from "lucide-react";
import AssignResourceDialog from "@/components/AssignResourceDialog";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  external_url: string | null;
  rating: number | null;
  capability_level: string | null;
  estimated_time_minutes: number | null;
  authors: string | null;
  publisher: string | null;
  capabilities: Array<{
    id: string;
    name: string;
  }>;
};

export default function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedContentType, setSelectedContentType] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{ 
    id: string; 
    title: string; 
    capabilities: Array<{ id: string; name: string }> 
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
    loadResources();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const loadResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch resources with their capability links
      const { data: resourceData, error: resourceError } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('title');

      if (resourceError) throw resourceError;

      // Fetch capability links for all resources
      const resourceIds = resourceData?.map(r => r.id) || [];
      const { data: capabilityLinks, error: linksError } = await supabase
        .from('resource_capabilities')
        .select(`
          resource_id,
          capabilities (
            id,
            name
          )
        `)
        .in('resource_id', resourceIds);

      if (linksError) throw linksError;

      // Group capabilities by resource
      const capabilitiesByResource = new Map<string, Array<{ id: string; name: string }>>();
      capabilityLinks?.forEach((link: any) => {
        if (link.capabilities) {
          const existing = capabilitiesByResource.get(link.resource_id) || [];
          existing.push(link.capabilities);
          capabilitiesByResource.set(link.resource_id, existing);
        }
      });

      // Combine data
      const resourcesWithCapabilities = resourceData?.map(resource => ({
        ...resource,
        capabilities: capabilitiesByResource.get(resource.id) || []
      })) || [];

      setResources(resourcesWithCapabilities);
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "book":
        return <BookOpen className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "podcast":
        return <Headphones className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getLevelColor = (level: string | null) => {
    if (!level) return "bg-muted";
    const l = level.toLowerCase();
    const norm = l === "foundational" ? "beginner"
      : l === "advancing" ? "intermediate"
      : l === "independent" ? "advanced"
      : l === "mastery" ? "expert"
      : l;
    switch (norm) {
      case "beginner":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "intermediate":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "advanced":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
      case "expert":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted";
    }
  };

  const getLevelLabel = (level: string | null) => {
    if (!level) return "General";
    const l = level.toLowerCase();
    const norm = l === "foundational" ? "beginner"
      : l === "advancing" ? "intermediate"
      : l === "independent" ? "advanced"
      : l === "mastery" ? "expert"
      : l;
    return norm.charAt(0).toUpperCase() + norm.slice(1);
  };

  const filteredResources = resources.filter(resource => {
    const matchesSearch = !searchQuery || 
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.capabilities.some(cap => cap.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLevel = selectedLevel === 'all' || resource.capability_level === selectedLevel;
    const matchesType = selectedContentType === 'all' || resource.content_type === selectedContentType;
    
    return matchesSearch && matchesLevel && matchesType;
  });

  const groupedByCapability = filteredResources.reduce((acc, resource) => {
    // A resource can appear under multiple capabilities
    if (resource.capabilities.length === 0) {
      if (!acc['Uncategorized']) {
        acc['Uncategorized'] = [];
      }
      acc['Uncategorized'].push(resource);
    } else {
      resource.capabilities.forEach(capability => {
        if (!acc[capability.name]) {
          acc[capability.name] = [];
        }
        // Check if resource is already in this group to avoid duplicates
        if (!acc[capability.name].find(r => r.id === resource.id)) {
          acc[capability.name].push(resource);
        }
      });
    }
    return acc;
  }, {} as Record<string, Resource[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Resource Library</h1>
        <p className="text-muted-foreground mt-2">
          Curated learning resources to develop your capabilities
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Filter by Level</p>
            <Tabs value={selectedLevel} onValueChange={setSelectedLevel} className="w-full">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="beginner">Beginner</TabsTrigger>
                <TabsTrigger value="intermediate">Intermediate</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger value="expert">Expert</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Filter by Type</p>
            <Tabs value={selectedContentType} onValueChange={setSelectedContentType} className="w-full">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="book">Books</TabsTrigger>
                <TabsTrigger value="video">Videos</TabsTrigger>
                <TabsTrigger value="podcast">Podcasts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {Object.keys(groupedByCapability).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No resources found</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(groupedByCapability).map(([capability, capabilityResources]) => (
            <AccordionItem key={capability} value={capability} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">{capability}</h2>
                  <Badge variant="outline">{capabilityResources.length} resources</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {capabilityResources.map((resource) => (
                    <Card key={resource.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getContentIcon(resource.content_type)}
                            <h3 className="font-semibold text-lg">{resource.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {resource.rating && (
                              <div className="flex items-center gap-1 text-yellow-500">
                                <Star className="h-4 w-4 fill-current" />
                                <span className="text-sm font-medium">{resource.rating}</span>
                              </div>
                            )}
                            {resource.capability_level && (
                              <Badge className={getLevelColor(resource.capability_level)}>
                                {getLevelLabel(resource.capability_level)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {resource.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {resource.capabilities.map(cap => (
                              <Badge key={cap.id} variant="outline" className="text-xs">
                                {cap.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {resource.authors && (
                          <CardDescription className="text-sm">
                            by {resource.authors}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {resource.description}
                          </p>
                        )}
                        {resource.publisher && (
                          <p className="text-xs text-muted-foreground">
                            Publisher: {resource.publisher}
                          </p>
                        )}
                        {resource.estimated_time_minutes && (
                          <p className="text-xs text-muted-foreground">
                            Est. time: {resource.estimated_time_minutes} min
                          </p>
                        )}
                        <div className="flex gap-2">
                          {resource.external_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              asChild
                            >
                              <a
                                href={resource.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                View Resource
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedResource({
                                  id: resource.id,
                                  title: resource.title,
                                  capabilities: resource.capabilities,
                                });
                                setAssignDialogOpen(true);
                              }}
                              className="gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              Assign
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {selectedResource && (
        <AssignResourceDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          resourceId={selectedResource.id}
          resourceTitle={selectedResource.title}
          resourceCapabilities={selectedResource.capabilities}
        />
      )}
    </div>
  );
}
