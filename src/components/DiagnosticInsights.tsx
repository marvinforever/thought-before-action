import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  Heart, 
  Users, 
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lightbulb
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
};

export default function DiagnosticInsights() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;
  if (!diagnostic) return null;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          My Personal Insights
        </CardTitle>
        <CardDescription>
          Based on your diagnostic assessment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          {diagnostic.confidence_score !== null && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">Confidence</span>
                </div>
                <Progress value={diagnostic.confidence_score * 10} className="mb-2" />
                <p className="text-2xl font-bold">{diagnostic.confidence_score}/10</p>
              </CardContent>
            </Card>
          )}

          {diagnostic.role_clarity_score !== null && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium">Role Clarity</span>
                </div>
                <Progress value={diagnostic.role_clarity_score * 10} className="mb-2" />
                <p className="text-2xl font-bold">{diagnostic.role_clarity_score}/10</p>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {diagnostic.workload_status && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Workload: {diagnostic.workload_status}
            </Badge>
          )}
          {diagnostic.sees_growth_path !== null && (
            <Badge variant={diagnostic.sees_growth_path ? "default" : "secondary"} className="gap-1">
              {diagnostic.sees_growth_path ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {diagnostic.sees_growth_path ? "Clear Growth Path" : "Unclear Growth Path"}
            </Badge>
          )}
          {diagnostic.manages_others && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              Manages Others
            </Badge>
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

        {/* Learning Info */}
        {(diagnostic.learning_preference || diagnostic.weekly_development_hours !== null) && (
          <div className="bg-muted/30 p-4 rounded-md">
            <h4 className="text-sm font-semibold mb-3">Learning Preferences</h4>
            <div className="flex flex-wrap gap-4">
              {diagnostic.learning_preference && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred Learning Style</p>
                  <Badge variant="secondary">{diagnostic.learning_preference}</Badge>
                </div>
              )}
              {diagnostic.weekly_development_hours !== null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weekly Development Hours</p>
                  <Badge variant="secondary">{diagnostic.weekly_development_hours} hours</Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
