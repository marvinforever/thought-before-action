import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Target, Zap, Calendar, Sparkles } from "lucide-react";

interface Sprint {
  week: number;
  focus: string;
  completed?: boolean;
}

interface Capability {
  id: string;
  current_level: string | null;
  target_level: string | null;
  capabilities: {
    name: string;
    description: string | null;
    category: string | null;
  } | null;
}

interface NinetyDayTarget {
  id: string;
  goal_text: string | null;
  completed: boolean | null;
  sprints: any;
  category: string;
}

interface TimelineSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: 'today' | '90days' | '1year' | '3years';
  capabilities?: Capability[];
  currentTargets?: NinetyDayTarget[];
  completedTargets?: NinetyDayTarget[];
  oneYearVision?: string | null;
  threeYearVision?: string | null;
}

export function TimelineSectionDialog({
  open,
  onOpenChange,
  section,
  capabilities = [],
  currentTargets = [],
  completedTargets = [],
  oneYearVision,
  threeYearVision,
}: TimelineSectionDialogProps) {
  const getSectionTitle = () => {
    switch (section) {
      case 'today': return 'Today - Current State';
      case '90days': return '90 Days - Goals Progress';
      case '1year': return '1 Year Vision';
      case '3years': return '3 Year Vision';
    }
  };

  const getSectionIcon = () => {
    switch (section) {
      case 'today': return <Zap className="h-5 w-5 text-primary" />;
      case '90days': return <Target className="h-5 w-5 text-accent" />;
      case '1year': return <Calendar className="h-5 w-5 text-blue-500" />;
      case '3years': return <Sparkles className="h-5 w-5 text-primary" />;
    }
  };

  // Extract all sprints from current targets
  const getAllSprints = () => {
    const sprints: { sprint: Sprint; goalText: string }[] = [];
    currentTargets.forEach(target => {
      if (target.sprints && Array.isArray(target.sprints)) {
        target.sprints.forEach((sprint: Sprint) => {
          sprints.push({
            sprint,
            goalText: target.goal_text || ''
          });
        });
      }
    });
    return sprints;
  };

  const renderTodayContent = () => {
    const sprints = getAllSprints();
    
    return (
      <div className="space-y-6">
        {/* Active Sprints */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Active Sprints
          </h3>
          {sprints.length > 0 ? (
            <div className="space-y-2">
              {sprints.map((item, idx) => (
                <div key={idx} className="bg-primary/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-primary/20 px-2 py-0.5 rounded">
                      Week {item.sprint.week}
                    </span>
                    {item.sprint.completed && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm">{item.sprint.focus}</p>
                  <p className="text-xs text-muted-foreground mt-1">From: {item.goalText}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No active sprints defined yet.</p>
          )}
        </div>

        {/* Current Capabilities */}
        <div className="space-y-3">
          <h3 className="font-semibold">Current Capability Levels</h3>
          {capabilities.length > 0 ? (
            <div className="space-y-2">
              {capabilities.map((cap) => (
                <div key={cap.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{cap.capabilities?.name}</p>
                    <p className="text-xs text-muted-foreground">{cap.capabilities?.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium capitalize px-2 py-1 bg-primary/10 rounded">
                      {cap.current_level || 'Not set'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No capabilities assigned yet.</p>
          )}
        </div>
      </div>
    );
  };

  const render90DaysContent = () => {
    return (
      <div className="space-y-6">
        {/* Completed Goals */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Completed Goals ({completedTargets.length})
          </h3>
          {completedTargets.length > 0 ? (
            <div className="space-y-2">
              {completedTargets.map((target) => (
                <div key={target.id} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm">{target.goal_text}</p>
                      <span className="text-xs text-muted-foreground capitalize">{target.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No completed goals yet. Keep pushing!</p>
          )}
        </div>

        {/* In Progress Goals */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            In Progress ({currentTargets.length})
          </h3>
          {currentTargets.length > 0 ? (
            <div className="space-y-2">
              {currentTargets.map((target) => (
                <div key={target.id} className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm">{target.goal_text}</p>
                      <span className="text-xs text-muted-foreground capitalize">{target.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No goals in progress.</p>
          )}
        </div>
      </div>
    );
  };

  const render1YearContent = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Your 1-Year Vision</h3>
        {oneYearVision ? (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{oneYearVision}</p>
          </div>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground italic">
              You haven't set your 1-year vision yet. Define where you want to be in one year!
            </p>
          </div>
        )}
      </div>
    );
  };

  const render3YearsContent = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Your 3-Year Dream Role</h3>
        {threeYearVision ? (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{threeYearVision}</p>
          </div>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground italic">
              You haven't set your 3-year vision yet. Dream big about your future!
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (section) {
      case 'today': return renderTodayContent();
      case '90days': return render90DaysContent();
      case '1year': return render1YearContent();
      case '3years': return render3YearsContent();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getSectionIcon()}
            {getSectionTitle()}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          {renderContent()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
