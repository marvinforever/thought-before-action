import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Video, Headphones, ExternalLink, Star, Loader2, CheckCircle2, Circle, Target, TrendingUp, FileText, RotateCw, Sparkles } from "lucide-react";
import DiagnosticInsights from "@/components/DiagnosticInsights";
import PersonalVisionCard from "@/components/PersonalVisionCard";
import NinetyDayTracker from "@/components/NinetyDayTracker";
import AchievementsCard from "@/components/AchievementsCard";
import GreatnessTracker from "@/components/GreatnessTracker";

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

type EmployeeCapability = {
  id: string;
  current_level: string;
  target_level: string;
  priority: number;
  ai_reasoning: string | null;
  capability: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
};

type JobDescription = {
  id: string;
  title: string | null;
  description: string;
  created_at: string;
  is_current: boolean;
  analysis_results: any;
};

export default function MyGrowthPlan() {
  const [resources, setResources] = useState<GrowthPlanResource[]>([]);
  const [capabilities, setCapabilities] = useState<EmployeeCapability[]>([]);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadGrowthPlan();
    loadCapabilities();
    loadJobDescriptions();
  }, []);

  const loadGrowthPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to view your growth plan",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("content_recommendations")
        .select(`
          id,
          status,
          sent_at,
          clicked_at,
          completed_at,
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
        .eq("profile_id", user.id)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      
      // Flatten the nested capability structure
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        capability: item.capability?.capability || null,
      }));
      
      setResources(formattedData as GrowthPlanResource[]);
    } catch (error: any) {
      toast({
        title: "Error loading growth plan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCapabilities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          current_level,
          target_level,
          priority,
          ai_reasoning,
          capability:capabilities(
            id,
            name,
            category,
            description
          )
        `)
        .eq("profile_id", user.id)
        .order("priority", { ascending: true });

      if (error) throw error;
      setCapabilities((data as any) || []);
    } catch (error: any) {
      console.error("Error loading capabilities:", error);
    }
  };

  const loadJobDescriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("job_descriptions")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setJobDescriptions(data || []);
    } catch (error) {
      console.error("Error loading job descriptions:", error);
    }
  };

  const handleGetRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase.functions.invoke('recommend-resources', {
        body: { 
          employeeId: user.id,
          companyId: profile.company_id,
          triggerSource: 'manual',
        }
      });

      if (error) throw error;

      toast({
        title: "Recommendations generated!",
        description: `Jericho has added ${data.count} personalized resources to your growth plan.`,
      });

      // Reload resources
      await loadGrowthPlan();
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Failed to generate recommendations",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleReanalyze = async (jobDesc: JobDescription) => {
    setIsReanalyzing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase.functions.invoke('analyze-job-description', {
        body: { 
          jobDescription: jobDesc.description,
          jobTitle: jobDesc.title,
          employeeId: user.id,
          companyId: profile.company_id
        }
      });

      if (error) throw error;

      if (data.suggestions) {
        // Auto-assign the suggestions
        const capabilitiesToAssign = data.suggestions.map((s: any) => ({
          profile_id: user.id,
          capability_id: s.capability_id,
          current_level: s.current_level,
          target_level: s.target_level,
          priority: s.priority,
          ai_reasoning: s.reasoning,
        }));

        await supabase
          .from('employee_capabilities')
          .upsert(capabilitiesToAssign, {
            onConflict: 'profile_id,capability_id',
          });

        toast({
          title: "Re-analysis complete",
          description: `Updated ${data.suggestions.length} capabilities based on your job description`,
        });

        // Reload data
        await loadCapabilities();
        await loadJobDescriptions();
      }
    } catch (error) {
      console.error('Error re-analyzing:', error);
      toast({
        title: "Re-analysis failed",
        description: error instanceof Error ? error.message : "Failed to re-analyze job description",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
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
      loadGrowthPlan();
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
      
      loadGrowthPlan();
    } catch (error: any) {
      toast({
        title: "Error updating status",
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
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const filteredResources = resources.filter((item) => {
    if (selectedStatus === "all") return true;
    return item.status === selectedStatus;
  });

  const pendingCount = resources.filter(r => r.status === "pending").length;
  const completedCount = resources.filter(r => r.status === "completed").length;

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
        <h1 className="text-4xl font-bold tracking-tight">My Growth Plan</h1>
        <p className="text-muted-foreground mt-2">
          Your personalized development journey, goals, and learning resources
        </p>
      </div>

      {/* Diagnostic Insights */}
      <DiagnosticInsights />

      {/* Personal Vision and Greatness Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PersonalVisionCard />
        <GreatnessTracker />
      </div>

      {/* 90 Day Tracker */}
      <NinetyDayTracker />

      {jobDescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Description History
            </CardTitle>
            <CardDescription>
              Previous job descriptions analyzed for your role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobDescriptions.slice(0, 3).map((jobDesc) => (
                <Card key={jobDesc.id} className="border-l-4 border-l-muted">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-sm">{jobDesc.title || "Untitled"}</h4>
                          {jobDesc.is_current && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Analyzed {new Date(jobDesc.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {jobDesc.description}
                        </p>
                        {jobDesc.analysis_results?.suggestions && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {jobDesc.analysis_results.suggestions.length} capabilities identified
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReanalyze(jobDesc)}
                        disabled={isReanalyzing}
                        className="flex-shrink-0"
                      >
                        <RotateCw className="h-3 w-3 mr-1" />
                        Re-analyze
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      <AchievementsCard />

      {capabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              My Capabilities
            </CardTitle>
            <CardDescription>
              Focus areas for your professional development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilities.map((cap) => (
                <Card key={cap.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{cap.capability.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          {cap.capability.category}
                        </Badge>
                      </div>
                      <Badge variant="outline">Priority {cap.priority}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">Current Level</div>
                        <Badge className={getLevelColor(cap.current_level)}>
                          {getLevelLabel(cap.current_level)}
                        </Badge>
                      </div>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">Target Level</div>
                        <Badge className={getLevelColor(cap.target_level)}>
                          {getLevelLabel(cap.target_level)}
                        </Badge>
                      </div>
                    </div>
                    {cap.ai_reasoning && (
                      <p className="text-xs text-muted-foreground italic">
                        {cap.ai_reasoning}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleGetRecommendations}
                disabled={isGeneratingRecommendations}
                className="gap-2"
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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All ({resources.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="clicked">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-6">
          {filteredResources.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {selectedStatus === "all" 
                    ? "No resources in your growth plan yet" 
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
                        <div className="flex items-center gap-2 flex-wrap">
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
                        {resource.external_url && (
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
  );
}
