import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Video, Headphones, ExternalLink, Star, Loader2, CheckCircle2, Circle, Target, TrendingUp, FileText, RotateCw, Sparkles, X, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PersonalVisionCard from "@/components/PersonalVisionCard";
import NinetyDayTracker from "@/components/NinetyDayTracker";
import AchievementsCard from "@/components/AchievementsCard";
import GreatnessTracker from "@/components/GreatnessTracker";
import InteractiveCapabilityCard from "@/components/InteractiveCapabilityCard";
import { ResourceRatingDialog } from "@/components/ResourceRatingDialog";
import { SuggestResourceDialog } from "@/components/SuggestResourceDialog";
import { ContentTypeFilter } from "@/components/ContentTypeFilter";
import { RequestCapabilityLevelDialog } from "@/components/RequestCapabilityLevelDialog";
import { LearningRoadmap } from "@/components/LearningRoadmap";
import { StrategicRoadmapTab } from "@/components/StrategicRoadmapTab";
import { OrganizationalContextTab } from "@/components/OrganizationalContextTab";
import { CompanyStrategicLearningTab } from "@/components/CompanyStrategicLearningTab";
import { SelfAssessCapabilitiesDialog } from "@/components/SelfAssessCapabilitiesDialog";
import { CapabilityMasteryMeter } from "@/components/CapabilityMasteryMeter";
import { ViewJobDescriptionDialog } from "@/components/ViewJobDescriptionDialog";
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
  level_descriptions?: Array<{
    level: string;
    description: string;
  }>;
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
  const [allResources, setAllResources] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<EmployeeCapability[]>([]);
  const [capabilityResources, setCapabilityResources] = useState<Record<string, any[]>>({});
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<EmployeeCapability | null>(null);
  const [selfAssessDialogOpen, setSelfAssessDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [viewJdDialogOpen, setViewJdDialogOpen] = useState(false);
  const [selectedJobDescription, setSelectedJobDescription] = useState<JobDescription | null>(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tabsRef = useRef<HTMLDivElement>(null);
  const { viewAsCompanyId } = useViewAs();

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Check for tab parameter in URL or navigation state
  useEffect(() => {
    // Check state first (for same-page navigation)
    const stateTab = (location.state as any)?.tab;
    if (stateTab) {
      setSelectedStatus(stateTab);
      // Scroll to tabs section after a brief delay to ensure content is rendered
      setTimeout(() => {
        if (tabsRef.current) {
          const elementPosition = tabsRef.current.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: elementPosition - 80, behavior: 'smooth' });
        }
      }, 300);
      return;
    }
    
    // Fall back to URL parameter
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setSelectedStatus(tabParam);
      // Scroll to tabs section after a brief delay
      setTimeout(() => {
        if (tabsRef.current) {
          const elementPosition = tabsRef.current.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: elementPosition - 80, behavior: 'smooth' });
        }
      }, 300);
    }
  }, [searchParams, location.state]);

  useEffect(() => {
    loadGrowthPlan();
    loadCapabilities();
    loadJobDescriptions();
    loadCapabilityResources();
    loadAllResources();
  }, [viewAsCompanyId]);

  // Auto-trigger recommendations when key data changes
  useEffect(() => {
    const handleDataChange = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Trigger recommendations in background (don't block UI)
      supabase.functions.invoke('recommend-resources', {
        body: { 
          employeeId: user.id,
          companyId: profile.company_id,
          triggerSource: 'auto',
        }
      }).then(() => {
        loadGrowthPlan();
        loadCapabilityResources();
      });
    };

    const handleRoadmapTrigger = async (triggerSource: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Trigger roadmap update in background
      supabase.functions.invoke('generate-learning-roadmap', {
        body: { 
          employeeId: user.id,
          companyId: profile.company_id,
          triggerSource,
        }
      });
    };

    // Listen for changes to triggers
    const capabilitiesChannel = supabase
      .channel('capability-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employee_capabilities'
      }, () => {
        handleDataChange();
        handleRoadmapTrigger('auto_capability_change');
      })
      .subscribe();

    const goalsChannel = supabase
      .channel('goals-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'personal_goals'
      }, () => {
        handleDataChange();
        handleRoadmapTrigger('auto_goal_update');
      })
      .subscribe();

    const targetsChannel = supabase
      .channel('targets-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ninety_day_targets'
      }, (payload: any) => {
        handleDataChange();
        if (payload.eventType === 'INSERT') {
          handleRoadmapTrigger('auto_new_target');
        } else if (payload.eventType === 'UPDATE' && payload.new?.completed && !payload.old?.completed) {
          handleRoadmapTrigger('auto_target_completed');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(capabilitiesChannel);
      supabase.removeChannel(goalsChannel);
      supabase.removeChannel(targetsChannel);
    };
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

      // Determine which user's data to load
      let targetUserId = user.id;
      
      if (viewAsCompanyId) {
        // If viewing as a company, load data for that company's admin
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
        .gt("expires_at", new Date().toISOString()) // Filter expired
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

      // Determine which user's data to load
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
        .from("employee_capabilities")
        .select(`
          id,
          capability_id,
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
        .eq("profile_id", targetUserId)
        .order("priority", { ascending: true });

      if (error) throw error;

      // Fetch level descriptions for each capability
      const capabilityIds = data?.map((ec: any) => ec.capability_id) || [];
      const { data: levelData, error: levelError } = await supabase
        .from("capability_levels")
        .select("capability_id, level, description")
        .in("capability_id", capabilityIds);

      if (levelError) {
        console.error("Error loading level descriptions:", levelError);
      }

      // Group level descriptions by capability_id
      const levelsByCapability = new Map<string, any[]>();
      levelData?.forEach((level: any) => {
        if (!levelsByCapability.has(level.capability_id)) {
          levelsByCapability.set(level.capability_id, []);
        }
        levelsByCapability.get(level.capability_id)?.push({
          level: level.level,
          description: level.description
        });
      });

      // Add level descriptions to capabilities
      const formattedData = (data as any[])?.map((ec: any) => ({
        ...ec,
        level_descriptions: levelsByCapability.get(ec.capability_id) || []
      })) || [];

      setCapabilities(formattedData);
    } catch (error: any) {
      console.error("Error loading capabilities:", error);
    }
  };

  const loadJobDescriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine which user's data to load
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
        .from("job_descriptions")
        .select("*")
        .eq("profile_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setJobDescriptions(data || []);
    } catch (error) {
      console.error("Error loading job descriptions:", error);
    }
  };

  const loadCapabilityResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine which user's data to load
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

      // Get all employee capabilities with their IDs
      const { data: empCaps } = await supabase
        .from("employee_capabilities")
        .select("id, capability_id")
        .eq("profile_id", targetUserId);

      if (!empCaps) return;

      // Get resources for each capability (filter expired)
      const { data: recommendations } = await supabase
        .from("content_recommendations")
        .select(`
          employee_capability_id,
          expires_at,
          resource:resources(
            id,
            title,
            description,
            content_type,
            external_url,
            rating,
            capability_level
          )
        `)
        .eq("profile_id", targetUserId)
        .gt("expires_at", new Date().toISOString())
        .in("employee_capability_id", empCaps.map(c => c.id));

      if (!recommendations) return;

      // Group resources by capability_id
      const grouped: Record<string, any[]> = {};
      empCaps.forEach(empCap => {
        const capResources = recommendations
          .filter(r => r.employee_capability_id === empCap.id)
          .map(r => r.resource)
          .filter(r => r !== null);
        grouped[empCap.capability_id] = capResources;
      });

      setCapabilityResources(grouped);
    } catch (error) {
      console.error("Error loading capability resources:", error);
    }
  };

  const loadAllResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("rating", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setAllResources(data || []);
    } catch (error) {
      console.error("Error loading all resources:", error);
    }
  };

  const triggerRoadmapUpdate = async (triggerSource: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;

    try {
      console.log(`Triggering roadmap update: ${triggerSource}`);
      const { error } = await supabase.functions.invoke('generate-learning-roadmap', {
        body: {
          employeeId: user.id,
          companyId: profile.company_id,
          triggerSource,
        },
      });

      if (error) throw error;

      toast({
        title: "Roadmap Updated",
        description: "Jericho has updated your learning roadmap based on your recent progress!",
      });
    } catch (error: any) {
      console.error('Error updating roadmap:', error);
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
      await loadCapabilityResources();
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

  const handleRequestLevelChange = async (capabilityId: string) => {
    const capability = capabilities.find(c => c.id === capabilityId);
    if (capability) {
      setSelectedCapability(capability);
      setRequestDialogOpen(true);
    }
  };

  const handleResourceClick = async (resourceId: string, url: string) => {
    // Find the recommendation ID from the resource
    const recommendation = resources.find(r => r.resource?.id === resourceId);
    if (recommendation) {
      await markAsClicked(recommendation.id);
    }
    window.open(url, '_blank');
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

  const removeResource = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from("content_recommendations")
        .update({ 
          expires_at: new Date().toISOString() // Set to expire immediately to hide it
        })
        .eq("id", recommendationId);

      if (error) throw error;
      
      toast({
        title: "Resource removed",
        description: "This resource has been removed from your plan.",
      });
      
      loadGrowthPlan();
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
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const filteredResources = resources.filter((item) => {
    // For "My Plan", exclude completed resources
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
    loadGrowthPlan();
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
          <h1 className="text-4xl font-bold tracking-tight mb-2">My Growth Plan</h1>
          <p className="text-primary-foreground/90 text-lg">
            Your personalized development journey, goals, and learning resources
          </p>
        </div>
      </div>

      {/* Personal Vision and Greatness Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PersonalVisionCard />
        <GreatnessTracker />
      </div>

      {/* 90 Day Tracker */}
      <NinetyDayTracker />

      {jobDescriptions.length > 0 && (() => {
        const currentJd = jobDescriptions.find(jd => jd.is_current) || jobDescriptions[0];
        const historicalJds = jobDescriptions.filter(jd => jd.id !== currentJd?.id);
        
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {currentJd?.title || "My Role"}
                  </CardTitle>
                  <CardDescription>
                    Your current role and responsibilities
                  </CardDescription>
                </div>
                {historicalJds.length > 0 && (
                  <Select
                    onValueChange={(id) => {
                      const jd = jobDescriptions.find(j => j.id === id);
                      if (jd) {
                        setSelectedJobDescription(jd);
                        setViewJdDialogOpen(true);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="View history" />
                    </SelectTrigger>
                    <SelectContent>
                      {historicalJds.map((jd) => (
                        <SelectItem key={jd.id} value={jd.id}>
                          {jd.title || "Untitled"} - {new Date(jd.created_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentJd && (
                <Card 
                  className="border-l-4 border-l-primary cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedJobDescription(currentJd);
                    setViewJdDialogOpen(true);
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="default" className="text-xs">Current</Badge>
                          <p className="text-xs text-muted-foreground">
                            Analyzed {new Date(currentJd.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {currentJd.description}
                        </p>
                        {currentJd.analysis_results?.suggestions && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {currentJd.analysis_results.suggestions.length} capabilities identified • Click to view full description
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <ViewJobDescriptionDialog
        open={viewJdDialogOpen}
        onOpenChange={setViewJdDialogOpen}
        jobDescription={selectedJobDescription}
      />

      {/* Achievements */}
      <AchievementsCard />

      {/* Capability Mastery Meter */}
      {capabilities.length > 0 && <CapabilityMasteryMeter capabilities={capabilities} />}

      {capabilities.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  My Capabilities
                </CardTitle>
                <CardDescription>
                  Focus areas for your professional development
                </CardDescription>
              </div>
              <Button
                onClick={() => setSelfAssessDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Self-Assess
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilities.map((cap) => (
                <InteractiveCapabilityCard
                  key={cap.id}
                  id={cap.id}
                  name={cap.capability.name}
                  category={cap.capability.category}
                  description={cap.capability.description}
                  currentLevel={cap.current_level}
                  targetLevel={cap.target_level}
                  aiReasoning={cap.ai_reasoning}
                  resources={capabilityResources[cap.capability.id] || []}
                  levelDescriptions={cap.level_descriptions || []}
                  onRequestLevelChange={handleRequestLevelChange}
                  onResourceClick={handleResourceClick}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Get Recommendations Button - Relocated */}
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
              <TabsTrigger value="company-learning">Company Learning</TabsTrigger>
              <TabsTrigger value="organizational">Organizational View</TabsTrigger>
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

          <TabsContent value="company-learning" className="mt-6">
            <CompanyStrategicLearningTab />
          </TabsContent>

          <TabsContent value="organizational" className="mt-6">
            <OrganizationalContextTab />
          </TabsContent>

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
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenRating(resource)}
                        className="gap-1"
                      >
                        <Star className="h-3 w-3" />
                        Rate
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRating(resource)}
                          className="gap-1"
                        >
                          <Star className="h-3 w-3" />
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

      {/* Request Capability Level Dialog */}
      {selectedCapability && (
        <RequestCapabilityLevelDialog
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          employeeCapability={{
            id: selectedCapability.id,
            capability_id: selectedCapability.capability.id,
            current_level: selectedCapability.current_level,
            capability_name: selectedCapability.capability.name,
          }}
        />
      )}

      {/* Self-Assess Capabilities Dialog */}
      <SelfAssessCapabilitiesDialog
        open={selfAssessDialogOpen}
        onOpenChange={setSelfAssessDialogOpen}
        profileId={currentUserId}
      />
    </div>
  );
}
