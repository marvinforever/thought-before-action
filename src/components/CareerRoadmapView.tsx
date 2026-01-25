import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Rocket, 
  Target, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  ChevronRight,
  Sparkles,
  Flag
} from "lucide-react";
import { useCareerPath, CareerRoadmap } from "@/hooks/useCareerPath";
import { format, addDays } from "date-fns";

interface CareerRoadmapViewProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRoadmap?: CareerRoadmap | null;
}

interface RoadmapPhase {
  name: string;
  duration_days: number;
  focus_capabilities: string[];
  milestones: Array<{
    milestone: string;
    measurable: string;
    target_date_offset_days: number;
  }>;
  resources: string[];
}

const PHASE_COLORS = {
  phase1: { bg: "bg-blue-500/10", border: "border-blue-500", dot: "bg-blue-500" },
  phase2: { bg: "bg-green-500/10", border: "border-green-500", dot: "bg-green-500" },
  phase3: { bg: "bg-orange-500/10", border: "border-orange-500", dot: "bg-orange-500" },
  phase4: { bg: "bg-purple-500/10", border: "border-purple-500", dot: "bg-purple-500" },
};

const PHASE_ICONS = {
  phase1: <Rocket className="h-4 w-4" />,
  phase2: <TrendingUp className="h-4 w-4" />,
  phase3: <Target className="h-4 w-4" />,
  phase4: <Flag className="h-4 w-4" />,
};

export function CareerRoadmapView({ 
  profileId, 
  open, 
  onOpenChange,
  initialRoadmap 
}: CareerRoadmapViewProps) {
  const { loading, roadmap: fetchedRoadmap, generateCareerPath, generating } = useCareerPath();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  
  const roadmap = initialRoadmap || fetchedRoadmap;
  const phases = roadmap?.roadmap?.roadmap || {};

  const handleGeneratePath = async () => {
    await generateCareerPath(profileId);
  };

  const getPhaseStartDate = (phaseKey: string): Date => {
    const today = new Date();
    let offsetDays = 0;
    
    if (phaseKey === "phase2") offsetDays = phases.phase1?.duration_days || 90;
    if (phaseKey === "phase3") offsetDays = (phases.phase1?.duration_days || 90) + (phases.phase2?.duration_days || 90);
    if (phaseKey === "phase4") offsetDays = (phases.phase1?.duration_days || 90) + (phases.phase2?.duration_days || 90) + (phases.phase3?.duration_days || 180);
    
    return addDays(today, offsetDays);
  };

  const renderPhaseCard = (phaseKey: string, phase: RoadmapPhase | undefined) => {
    if (!phase) return null;
    
    const colors = PHASE_COLORS[phaseKey as keyof typeof PHASE_COLORS];
    const icon = PHASE_ICONS[phaseKey as keyof typeof PHASE_ICONS];
    const startDate = getPhaseStartDate(phaseKey);
    const endDate = addDays(startDate, phase.duration_days);
    
    return (
      <Card 
        key={phaseKey}
        className={`cursor-pointer transition-all hover:shadow-md ${colors.border} border-l-4 ${selectedPhase === phaseKey ? 'ring-2 ring-primary' : ''}`}
        onClick={() => setSelectedPhase(selectedPhase === phaseKey ? null : phaseKey)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${colors.bg}`}>
                {icon}
              </div>
              <div>
                <CardTitle className="text-base">{phase.name}</CardTitle>
                <CardDescription className="text-xs">
                  {format(startDate, "MMM yyyy")} - {format(endDate, "MMM yyyy")}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {phase.duration_days} days
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Focus Capabilities */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Focus Areas</p>
            <div className="flex flex-wrap gap-1">
              {phase.focus_capabilities?.slice(0, 3).map((cap, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {cap}
                </Badge>
              ))}
              {(phase.focus_capabilities?.length || 0) > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{phase.focus_capabilities.length - 3}
                </Badge>
              )}
            </div>
          </div>

          {/* Milestones Preview */}
          {phase.milestones?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {phase.milestones.length} Milestones
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {phase.milestones[0]?.milestone}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedPhase === phaseKey ? 'rotate-90' : ''}`} />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPhaseDetails = (phaseKey: string, phase: RoadmapPhase) => {
    const colors = PHASE_COLORS[phaseKey as keyof typeof PHASE_COLORS];
    const startDate = getPhaseStartDate(phaseKey);
    
    return (
      <Card className={`${colors.bg} border-none`}>
        <CardHeader>
          <CardTitle className="text-lg">{phase.name} Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Milestones */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Milestones
            </h4>
            <div className="space-y-2">
              {phase.milestones?.map((milestone, idx) => {
                const targetDate = addDays(startDate, milestone.target_date_offset_days);
                return (
                  <div key={idx} className="p-3 rounded-lg bg-background/80 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{milestone.milestone}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(targetDate, "MMM d")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Measure:</span> {milestone.measurable}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resources */}
          {phase.resources?.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Recommended Resources
              </h4>
              <div className="space-y-1">
                {phase.resources.map((resource, idx) => (
                  <div key={idx} className="text-sm p-2 rounded bg-background/80">
                    {resource}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Career Development Roadmap
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="p-6 pt-4 space-y-6">
            {!roadmap ? (
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Generate Your Career Roadmap</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI will analyze your capabilities, aspirations, and experience to create a personalized development plan.
                      </p>
                    </div>
                    <Button onClick={handleGeneratePath} disabled={generating}>
                      {generating ? "Generating..." : "Generate Roadmap"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Header */}
                <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">
                          Path to: {roadmap.targetRole}
                        </h3>
                        {roadmap.roadmap?.summary && (
                          <p className="text-sm text-muted-foreground">
                            {roadmap.roadmap.summary}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">
                          {roadmap.readinessScore}%
                        </div>
                        <p className="text-xs text-muted-foreground">Ready</p>
                      </div>
                    </div>
                    
                    {/* Readiness Breakdown */}
                    {roadmap.roadmap?.readiness_breakdown && (
                      <div className="grid grid-cols-4 gap-2 mt-4">
                        <div className="text-center p-2 rounded bg-background/50">
                          <div className="text-sm font-semibold">
                            {roadmap.roadmap.readiness_breakdown.capability_coverage}%
                          </div>
                          <div className="text-xs text-muted-foreground">Capabilities</div>
                        </div>
                        <div className="text-center p-2 rounded bg-background/50">
                          <div className="text-sm font-semibold">
                            {roadmap.roadmap.readiness_breakdown.gap_severity_score}%
                          </div>
                          <div className="text-xs text-muted-foreground">Gap Score</div>
                        </div>
                        <div className="text-center p-2 rounded bg-background/50">
                          <div className="text-sm font-semibold">
                            {roadmap.roadmap.readiness_breakdown.track_record_score}%
                          </div>
                          <div className="text-xs text-muted-foreground">Track Record</div>
                        </div>
                        <div className="text-center p-2 rounded bg-background/50">
                          <div className="text-sm font-semibold">
                            {roadmap.roadmap.readiness_breakdown.consistency_score}%
                          </div>
                          <div className="text-xs text-muted-foreground">Consistency</div>
                        </div>
                      </div>
                    )}

                    {roadmap.roadmap?.estimated_ready_date && (
                      <div className="flex items-center gap-2 mt-4 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Estimated ready by:{" "}
                          <span className="font-semibold">
                            {format(new Date(roadmap.roadmap.estimated_ready_date), "MMMM yyyy")}
                          </span>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline Visualization */}
                <div className="relative">
                  {/* Connecting Line */}
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border hidden md:block" />
                  
                  <div className="grid gap-4">
                    {Object.entries(phases).map(([key, phase]) => (
                      <div key={key} className="relative">
                        {/* Phase Dot */}
                        <div className={`absolute left-4 top-6 w-4 h-4 rounded-full ${PHASE_COLORS[key as keyof typeof PHASE_COLORS]?.dot} hidden md:block z-10`} />
                        
                        <div className="md:ml-12 space-y-2">
                          {renderPhaseCard(key, phase as RoadmapPhase)}
                          
                          {selectedPhase === key && phase && (
                            renderPhaseDetails(key, phase as RoadmapPhase)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gaps & Strengths Summary */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Gaps */}
                  {roadmap.gaps?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Capability Gaps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {roadmap.gaps.slice(0, 5).map((gap: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span>{gap.capability}</span>
                              <Badge 
                                variant={gap.severity === 'critical' ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {gap.estimated_months_to_close}mo
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Strengths */}
                  {roadmap.strengths?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Your Strengths</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {roadmap.strengths.map((strength: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {strength.capability}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
