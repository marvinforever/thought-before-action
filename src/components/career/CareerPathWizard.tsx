import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { WizardStepAspirations } from "./WizardStepAspirations";
import { WizardStepTargetRole } from "./WizardStepTargetRole";
import { WizardStepSelfAssessment } from "./WizardStepSelfAssessment";
import { WizardStepTimeline } from "./WizardStepTimeline";
import { WizardStepGenerating } from "./WizardStepGenerating";
import { CareerPath } from "@/hooks/useCareerPath";

export interface WizardData {
  aspirations: string;
  targetRole: string;
  customTargetRole: string;
  selfAssessment: {
    technicalSkills: number;
    leadership: number;
    communication: number;
    experience: number;
  };
  timeline: "6" | "12" | "18" | "24";
}

interface CareerPathWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  careerPaths: CareerPath[];
  onComplete: (data: WizardData) => Promise<void>;
  generating: boolean;
}

const STEPS = [
  { id: "aspirations", title: "Your Aspirations" },
  { id: "target", title: "Target Role" },
  { id: "assessment", title: "Self-Assessment" },
  { id: "timeline", title: "Timeline" },
  { id: "generating", title: "Generating" },
];

export function CareerPathWizard({
  open,
  onOpenChange,
  careerPaths,
  onComplete,
  generating,
}: CareerPathWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    aspirations: "",
    targetRole: "",
    customTargetRole: "",
    selfAssessment: {
      technicalSkills: 3,
      leadership: 3,
      communication: 3,
      experience: 3,
    },
    timeline: "12",
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = async () => {
    if (currentStep < STEPS.length - 2) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === STEPS.length - 2) {
      // Move to generating step and trigger generation
      setCurrentStep(currentStep + 1);
      await onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Aspirations
        return data.aspirations.length >= 10;
      case 1: // Target Role
        return data.targetRole !== "" || data.customTargetRole.length > 2;
      case 2: // Self Assessment
        return true; // Always valid with defaults
      case 3: // Timeline
        return true; // Always valid since we have a default value
      default:
        return false;
    }
  };

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WizardStepAspirations
            value={data.aspirations}
            onChange={(aspirations) => updateData({ aspirations })}
          />
        );
      case 1:
        return (
          <WizardStepTargetRole
            careerPaths={careerPaths}
            selectedPath={data.targetRole}
            customRole={data.customTargetRole}
            onSelectPath={(targetRole) => updateData({ targetRole, customTargetRole: "" })}
            onCustomRole={(customTargetRole) => updateData({ customTargetRole, targetRole: "" })}
          />
        );
      case 2:
        return (
          <WizardStepSelfAssessment
            assessment={data.selfAssessment}
            onChange={(selfAssessment) => updateData({ selfAssessment })}
          />
        );
      case 3:
        return (
          <WizardStepTimeline
            value={data.timeline}
            onChange={(timeline) => updateData({ timeline })}
          />
        );
      case 4:
        return <WizardStepGenerating />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {currentStep < STEPS.length - 1 ? "Set Up Your Career Path" : "Building Your Roadmap"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>{STEPS[currentStep].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="py-4 min-h-[280px]">{renderStep()}</div>

        {/* Navigation */}
        {currentStep < STEPS.length - 1 && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canProceed() || generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : currentStep === STEPS.length - 2 ? (
                "Generate My Path"
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
