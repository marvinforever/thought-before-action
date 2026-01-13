import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Clock, Lightbulb, ExternalLink, RefreshCw, FileText } from "lucide-react";
import { AddMyJobDescriptionDialog } from "@/components/AddMyJobDescriptionDialog";

interface AITask {
  task: string;
  current_time_hours: number;
  ai_solution: string;
  recommended_tool: string;
  estimated_time_after: number;
  hours_saved: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'full_automation' | 'augmentation' | 'human_inherent';
}

interface AIRecommendation {
  id: string;
  profile_id: string;
  recommendations: AITask[];
  priority_tasks: AITask[];
  recommended_tools: string[];
  estimated_weekly_hours_saved: number;
  ai_readiness_score: number;
  generated_at: string;
  mentioned_in_podcast: boolean;
}

export function AIProductivityTips() {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [addJdDialogOpen, setAddJdDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_ai_recommendations')
        .select('*')
        .eq('profile_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setRecommendation(data as unknown as AIRecommendation);
      }
    } catch (error) {
      console.error('Error loading AI recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First check if user has a job description - use profile_id as that's the FK
      const { data: jdCheck, error: jdError } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_current', true)
        .limit(1);

      if (jdError || !jdCheck || jdCheck.length === 0) {
        toast({
          title: "No job description found",
          description: "Please add a job description first to get AI productivity recommendations.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      toast({
        title: "Analyzing your role...",
        description: "Finding AI opportunities in your job description.",
      });

      const { error } = await supabase.functions.invoke('analyze-ai-efficiency', {
        body: { profileId: user.id },
      });

      if (error) throw error;

      toast({
        title: "Analysis complete!",
        description: "Your personalized AI productivity tips are ready.",
      });

      await loadRecommendations();
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Error generating recommendations",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getToolLink = (tool: string) => {
    const links: Record<string, string> = {
      'ChatGPT': 'https://chat.openai.com',
      'Claude': 'https://claude.ai',
      'Microsoft Copilot': 'https://copilot.microsoft.com',
      'Perplexity': 'https://perplexity.ai',
      'Notion AI': 'https://notion.so',
      'Grammarly': 'https://grammarly.com',
      'GitHub Copilot': 'https://github.com/features/copilot',
    };
    return links[tool] || '#';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Productivity Tips</CardTitle>
            </div>
            <CardDescription>
              Get personalized AI tool recommendations based on your role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={generateRecommendations} disabled={generating} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Get My AI Tips
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAddJdDialogOpen(true)} 
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              Add My Job Description
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Add your job description to unlock AI productivity recommendations
            </p>
          </CardContent>
        </Card>
        <AddMyJobDescriptionDialog
          open={addJdDialogOpen}
          onOpenChange={setAddJdDialogOpen}
          onSuccess={() => generateRecommendations()}
        />
      </>
    );
  }

  const priorityTasks = recommendation.priority_tasks || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Productivity Tips</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={generateRecommendations} disabled={generating}>
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Save up to {recommendation.estimated_weekly_hours_saved.toFixed(1)} hours/week
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {priorityTasks.slice(0, 3).map((task, idx) => (
          <div 
            key={idx} 
            className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setExpandedTip(expandedTip === idx ? null : idx)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{task.task}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${getDifficultyColor(task.difficulty)}`}>
                    {task.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-green-600 font-medium">Save {task.hours_saved.toFixed(1)}h/week</span>
                  <span>•</span>
                  <span>{task.recommended_tool}</span>
                </div>
              </div>
            </div>
            
            {expandedTip === idx && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <p className="text-sm">{task.ai_solution}</p>
                <a 
                  href={getToolLink(task.recommended_tool)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Try {task.recommended_tool}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        ))}

        {recommendation.recommended_tools && recommendation.recommended_tools.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recommended tools for you:</p>
            <div className="flex flex-wrap gap-1">
              {recommendation.recommended_tools.slice(0, 5).map((tool, idx) => (
                <a 
                  key={idx} 
                  href={getToolLink(tool)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                    {tool}
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
