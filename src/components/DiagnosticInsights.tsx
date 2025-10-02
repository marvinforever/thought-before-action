import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { JerichoChat } from "./JerichoChat";
import { 
  Brain, 
  TrendingUp, 
  Heart, 
  Users, 
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lightbulb,
  Sparkles,
  Loader2
} from "lucide-react";

type DiagnosticResponse = {
  confidence_score: number | null;
  role_clarity_score: number | null;
  work_life_integration_score: number | null;
  workload_status: string | null;
  sees_growth_path: boolean | null;
  manages_others: boolean | null;
  three_year_goal: string | null;
  twelve_month_growth_goal: string | null;
  natural_strength: string | null;
  growth_barrier: string | null;
  biggest_work_obstacle: string | null;
  skill_to_master: string | null;
  learning_preference: string | null;
  weekly_development_hours: number | null;
  burnout_frequency: string | null;
  work_life_sacrifice_frequency: string | null;
};

export default function DiagnosticInsights() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [jerichoOpen, setJerichoOpen] = useState(false);
  const [jerichoContext, setJerichoContext] = useState<{message?: string, type?: string}>({});
  const { toast } = useToast();

  useEffect(() => {
    loadDiagnostic();
  }, []);

  const loadDiagnostic = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diagnostic_responses")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setDiagnostic(data);
    } catch (error: any) {
      console.error("Error loading diagnostic:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetHelp = (area: string) => {
    const contextMessages = {
      role_clarity: "I'm struggling with understanding my role clearly. Can you help me think through this?",
      confidence: "I'm feeling uncertain about my direction. Can we talk through this?",
      work_life_balance: "I need help with my work-life balance. What should I be thinking about?",
      burnout_risk: "I'm concerned about burnout. Can you help me develop a plan?",
    };

    setJerichoContext({
      message: contextMessages[area as keyof typeof contextMessages] || "I need some help with my career development.",
      type: area,
    });
    setJerichoOpen(true);
  };

  if (loading) return null;
  if (!diagnostic) return null;

  const calculateBurnoutRisk = () => {
    const scores: number[] = [];

    // Score workload status (0-100)
    if (diagnostic.workload_status) {
      const lower = diagnostic.workload_status.toLowerCase();
      if (lower.includes('very manageable') || lower.includes('light')) scores.push(10);
      else if (lower.includes('manageable') || lower.includes('balanced')) scores.push(30);
      else if (lower.includes('stretched') || lower.includes('busy')) scores.push(55);
      else if (lower.includes('somewhat overwhelming') || lower.includes('challenging')) scores.push(70);
      else if (lower.includes('very overwhelming') || lower.includes('unsustainable')) scores.push(90);
    }

    // Score burnout frequency (0-100)
    if (diagnostic.burnout_frequency) {
      const lower = diagnostic.burnout_frequency.toLowerCase();
      if (lower.includes('never')) scores.push(5);
      else if (lower.includes('rarely')) scores.push(20);
      else if (lower.includes('occasionally')) scores.push(50);
      else if (lower.includes('frequently')) scores.push(75);
      else if (lower.includes('constantly')) scores.push(95);
    }

    // Score work-life sacrifice frequency (0-100)
    if (diagnostic.work_life_sacrifice_frequency) {
      const lower = diagnostic.work_life_sacrifice_frequency.toLowerCase();
      if (lower.includes('never')) scores.push(5);
      else if (lower.includes('rarely')) scores.push(20);
      else if (lower.includes('occasionally')) scores.push(50);
      else if (lower.includes('frequently')) scores.push(75);
      else if (lower.includes('constantly')) scores.push(95);
    }

    if (scores.length === 0) return null;

    // Calculate simple average
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Map to risk levels with colors
    if (average <= 25) return { level: 'Low', color: 'text-green-500', bgColor: 'bg-green-500', value: average };
    if (average <= 50) return { level: 'Moderate', color: 'text-yellow-500', bgColor: 'bg-yellow-500', value: average };
    if (average <= 75) return { level: 'High', color: 'text-orange-500', bgColor: 'bg-orange-500', value: average };
    return { level: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500', value: average };
  };

  const burnoutInfo = calculateBurnoutRisk();

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          My Personal Insights
        </CardTitle>
        <CardDescription>
          These scores reflect your responses from the diagnostic survey, helping identify areas of strength and opportunities for growth
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {diagnostic.role_clarity_score !== null && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium">Role Clarity</span>
                </div>
                <Progress value={diagnostic.role_clarity_score * 10} className="mb-2" />
                <p className="text-2xl font-bold">{diagnostic.role_clarity_score}/10</p>
                {diagnostic.role_clarity_score < 7 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => handleGetHelp('role_clarity')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Get Help
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {diagnostic.confidence_score !== null && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">Certainty</span>
                </div>
                <Progress value={diagnostic.confidence_score * 10} className="mb-2" />
                <p className="text-2xl font-bold">{diagnostic.confidence_score}/10</p>
                {diagnostic.confidence_score < 7 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => handleGetHelp('confidence')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Get Help
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {diagnostic.work_life_integration_score !== null && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium">Work-Life Balance</span>
                </div>
                <Progress value={diagnostic.work_life_integration_score * 10} className="mb-2" />
                <p className="text-2xl font-bold">{diagnostic.work_life_integration_score}/10</p>
                {diagnostic.work_life_integration_score < 7 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => handleGetHelp('work_life_balance')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Get Help
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {burnoutInfo && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`h-4 w-4 ${burnoutInfo.color}`} />
                  <span className="text-xs font-medium">Burnout Risk</span>
                </div>
                <Progress value={burnoutInfo.value} className="mb-2" />
                <p className="text-sm font-semibold">{burnoutInfo.level}</p>
                {burnoutInfo.value > 50 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => handleGetHelp('burnout_risk')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Get Help
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>


        {/* Goals & Focus Areas */}
        <div className="grid gap-4 md:grid-cols-2">
          {diagnostic.three_year_goal && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                3-Year Goal
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {diagnostic.three_year_goal}
              </p>
            </div>
          )}

          {diagnostic.twelve_month_growth_goal && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                12-Month Growth Goal
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {diagnostic.twelve_month_growth_goal}
              </p>
            </div>
          )}

          {diagnostic.natural_strength && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Natural Strength
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {diagnostic.natural_strength}
              </p>
            </div>
          )}

          {diagnostic.skill_to_master && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Skill to Master
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {diagnostic.skill_to_master}
              </p>
            </div>
          )}
        </div>

        {/* Barriers & Obstacles */}
        {(diagnostic.growth_barrier || diagnostic.biggest_work_obstacle) && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Areas Needing Support
            </h4>
            <div className="space-y-2">
              {diagnostic.growth_barrier && (
                <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md border border-orange-200 dark:border-orange-900">
                  <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">Growth Barrier</p>
                  <p className="text-sm text-orange-800 dark:text-orange-300">{diagnostic.growth_barrier}</p>
                </div>
              )}
              {diagnostic.biggest_work_obstacle && (
                <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md border border-orange-200 dark:border-orange-900">
                  <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">Work Obstacle</p>
                  <p className="text-sm text-orange-800 dark:text-orange-300">{diagnostic.biggest_work_obstacle}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>

      <JerichoChat
        isOpen={jerichoOpen}
        onClose={() => setJerichoOpen(false)}
        initialMessage={jerichoContext.message}
        contextType={jerichoContext.type}
      />
    </Card>
  );
}
