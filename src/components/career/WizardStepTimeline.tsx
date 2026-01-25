import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepTimelineProps {
  value: string;
  onChange: (value: "6" | "12" | "18" | "24") => void;
}

const TIMELINE_OPTIONS = [
  {
    value: "6" as const,
    label: "6 months",
    description: "Aggressive pace, focused effort",
    emoji: "🚀",
  },
  {
    value: "12" as const,
    label: "12 months",
    description: "Balanced growth trajectory",
    emoji: "📈",
  },
  {
    value: "18" as const,
    label: "18 months",
    description: "Steady, sustainable development",
    emoji: "🎯",
  },
  {
    value: "24" as const,
    label: "24 months",
    description: "Thorough preparation",
    emoji: "🌱",
  },
];

export function WizardStepTimeline({ value, onChange }: WizardStepTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">When do you want to be ready?</h3>
        <p className="text-sm text-muted-foreground">
          Choose your target timeline for promotion readiness.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TIMELINE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              value === option.value
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-primary/50 hover:bg-accent/5"
            )}
          >
            <div className="text-2xl mb-2">{option.emoji}</div>
            <div className="font-semibold">{option.label}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {option.description}
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Your roadmap will be tailored to fit this timeline with appropriate milestones.
      </p>
    </div>
  );
}
