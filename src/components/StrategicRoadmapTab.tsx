import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { JerichoChat } from "@/components/JerichoChat";

export const StrategicRoadmapTab = () => {
  const [loading, setLoading] = useState(true);
  const [showJericho, setShowJericho] = useState(false);
  const [goals, setGoals] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);

  useEffect(() => {
    loadRoadmapData();
  }, []);

  const loadRoadmapData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          .order('created_at', { ascending: false })
          .limit(3)
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

  const calculateProgress = (current: string, target: string) => {
    const levels = ['foundational', 'developing', 'proficient', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(current?.toLowerCase());
    const targetIndex = levels.indexOf(target?.toLowerCase());
    if (currentIndex === -1 || targetIndex === -1) return 0;
    return ((currentIndex + 1) / (targetIndex + 1)) * 100;
  };

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
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current State</p>
              <div className="space-y-1">
                {capabilities.slice(0, 3).map((cap) => (
                  <div key={cap.id} className="text-xs">
                    {cap.capabilities?.name}: {cap.current_level}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 90 DAYS */}
          <Card className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <h3 className="font-bold">90 Days</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Quick Wins</p>
              {targets.slice(0, 2).map((target: any) => (
                <div key={target.id} className="text-xs">
                  <Target className="inline h-3 w-3 mr-1" />
                  {target.goal_text?.substring(0, 40)}...
                </div>
              ))}
            </div>
          </Card>

          {/* 1 YEAR */}
          <Card className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-bold">1 Year</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Next Level</p>
              <div className="text-sm font-medium">
                {goals?.one_year_vision || 'Set your 1-year vision'}
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
              <div className="text-sm font-medium">
                {goals?.three_year_vision || 'Set your 3-year vision'}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Capability Progress */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Capability Development Path</h2>
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
                    <div className="text-sm font-medium">
                      {cap.current_level} → {cap.target_level}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Priority: {cap.priority || 'Not set'}
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
