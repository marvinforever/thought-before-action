import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Target, TrendingUp, MessageSquare, CheckCircle2, Zap, Expand } from "lucide-react";
import { toast } from "sonner";
import { JerichoChat } from "@/components/JerichoChat";
import { TimelineSectionDialog } from "@/components/TimelineSectionDialog";

interface Sprint {
  week: number;
  focus: string;
  completed?: boolean;
}

interface NinetyDayTarget {
  id: string;
  goal_text: string | null;
  completed: boolean | null;
  sprints: any;
  category: string;
}

export default function GrowthRoadmap() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showJericho, setShowJericho] = useState(false);
  const [goals, setGoals] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [currentTargets, setCurrentTargets] = useState<NinetyDayTarget[]>([]);
  const [completedTargets, setCompletedTargets] = useState<NinetyDayTarget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'today' | '90days' | '1year' | '3years'>('today');

  useEffect(() => {
    loadRoadmapData();
  }, []);

  const loadRoadmapData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Load personal goals
      const { data: goalsData } = await supabase
        .from('personal_goals')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      // Load capabilities
      const { data: capabilitiesData } = await supabase
        .from('employee_capabilities')
        .select(`
          *,
          capabilities (
            name,
            description,
            category
          )
        `)
        .eq('profile_id', user.id);

      // Load current (incomplete) 90-day targets with sprints
      const { data: currentTargetsData } = await supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', user.id)
        .or('completed.is.null,completed.eq.false')
        .order('created_at', { ascending: false });

      // Load completed 90-day targets
      const { data: completedTargetsData } = await supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', user.id)
        .eq('completed', true)
        .order('updated_at', { ascending: false });

      setGoals(goalsData);
      setCapabilities(capabilitiesData || []);
      setCurrentTargets(currentTargetsData || []);
      setCompletedTargets(completedTargetsData || []);
    } catch (error: any) {
      console.error('Error loading roadmap:', error);
      toast.error('Failed to load growth roadmap');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (current: string, target: string) => {
    const levels = ['foundational', 'developing', 'proficient', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(current?.toLowerCase());
    const targetIndex = levels.indexOf(target?.toLowerCase());
    if (currentIndex === -1 || targetIndex === -1) return 0;
    return ((currentIndex + 1) / (targetIndex + 1)) * 100;
  };

  // Extract all sprints from current targets
  const getAllSprints = () => {
    const sprints: { sprint: Sprint; goalText: string }[] = [];
    currentTargets.forEach(target => {
      if (target.sprints && Array.isArray(target.sprints)) {
        target.sprints.forEach((sprint: Sprint) => {
          sprints.push({
            sprint,
            goalText: target.goal_text || ''
          });
        });
      }
    });
    return sprints.slice(0, 4); // Show up to 4 sprints
  };

  const openSection = (section: 'today' | '90days' | '1year' | '3years') => {
    setActiveSection(section);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="text-center">Loading your growth roadmap...</div>
      </div>
    );
  }

  const sprints = getAllSprints();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container max-w-6xl py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Your 3-Year Growth Roadmap</h1>
              <p className="text-muted-foreground mt-2">
                Your personalized path from today to your dream role
              </p>
            </div>
            <Button onClick={() => setShowJericho(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat with Jericho
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-8 space-y-8">
        {/* Timeline Visualization */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute top-12 left-0 right-0 h-1 bg-border" />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* TODAY - Sprints + Capability State */}
            <Card 
              className="p-6 relative z-10 border-primary cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => openSection('today')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <h3 className="font-bold">Today</h3>
                </div>
                <Expand className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Current Sprints */}
              {sprints.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-primary flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Active Sprints
                  </p>
                  <div className="space-y-1.5">
                    {sprints.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="text-xs bg-primary/10 rounded px-2 py-1">
                        <span className="text-muted-foreground">Week {item.sprint.week}:</span>{' '}
                        {item.sprint.focus}
                      </div>
                    ))}
                    {sprints.length > 2 && (
                      <p className="text-xs text-muted-foreground">+{sprints.length - 2} more</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Current Capability State */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Current Capabilities</p>
                <div className="space-y-1">
                  {capabilities.slice(0, 3).map((cap) => (
                    <div key={cap.id} className="text-xs flex justify-between">
                      <span className="truncate mr-2">{cap.capabilities?.name}</span>
                      <span className="capitalize text-muted-foreground shrink-0">
                        {cap.current_level || 'N/A'}
                      </span>
                    </div>
                  ))}
                  {capabilities.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{capabilities.length - 3} more</p>
                  )}
                </div>
              </div>
            </Card>

            {/* 90 DAYS - Completed Targets */}
            <Card 
              className="p-6 relative z-10 cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => openSection('90days')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <h3 className="font-bold">90 Days</h3>
                </div>
                <Expand className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Completed Goals</p>
                {completedTargets.length > 0 ? (
                  <div className="space-y-1.5">
                    {completedTargets.slice(0, 2).map((target) => (
                      <div key={target.id} className="text-xs flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {target.goal_text?.substring(0, 50)}{target.goal_text && target.goal_text.length > 50 ? '...' : ''}
                        </span>
                      </div>
                    ))}
                    {completedTargets.length > 2 && (
                      <p className="text-xs text-muted-foreground">+{completedTargets.length - 2} more</p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No completed goals yet.
                  </div>
                )}
                
                {/* Show in-progress count */}
                {currentTargets.length > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">
                      <Target className="inline h-3 w-3 mr-1" />
                      {currentTargets.length} in progress
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* 1 YEAR - Vision */}
            <Card 
              className="p-6 relative z-10 cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => openSection('1year')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-bold">1 Year</h3>
                </div>
                <Expand className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Your Vision</p>
                <div className="text-sm">
                  {goals?.one_year_vision ? (
                    <p className="line-clamp-4">{goals.one_year_vision}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Set your 1-year vision</p>
                  )}
                </div>
              </div>
            </Card>

            {/* 3 YEARS */}
            <Card 
              className="p-6 relative z-10 border-2 border-primary cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => openSection('3years')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-bold">3 Years</h3>
                </div>
                <Expand className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Dream Role</p>
                <div className="text-sm font-medium">
                  {goals?.three_year_vision ? (
                    <p className="line-clamp-4">{goals.three_year_vision}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Set your 3-year vision</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Capability Progress */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Capability Development Path</h2>
          <div className="grid gap-4">
            {capabilities.map((cap) => (
              <Card key={cap.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{cap.capabilities?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {cap.capabilities?.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium capitalize">
                        {cap.current_level || 'Not set'} → {cap.target_level || 'Not set'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(calculateProgress(cap.current_level, cap.target_level))}%</span>
                    </div>
                    <Progress 
                      value={calculateProgress(cap.current_level, cap.target_level)} 
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <Card className="p-8 text-center bg-gradient-to-r from-primary/10 to-accent/10">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-bold mb-2">
            Ready to Accelerate Your Growth?
          </h3>
          <p className="text-muted-foreground mb-6">
            Chat with Jericho to refine your path, get personalized recommendations,
            and build unstoppable momentum toward your 3-year vision.
          </p>
          <Button size="lg" onClick={() => setShowJericho(true)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Start Conversation with Jericho
          </Button>
        </Card>
      </div>

      {/* Timeline Section Dialog */}
      <TimelineSectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        section={activeSection}
        capabilities={capabilities}
        currentTargets={currentTargets}
        completedTargets={completedTargets}
        oneYearVision={goals?.one_year_vision}
        threeYearVision={goals?.three_year_vision}
      />

      {/* Jericho Chat */}
      {showJericho && (
        <JerichoChat
          isOpen={showJericho}
          onClose={() => setShowJericho(false)}
          contextType="growth-path"
        />
      )}
    </div>
  );
}
