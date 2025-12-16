import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, Sparkles, MessageCircle, Target, Zap, Award, Brain, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface OnboardingProgressCardProps {
  onOpenJericho?: () => void;
  className?: string;
}

const milestoneIcons: Record<string, React.ReactNode> = {
  jericho_chat: <MessageCircle className="h-4 w-4" />,
  vision: <Target className="h-4 w-4" />,
  habit: <Zap className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  achievement: <Award className="h-4 w-4" />,
  capability: <Brain className="h-4 w-4" />,
  resource: <BookOpen className="h-4 w-4" />,
};

export function OnboardingProgressCard({ onOpenJericho, className }: OnboardingProgressCardProps) {
  const { score, phase, milestones, loading } = useOnboardingProgress();
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Don't show if onboarding is complete
  if (phase === "complete") {
    return null;
  }

  const completedCount = milestones.filter(m => m.completed).length;
  const nextMilestone = milestones.find(m => !m.completed);

  return (
    <Card className={cn(
      "border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Get Started with Jericho
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Ring */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${(score / 100) * 226} 226`}
                strokeLinecap="round"
                className="text-primary transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{score}%</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {completedCount} of {milestones.length} milestones complete
            </p>
            <Progress value={score} className="h-2 mt-2" />
            {nextMilestone && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium text-foreground">Next up:</span> {nextMilestone.label}
              </p>
            )}
          </div>
        </div>

        {/* Milestones List */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  milestone.completed 
                    ? "bg-primary/10" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full",
                  milestone.completed 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {milestone.completed ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    milestoneIcons[milestone.id] || <Circle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    milestone.completed && "line-through text-muted-foreground"
                  )}>
                    {milestone.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {milestone.description}
                  </p>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  milestone.completed ? "text-primary" : "text-muted-foreground"
                )}>
                  +{milestone.points}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Quick Win Button */}
        {nextMilestone && nextMilestone.id === "jericho_chat" && onOpenJericho && (
          <Button 
            onClick={onOpenJericho}
            className="w-full mt-2"
            size="sm"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat with Jericho to Get Started
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
