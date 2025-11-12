import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

type EmployeeCapability = {
  id: string;
  current_level: string;
  target_level: string;
  capability: {
    name: string;
  };
};

type CapabilityMasteryMeterProps = {
  capabilities: EmployeeCapability[];
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
  1: "Foundational",
  2: "Advancing",
  3: "Independent",
  4: "Mastery",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "text-blue-600 dark:text-blue-400",
  2: "text-green-600 dark:text-green-400",
  3: "text-orange-600 dark:text-orange-400",
  4: "text-purple-600 dark:text-purple-400",
};

export function CapabilityMasteryMeter({ capabilities }: CapabilityMasteryMeterProps) {
  if (capabilities.length === 0) return null;

  // Calculate average current level
  const normalizeLevel = (level: string): number => {
    const normalized = level.toLowerCase();
    return LEVEL_MAP[normalized] || 1.0;
  };

  const totalScore = capabilities.reduce((sum, cap) => {
    return sum + normalizeLevel(cap.current_level);
  }, 0);

  const averageScore = totalScore / capabilities.length;
  const percentage = ((averageScore - 1) / 3) * 100; // Convert 1-4 scale to 0-100%
  
  // Convert to 100-400 scale
  const displayScore = Math.round(averageScore * 100);
  const maxScore = 400;

  // Determine current stage label
  const currentStage = Math.floor(averageScore);
  const stageLabel = LEVEL_LABELS[currentStage] || "Developing";
  const stageColor = LEVEL_COLORS[currentStage] || "text-muted-foreground";

  // Count capabilities at each level
  const levelCounts = capabilities.reduce((acc, cap) => {
    const level = Math.floor(normalizeLevel(cap.current_level));
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Calculate target average
  const targetScore = capabilities.reduce((sum, cap) => {
    return sum + normalizeLevel(cap.target_level);
  }, 0) / capabilities.length;
  const displayTargetScore = Math.round(targetScore * 100);

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Your Capability Mastery Journey
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
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

        {/* Progress Bar with Level Markers */}
        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex justify-between text-xs">
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-blue-600 dark:text-blue-400">L1</span>
              <span className="text-muted-foreground">Foundational</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-green-600 dark:text-green-400">L2</span>
              <span className="text-muted-foreground">Advancing</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-orange-600 dark:text-orange-400">L3</span>
              <span className="text-muted-foreground">Independent</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-purple-600 dark:text-purple-400">L4</span>
              <span className="text-muted-foreground">Mastery</span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
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
      </CardContent>
    </Card>
  );
}
