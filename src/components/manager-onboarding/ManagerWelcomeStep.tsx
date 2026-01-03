import { motion } from "framer-motion";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManagerWelcomeStepProps {
  userName: string;
  teamSize: number;
  onContinue: () => void;
  onSkip: () => void;
}

export function ManagerWelcomeStep({ userName, teamSize, onContinue, onSkip }: ManagerWelcomeStepProps) {
  return (
    <div className="space-y-6 text-center">
      {/* Animated icon */}
      <motion.div 
        className="flex justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        <div className="relative">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <motion.div
            className="absolute -top-1 -right-1 p-1.5 bg-amber-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </motion.div>
        </div>
      </motion.div>

      {/* Welcome text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h1 className="text-3xl font-bold">
          Welcome, {userName || 'Manager'}! 🎯
        </h1>
        <p className="text-lg text-muted-foreground">
          {teamSize > 0 ? (
            <>
              You have <span className="font-semibold text-primary">{teamSize} team member{teamSize !== 1 ? 's' : ''}</span> ready to grow with your guidance.
            </>
          ) : (
            <>
              Let's get your team set up so you can start coaching in real time.
            </>
          )}
        </p>
      </motion.div>

      {/* Value proposition */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 space-y-4"
      >
        <p className="text-lg font-medium">
          Let's get you set up in under 2 minutes!
        </p>
        <div className="space-y-2 text-sm text-muted-foreground text-left">
          <p>👥 See your team at a glance</p>
          <p>💬 Learn how to run effective 1:1s</p>
          <p>📊 Understand capability tracking</p>
          <p>🏆 Discover recognition tools</p>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col gap-3 pt-2"
      >
        <Button 
          size="lg" 
          onClick={onContinue}
          className="gap-2"
        >
          Let's Go!
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          onClick={onSkip}
          className="text-muted-foreground"
        >
          I'll explore on my own
        </Button>
      </motion.div>
    </div>
  );
}
