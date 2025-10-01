import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Video, Headphones, ExternalLink, Star, Loader2 } from "lucide-react";

type Resource = {
  id: string;
  title: string;
  description: string;
  authors: string | null;
  publisher: string | null;
  rating: number | null;
  external_url: string | null;
  content_type: string;
  capability_level: string | null;
  estimated_time_minutes: number | null;
  capability: {
    id: string;
    name: string;
    category: string;
  } | null;
};

export default function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Authentication required",
          description: "Please log in to view resources",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("resources")
        .select(`
          id,
          title,
          description,
          authors,
          publisher,
          rating,
          external_url,
          content_type,
          capability_level,
          estimated_time_minutes,
          capability:capabilities(id, name, category)
        `)
        .eq("is_active", true)
        .order("title");

      if (error) throw error;
      setResources(data as Resource[]);
    } catch (error: any) {
      toast({
        title: "Error loading resources",
        description: error.message,
        variant: "destructive",
      });
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
    switch (level.toLowerCase()) {
      case "foundational":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "advancing":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "independent":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
      case "mastery":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted";
    }
  };

  const getLevelLabel = (level: string | null) => {
    if (!level) return "General";
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      searchQuery === "" ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.authors?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.capability?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel =
      selectedLevel === "all" ||
      resource.capability_level?.toLowerCase() === selectedLevel.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  const groupedByCapability = filteredResources.reduce((acc, resource) => {
    const capabilityName = resource.capability?.name || "General";
    if (!acc[capabilityName]) {
      acc[capabilityName] = [];
    }
    acc[capabilityName].push(resource);
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

      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Tabs value={selectedLevel} onValueChange={setSelectedLevel} className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Levels</TabsTrigger>
            <TabsTrigger value="foundational">Foundational</TabsTrigger>
            <TabsTrigger value="advancing">Advancing</TabsTrigger>
            <TabsTrigger value="independent">Independent</TabsTrigger>
            <TabsTrigger value="mastery">Mastery</TabsTrigger>
          </TabsList>
        </Tabs>
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getContentIcon(resource.content_type)}
                            <Badge className={getLevelColor(resource.capability_level)}>
                              {getLevelLabel(resource.capability_level)}
                            </Badge>
                          </div>
                          {resource.rating && (
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{resource.rating}</span>
                            </div>
                          )}
                        </div>
                        <CardTitle className="text-lg line-clamp-2">{resource.title}</CardTitle>
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
                        {resource.external_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
