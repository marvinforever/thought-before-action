import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, BookOpen, GraduationCap, UserCircle, MessageSquare, Users, TrendingUp, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface FocusArea {
  topic: string;
  recommendation_type: string;
  reasoning: string;
  investment_level: string;
  timeline: string;
  suggested_resources: string[];
}

interface QuickWin {
  action: string;
  reasoning: string;
}

interface LongTerm {
  investment: string;
  reasoning: string;
  timeline: string;
}

interface RoadmapData {
  narrative: string;
  focus_areas: FocusArea[];
  quick_wins: QuickWin[];
  long_term: LongTerm[];
}

interface LearningRoadmapProps {
  profileId: string;
  companyId: string;
}

export const LearningRoadmap = ({ profileId, companyId }: LearningRoadmapProps) => {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRoadmap();
  }, [profileId]);

  const loadRoadmap = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_roadmaps')
        .select('*')
        .eq('profile_id', profileId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No roadmap exists yet
          return null;
        }
        throw error;
      }

      if (data) {
        setRoadmap(data.roadmap_data as unknown as RoadmapData);
        setGeneratedAt(data.generated_at);
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
    }
  };

  const generateRoadmap = async () => {
    setIsLoading(true);
    try {
      console.log('Calling generate-learning-roadmap function...', { profileId, companyId });
      
      const { data, error } = await supabase.functions.invoke('generate-learning-roadmap', {
        body: {
          employeeId: profileId,
          companyId: companyId,
          triggerSource: 'manual',
        },
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (data.success) {
        setRoadmap(data.roadmap);
        setGeneratedAt(data.generatedAt);
        await loadRoadmap(); // Reload from database
        toast({
          title: "Roadmap Updated",
          description: "Jericho has created your personalized growth roadmap!",
        });
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error generating roadmap:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate roadmap. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'free_resources':
        return <BookOpen className="h-5 w-5" />;
      case 'external_training':
        return <GraduationCap className="h-5 w-5" />;
      case 'coaching':
        return <UserCircle className="h-5 w-5" />;
      case 'jericho_coaching':
        return <MessageSquare className="h-5 w-5" />;
      case 'manager_mentorship':
        return <Users className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const getRecommendationLabel = (type: string) => {
    switch (type) {
      case 'free_resources':
        return 'Free Resources';
      case 'external_training':
        return 'External Training';
      case 'coaching':
        return 'Professional Coaching';
      case 'jericho_coaching':
        return 'Jericho Coaching';
      case 'manager_mentorship':
        return 'Manager Mentorship';
      default:
        return type;
    }
  };

  const getInvestmentColor = (level: string) => {
    switch (level) {
      case 'free':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'low':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'high':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getTimelineColor = (timeline: string) => {
    switch (timeline) {
      case 'immediate':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'next_quarter':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case '6_months':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Your Strategic Growth Roadmap</CardTitle>
              <CardDescription>
                Jericho's personalized development plan for you
                {generatedAt && (
                  <span className="block mt-1 text-xs">
                    Last updated {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button
              onClick={roadmap ? generateRoadmap : () => { loadRoadmap(); if (!roadmap) generateRoadmap(); }}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {roadmap ? 'Refresh Roadmap' : 'Generate Roadmap'}
            </Button>
          </div>
        </CardHeader>

        {!roadmap && !isLoading && (
          <CardContent>
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-4">Ready to create your personalized growth roadmap?</p>
              <p className="text-sm text-muted-foreground mb-6">
                Jericho will analyze your capabilities, goals, and progress to recommend the best path forward.
              </p>
              <Button onClick={generateRoadmap} size="lg">
                Generate My Roadmap
              </Button>
            </div>
          </CardContent>
        )}

        {roadmap && (
          <CardContent className="space-y-6">
            {/* Current State Assessment */}
            <Card className="bg-accent/50">
              <CardHeader>
                <CardTitle className="text-lg">Current State</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{roadmap.narrative}</p>
              </CardContent>
            </Card>

            {/* Quick Wins */}
            {roadmap.quick_wins && roadmap.quick_wins.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Quick Wins - Start Today
                </h3>
                <div className="grid gap-3">
                  {roadmap.quick_wins.map((win, index) => (
                    <Card key={index} className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-4">
                        <p className="font-medium mb-2">{win.action}</p>
                        <p className="text-sm text-muted-foreground">{win.reasoning}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Focus Areas */}
            {roadmap.focus_areas && roadmap.focus_areas.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Priority Focus Areas</h3>
                <div className="grid gap-4">
                  {roadmap.focus_areas.map((area, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1">
                              {getRecommendationIcon(area.recommendation_type)}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-2">{area.topic}</CardTitle>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <Badge variant="secondary">
                                  {getRecommendationLabel(area.recommendation_type)}
                                </Badge>
                                <Badge className={getInvestmentColor(area.investment_level)}>
                                  {area.investment_level.charAt(0).toUpperCase() + area.investment_level.slice(1)} Investment
                                </Badge>
                                <Badge className={getTimelineColor(area.timeline)}>
                                  {area.timeline.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Jericho's Reasoning:</p>
                          <p className="text-sm text-muted-foreground">{area.reasoning}</p>
                        </div>
                        {area.suggested_resources && area.suggested_resources.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Suggested Options:</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {area.suggested_resources.map((resource, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{resource}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Long-term Investments */}
            {roadmap.long_term && roadmap.long_term.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Future Investments</h3>
                <div className="grid gap-3">
                  {roadmap.long_term.map((investment, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium mb-2">{investment.investment}</p>
                            <p className="text-sm text-muted-foreground mb-2">{investment.reasoning}</p>
                            <Badge variant="secondary">{investment.timeline.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};