import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface QuickGoalInputProps {
  onComplete: (goal: string) => void;
  onBack: () => void;
  selectedCapabilities: Array<{ name: string }>;
}

const GOAL_PROMPTS = [
  "Get promoted to a leadership role",
  "Improve my team's performance by 20%",
  "Become a more confident presenter",
  "Build stronger relationships at work",
  "Master a new skill that's critical for my career",
  "Lead my first major project successfully",
];

export function QuickGoalInput({ onComplete, onBack, selectedCapabilities }: QuickGoalInputProps) {
  const [goal, setGoal] = useState("");

  const handlePromptClick = (prompt: string) => {
    setGoal(prompt);
  };

  const handleContinue = () => {
    if (goal.trim()) {
      onComplete(goal.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Target className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">What's your 90-day goal?</h2>
        <p className="text-muted-foreground">
          This helps me create content that's laser-focused on what matters to you.
        </p>
      </div>

      {/* Selected capabilities reminder */}
      {selectedCapabilities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 rounded-lg p-3"
        >
          <p className="text-xs text-muted-foreground mb-2">Building on your selected focus areas:</p>
          <div className="flex flex-wrap gap-2">
            {selectedCapabilities.map((cap) => (
              <span 
                key={cap.name} 
                className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium"
              >
                {cap.name}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Goal input */}
      <div className="space-y-3">
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="In 90 days, I want to..."
          className="min-h-[100px] text-base resize-none"
          maxLength={500}
        />
        <div className="text-right text-xs text-muted-foreground">
          {goal.length}/500
        </div>
      </div>

      {/* Idea prompts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Need inspiration? Try one of these:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOAL_PROMPTS.map((prompt, index) => (
            <motion.button
              key={prompt}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handlePromptClick(prompt)}
              className="px-3 py-2 text-sm text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {prompt}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button 
          onClick={handleContinue} 
          disabled={!goal.trim()}
          className="flex-1 gap-2"
        >
          Create My Podcast
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
