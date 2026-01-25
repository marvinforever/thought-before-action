import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Compass, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  MessageSquare,
  Heart,
  TrendingUp,
  Loader2
} from "lucide-react";
import { useCareerPath, CareerPath, CareerAspiration } from "@/hooks/useCareerPath";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PromotionReadinessCard } from "./PromotionReadinessCard";
import { CareerRoadmapView } from "./CareerRoadmapView";

interface CareerPathExplorerProps {
  profileId?: string;
  companyId?: string;
}

const ASPIRATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  role: <TrendingUp className="h-4 w-4" />,
  skill: <Sparkles className="h-4 w-4" />,
  general: <Heart className="h-4 w-4" />,
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-500/10 text-green-700 dark:text-green-400",
  neutral: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  negative: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function CareerPathExplorer({ profileId: propProfileId, companyId: propCompanyId }: CareerPathExplorerProps) {
  const [profileId, setProfileId] = useState<string>(propProfileId || "");
  const [companyId, setCompanyId] = useState<string>(propCompanyId || "");
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [selectedTargetRole, setSelectedTargetRole] = useState<string | undefined>();
  
  const { 
    loading, 
    careerPaths, 
    aspirations, 
    loadCareerPaths, 
    loadAspirations,
    generateCareerPath,
    generating,
    roadmap
  } = useCareerPath();

  useEffect(() => {
    const loadUserContext = async () => {
      if (propProfileId && propCompanyId) {
        setProfileId(propProfileId);
        setCompanyId(propCompanyId);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfileId(user.id);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();
          
        if (profile?.company_id) {
          setCompanyId(profile.company_id);
        }
      }
    };

    loadUserContext();
  }, [propProfileId, propCompanyId]);

  useEffect(() => {
    if (companyId) {
      loadCareerPaths(companyId);
    }
    if (profileId) {
      loadAspirations(profileId);
    }
  }, [companyId, profileId]);

  const handleGenerateForPath = async (path: CareerPath) => {
    setSelectedTargetRole(path.to_role);
    await generateCareerPath(profileId, path.to_role);
    setRoadmapOpen(true);
  };

  const handleGenerateCustom = async () => {
    setSelectedTargetRole(undefined);
    await generateCareerPath(profileId);
    setRoadmapOpen(true);
  };

  if (!profileId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary to-primary/80 p-8 text-primary-foreground shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Career Path Explorer</h1>
          </div>
          <p className="text-primary-foreground/90">
            Discover your personalized path to promotion and track your readiness
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="paths" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paths">Career Paths</TabsTrigger>
              <TabsTrigger value="aspirations">My Aspirations</TabsTrigger>
            </TabsList>
            
            {/* Career Paths Tab */}
            <TabsContent value="paths" className="space-y-4">
              {careerPaths.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Compass className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">No Defined Paths Yet</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your organization hasn't defined career paths yet.
                          Generate a personalized path based on your capabilities.
                        </p>
                      </div>
                      <Button onClick={handleGenerateCustom} disabled={generating}>
                        {generating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate My Path
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {careerPaths.map((path) => (
                    <Card key={path.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{path.name}</CardTitle>
                            {path.description && (
                              <CardDescription className="mt-1">
                                {path.description}
                              </CardDescription>
                            )}
                          </div>
                          <Badge variant="outline">
                            {path.path_type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Role Progression */}
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary">{path.from_role || "Current Role"}</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge className="bg-primary">{path.to_role}</Badge>
                        </div>

                        {/* Timeline */}
                        {path.typical_timeline_months && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Typical timeline: {path.typical_timeline_months} months
                          </div>
                        )}

                        {/* Required Capabilities Preview */}
                        {path.required_capabilities && Object.keys(path.required_capabilities).length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Required Capabilities</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(path.required_capabilities).slice(0, 4).map(([cap, level]) => (
                                <Badge key={cap} variant="outline" className="text-xs">
                                  {cap}: {String(level)}
                                </Badge>
                              ))}
                              {Object.keys(path.required_capabilities).length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(path.required_capabilities).length - 4} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <Button 
                          className="w-full" 
                          onClick={() => handleGenerateForPath(path)}
                          disabled={generating}
                        >
                          {generating && selectedTargetRole === path.to_role ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Analyze My Readiness
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Aspirations Tab */}
            <TabsContent value="aspirations" className="space-y-4">
              {aspirations.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">No Aspirations Detected</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Chat with Jericho about your career goals and interests.
                          We'll automatically track your aspirations from those conversations.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {aspirations.map((aspiration) => (
                    <Card key={aspiration.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-muted">
                            {ASPIRATION_TYPE_ICONS[aspiration.aspiration_type] || <Heart className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm">{aspiration.aspiration_text}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {aspiration.target_role && (
                                <Badge variant="secondary" className="text-xs">
                                  Target: {aspiration.target_role}
                                </Badge>
                              )}
                              {aspiration.sentiment && (
                                <Badge className={`text-xs ${SENTIMENT_COLORS[aspiration.sentiment]}`}>
                                  {aspiration.sentiment}
                                </Badge>
                              )}
                              {aspiration.confidence_score && (
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(aspiration.confidence_score * 100)}% confidence
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Detected: {format(new Date(aspiration.created_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Promotion Readiness */}
        <div className="space-y-4">
          <PromotionReadinessCard 
            profileId={profileId}
            onViewRoadmap={() => setRoadmapOpen(true)}
            onGeneratePath={() => {}}
          />
        </div>
      </div>

      {/* Roadmap Dialog */}
      <CareerRoadmapView
        profileId={profileId}
        open={roadmapOpen}
        onOpenChange={setRoadmapOpen}
        initialRoadmap={roadmap}
      />
    </div>
  );
}
