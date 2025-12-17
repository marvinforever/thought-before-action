import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trophy, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface CelebrationOverlayProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
  type?: "milestone" | "streak" | "achievement" | "badge";
  badgeEmoji?: string;
  subtitle?: string;
}

const confettiColors = [
  "bg-primary",
  "bg-accent",
  "bg-yellow-400",
  "bg-green-400",
  "bg-blue-400",
  "bg-pink-400",
];

function Confetti({ count = 50 }: { count?: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute w-3 h-3 rounded-sm",
            confettiColors[i % confettiColors.length]
          )}
          initial={{
            x: Math.random() * window.innerWidth,
            y: -20,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            y: window.innerHeight + 20,
            rotate: Math.random() * 720 - 360,
            opacity: 0,
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export function CelebrationOverlay({ 
  show, 
  onComplete, 
  message = "Milestone Complete!",
  type = "milestone",
  badgeEmoji,
  subtitle
}: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const Icon = type === "streak" ? Zap : type === "achievement" ? Trophy : type === "badge" ? null : Sparkles;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <Confetti />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-card border-2 border-primary shadow-2xl rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4"
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 0.5,
                  repeat: 2,
                }}
              >
                {type === "badge" && badgeEmoji ? (
                  <span className="text-5xl">{badgeEmoji}</span>
                ) : Icon ? (
                  <Icon className="h-10 w-10 text-primary" />
                ) : (
                  <Trophy className="h-10 w-10 text-primary" />
                )}
              </motion.div>
              <div className="text-center">
                <motion.h3 
                  className="text-2xl font-bold text-foreground"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {message}
                </motion.h3>
                {subtitle && (
                  <motion.p
                    className="text-muted-foreground mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {subtitle}
                  </motion.p>
                )}
                <motion.div
                  className="flex items-center justify-center gap-1 mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {[...Array(3)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-5 w-5 text-yellow-400 fill-yellow-400" 
                    />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook for triggering celebrations
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    show: boolean;
    message: string;
    type: "milestone" | "streak" | "achievement" | "badge";
    badgeEmoji?: string;
    subtitle?: string;
  }>({
    show: false,
    message: "",
    type: "milestone",
  });

  const celebrate = (
    message: string, 
    type: "milestone" | "streak" | "achievement" | "badge" = "milestone",
    options?: { badgeEmoji?: string; subtitle?: string }
  ) => {
    setCelebration({ show: true, message, type, ...options });
  };

  const onComplete = () => {
    setCelebration(prev => ({ ...prev, show: false }));
  };

  return {
    celebration,
    celebrate,
    onComplete,
  };
}
