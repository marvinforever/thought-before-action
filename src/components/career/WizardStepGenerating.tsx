import { Loader2, Sparkles, Target, Map, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = [
  { icon: Sparkles, label: "Analyzing your aspirations..." },
  { icon: Target, label: "Identifying capability gaps..." },
  { icon: Map, label: "Building your personalized roadmap..." },
  { icon: CheckCircle, label: "Finalizing recommendations..." },
];

export function WizardStepGenerating() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h3 className="font-semibold text-lg">Creating Your Career Path</h3>
        <p className="text-sm text-muted-foreground">
          Our AI is analyzing your profile and building a personalized development roadmap.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeStep;
          const isComplete = index < activeStep;

          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : isComplete
                  ? "bg-muted/50 text-muted-foreground"
                  : "text-muted-foreground/50"
              }`}
            >
              {isComplete ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span className={`text-sm ${isActive ? "font-medium" : ""}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
