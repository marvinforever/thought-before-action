import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalVisionCard from "@/components/PersonalVisionCard";
import NinetyDayTracker from "@/components/NinetyDayTracker";
import AchievementsCard from "@/components/AchievementsCard";
import GreatnessTracker from "@/components/GreatnessTracker";
import { ViewJobDescriptionDialog } from "@/components/ViewJobDescriptionDialog";
import { useViewAs } from "@/contexts/ViewAsContext";
import { PhasedOnboarding } from "@/components/PhasedOnboarding";
import { StreakBadge } from "@/components/StreakBadge";
import { BadgeShowcase } from "@/components/BadgeShowcase";
import { CelebrationOverlay, useCelebration } from "@/components/CelebrationOverlay";
import { CompanyLeaderboard } from "@/components/CompanyLeaderboard";
import { DailyPodcastPlayer } from "@/components/DailyPodcastPlayer";
import { WelcomeModal } from "@/components/WelcomeModal";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { FloatingJerichoButton } from "@/components/FloatingJerichoButton";
import { RequestMeetingDialog } from "@/components/RequestMeetingDialog";
import { AIProductivityTips } from "@/components/AIProductivityTips";
import { JerichoChat } from "@/components/JerichoChat";

interface AITask {
  task: string;
  ai_solution: string;
  recommended_tool?: string;
  hours_saved?: number;
}

type JobDescription = {
  id: string;
  title: string | null;
  description: string;
  created_at: string;
  is_current: boolean;
  analysis_results: any;
};

export default function MyGrowthPlan() {
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewJdDialogOpen, setViewJdDialogOpen] = useState(false);
  const [selectedJobDescription, setSelectedJobDescription] = useState<JobDescription | null>(null);
  const [userProfile, setUserProfile] = useState<{ id: string; company_id: string; hide_daily_brief?: boolean } | null>(null);
  const [jerichoOpen, setJerichoOpen] = useState(false);
  const [jerichoContextType, setJerichoContextType] = useState<string | undefined>(undefined);
  const [jerichoTaskDetails, setJerichoTaskDetails] = useState<AITask | undefined>(undefined);
  const [podcastRefreshKey, setPodcastRefreshKey] = useState(0);
  const [onboardingProgressKey, setOnboardingProgressKey] = useState(0);
  const [onboardingWizardForceKey, setOnboardingWizardForceKey] = useState(0);
  const [requestMeetingOpen, setRequestMeetingOpen] = useState(false);
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();
  const { celebration, celebrate, onComplete } = useCelebration();
  const { isEnabled: isPodcastEnabled, loading: podcastFlagLoading } = useFeatureFlag('daily_podcast');
  const { isEnabled: isAIEfficiencyEnabled, loading: aiEfficiencyFlagLoading } = useFeatureFlag('ai_efficiency_analysis');

  const handleOpenJericho = () => {
    setJerichoContextType(undefined);
    setJerichoTaskDetails(undefined);
    setJerichoOpen(true);
  };

  const handleStartWithJericho = (task: AITask) => {
    setJerichoContextType('ai-task-agent');
    setJerichoTaskDetails(task);
    setJerichoOpen(true);
  };

  const handleNewBadge = (badge: { name: string; icon_emoji: string; description: string }) => {
    celebrate(`Badge Earned: ${badge.name}`, "badge", {
      badgeEmoji: badge.icon_emoji,
      subtitle: badge.description
    });
  };

  // Listen for openJericho events from navigation
  useEffect(() => {
    const handleOpenJerichoEvent = () => {
      setJerichoOpen(true);
    };
    window.addEventListener('openJericho', handleOpenJerichoEvent);
    return () => window.removeEventListener('openJericho', handleOpenJerichoEvent);
  }, []);

  useEffect(() => {
    loadJobDescriptions();
  }, [viewAsCompanyId]);

  const loadJobDescriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile for podcast player
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id, hide_daily_brief")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        setUserProfile({
          id: profile.id,
          company_id: profile.company_id,
          hide_daily_brief: profile.hide_daily_brief ?? false,
        });
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
        .from("job_descriptions")
        .select("*")
        .eq("profile_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setJobDescriptions(data || []);
    } catch (error) {
      console.error("Error loading job descriptions:", error);
    } finally {
      setLoading(false);
    }
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
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">My Growth Plan</h1>
            <p className="text-primary-foreground/90 text-lg">
              Your personalized development journey and goals
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => setRequestMeetingOpen(true)}
              className="bg-white text-primary hover:bg-white/90"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Meeting
            </Button>
            <StreakBadge className="bg-white/10 border-white/20" />
          </div>
        </div>
      </div>

      {/* Welcome Modal for incomplete onboarding */}
      <WelcomeModal onStartChat={handleOpenJericho} />

      {/* Phased Onboarding */}
      <PhasedOnboarding
        key={onboardingProgressKey}
        onOpenJericho={handleOpenJericho}
        onStartFirstDailyBrief={() => {
          toast({ title: "Opening onboarding...", description: "Let's create your first Daily Brief." });
          setOnboardingWizardForceKey((v) => v + 1);
        }}
      />

      {/* Daily Podcast Player - Feature Flagged + User Preference */}
      {userProfile && !podcastFlagLoading && isPodcastEnabled && !userProfile.hide_daily_brief && (
        <DailyPodcastPlayer 
          key={podcastRefreshKey}
          profileId={userProfile.id} 
          companyId={userProfile.company_id}
          autoPlay={podcastRefreshKey > 0}
        />
      )}

      {/* Personal Vision and Greatness/Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-onboarding="vision">
          <PersonalVisionCard />
        </div>
        <div data-onboarding="habits">
          <Tabs defaultValue="greatness" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="greatness">Habits</TabsTrigger>
              <TabsTrigger value="badges">Badges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>
            <TabsContent value="greatness" className="mt-4">
              <GreatnessTracker />
            </TabsContent>
            <TabsContent value="badges" className="mt-4">
              <BadgeShowcase onNewBadge={handleNewBadge} />
            </TabsContent>
            <TabsContent value="leaderboard" className="mt-4">
              <CompanyLeaderboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 90 Day Tracker */}
      <div data-onboarding="goals">
        <NinetyDayTracker />
      </div>

      {/* Job Description Section */}
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
      <div data-onboarding="achievements">
        <AchievementsCard />
      </div>

      {/* AI Productivity Tips - Feature Flagged */}
      {!aiEfficiencyFlagLoading && isAIEfficiencyEnabled && (
        <AIProductivityTips onStartWithJericho={handleStartWithJericho} />
      )}

      {/* Badge Celebration Overlay */}
      <CelebrationOverlay 
        show={celebration.show}
        message={celebration.message}
        type={celebration.type}
        badgeEmoji={celebration.badgeEmoji}
        subtitle={celebration.subtitle}
        onComplete={onComplete}
      />

      {/* Onboarding Wizard for new users */}
      <OnboardingWizard 
        forceOpenKey={onboardingWizardForceKey}
        onComplete={() => {
          // Trigger podcast player refresh and auto-play
          setPodcastRefreshKey(prev => prev + 1);
          setOnboardingProgressKey((v) => v + 1);
        }}
        onOpenPlayer={() => {
          // Trigger refresh then scroll to podcast player
          setPodcastRefreshKey(prev => prev + 1);
          setOnboardingProgressKey((v) => v + 1);
          setTimeout(() => {
            document.querySelector('[data-podcast-player]')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
      />

      {/* Floating Jericho Button */}
      <FloatingJerichoButton 
        isOpen={jerichoOpen}
        onOpenChange={setJerichoOpen}
      />

      {/* Direct Jericho Chat for AI Task Agent Mode */}
      <JerichoChat
        isOpen={jerichoOpen && jerichoContextType === 'ai-task-agent'}
        onClose={() => {
          setJerichoOpen(false);
          setJerichoContextType(undefined);
          setJerichoTaskDetails(undefined);
        }}
        contextType={jerichoContextType}
        taskDetails={jerichoTaskDetails}
      />

      {/* Request Meeting Dialog */}
      <RequestMeetingDialog
        open={requestMeetingOpen}
        onOpenChange={setRequestMeetingOpen}
      />
    </div>
  );
}
