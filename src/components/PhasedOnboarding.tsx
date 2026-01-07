import { useState, useEffect } from "react";
import { useOnboardingProgress, OnboardingMilestone } from "@/hooks/useOnboardingProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Sparkles, Play, MessageCircle, Target, Zap, Award, Brain, BookOpen, ClipboardCheck, Rocket, Map, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorialVideoDialog } from "./TutorialVideoDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface PhasedOnboardingProps {
  onOpenJericho?: () => void;
  onStartFirstDailyBrief?: () => void;
  className?: string;
  isPreview?: boolean;
}

interface Phase {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  milestoneIds: string[];
}

const phases: Phase[] = [
  {
    id: "define",
    name: "Define Your Path",
    tagline: "Set your direction",
    icon: <Map className="h-4 w-4" />,
    milestoneIds: ["diagnostic", "vision"],
  },
  {
    id: "acquainted",
    name: "Get Acquainted",
    tagline: "Meet your AI coach",
    icon: <Rocket className="h-4 w-4" />,
    milestoneIds: ["first_daily_brief", "jericho_chat"],
  },
  {
    id: "momentum",
    name: "Build Momentum",
    tagline: "Take action",
    icon: <Trophy className="h-4 w-4" />,
    milestoneIds: ["goal", "habit", "achievement", "capability", "resource"],
  },
];

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

export function PhasedOnboarding({ onOpenJericho, onStartFirstDailyBrief, className, isPreview = false }: PhasedOnboardingProps) {
  const progressData = useOnboardingProgress();
  const [previewCompletedIds, setPreviewCompletedIds] = useState<Set<string>>(new Set());
  
  // In preview mode, use local state for milestone completion
  const milestones = isPreview 
    ? progressData.milestones.map(m => ({ ...m, completed: previewCompletedIds.has(m.id) }))
    : progressData.milestones;
  const score = isPreview 
    ? milestones.filter(m => m.completed).reduce((sum, m) => sum + m.points, 0)
    : progressData.score;
  const loading = isPreview ? false : progressData.loading;

  const [videoDialog, setVideoDialog] = useState<{
    open: boolean;
    milestone: OnboardingMilestone | null;
  }>({ open: false, milestone: null });
  const [celebratingPhase, setCelebratingPhase] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current phase based on completion
  const getCurrentPhase = () => {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseMilestones = milestones.filter(m => phase.milestoneIds.includes(m.id));
      const allComplete = phaseMilestones.every(m => m.completed);
      if (!allComplete) return i;
    }
    return phases.length - 1; // All complete, show last phase
  };

  const currentPhaseIndex = getCurrentPhase();
  const currentPhase = phases[currentPhaseIndex];

  // Get milestones for current phase
  const currentPhaseMilestones = milestones.filter(m => 
    currentPhase.milestoneIds.includes(m.id)
  );

  const completedInPhase = currentPhaseMilestones.filter(m => m.completed).length;
  const totalInPhase = currentPhaseMilestones.length;
  const phaseProgress = (completedInPhase / totalInPhase) * 100;

  // Check if phase just completed
  useEffect(() => {
    if (completedInPhase === totalInPhase && totalInPhase > 0 && currentPhaseIndex < phases.length - 1) {
      setCelebratingPhase(currentPhase.id);
      const timer = setTimeout(() => setCelebratingPhase(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [completedInPhase, totalInPhase, currentPhaseIndex, currentPhase.id]);

  const handleMilestoneClick = (milestone: OnboardingMilestone) => {
    // For milestones with videos, show the video dialog (works in both preview and normal mode)
    if (milestone.videoUrl && !milestone.completed) {
      setVideoDialog({ open: true, milestone });
      return;
    }

    // In preview mode, navigate to routes but don't trigger special actions
    if (isPreview) {
      if (milestone.route) {
        const [path] = milestone.route.split('#');
        navigate(path);
      }
      return;
    }

    if (milestone.id === 'first_daily_brief' && !milestone.completed && onStartFirstDailyBrief) {
      onStartFirstDailyBrief();
      return;
    }

    if ((milestone.id === 'jericho_chat' || milestone.id === 'diagnostic') && onOpenJericho) {
      if (location.pathname !== '/my-growth-plan') {
        navigate('/my-growth-plan');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openJericho'));
        }, 100);
      } else {
        onOpenJericho();
      }
      return;
    }

    if (milestone.route) {
      const [path, hash] = milestone.route.split('#');
      
      if (location.pathname === path && hash) {
        const element = document.querySelector(`[data-onboarding="${hash}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
        return;
      }
      
      navigate(path);
      
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
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Don't show if onboarding is complete
  if (score >= 100) {
    return null;
  }

  const nextMilestone = currentPhaseMilestones.find(m => !m.completed);

  return (
    <Card className={cn(
      "border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden relative",
      className
    )}>
      {/* Phase celebration overlay */}
      <AnimatePresence>
        {celebratingPhase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/20 backdrop-blur-sm z-10 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-center"
            >
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-lg font-bold">Phase Complete!</p>
              <p className="text-sm text-muted-foreground">Unlocking next phase...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardContent className="p-5">
        {/* Phase Slider */}
        <div className="flex items-center justify-between mb-4">
          {phases.map((phase, index) => {
            const phaseMilestones = milestones.filter(m => phase.milestoneIds.includes(m.id));
            const isComplete = phaseMilestones.every(m => m.completed);
            const isCurrent = index === currentPhaseIndex;
            const isLocked = index > currentPhaseIndex;

            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                  isCurrent && "bg-primary text-primary-foreground",
                  isComplete && !isCurrent && "bg-primary/20 text-primary",
                  isLocked && "bg-muted text-muted-foreground opacity-50"
                )}>
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    phase.icon
                  )}
                  <span className="text-xs font-medium hidden sm:inline">{phase.name}</span>
                  <span className="text-xs font-medium sm:hidden">{index + 1}</span>
                </div>
                {index < phases.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-2",
                    isComplete ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Phase Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{currentPhase.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{currentPhase.tagline}</p>
          
          {/* Phase Progress Bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${phaseProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {completedInPhase}/{totalInPhase}
            </span>
          </div>
        </div>

        {/* Current Phase Milestones */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {currentPhaseMilestones.map((milestone, index) => {
              const isFirstBrief = milestone.id === 'first_daily_brief';
              const isNext = milestone === nextMilestone;

              return (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer",
                    milestone.completed
                      ? "bg-primary/10"
                      : isNext
                        ? "bg-accent/50 ring-1 ring-primary/30"
                        : "bg-muted/30 hover:bg-muted/50"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMilestoneClick(milestone)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleMilestoneClick(milestone);
                  }}
                >
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-all",
                    milestone.completed
                      ? "bg-primary text-primary-foreground"
                      : isNext
                        ? "bg-primary/20 text-primary ring-2 ring-primary/30"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {milestone.completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      milestoneIcons[milestone.id]
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      milestone.completed && "text-muted-foreground line-through"
                    )}>
                      {milestone.label}
                    </p>
                    {isNext && !milestone.completed && (
                      <p className="text-xs text-primary font-medium">← Start here</p>
                    )}
                  </div>

                  {isFirstBrief && !milestone.completed && onStartFirstDailyBrief ? (
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartFirstDailyBrief();
                      }}
                      className="shrink-0"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  ) : milestone.completed ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Preview of next phase */}
        {currentPhaseIndex < phases.length - 1 && (
          <div className="mt-4 pt-3 border-t border-dashed border-muted-foreground/20">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="opacity-50">Up next:</span>
              {phases[currentPhaseIndex + 1].icon}
              <span className="font-medium">{phases[currentPhaseIndex + 1].name}</span>
              <span className="opacity-50">— {phases[currentPhaseIndex + 1].tagline}</span>
            </p>
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
      </CardContent>
    </Card>
  );
}
