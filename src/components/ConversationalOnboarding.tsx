import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ConversationalOnboardingProps {
  onComplete: () => void;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

// Onboarding question flow - Jericho walks through these one at a time
const ONBOARDING_QUESTIONS = [
  // Section 1 — Who You Are
  { key: "role_org", section: 1, question: "What's your role and where do you work?" },
  { key: "tenure", section: 1, question: "How long have you been in this position?" },
  { key: "team_lead", section: 1, question: "Do you lead a team? If so, how many people?" },
  // Section 2 — Where You Stand (1-10 ratings)
  { key: "engagement", section: 2, question: "On a scale of 1–10, how engaged are you with your work right now?" },
  { key: "career_growth", section: 2, question: "How satisfied are you with your career growth over the past 12 months? (1–10)" },
  { key: "role_clarity", section: 2, question: "How clear are you on what success looks like in your role? (1–10)" },
  // Section 3 — What Drives You
  { key: "great_year", section: 3, question: "What would make this a great year for you professionally?" },
  { key: "strengths", section: 3, question: "What are you naturally good at — the things that come easy to you that others seem to struggle with?" },
  { key: "hardest_part", section: 3, question: "What's the hardest part of your job right now?" },
  { key: "obstacles", section: 3, question: "What gets in the way of doing your best work?" },
  { key: "proudest", section: 3, question: "What's something you've accomplished that you're genuinely proud of?" },
  // Section 4 — How You Learn
  { key: "learning_pref", section: 4, question: "How do you prefer to learn? Books, podcasts, videos, or just diving in and trying things?" },
  { key: "time_available", section: 4, question: "How much time can you realistically invest in your own development each week?" },
];

const OPENING_MESSAGE = `Hey — I'm Jericho. Before I build your growth plan, I want to get to know you a little. This'll take about 10–15 minutes and feel more like a conversation than a survey.

Ready to jump in?`;

const COMPLETION_MESSAGE = `That's everything I need. I'm building your personalized growth plan now — you'll have it within 24 hours. I'll reach out when it's ready. 🚀`;

// Section transition messages
const SECTION_TRANSITIONS: Record<number, string> = {
  2: "Great — got a good picture of where you sit. Now I want to understand how you're feeling about your work right now. Quick ratings, 1–10.",
  3: "Appreciate the honesty. Now let's dig into what drives you — this is where it gets good.",
  4: "Love it. Last couple of questions — quick ones about how you like to learn.",
};

// Reflection templates for 1-10 ratings
function getScoreReflection(key: string, score: number): string {
  if (key === "engagement") {
    if (score >= 8) return `A ${score} — that's solid. You're clearly plugged in. Let's keep that momentum going.`;
    if (score >= 5) return `A ${score} — honest answer. There's room to move that needle. Let's figure out what's holding it back.`;
    return `A ${score} — I appreciate you being real about that. That's exactly why we're doing this.`;
  }
  if (key === "career_growth") {
    if (score >= 8) return `${score} out of 10 on career growth — you've been making moves. Let's build on that.`;
    if (score >= 5) return `A ${score}. Not bad, but I bet you want more. That's what we're here for.`;
    return `${score} — sounds like you're ready for a change. Good. That's the first step.`;
  }
  if (key === "role_clarity") {
    if (score >= 8) return `${score} — you've got clarity. That's a huge advantage most people don't have.`;
    if (score >= 5) return `A ${score}. Some things are clear, some aren't. We'll sharpen that.`;
    return `${score} — that tells me a lot. Getting clear on what winning looks like is step one in your growth plan.`;
  }
  return "Got it.";
}

export function ConversationalOnboarding({ onComplete }: ConversationalOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1 = opening
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [waitingForReady, setWaitingForReady] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading && open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, open, messages.length]);

  const checkIfShouldShow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if onboarding already complete
      const { data: context } = await supabase
        .from("user_active_context")
        .select("onboarding_complete, onboarding_step, onboarding_data, onboarding_path")
        .eq("profile_id", user.id)
        .maybeSingle();

      const ctx = context as any;
      if (ctx?.onboarding_complete) return;

      // Check if they've completed the old onboarding
      const { data: completeness } = await supabase
        .from("user_data_completeness")
        .select("onboarding_score")
        .eq("profile_id", user.id)
        .maybeSingle();

      if ((completeness as any)?.onboarding_score >= 50) return;

      // Check dismissed this session
      if (sessionStorage.getItem("conversational_onboarding_dismissed")) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;
      setProfileId(profile.id);
      setCompanyId(profile.company_id);

      // Resume if partially complete
      if (ctx?.onboarding_path === "conversational" && ctx?.onboarding_step != null && ctx?.onboarding_data) {
        const savedAnswers = (ctx.onboarding_data as Record<string, string>) || {};
        setAnswers(savedAnswers);
        setCurrentQuestionIndex(ctx.onboarding_step);
        
        // Rebuild message history from saved answers
        const rebuilt: ChatMessage[] = [{ role: "assistant", content: OPENING_MESSAGE }];
        for (let i = 0; i < ctx.onboarding_step && i < ONBOARDING_QUESTIONS.length; i++) {
          const q = ONBOARDING_QUESTIONS[i];
          // Add section transition if needed
          if (i > 0 && q.section !== ONBOARDING_QUESTIONS[i - 1].section) {
            rebuilt.push({ role: "assistant", content: SECTION_TRANSITIONS[q.section] || "" });
          }
          rebuilt.push({ role: "assistant", content: q.question });
          if (savedAnswers[q.key]) {
            rebuilt.push({ role: "user", content: savedAnswers[q.key] });
          }
        }
        // Add current question
        if (ctx.onboarding_step < ONBOARDING_QUESTIONS.length) {
          const currentQ = ONBOARDING_QUESTIONS[ctx.onboarding_step];
          if (ctx.onboarding_step > 0 && currentQ.section !== ONBOARDING_QUESTIONS[ctx.onboarding_step - 1].section) {
            rebuilt.push({ role: "assistant", content: SECTION_TRANSITIONS[currentQ.section] || "" });
          }
          rebuilt.push({ role: "assistant", content: currentQ.question });
        }
        setMessages(rebuilt);
        setWaitingForReady(false);
        setOpen(true);
        return;
      }

      // Fresh start
      setMessages([{ role: "assistant", content: OPENING_MESSAGE }]);
      setOpen(true);
    } catch (error) {
      console.error("Error checking onboarding:", error);
    }
  };

  const saveProgress = useCallback(async (newAnswers: Record<string, string>, step: number, complete = false) => {
    if (!profileId) return;
    try {
      await supabase
        .from("user_active_context")
        .upsert({
          profile_id: profileId,
          company_id: companyId,
          onboarding_path: "conversational",
          onboarding_step: step,
          onboarding_data: newAnswers as any,
          onboarding_complete: complete,
          updated_at: new Date().toISOString(),
        }, { onConflict: "profile_id" });
    } catch (e) {
      console.error("Error saving onboarding progress:", e);
    }
  }, [profileId, companyId]);

  const writeProfileData = useCallback(async (allAnswers: Record<string, string>) => {
    if (!profileId) return;
    try {
      // Parse team size from team_lead answer
      const teamAnswer = allAnswers.team_lead || "";
      const teamMatch = teamAnswer.match(/(\d+)/);
      const teamSize = teamMatch ? parseInt(teamMatch[1]) : null;

      // Parse tenure
      const tenureAnswer = allAnswers.tenure || "";

      // Update profile with extracted data
      const profileUpdate: any = {};
      if (allAnswers.role_org) {
        // Try to extract role and org from combined answer
        profileUpdate.role = allAnswers.role_org.substring(0, 100);
      }
      if (teamSize) profileUpdate.team_size = teamSize;
      
      await supabase.from("profiles").update(profileUpdate).eq("id", profileId);

      // Parse scores
      const parseScore = (val: string) => {
        const match = val?.match(/(\d+)/);
        return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : null;
      };

      // Write all onboarding data to user_active_context
      const contextUpdate: any = {
        profile_id: profileId,
        company_id: companyId,
        onboarding_complete: true,
        onboarding_path: "conversational",
        onboarding_step: ONBOARDING_QUESTIONS.length,
        onboarding_data: {
          ...allAnswers,
          engagement_score: parseScore(allAnswers.engagement || ""),
          career_growth_score: parseScore(allAnswers.career_growth || ""),
          role_clarity_score: parseScore(allAnswers.role_clarity || ""),
          vision_great_year: allAnswers.great_year,
          natural_strengths: allAnswers.strengths,
          hardest_part: allAnswers.hardest_part,
          obstacles: allAnswers.obstacles,
          proudest_accomplishment: allAnswers.proudest,
          learning_formats: allAnswers.learning_pref,
          time_available: allAnswers.time_available,
          tenure: tenureAnswer,
          team_size: teamSize,
        },
        updated_at: new Date().toISOString(),
      };
      
      await supabase.from("user_active_context").upsert(contextUpdate, { onConflict: "profile_id" });

      // Write coaching insights for patterns observed
      const insights: string[] = [];
      const engScore = parseScore(allAnswers.engagement || "");
      const growthScore = parseScore(allAnswers.career_growth || "");
      const clarityScore = parseScore(allAnswers.role_clarity || "");
      
      if (engScore && engScore <= 4) insights.push(`Low engagement (${engScore}/10) — may need motivation or role alignment work.`);
      if (growthScore && growthScore <= 4) insights.push(`Dissatisfied with career growth (${growthScore}/10) — prioritize career pathing.`);
      if (clarityScore && clarityScore <= 4) insights.push(`Low role clarity (${clarityScore}/10) — needs success metrics defined.`);
      if (allAnswers.obstacles) insights.push(`Self-reported obstacles: ${allAnswers.obstacles.substring(0, 200)}`);
      if (allAnswers.strengths) insights.push(`Self-reported strengths: ${allAnswers.strengths.substring(0, 200)}`);

      for (const insight of insights) {
        await supabase.from("coaching_insights").insert({
          profile_id: profileId,
          company_id: companyId,
          insight_type: "onboarding_observation",
          insight_text: insight,
          source_type: "conversational_onboarding" as any,
          confidence_level: "high",
          is_active: true,
        } as any);
      }

      // Trigger IGP generation
      try {
        await supabase.functions.invoke("generate-growth-plan-recommendations", {
          body: { profileId },
        });
      } catch (e) {
        console.error("IGP trigger error (non-blocking):", e);
      }
    } catch (e) {
      console.error("Error writing onboarding data:", e);
    }
  }, [profileId, companyId]);

  const advanceQuestion = useCallback((newAnswers: Record<string, string>, nextIndex: number) => {
    if (nextIndex >= ONBOARDING_QUESTIONS.length) {
      // All done
      setIsComplete(true);
      setMessages(prev => [...prev, { role: "assistant", content: COMPLETION_MESSAGE }]);
      saveProgress(newAnswers, ONBOARDING_QUESTIONS.length, true);
      writeProfileData(newAnswers);
      return;
    }

    const nextQ = ONBOARDING_QUESTIONS[nextIndex];
    const prevQ = nextIndex > 0 ? ONBOARDING_QUESTIONS[nextIndex - 1] : null;
    const newMessages: ChatMessage[] = [];

    // Section transition
    if (prevQ && nextQ.section !== prevQ.section && SECTION_TRANSITIONS[nextQ.section]) {
      newMessages.push({ role: "assistant", content: SECTION_TRANSITIONS[nextQ.section] });
    }

    newMessages.push({ role: "assistant", content: nextQ.question });
    
    setMessages(prev => [...prev, ...newMessages]);
    setCurrentQuestionIndex(nextIndex);
    saveProgress(newAnswers, nextIndex);
  }, [saveProgress, writeProfileData]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || isComplete) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);

    // Handle "ready" response to opening
    if (waitingForReady) {
      setWaitingForReady(false);
      setLoading(true);
      
      // Brief delay for natural feel
      await new Promise(r => setTimeout(r, 600));
      
      const firstQ = ONBOARDING_QUESTIONS[0];
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Let's do it. 💪" },
        { role: "assistant", content: firstQ.question },
      ]);
      setCurrentQuestionIndex(0);
      saveProgress({}, 0);
      setLoading(false);
      return;
    }

    // Process the answer
    const currentQ = ONBOARDING_QUESTIONS[currentQuestionIndex];
    if (!currentQ) return;

    setLoading(true);
    const newAnswers = { ...answers, [currentQ.key]: trimmed };
    setAnswers(newAnswers);

    // Brief thinking pause
    await new Promise(r => setTimeout(r, 500));

    // Generate reflection for score questions
    const isScoreQuestion = currentQ.section === 2;
    if (isScoreQuestion) {
      const reflection = getScoreReflection(currentQ.key, parseInt(trimmed) || 5);
      setMessages(prev => [...prev, { role: "assistant", content: reflection }]);
      await new Promise(r => setTimeout(r, 400));
    } else if (currentQ.section === 3) {
      // Brief reflective acknowledgment for open-ended questions
      const reflections = [
        "I hear you.",
        "That's real.",
        "Noted — this is exactly the kind of thing I'll build into your plan.",
        "Good stuff. That tells me a lot.",
        "I can work with that.",
      ];
      const reflection = reflections[currentQuestionIndex % reflections.length];
      setMessages(prev => [...prev, { role: "assistant", content: reflection }]);
      await new Promise(r => setTimeout(r, 400));
    }

    setLoading(false);
    advanceQuestion(newAnswers, currentQuestionIndex + 1);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("conversational_onboarding_dismissed", "true");
    setOpen(false);
    if (isComplete) onComplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const progressPercent = Math.round(
    ((currentQuestionIndex < 0 ? 0 : currentQuestionIndex) / ONBOARDING_QUESTIONS.length) * 100
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary px-6 py-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Jericho</h2>
              <p className="text-xs text-primary-foreground/70">
                {isComplete ? "Growth plan building..." : "Getting to know you"}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          {!isComplete && currentQuestionIndex >= 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-primary-foreground/60 mb-1">
                <span>Section {ONBOARDING_QUESTIONS[Math.min(currentQuestionIndex, ONBOARDING_QUESTIONS.length - 1)]?.section || 1} of 4</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary-foreground/60 rounded-full"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[300px] max-h-[50vh]">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          {isComplete ? (
            <Button onClick={handleDismiss} className="w-full">
              Got it — let's go
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={waitingForReady ? 'Type "yes" or "ready"...' : "Type your answer..."}
                disabled={loading}
                className="flex-1"
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          {!isComplete && !waitingForReady && (
            <button
              onClick={handleDismiss}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
            >
              I'll finish this later
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
