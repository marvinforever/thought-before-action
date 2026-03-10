import { useState, useRef, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, detectBuyingSignal, getVariant } from "@/lib/posthog";

type Message = {
  id: string;
  role: "jericho" | "user";
  text: string;
};

type ConvoState =
  | "idle"
  | "opening"
  | "questions"
  | "ask_email"
  | "ask_phone"
  | "creating_account"
  | "done";

// Same 13-question flow as ConversationalOnboarding
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

const SECTION_TRANSITIONS: Record<number, string> = {
  2: "Great — got a good picture of where you sit. Now I want to understand how you're feeling about your work right now. Quick ratings, 1–10.",
  3: "Appreciate the honesty. Now let's dig into what drives you — this is where it gets good.",
  4: "Love it. Last couple of questions — quick ones about how you like to learn.",
};

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

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function TryJericho() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ConvoState>("idle");
  const [isTyping, setIsTyping] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const addJerichoMsg = useCallback((text: string, delay = 800) => {
    setIsTyping(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: generateId(), role: "jericho", text }]);
        setIsTyping(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        resolve();
      }, delay);
    });
  }, []);

  const handleStart = async () => {
    setStarted(true);
    setState("opening");
    trackEvent('coaching_conversation_started', { variant: getVariant('try_opening_variant') });
    setTimeout(() => inputRef.current?.focus(), 400);
    await addJerichoMsg(
      "Hey — I'm Jericho. Before I build your growth plan, I want to get to know you a little. This'll feel more like a conversation than a survey — most people find it pretty easy.\n\nReady to jump in?",
      600
    );
  };

  const advanceToQuestion = async (idx: number, currentAnswers: Record<string, string>) => {
    if (idx >= ONBOARDING_QUESTIONS.length) {
      // All questions done — ask for email to deliver the report
      await addJerichoMsg(
        "That's everything I need. I'm going to build your personalized Leadership Acceleration Report — it'll map your strengths, gaps, and a 90-day roadmap.\n\nWhat email should I send it to?",
        800
      );
      setState("ask_email");
      return;
    }

    const nextQ = ONBOARDING_QUESTIONS[idx];
    const prevQ = idx > 0 ? ONBOARDING_QUESTIONS[idx - 1] : null;

    // Section transition
    if (prevQ && nextQ.section !== prevQ.section && SECTION_TRANSITIONS[nextQ.section]) {
      await addJerichoMsg(SECTION_TRANSITIONS[nextQ.section], 600);
    }

    await addJerichoMsg(nextQ.question, 500);
    setQuestionIndex(idx);
    setState("questions");
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || isTyping) return;

    const signal = detectBuyingSignal(value);
    if (signal) {
      trackEvent('buying_signal_expressed', { signal_type: signal });
    }

    setMessages((prev) => [...prev, { id: generateId(), role: "user", text: value }]);
    setInput("");

    switch (state) {
      case "opening": {
        // User said they're ready — start questions
        await addJerichoMsg("Let's do it. 💪", 400);
        await advanceToQuestion(0, answers);
        break;
      }

      case "questions": {
        const currentQ = ONBOARDING_QUESTIONS[questionIndex];
        if (!currentQ) return;

        const newAnswers = { ...answers, [currentQ.key]: value };
        setAnswers(newAnswers);

        // Reflection for score questions (section 2)
        if (currentQ.section === 2) {
          const score = parseInt(value) || 5;
          await addJerichoMsg(getScoreReflection(currentQ.key, score), 500);
        } else if (currentQ.section === 3) {
          const reflections = [
            "I hear you.",
            "That's real.",
            "Noted — this is exactly the kind of thing I'll build into your plan.",
            "Good stuff. That tells me a lot.",
            "I can work with that.",
          ];
          await addJerichoMsg(reflections[questionIndex % reflections.length], 400);
        }

        await advanceToQuestion(questionIndex + 1, newAnswers);
        break;
      }

      case "ask_email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          await addJerichoMsg("Hmm, that doesn't look like a valid email. Try again?", 400);
          return;
        }
        setEmail(value);
        setState("ask_phone");
        await addJerichoMsg("And your phone number? (I can text you coaching nudges — totally optional. Type 'skip' to skip.)");
        break;
      }

      case "ask_phone": {
        const phoneVal = value.toLowerCase() === "skip" || value.toLowerCase() === "no" ? undefined : value;
        setPhone(phoneVal || "");
        setState("creating_account");

        await addJerichoMsg("Setting up your account and building your report now...", 400);

        try {
          const password = generatePassword();
          const name = answers.role_org?.split(" at ")[0] || "New User";

          const { data, error } = await supabase.functions.invoke("try-jericho-onboard", {
            body: {
              email: value.toLowerCase() === "skip" || value.toLowerCase() === "no" ? email : email,
              fullName: name,
              role: answers.role_org || null,
              phone: phoneVal || null,
              company: null,
              companyId: null,
              challenge: answers.hardest_part || null,
              password,
              // Pass all diagnostic answers for context seeding
              diagnosticData: {
                ...answers,
                engagement_score: parseInt(answers.engagement) || null,
                career_growth_score: parseInt(answers.career_growth) || null,
                role_clarity_score: parseInt(answers.role_clarity) || null,
                vision_great_year: answers.great_year,
                natural_strengths: answers.strengths,
                hardest_part: answers.hardest_part,
                obstacles: answers.obstacles,
                proudest_accomplishment: answers.proudest,
                learning_formats: answers.learning_pref,
                time_available: answers.time_available,
                tenure: answers.tenure,
                team_lead: answers.team_lead,
              },
            },
          });

          if (error) throw error;

          setState("done");
          const firstName = name.split(" ")[0];
          await addJerichoMsg(
            `You're all set, ${firstName}! 🎉\n\nI've sent your login details to **${email}**. Your Leadership Acceleration Report is being generated now — expect it in your inbox within 24 hours.\n\nWhen you log in, I'll already know everything we just talked about — we'll pick up right where we left off.\n\nSee you inside. 🤝`
          );
        } catch (err: any) {
          console.error("Onboard error:", err);
          setState("ask_email");
          await addJerichoMsg(
            "Something went wrong creating your account. Let's try again — what email should I use?"
          );
        }
        break;
      }

      default:
        break;
    }
  };

  const progressPercent = Math.round(
    ((questionIndex < 0 ? 0 : questionIndex) / ONBOARDING_QUESTIONS.length) * 100
  );

  return (
    <>
      <Helmet>
        <title>Try Jericho — Your AI Performance Coach</title>
        <meta name="description" content="Meet Jericho, your AI performance coach for sales, team development, and operations. Start a conversation and see what's possible." />
      </Helmet>

      <div className="min-h-screen bg-primary text-primary-foreground">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-lg font-bold text-accent-foreground">J</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Jericho</span>
            </div>
            <a href="/auth" className="text-sm text-muted-foreground hover:text-primary-foreground transition-colors">
              Already have an account? Log in →
            </a>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {!started ? (
            /* Hero / Landing */
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center min-h-screen px-4 text-center pt-16"
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7 }}
                className="max-w-2xl"
              >
                <div className="inline-flex items-center gap-2 bg-accent/15 text-accent px-4 py-2 rounded-full text-sm font-medium mb-8">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Live demo — no account needed
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
                  Meet <span className="text-accent">Jericho</span>
                  <br />
                  Your AI Performance Coach
                </h1>

                <p className="text-lg sm:text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
                  Answer a few questions and I'll build you a personalized Leadership Acceleration Report — free, in 24 hours.
                </p>

                <Button
                  size="lg"
                  onClick={handleStart}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 rounded-xl shadow-lg shadow-accent/25 font-semibold group"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Start Conversation
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                <p className="text-sm text-white/40 mt-6">
                  No login required. Takes 10–15 minutes.
                </p>
              </motion.div>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap justify-center gap-3 mt-16 max-w-lg"
              >
                {["Leadership Report", "Growth Roadmap", "AI Coaching", "90-Day Sprint", "Career Clarity"].map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60">
                    {f}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            /* Chat Interface */
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col min-h-screen pt-16"
            >
              {/* Progress bar */}
              {state === "questions" && (
                <div className="px-4 pt-3">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                      <span>Getting to know you</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-accent text-accent-foreground rounded-br-md"
                            : "bg-white/10 text-primary-foreground rounded-bl-md"
                        }`}
                      >
                        {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                          part.startsWith("**") && part.endsWith("**") ? (
                            <strong key={i}>{part.slice(2, -2)}</strong>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </motion.div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Input */}
              {state !== "done" && state !== "creating_account" && (
                <div className="border-t border-white/10 bg-primary/95 backdrop-blur-sm p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="max-w-2xl mx-auto flex gap-2"
                  >
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        state === "ask_email"
                          ? "your@email.com"
                          : state === "ask_phone"
                          ? "Phone number (or type 'skip')"
                          : state === "opening"
                          ? "Type 'yes' to start..."
                          : "Type your answer..."
                      }
                      disabled={isTyping}
                      className="flex-1 bg-white/10 border-white/20 text-primary-foreground placeholder:text-white/40 focus-visible:ring-accent"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!input.trim() || isTyping}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              )}

              {state === "done" && (
                <div className="border-t border-white/10 bg-primary/95 p-4 text-center">
                  <a href="/auth">
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                      Log In Now →
                    </Button>
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
