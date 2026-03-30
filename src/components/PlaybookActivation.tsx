import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Compass, Target, Zap, ArrowRight, Check,
  ChevronRight, Star, Sparkles, Rocket
} from "lucide-react";
import type { Narrative, EngagementScores, CapabilityEntry } from "./PlaybookViewer";

interface PlaybookActivationProps {
  narrative: Narrative;
  scores: EngagementScores;
  capabilities: CapabilityEntry[];
  onComplete: () => void;
  onViewFullPlaybook: () => void;
}

const levelColor = (l: string) => {
  switch (l) {
    case "foundational": return "bg-orange-100 text-orange-700 border-orange-200";
    case "advancing": return "bg-blue-100 text-blue-700 border-blue-200";
    case "independent": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "mastery": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-muted text-muted-foreground";
  }
};

export function PlaybookActivation({
  narrative,
  scores,
  capabilities,
  onComplete,
  onViewFullPlaybook,
}: PlaybookActivationProps) {
  const [step, setStep] = useState(0);
  const [northStarConfirmed, setNorthStarConfirmed] = useState(false);
  const [capsReviewed, setCapsReviewed] = useState(false);
  const [quickWinStarted, setQuickWinStarted] = useState(false);
  const [completing, setCompleting] = useState(false);

  const priorityCaps = capabilities.filter(c => c.is_priority);
  const totalSteps = 3;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_active_context")
          .update({ onboarding_complete: true })
          .eq("profile_id", user.id);
      }
    } catch (e) {
      console.error("Error completing activation:", e);
    }
    setCompleting(false);
    onComplete();
  };

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-accent/5 via-background to-accent/5 shadow-lg overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Activate Your Playbook</h2>
                <p className="text-sm text-muted-foreground">
                  {step + 1} of {totalSteps} — Let's make your plan actionable
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onViewFullPlaybook} className="text-xs text-muted-foreground">
              View full playbook
            </Button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i < step ? "bg-accent" : i === step ? "bg-accent/60" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="north-star"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-start gap-3">
                  <Compass className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-foreground text-base">Confirm Your North Star</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This is the 12-month vision Jericho built your plan around. Everything flows from here.
                    </p>
                  </div>
                </div>

                <Card className="border-accent/30 bg-accent/5">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Your North Star</p>
                    <p className="text-lg font-bold text-foreground leading-snug">
                      "{narrative.north_star_text || "Your 12-month vision"}"
                    </p>
                    {narrative.north_star_followup && (
                      <p className="text-sm text-muted-foreground mt-2">{narrative.north_star_followup}</p>
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Your first 90-day target has been loaded to match this vision.
                  </p>
                  <Button
                    onClick={() => {
                      setNorthStarConfirmed(true);
                      setStep(1);
                    }}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                  >
                    Looks right
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="capabilities"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-start gap-3">
                  <Target className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-foreground text-base">Your Development Priorities</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Jericho identified {capabilities.length} capabilities for your profile. These {priorityCaps.length} are your growth priorities.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {priorityCaps.map((cap, i) => (
                    <Card key={cap.capability_name} className="border-accent/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-sm text-foreground">{cap.capability_name}</p>
                              <p className="text-xs text-muted-foreground">{cap.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-xs ${levelColor(cap.current_level)}`}>
                              {cap.current_level}
                            </Badge>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <Badge variant="outline" className={`text-xs ${levelColor(cap.target_level)}`}>
                              {cap.target_level}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      setCapsReviewed(true);
                      setStep(2);
                    }}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                  >
                    Got it — what's my first move?
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="quick-win"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-start gap-3">
                  <Zap className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-foreground text-base">Start Your Quick Win</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This is your first 7-day sprint. Small, specific, and designed to create momentum.
                    </p>
                  </div>
                </div>

                <Card className="border-accent/20 bg-accent/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-foreground">{narrative.quick_win_title || "Your Quick Win"}</h4>
                      {narrative.quick_win_hours && (
                        <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10 text-xs">
                          ~{narrative.quick_win_hours} hrs/week
                        </Badge>
                      )}
                    </div>
                    {narrative.quick_win_steps?.length ? (
                      <ul className="space-y-2.5">
                        {narrative.quick_win_steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full border-2 border-accent/40 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[10px] text-accent font-bold">{i + 1}</span>
                            </div>
                            <span className="text-sm text-foreground leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {narrative.quick_win_closer && (
                      <p className="text-sm text-muted-foreground mt-4 italic">{narrative.quick_win_closer}</p>
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={completing}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                  >
                    {completing ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Let's go — activate my plan
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
