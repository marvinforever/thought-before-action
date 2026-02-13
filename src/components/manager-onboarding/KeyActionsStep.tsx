import { motion } from "framer-motion";
import { MessageSquare, Target, Award, BarChart3, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface KeyActionsStepProps {
  onContinue: () => void;
  onBack: () => void;
}

const KEY_ACTIONS = [
  {
    icon: MessageSquare,
    title: "1:1 Conversations",
    description: "Regular check-ins with AI-powered note-taking and follow-up suggestions",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Target,
    title: "Capability Reviews",
    description: "Track and develop your team's skills with clear level progressions",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Award,
    title: "Recognition",
    description: "Celebrate wins and reinforce great behaviors in the moment",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "Team Analytics",
    description: "Spot trends, identify risks, and see growth patterns across your team",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

export function KeyActionsStep({ onContinue, onBack }: KeyActionsStepProps) {
  return (
    <div className="space-y-6 pb-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Your Manager Toolkit</h2>
        <p className="text-muted-foreground">
          Four powerful tools to help your team thrive
        </p>
      </motion.div>

      {/* Action Cards */}
      <div className="grid gap-3">
        {KEY_ACTIONS.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ${action.bgColor}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {action.description}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pro tip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-muted/50 rounded-lg p-4 text-sm"
      >
        <p className="font-medium">💡 Pro tip</p>
        <p className="text-muted-foreground mt-1">
          Start with a 1:1 – it's the foundation of great management. Jericho will help you prepare talking points based on each team member's data.
        </p>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex gap-3 pt-2"
      >
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onContinue} className="flex-1 gap-2">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}
