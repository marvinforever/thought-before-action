import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Calendar,
  ChevronRight
} from "lucide-react";
import { useCareerPath, PromotionReadiness } from "@/hooks/useCareerPath";
import { format } from "date-fns";

interface PromotionReadinessCardProps {
  profileId: string;
  onViewRoadmap?: () => void;
  onGeneratePath?: () => void;
}

const getReadinessColor = (pct: number | null) => {
  if (!pct) return "bg-muted";
  if (pct >= 80) return "bg-green-500";
  if (pct >= 60) return "bg-yellow-500";
  if (pct >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const getReadinessLabel = (pct: number | null) => {
  if (!pct) return "Not Assessed";
  if (pct >= 80) return "Ready";
  if (pct >= 60) return "Almost Ready";
  if (pct >= 40) return "On Track";
  return "Building Foundation";
};

export function PromotionReadinessCard({ 
  profileId, 
  onViewRoadmap,
  onGeneratePath 
}: PromotionReadinessCardProps) {
  const { loading, readiness, loadPromotionReadiness, generating, generateCareerPath } = useCareerPath();

  useEffect(() => {
    if (profileId) {
      loadPromotionReadiness(profileId);
    }
  }, [profileId]);

  const handleGeneratePath = async () => {
    await generateCareerPath(profileId);
    onGeneratePath?.();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!readiness) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Career Path Not Generated</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Generate your personalized career path to see promotion readiness and development roadmap.
              </p>
            </div>
            <Button onClick={handleGeneratePath} disabled={generating}>
              {generating ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Career Path
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallPct = readiness.overall_readiness_pct || 0;
  const capabilityPct = readiness.capability_readiness_pct || 0;
  const experiencePct = readiness.experience_readiness_pct || 0;
  const performancePct = readiness.performance_readiness_pct || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Promotion Readiness
            </CardTitle>
            <CardDescription className="mt-1">
              Target: <span className="font-medium text-foreground">{readiness.target_role}</span>
            </CardDescription>
          </div>
          <Badge className={getReadinessColor(overallPct)}>
            {getReadinessLabel(overallPct)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Readiness Score */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Readiness</span>
            <span className="text-2xl font-bold">{overallPct}%</span>
          </div>
          <Progress 
            value={overallPct} 
            className="h-3"
            indicatorClassName={getReadinessColor(overallPct)}
          />
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{capabilityPct}%</div>
            <div className="text-xs text-muted-foreground">Capabilities</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{experiencePct}%</div>
            <div className="text-xs text-muted-foreground">Track Record</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{performancePct}%</div>
            <div className="text-xs text-muted-foreground">Consistency</div>
          </div>
        </div>

        {/* Estimated Ready Date */}
        {readiness.estimated_ready_date && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm">
              Estimated ready by:{" "}
              <span className="font-semibold">
                {format(new Date(readiness.estimated_ready_date), "MMMM yyyy")}
              </span>
            </span>
          </div>
        )}

        {/* Key Gaps */}
        {readiness.capability_gaps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Key Gaps
            </h4>
            <div className="space-y-1.5">
              {readiness.capability_gaps.slice(0, 3).map((gap: any, idx: number) => (
                <div 
                  key={idx} 
                  className="text-sm flex items-center justify-between p-2 rounded bg-muted/30"
                >
                  <span>{gap.capability}</span>
                  <Badge variant="outline" className="text-xs">
                    {gap.severity}
                  </Badge>
                </div>
              ))}
              {readiness.capability_gaps.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{readiness.capability_gaps.length - 3} more gaps
                </p>
              )}
            </div>
          </div>
        )}

        {/* Strengths */}
        {readiness.strengths.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Strengths
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {readiness.strengths.slice(0, 5).map((strength: any, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {strength.capability}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleGeneratePath}
            disabled={generating}
          >
            {generating ? "Refreshing..." : "Refresh Analysis"}
          </Button>
          {onViewRoadmap && (
            <Button size="sm" className="flex-1" onClick={onViewRoadmap}>
              View Roadmap
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Last assessed */}
        {readiness.assessed_at && (
          <p className="text-xs text-muted-foreground text-center">
            Last assessed: {format(new Date(readiness.assessed_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
