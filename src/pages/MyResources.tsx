import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Video, Headphones, ExternalLink, Star, Loader2, CheckCircle2, Circle, Sparkles, X, Search } from "lucide-react";
import { ResourceRatingDialog } from "@/components/ResourceRatingDialog";
import { SuggestResourceDialog } from "@/components/SuggestResourceDialog";
import { ContentTypeFilter } from "@/components/ContentTypeFilter";
import { LearningRoadmap } from "@/components/LearningRoadmap";
import { StrategicRoadmapTab } from "@/components/StrategicRoadmapTab";
import { OrganizationalContextTab } from "@/components/OrganizationalContextTab";
import { CompanyStrategicLearningTab } from "@/components/CompanyStrategicLearningTab";
import { useViewAs } from "@/contexts/ViewAsContext";

type GrowthPlanResource = {
  id: string;
  status: string;
  sent_at: string | null;
  clicked_at: string | null;
  completed_at: string | null;
  resource: {
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
  } | null;
  capability: {
    id: string;
    name: string;
  } | null;
};

export default function MyResources() {
  const [resources, setResources] = useState<GrowthPlanResource[]>([]);
  const [allResources, setAllResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tabsRef = useRef<HTMLDivElement>(null);
  const { viewAsCompanyId } = useViewAs();

  // Check if user is admin or manager
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check profile flags
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_super_admin, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      // Check user_roles table
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["manager", "admin", "super_admin"]);

      const hasAdminProfile = profile?.is_super_admin || profile?.is_admin;
      const hasManagerRole = roles && roles.length > 0;
      
      setIsAdminOrManager(hasAdminProfile || hasManagerRole || false);
    };

    checkUserRole();
  }, []);

  useEffect(() => {
    const stateTab = (location.state as any)?.tab;
    if (stateTab) {
      setSelectedStatus(stateTab);
      setTimeout(() => {
        if (tabsRef.current) {
          const elementPosition = tabsRef.current.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: elementPosition - 80, behavior: 'smooth' });
        }
      }, 300);
      return;
    }
    
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setSelectedStatus(tabParam);
      setTimeout(() => {
        if (tabsRef.current) {
          const elementPosition = tabsRef.current.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: elementPosition - 80, behavior: 'smooth' });
        }
      }, 300);
    }
  }, [searchParams, location.state]);

  useEffect(() => {
    loadResources();
    loadAllResources();
  }, [viewAsCompanyId]);

  const loadResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to view your resources",
          variant: "destructive",
        });
        return;
      }

      let targetUserId = user.id;
      
      if (viewAsCompanyId) {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", viewAsCompanyId)
          .eq("is_admin", true)
          .limit(1)
          .single();
        
        if (adminProfile) {
          targetUserId = adminProfile.id;
        }
      }

      const { data, error } = await supabase
        .from("content_recommendations")
        .select(`
          id,
          status,
          sent_at,
          clicked_at,
          completed_at,
          expires_at,
          resource:resources(
            id,
            title,
            description,
            authors,
            publisher,
            rating,
            external_url,
            content_type,
            capability_level,
            estimated_time_minutes
          ),
          capability:employee_capabilities!content_recommendations_employee_capability_id_fkey(
            capability:capabilities(id, name)
          )
        `)
        .eq("profile_id", targetUserId)
        .gt("expires_at", new Date().toISOString())
        .order("sent_at", { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        capability: item.capability?.capability || null,
      }));
      
      setResources(formattedData as GrowthPlanResource[]);
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

  const loadAllResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let companyId = viewAsCompanyId;
      
      if (!companyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();
        
        companyId = profile?.company_id;
      }

      if (!companyId) return;

      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllResources(data || []);
    } catch (error) {
      console.error("Error loading all resources:", error);
    }
  };

  const handleGetRecommendations = async () => {
    try {
      setIsGeneratingRecommendations(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to get recommendations",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "Company not found",
          description: "You must be associated with a company to get recommendations",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('recommend-resources', {
        body: { 
          employeeId: user.id,
          companyId: profile.company_id,
          triggerSource: 'manual',
        }
      });

      if (error) throw error;

      toast({
        title: "Recommendations updated",
        description: "Jericho has found new resources for your growth plan!",
      });

      loadResources();
    } catch (error: any) {
      toast({
        title: "Error getting recommendations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const markAsClicked = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from("content_recommendations")
        .update({ 
          clicked_at: new Date().toISOString(),
          status: "clicked" 
        })
        .eq("id", recommendationId)
        .is("clicked_at", null);

      if (error) throw error;
      loadResources();
    } catch (error: any) {
      console.error("Error updating click status:", error);
    }
  };

  const markAsCompleted = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from("content_recommendations")
        .update({ 
          completed_at: new Date().toISOString(),
          status: "completed" 
        })
        .eq("id", recommendationId);

      if (error) throw error;
      
      toast({
        title: "Marked as complete",
        description: "Great job! Keep up the learning momentum.",
      });
      
      loadResources();
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeResource = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from("content_recommendations")
        .update({ 
          expires_at: new Date().toISOString()
        })
        .eq("id", recommendationId);

      if (error) throw error;
      
      toast({
        title: "Resource removed",
        description: "This resource has been removed from your plan.",
      });
      
      loadResources();
    } catch (error: any) {
      toast({
        title: "Error removing resource",
        description: error.message,
        variant: "destructive",
      });
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
    switch (l) {
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
    if (l === "beginner" || l === "foundational") return "Level 1";
    if (l === "intermediate" || l === "advancing") return "Level 2";
    if (l === "advanced" || l === "independent") return "Level 3";
    if (l === "expert" || l === "mastery") return "Level 4";
    return "General";
  };

  const filteredResources = resources.filter((item) => {
    if (selectedStatus === "all") return item.status !== "completed";
    if (selectedStatus === "completed") return item.status === "completed";
    return item.status === selectedStatus;
  }).filter((item) => {
    if (contentTypeFilter === "all") return true;
    return item.resource?.content_type === contentTypeFilter;
  });

  const filteredAllResources = allResources.filter((resource) => {
    if (contentTypeFilter === "all") return true;
    return resource.content_type === contentTypeFilter;
  });

  const handleOpenRating = (resource: any) => {
    setSelectedResource(resource);
    setRatingDialogOpen(true);
  };

  const handleRatingSubmitted = () => {
    loadAllResources();
    loadResources();
  };

  const pendingCount = resources.filter(r => r.status === "pending").length;
  const completedCount = resources.filter(r => r.status === "completed").length;

  const LearningRoadmapWrapper = () => {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
      const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          const { data: profileData } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", user.id)
            .single();
          setProfile(profileData);
        }
      };
      fetchUserData();
    }, []);

    if (!user || !profile) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return <LearningRoadmap profileId={user.id} companyId={profile.company_id} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-primary p-8 text-primary-foreground shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full -ml-24 -mb-24" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">My Resources</h1>
          <p className="text-primary-foreground/90 text-lg">
            Your personalized learning resources and recommendations
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-accent bg-gradient-to-br from-card to-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{resources.length}</div>
            <p className="text-xs text-muted-foreground mt-1">In your learning plan</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-orange-50 dark:to-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to start</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-card to-green-50 dark:to-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600">{completedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completedCount > 0 ? `${Math.round((completedCount / resources.length) * 100)}% complete` : 'Start learning!'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Get Recommendations Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleGetRecommendations}
          disabled={isGeneratingRecommendations}
          variant="accent"
          size="lg"
          className="gap-2 shadow-lg"
        >
          {isGeneratingRecommendations ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Jericho is thinking...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Get Recommendations
            </>
          )}
        </Button>
      </div>

      <div ref={tabsRef}>
        <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
              <TabsTrigger value="all">My Plan ({resources.filter(r => r.status !== "completed").length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              <TabsTrigger value="clicked">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
              <TabsTrigger value="all-resources">All Resources ({allResources.length})</TabsTrigger>
              {isAdminOrManager && (
                <>
                  <TabsTrigger value="company-learning">Company Learning</TabsTrigger>
                  <TabsTrigger value="organizational">Organizational View</TabsTrigger>
                </>
              )}
            </TabsList>
            <div className="flex items-center gap-2">
              <ContentTypeFilter value={contentTypeFilter} onChange={setContentTypeFilter} />
              <SuggestResourceDialog />
            </div>
          </div>

          <TabsContent value="roadmap" className="mt-6">
            <div className="space-y-6">
              <StrategicRoadmapTab />
              <LearningRoadmapWrapper />
            </div>
          </TabsContent>

          {isAdminOrManager && (
            <TabsContent value="company-learning" className="mt-6">
              <CompanyStrategicLearningTab />
            </TabsContent>
          )}

          {isAdminOrManager && (
            <TabsContent value="organizational" className="mt-6">
              <OrganizationalContextTab />
            </TabsContent>
          )}

          <TabsContent value="all-resources" className="mt-6">
          {filteredAllResources.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No resources available
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAllResources.map((resource) => (
                <Card key={resource.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
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
                    <div className="flex gap-2">
                      {resource.external_url ? (
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
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                        >
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(resource.title + (resource.authors ? ' ' + resource.authors : ''))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            Find Resource
                            <Search className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleOpenRating(resource)}
                        className="h-8 w-8 flex-shrink-0"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value={selectedStatus} className="mt-6">
          {selectedStatus === "all-resources" ? null : filteredResources.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {selectedStatus === "all" 
                    ? "No resources in your learning plan yet" 
                    : `No ${selectedStatus} resources`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((item) => {
                if (!item.resource) return null;
                const resource = item.resource;

                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                       <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          {getContentIcon(resource.content_type)}
                          <Badge className={getLevelColor(resource.capability_level)}>
                            {getLevelLabel(resource.capability_level)}
                          </Badge>
                          {item.status === "completed" && (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Complete
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {resource.rating && (
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{resource.rating.toFixed(1)}</span>
                            </div>
                          )}
                          {item.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeResource(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{resource.title}</CardTitle>
                      {resource.authors && (
                        <CardDescription className="text-sm">
                          by {resource.authors}
                        </CardDescription>
                      )}
                      {item.capability && (
                        <Badge variant="secondary" className="w-fit mt-2">
                          {item.capability.name}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {resource.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {resource.description}
                        </p>
                      )}
                      {resource.estimated_time_minutes && (
                        <p className="text-xs text-muted-foreground">
                          Est. time: {resource.estimated_time_minutes} min
                        </p>
                      )}
                      <div className="flex gap-2">
                        {resource.external_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                            onClick={() => markAsClicked(item.id)}
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
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                            onClick={() => markAsClicked(item.id)}
                          >
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(resource.title + (resource.authors ? ' ' + resource.authors : ''))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              Find Resource
                              <Search className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {item.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => markAsCompleted(item.id)}
                            className="gap-1"
                          >
                            <Circle className="h-3 w-3" />
                            Complete
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleOpenRating(resource)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>

      {/* Rating Dialog */}
      {selectedResource && (
        <ResourceRatingDialog
          resourceId={selectedResource.id}
          resourceTitle={selectedResource.title}
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
}
