import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface CapabilityPickerProps {
  onComplete: (selectedCapabilities: Capability[]) => void;
  onBack: () => void;
}

// Common capabilities grouped by category for new users to pick from
const STARTER_CAPABILITIES: Capability[] = [
  // Leadership
  { id: "leadership-1", name: "Team Leadership", description: "Guide and inspire your team to success", category: "Leadership" },
  { id: "leadership-2", name: "Strategic Thinking", description: "See the big picture and plan ahead", category: "Leadership" },
  { id: "leadership-3", name: "Decision Making", description: "Decide with clarity and accountability", category: "Leadership" },
  // Communication
  { id: "comm-1", name: "Active Listening", description: "Listen to understand, not just to respond", category: "Communication" },
  { id: "comm-2", name: "Presentation Skills", description: "Present with clarity and confidence", category: "Communication" },
  { id: "comm-3", name: "Written Communication", description: "Write clear, impactful messages", category: "Communication" },
  // Execution
  { id: "exec-1", name: "Problem Solving", description: "Frame problems and drive to solutions", category: "Execution" },
  { id: "exec-2", name: "Time Management", description: "Manage energy and meet commitments", category: "Execution" },
  { id: "exec-3", name: "Project Management", description: "Deliver predictable outcomes on schedule", category: "Execution" },
  // Self-Management
  { id: "self-1", name: "Emotional Intelligence", description: "Navigate emotions and relationships", category: "Self-Management" },
  { id: "self-2", name: "Adaptability", description: "Thrive through change and uncertainty", category: "Self-Management" },
  { id: "self-3", name: "Growth Mindset", description: "Learn from setbacks and keep improving", category: "Self-Management" },
  // Interpersonal
  { id: "inter-1", name: "Building Trust", description: "Create authentic, reliable relationships", category: "Interpersonal" },
  { id: "inter-2", name: "Conflict Resolution", description: "Navigate disagreements constructively", category: "Interpersonal" },
  { id: "inter-3", name: "Collaboration", description: "Work effectively with diverse teams", category: "Interpersonal" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Leadership": "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
  "Communication": "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  "Execution": "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
  "Self-Management": "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  "Interpersonal": "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
};

export function CapabilityPicker({ onComplete, onBack }: CapabilityPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleCapability = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else if (newSelected.size < 5) {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleContinue = () => {
    const selectedCapabilities = STARTER_CAPABILITIES.filter(c => selected.has(c.id));
    onComplete(selectedCapabilities);
  };

  const categories = [...new Set(STARTER_CAPABILITIES.map(c => c.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">What do you want to grow?</h2>
        <p className="text-muted-foreground">
          Select 3-5 capabilities you want to focus on. I'll personalize your experience based on these.
        </p>
      </div>

      {/* Selection count */}
      <div className="flex justify-center">
        <div className={cn(
          "px-4 py-2 rounded-full text-sm font-medium transition-colors",
          selected.size >= 3 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-muted text-muted-foreground"
        )}>
          {selected.size}/3-5 selected
        </div>
      </div>

      {/* Capability grid by category */}
      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
        {categories.map((category) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STARTER_CAPABILITIES.filter(c => c.category === category).map((capability, index) => (
                <motion.button
                  key={capability.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => toggleCapability(capability.id)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 text-left transition-all",
                    "hover:shadow-md",
                    selected.has(capability.id)
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : CATEGORY_COLORS[category] || "bg-muted/50 border-border"
                  )}
                >
                  {/* Selection indicator */}
                  {selected.has(capability.id) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 p-1 bg-primary rounded-full"
                    >
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </motion.div>
                  )}
                  
                  <h4 className="font-semibold text-sm">{capability.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {capability.description}
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button 
          onClick={handleContinue} 
          disabled={selected.size < 3}
          className="flex-1"
        >
          Continue ({selected.size}/3+)
        </Button>
      </div>
    </div>
  );
}
