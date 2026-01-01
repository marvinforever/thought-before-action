import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2 } from "lucide-react";

type OrganizationalCapabilityScoreProps = {
  capabilities: Array<{
    current_level: string;
    target_level: string;
  }>;
  title?: string;
  showBreakdown?: boolean;
  variant?: "full" | "compact";
};

const LEVEL_MAP: Record<string, number> = {
  foundational: 1.0,
  beginner: 1.0,
  advancing: 2.0,
  intermediate: 2.0,
  independent: 3.0,
  advanced: 3.0,
  established: 3.0,
  mastery: 4.0,
  expert: 4.0,
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
  4: "Level 4",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "text-blue-600 dark:text-blue-400",
  2: "text-green-600 dark:text-green-400",
  3: "text-orange-600 dark:text-orange-400",
  4: "text-purple-600 dark:text-purple-400",
};

export function OrganizationalCapabilityScore({ 
  capabilities, 
  title = "Organizational Capability Score",
  showBreakdown = true,
  variant = "full"
}: OrganizationalCapabilityScoreProps) {
  if (capabilities.length === 0) return null;

  const normalizeLevel = (level: string): number => {
    const normalized = level.toLowerCase();
    return LEVEL_MAP[normalized] || 1.0;
  };

  const totalScore = capabilities.reduce((sum, cap) => {
    return sum + normalizeLevel(cap.current_level);
  }, 0);

  const averageScore = totalScore / capabilities.length;
  const percentage = ((averageScore - 1) / 3) * 100;
  
  const displayScore = Math.round(averageScore * 100);
  const maxScore = 400;

  const currentStage = Math.floor(averageScore);
  const stageLabel = LEVEL_LABELS[currentStage] || "Developing";
  const stageColor = LEVEL_COLORS[currentStage] || "text-muted-foreground";

  const levelCounts = capabilities.reduce((acc, cap) => {
    const level = Math.floor(normalizeLevel(cap.current_level));
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const targetScore = capabilities.reduce((sum, cap) => {
    return sum + normalizeLevel(cap.target_level);
  }, 0) / capabilities.length;
  const displayTargetScore = Math.round(targetScore * 100);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-primary/5 to-background rounded-lg border">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Group Score</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${stageColor}`}>
                {displayScore}
              </span>
              <span className="text-sm text-muted-foreground">/ {maxScore}</span>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <Progress value={percentage} className="h-2" />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="text-xl font-semibold text-primary">{displayTargetScore}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${stageColor}`}>
                {displayScore}
              </span>
              <span className="text-2xl text-muted-foreground font-medium">/ {maxScore}</span>
            </div>
            <Badge variant="outline" className="mt-2">
              {stageLabel}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Target Score</p>
            <p className="text-3xl font-semibold text-primary">{displayTargetScore}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex justify-between text-xs">
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-blue-600 dark:text-blue-400">Level 1</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-green-600 dark:text-green-400">Level 2</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-orange-600 dark:text-orange-400">Level 3</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-purple-600 dark:text-purple-400">Level 4</span>
            </div>
          </div>
        </div>

        {showBreakdown && (
          <div className="grid grid-cols-4 gap-2 pt-2 border-t">
            {[1, 2, 3, 4].map((level) => (
              <div key={level} className="text-center">
                <p className={`text-xl font-bold ${LEVEL_COLORS[level]}`}>
                  {levelCounts[level] || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {LEVEL_LABELS[level]}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
