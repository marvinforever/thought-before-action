import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ClipboardCheck } from "lucide-react";

interface Assessment {
  technicalSkills: number;
  leadership: number;
  communication: number;
  experience: number;
}

interface WizardStepSelfAssessmentProps {
  assessment: Assessment;
  onChange: (assessment: Assessment) => void;
}

const AREAS = [
  {
    key: "technicalSkills" as const,
    label: "Technical / Functional Skills",
    description: "Your proficiency in role-specific skills and knowledge",
  },
  {
    key: "leadership" as const,
    label: "Leadership & Influence",
    description: "Ability to lead, mentor, and influence others",
  },
  {
    key: "communication" as const,
    label: "Communication",
    description: "Written, verbal, and presentation skills",
  },
  {
    key: "experience" as const,
    label: "Relevant Experience",
    description: "Track record and exposure to target role responsibilities",
  },
];

const LEVEL_LABELS = ["Beginner", "Developing", "Proficient", "Advanced", "Expert"];

export function WizardStepSelfAssessment({ assessment, onChange }: WizardStepSelfAssessmentProps) {
  const updateArea = (key: keyof Assessment, value: number) => {
    onChange({ ...assessment, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">Quick Self-Assessment</h3>
        <p className="text-sm text-muted-foreground">
          Rate your current readiness in these key areas (1-5 scale).
        </p>
      </div>

      <div className="space-y-5">
        {AREAS.map((area) => (
          <div key={area.key} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">{area.label}</Label>
              <span className="text-xs font-medium text-primary">
                {LEVEL_LABELS[assessment[area.key] - 1]}
              </span>
            </div>
            <Slider
              value={[assessment[area.key]]}
              onValueChange={([value]) => updateArea(area.key, value)}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">{area.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
