import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, PenLine, Mic, Music, Check, Loader2 } from "lucide-react";

interface PodcastGeneratingProps {
  userName: string;
}

type GenerationStep = 'script' | 'voice' | 'music' | 'complete';

const STEPS: Array<{ id: GenerationStep; label: string; icon: React.ElementType }> = [
  { id: 'script', label: 'Writing your personalized script', icon: PenLine },
  { id: 'voice', label: 'Recording with Jericho\'s voice', icon: Mic },
  { id: 'music', label: 'Adding intro & outro music', icon: Music },
  { id: 'complete', label: 'Your episode is ready!', icon: Check },
];

export function PodcastGenerating({ userName }: PodcastGeneratingProps) {
  const [currentStep, setCurrentStep] = useState<GenerationStep>('script');

  // Simulate progress through steps for visual feedback
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Move through steps to give visual feedback
    timers.push(setTimeout(() => setCurrentStep('voice'), 8000));
    timers.push(setTimeout(() => setCurrentStep('music'), 16000));
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div 
          className="flex justify-center"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="p-4 bg-primary/10 rounded-full">
            <Headphones className="h-12 w-12 text-primary" />
          </div>
        </motion.div>
        
        <div>
          <h2 className="text-2xl font-bold">Creating your welcome episode...</h2>
          <p className="text-muted-foreground mt-2">
            Hang tight, {userName}! This takes about 30 seconds.
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="space-y-4 max-w-sm mx-auto">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                isComplete ? 'bg-green-100/50 dark:bg-green-900/20' :
                isCurrent ? 'bg-primary/10' :
                'bg-muted/30'
              }`}
            >
              <div className={`p-2 rounded-full ${
                isComplete ? 'bg-green-500 text-white' :
                isCurrent ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              
              <span className={`text-sm font-medium ${
                isPending ? 'text-muted-foreground' : ''
              }`}>
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Animated dots */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
