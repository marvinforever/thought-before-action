import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Sparkles, MessageCircle, Target, Zap, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WelcomeModalProps {
  onStartChat: () => void;
}

export function WelcomeModal({ onStartChat }: WelcomeModalProps) {
  const { score, loading, milestones } = useOnboardingProgress();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Check if user has dismissed the welcome before
  const dismissKey = "jericho_welcome_dismissed";

  useEffect(() => {
    if (loading) return;
    
    // Show welcome if score < 100 and hasn't been dismissed this session
    const dismissed = sessionStorage.getItem(dismissKey);
    if (score < 100 && !dismissed) {
      // Small delay for smoother UX after page load
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, score]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, "true");
    setOpen(false);
  };

  const handleStartChat = () => {
    sessionStorage.setItem(dismissKey, "true");
    setOpen(false);
    onStartChat();
  };

  const completedCount = milestones.filter(m => m.completed).length;
  const isReturning = completedCount > 0;

  const steps = [
    {
      title: isReturning ? "Welcome back! 👋" : "Meet Jericho, your AI coach",
      subtitle: isReturning 
        ? `You're ${score}% through your setup. Let's finish strong!`
        : "I'm here to help you grow into your best self at work.",
      icon: <Sparkles className="h-12 w-12" />,
    },
    {
      title: "What we'll do together",
      subtitle: "In just a few minutes, you'll have a personalized growth plan.",
      icon: <Target className="h-12 w-12" />,
      features: [
        "Set your vision & goals",
        "Build powerful daily habits", 
        "Track your achievements",
      ],
    },
    {
      title: "Ready to get started?",
      subtitle: "Chat with me and I'll guide you through everything.",
      icon: <MessageCircle className="h-12 w-12" />,
      cta: true,
    },
  ];

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80">
        <div className="relative p-8 text-primary-foreground">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 space-y-6"
            >
              {/* Icon */}
              <div className="flex justify-center">
                <div className="p-4 bg-white/20 rounded-full">
                  {currentStep.icon}
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">{currentStep.title}</h2>
                <p className="text-primary-foreground/80">{currentStep.subtitle}</p>
              </div>

              {/* Features list */}
              {currentStep.features && (
                <div className="space-y-3 py-2">
                  {currentStep.features.map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 bg-white/10 rounded-lg p-3"
                    >
                      <Zap className="h-5 w-5 text-accent" />
                      <span className="font-medium">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Progress indicator for returning users */}
              {isReturning && step === 0 && (
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Your progress</span>
                    <span className="font-bold">{score}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <p className="text-xs text-primary-foreground/70 mt-2">
                    {completedCount} of {milestones.length} milestones complete
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-2">
                {currentStep.cta ? (
                  <Button
                    onClick={handleStartChat}
                    size="lg"
                    className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Chat with Jericho
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStep(step + 1)}
                    size="lg"
                    className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
                  >
                    Continue
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                >
                  {isReturning ? "I'll continue later" : "Skip for now"}
                </Button>
              </div>

              {/* Step indicators */}
              <div className="flex justify-center gap-2 pt-2">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === step ? "bg-white w-6" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
