import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface TelegramConnectCTAProps {
  variant?: "banner" | "card" | "compact";
  dismissible?: boolean;
}

export function TelegramConnectCTA({ variant = "banner", dismissible = true }: TelegramConnectCTAProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check if dismissed in sessionStorage
        if (sessionStorage.getItem("telegram_cta_dismissed") === "true") {
          setDismissed(true);
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("telegram_links")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        setVisible(!data);
      } catch {
        // Silently fail — don't show CTA if we can't check
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("telegram_cta_dismissed", "true");
  };

  if (loading || !visible || dismissed) return null;

  if (variant === "compact") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-3 p-3 bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20 rounded-lg"
        >
          <MessageCircle className="h-4 w-4 text-accent flex-shrink-0" />
          <p className="text-sm text-foreground flex-1">
            Get Jericho on Telegram for coaching on the go.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/settings")}
            className="text-accent hover:text-accent font-medium shrink-0"
          >
            Connect
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          {dismissible && (
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleDismiss}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  if (variant === "card") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/0.85] p-5 text-primary-foreground shadow-lg"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(var(--accent))]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <div className="relative flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center shadow-lg flex-shrink-0">
              <MessageCircle className="h-6 w-6 text-accent-foreground" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                Jericho in Your Pocket
                <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
              </h3>
              <p className="text-primary-foreground/80 text-sm">
                Get AI coaching, log calls, send kudos, and check your targets — all from Telegram. Connect in 30 seconds.
              </p>
              <Button
                onClick={() => navigate("/dashboard/settings")}
                className="bg-[hsl(var(--accent))] text-accent-foreground hover:bg-[hsl(var(--accent))]/90 shadow-md mt-1"
                size="sm"
              >
                Connect Telegram
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Default: banner
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary))/0.95] to-[hsl(var(--primary))] p-4 text-primary-foreground shadow-lg"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--accent))] flex items-center justify-center shadow-md">
              <MessageCircle className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Get Jericho in your pocket</p>
              <p className="text-primary-foreground/70 text-xs">AI coaching, pipeline updates, and kudos — right from Telegram</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/dashboard/settings")}
              className="bg-[hsl(var(--accent))] text-accent-foreground hover:bg-[hsl(var(--accent))]/90 shadow-md"
              size="sm"
            >
              Connect Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            {dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
