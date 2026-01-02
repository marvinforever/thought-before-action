import { motion } from "framer-motion";
import { Play, PartyPopper, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PodcastReadyProps {
  onPlay: () => void;
  onContinue: () => void;
}

export function PodcastReady({ onPlay, onContinue }: PodcastReadyProps) {
  return (
    <div className="space-y-6 text-center">
      {/* Success animation */}
      <motion.div 
        className="flex justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
      >
        <div className="relative">
          <div className="p-5 bg-green-100 dark:bg-green-900/30 rounded-full">
            <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
          </div>
          <motion.div
            className="absolute -top-2 -right-2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <PartyPopper className="h-8 w-8 text-amber-500" />
          </motion.div>
        </div>
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <h2 className="text-2xl font-bold">Your episode is ready! 🎧</h2>
        <p className="text-muted-foreground">
          This is your personalized welcome to the growth journey.
        </p>
      </motion.div>

      {/* Play button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button 
          size="lg" 
          onClick={onPlay}
          className="gap-3 h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Play className="h-6 w-6" fill="currentColor" />
          Play Episode
        </Button>
      </motion.div>

      {/* Next steps preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-muted/50 rounded-xl p-5 text-left space-y-3"
      >
        <p className="text-sm font-medium text-muted-foreground">
          What's next? Complete your profile for even better content:
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <span>Complete your growth diagnostic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <span>Set up your personal vision</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <span>Add daily habits to track</span>
          </div>
        </div>
      </motion.div>

      {/* Continue button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button 
          variant="outline" 
          onClick={onContinue}
          className="gap-2"
        >
          Continue to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}
