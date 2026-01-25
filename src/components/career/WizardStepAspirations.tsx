import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

interface WizardStepAspirationsProps {
  value: string;
  onChange: (value: string) => void;
}

const PROMPTS = [
  "I want to lead a team and help others grow",
  "I'm interested in becoming a technical expert",
  "I'd like to move into a management role",
  "I want to develop strategic planning skills",
];

export function WizardStepAspirations({ value, onChange }: WizardStepAspirationsProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">What are your career aspirations?</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your goals, interests, and what you'd like to achieve in your career.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="aspirations">Your aspirations</Label>
        <Textarea
          id="aspirations"
          placeholder="Describe where you see yourself growing professionally..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {value.length}/500 characters (min 10)
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Need inspiration?</p>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onChange(value ? `${value} ${prompt}` : prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
