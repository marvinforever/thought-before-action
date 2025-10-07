import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, MessageSquare, ArrowRight } from "lucide-react";

export function GrowthAtAGlance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadGrowthData();
  }, []);

  const loadGrowthData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load personal goals
      const { data: goals } = await supabase
        .from('personal_goals')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      // Load top priority capabilities
      const { data: capabilities } = await supabase
        .from('employee_capabilities')
        .select(`
          *,
          capabilities (
            name,
            category
          )
        `)
        .eq('profile_id', user.id)
        .order('priority', { ascending: true })
        .limit(3);

      // Load current quarter targets
      const { data: targets } = await supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', user.id)
        .eq('completed', false)
        .limit(1);

      // Load retention score (based on risk flags)
      const { data: riskFlags } = await supabase
        .from('employee_risk_flags')
        .select('risk_level')
        .eq('profile_id', user.id)
        .is('resolved_at', null);

      const retentionScore = calculateRetentionScore(riskFlags || []);

      setData({
        goals,
        capabilities: capabilities || [],
        currentTarget: targets?.[0],
        retentionScore,
      });
    } catch (error) {
      console.error('Error loading growth data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRetentionScore = (risks: any[]) => {
    if (risks.length === 0) return { status: 'thriving', color: 'text-green-600', emoji: '🟢' };
    
    const hasCritical = risks.some(r => r.risk_level === 'critical');
    if (hasCritical) return { status: 'at risk', color: 'text-destructive', emoji: '🔴' };
    
    const hasModerate = risks.some(r => r.risk_level === 'moderate');
    if (hasModerate) return { status: 'needs attention', color: 'text-yellow-600', emoji: '🟡' };
    
    return { status: 'stable', color: 'text-green-600', emoji: '🟢' };
  };

  const calculateVisionProgress = () => {
    if (!data?.capabilities || data.capabilities.length === 0) return 0;
    
    const levels = ['foundational', 'developing', 'proficient', 'advanced', 'expert'];
    const totalProgress = data.capabilities.reduce((sum: number, cap: any) => {
      const currentIndex = levels.indexOf(cap.current_level?.toLowerCase());
      const targetIndex = levels.indexOf(cap.target_level?.toLowerCase());
      if (currentIndex === -1 || targetIndex === -1) return sum;
      return sum + ((currentIndex + 1) / (targetIndex + 1));
    }, 0);
    
    return Math.round((totalProgress / data.capabilities.length) * 100);
  };

  if (loading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Growth at a Glance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const visionProgress = calculateVisionProgress();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Growth at a Glance</CardTitle>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => navigate('/dashboard/growth-roadmap')}
          >
            View Full Roadmap
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 3-Year Vision Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">3-Year Vision</span>
            </div>
            <span className="text-sm font-bold text-primary">{visionProgress}%</span>
          </div>
          {data.goals?.three_year_vision ? (
            <>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {data.goals.three_year_vision}
              </p>
              <Progress value={visionProgress} className="h-2" />
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/dashboard/my-growth-plan')}
              className="w-full"
            >
              Set Your 3-Year Vision
            </Button>
          )}
        </div>

        {/* This Quarter Focus */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">This Quarter Focus</span>
          </div>
          {data.capabilities.length > 0 ? (
            <div className="space-y-1">
              {data.capabilities.map((cap: any) => (
                <div key={cap.id} className="flex items-center justify-between text-xs bg-background/80 p-2 rounded">
                  <span className="font-medium">{cap.capabilities?.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {cap.current_level} → {cap.target_level}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No capabilities assigned yet</p>
          )}
        </div>

        {/* This Week's Recommended Action */}
        {data.currentTarget && (
          <div className="border-l-4 border-primary pl-3 py-2 bg-background/80 rounded-r">
            <p className="text-xs font-medium mb-1">This Week's Recommended Action:</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {data.currentTarget.goal_text}
            </p>
          </div>
        )}

        {/* Retention Score */}
        <div className="flex items-center justify-between p-3 bg-background/80 rounded">
          <span className="text-sm font-medium">Your Retention Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg">{data.retentionScore.emoji}</span>
            <Badge 
              variant="outline" 
              className={data.retentionScore.color}
            >
              {data.retentionScore.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* CTA */}
        <Button 
          className="w-full" 
          size="sm"
          onClick={() => {
            // This will be handled by the global Jericho chat button
            const event = new CustomEvent('openJerichoChat', { detail: { contextType: 'growth-path' } });
            window.dispatchEvent(event);
          }}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Chat with Jericho About Your Growth
        </Button>
      </CardContent>
    </Card>
  );
}