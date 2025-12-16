import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, MessageSquare, Sparkles, BookOpen, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { JerichoChat } from "@/components/JerichoChat";

export const StrategicRoadmapTab = () => {
  const [loading, setLoading] = useState(true);
  const [showJericho, setShowJericho] = useState(false);
  const [goals, setGoals] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [suggestedResources, setSuggestedResources] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Calculate current quarter
  const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth();
    if (month < 3) return { quarter: 'Q1', year: now.getFullYear() };
    if (month < 6) return { quarter: 'Q2', year: now.getFullYear() };
    if (month < 9) return { quarter: 'Q3', year: now.getFullYear() };
    return { quarter: 'Q4', year: now.getFullYear() };
  };

  useEffect(() => {
    loadRoadmapData();
  }, []);

  const loadRoadmapData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { quarter, year } = getCurrentQuarter();

      const [goalsData, capabilitiesData, targetsData] = await Promise.all([
        supabase
          .from('personal_goals')
          .select('*')
          .eq('profile_id', user.id)
          .single(),
        supabase
          .from('employee_capabilities')
          .select(`
            *,
            capabilities (
              name,
              description,
              category
            )
          `)
          .eq('profile_id', user.id),
        supabase
          .from('ninety_day_targets')
          .select('*')
          .eq('profile_id', user.id)
          .eq('quarter', quarter)
          .eq('year', year)
          .eq('goal_type', 'professional')
          .order('goal_number', { ascending: true })
      ]);

      setGoals(goalsData.data);
      setCapabilities(capabilitiesData.data || []);
      setTargets(targetsData.data || []);
    } catch (error: any) {
      console.error('Error loading roadmap:', error);
      toast.error('Failed to load strategic roadmap');
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall capability score
  const calculateCapabilityScore = () => {
    if (capabilities.length === 0) return 0;
    
    const levels: Record<string, number> = {
      'foundational': 1,
      'developing': 2,
      'proficient': 3,
      'advanced': 4,
      'expert': 5
    };

    let totalScore = 0;
    let totalPossible = 0;

    capabilities.forEach(cap => {
      const currentLevel = cap.current_level?.toLowerCase();
      const targetLevel = cap.target_level?.toLowerCase();
      
      if (levels[currentLevel] && levels[targetLevel]) {
        totalScore += levels[currentLevel];
        totalPossible += levels[targetLevel];
      }
    });

    return totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  };

  const getSuggestedResources = async () => {
    if (targets.length === 0) {
      toast.error("Add some 90-day targets first to get resource suggestions");
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const targetTexts = targets
        .filter(t => t.goal_text && !t.completed)
        .map(t => t.goal_text)
        .join('\n- ');

      const { data, error } = await supabase.functions.invoke('recommend-resources', {
        body: {
          targetGoals: targetTexts,
          capabilities: capabilities.map(c => c.capabilities?.name).filter(Boolean)
        }
      });

      if (error) throw error;

      if (data?.recommendations) {
        setSuggestedResources(data.recommendations);
        toast.success("Jericho found some resources for you!");
      }
    } catch (error: any) {
      console.error('Error getting suggestions:', error);
      toast.error("Failed to get resource suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const capabilityScore = calculateCapabilityScore();
  const completedTargets = targets.filter(t => t.completed).length;
  const totalTargets = targets.length;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading your strategic roadmap...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Your 3-Year Strategic Roadmap</h2>
          <p className="text-muted-foreground mt-1">
            Your personalized path from today to your dream role
          </p>
        </div>
        <Button onClick={() => setShowJericho(true)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Chat with Jericho
        </Button>
      </div>

      {/* Timeline Visualization */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-12 left-0 right-0 h-1 bg-border" />
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {/* TODAY */}
          <Card className="p-6 relative z-10 border-primary">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <h3 className="font-bold">Today</h3>
            </div>
            <div className="space-y-4">
              {/* Capability Score */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Capability Score</p>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-primary">{capabilityScore}%</div>
                  <Progress value={capabilityScore} className="flex-1 h-2" />
                </div>
              </div>
              
              {/* Current Capabilities Summary */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {capabilities.length} capabilities tracked
                </p>
                <p className="text-xs text-muted-foreground">
                  {capabilities.filter(c => c.current_level === c.target_level).length} at target level
                </p>
              </div>
            </div>
          </Card>

          {/* 90 DAYS */}
          <Card className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <h3 className="font-bold">90 Days</h3>
              {totalTargets > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {completedTargets}/{totalTargets}
                </Badge>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-sm text-muted-foreground">Current Quarter Goals</p>
              {targets.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No 90-day targets set</p>
              ) : (
                targets.map((target: any) => (
                  <div key={target.id} className="flex items-start gap-2 text-xs">
                    {target.completed ? (
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Target className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    )}
                    <span className={target.completed ? "line-through text-muted-foreground" : ""}>
                      {target.goal_text || 'Untitled goal'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* 1 YEAR */}
          <Card className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-bold">1 Year</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Professional Vision</p>
              <div className="text-sm">
                {goals?.one_year_vision || (
                  <span className="italic text-muted-foreground">Set your 1-year vision</span>
                )}
              </div>
            </div>
          </Card>

          {/* 3 YEARS */}
          <Card className="p-6 relative z-10 border-2 border-primary">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <h3 className="font-bold">3 Years</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Dream Role</p>
              <div className="text-sm">
                {goals?.three_year_vision || (
                  <span className="italic text-muted-foreground">Set your 3-year vision</span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Resource Suggestions Based on 90-Day Goals */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Jericho's Resource Suggestions</h3>
          </div>
          <Button 
            onClick={getSuggestedResources} 
            disabled={isLoadingSuggestions || targets.length === 0}
            size="sm"
          >
            {isLoadingSuggestions ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding Resources...
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Get Suggestions for My Goals
              </>
            )}
          </Button>
        </div>
        
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add 90-day targets to get personalized resource suggestions from Jericho.
          </p>
        ) : suggestedResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Click the button above to get resource suggestions based on your {targets.filter(t => !t.completed).length} active 90-day goals.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestedResources.map((resource: any, idx: number) => (
              <Card key={idx} className="p-4 bg-muted/30">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-sm">{resource.title}</h4>
                      {resource.author && (
                        <p className="text-xs text-muted-foreground">by {resource.author}</p>
                      )}
                    </div>
                  </div>
                  {resource.reason && (
                    <p className="text-xs text-muted-foreground">{resource.reason}</p>
                  )}
                  {resource.type && (
                    <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

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
};