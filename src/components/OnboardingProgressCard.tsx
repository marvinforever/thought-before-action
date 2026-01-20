import { useOnboardingProgress, OnboardingMilestone } from "@/hooks/useOnboardingProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, Sparkles, MessageCircle, Target, Zap, Award, Brain, BookOpen, ClipboardCheck, Play, Video, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TutorialVideoDialog } from "./TutorialVideoDialog";
import { useNavigate, useLocation } from "react-router-dom";

interface OnboardingProgressCardProps {
  onOpenJericho?: () => void;
  onStartFirstDailyBrief?: () => void;
  className?: string;
}

const milestoneIcons: Record<string, React.ReactNode> = {
  first_daily_brief: <Play className="h-4 w-4" />,
  jericho_chat: <MessageCircle className="h-4 w-4" />,
  diagnostic: <ClipboardCheck className="h-4 w-4" />,
  vision: <Target className="h-4 w-4" />,
  habit: <Zap className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  achievement: <Award className="h-4 w-4" />,
  capability: <Brain className="h-4 w-4" />,
  resource: <BookOpen className="h-4 w-4" />,
};

export function OnboardingProgressCard({ onOpenJericho, onStartFirstDailyBrief, className }: OnboardingProgressCardProps) {
  const { score, milestones, loading } = useOnboardingProgress();
  const [expanded, setExpanded] = useState(true);
  const [videoDialog, setVideoDialog] = useState<{
    open: boolean;
    milestone: OnboardingMilestone | null;
  }>({ open: false, milestone: null });
  const navigate = useNavigate();
  const location = useLocation();

  const handleMilestoneClick = (milestone: OnboardingMilestone) => {
    // For first daily brief, use the special action if not completed
    if (milestone.id === 'first_daily_brief' && !milestone.completed && onStartFirstDailyBrief) {
      onStartFirstDailyBrief();
      return;
    }

    // For jericho_chat and diagnostic, open Jericho chat
    if ((milestone.id === 'jericho_chat' || milestone.id === 'diagnostic') && onOpenJericho) {
      // If we're not on my-growth-plan, navigate there first
      if (location.pathname !== '/dashboard/my-growth-plan') {
        navigate('/dashboard/my-growth-plan');
        // Give time for navigation, then trigger Jericho
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openJericho'));
        }, 100);
      } else {
        onOpenJericho();
      }
      return;
    }

    // For items with routes, navigate to that route
    if (milestone.route) {
      const [path, hash] = milestone.route.split('#');
      
      // Ensure path starts with /dashboard for safety
      const safePath = path.startsWith('/dashboard') ? path : `/dashboard${path}`;
      
      // If we're already on the same page, just scroll to the element
      if (location.pathname === safePath && hash) {
        const element = document.querySelector(`[data-onboarding="${hash}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a brief highlight effect
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
        return;
      }
      
      // Navigate to the route
      navigate(safePath, { replace: false });
      
      // If there's a hash, scroll to it after navigation
      if (hash) {
        setTimeout(() => {
          const element = document.querySelector(`[data-onboarding="${hash}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 300);
      }
      return;
    }

    // For incomplete items without special handling, show tutorial video
    if (!milestone.completed) {
      setVideoDialog({ open: true, milestone });
    }
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Don't show if onboarding is truly complete (score >= 100)
  if (score >= 100) {
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
            {milestones.map((milestone) => {
              const isFirstBrief = milestone.id === 'first_daily_brief';

              return (
                <div
                  key={milestone.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer",
                    milestone.completed
                      ? "bg-primary/10 hover:bg-primary/15"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMilestoneClick(milestone)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleMilestoneClick(milestone);
                  }}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
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
                      milestone.completed && "text-muted-foreground"
                    )}>
                      {milestone.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {milestone.description}
                    </p>
                  </div>

                  {isFirstBrief && !milestone.completed && onStartFirstDailyBrief ? (
                    <Button size="sm" variant="secondary" onClick={(e) => {
                      e.stopPropagation();
                      onStartFirstDailyBrief();
                    }}>
                      Start
                    </Button>
                  ) : milestone.completed ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-primary">
                        +{milestone.points}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tutorial Video Dialog */}
        <TutorialVideoDialog
          open={videoDialog.open}
          onOpenChange={(open) => setVideoDialog({ open, milestone: videoDialog.milestone })}
          title={videoDialog.milestone?.label || ""}
          description={videoDialog.milestone?.description || ""}
          videoUrl={videoDialog.milestone?.videoUrl}
        />

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
