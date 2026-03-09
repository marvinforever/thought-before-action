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
  | "ask_name"
  | "ask_company"
  | "checking_company"
  | "found_company"
  | "ask_role"
  | "ask_challenge"
  | "show_value"
  | "ask_convert"
  | "ask_email"
  | "ask_phone"
  | "creating_account"
  | "done";

const CAPABILITIES_MSG = `Here's what I can do for you every day:

✦ **Sales pipeline + coaching** — manage deals through conversation, not forms
✦ **Team development + habits** — build your people with daily micro-actions  
✦ **Project coordination** — keep everything moving without the busywork
✦ **Personal + work goals** — 90-day sprints with AI accountability

No data entry. No dashboards to learn. Just talk to me.`;

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
  const [userData, setUserData] = useState<{
    name?: string;
    company?: string;
    companyId?: string;
    role?: string;
    challenge?: string;
    email?: string;
    phone?: string;
  }>({});
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
    setState("ask_name");
    setTimeout(() => inputRef.current?.focus(), 400);
    await addJerichoMsg("Hey! I'm Jericho. What's your name?", 600);
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || isTyping) return;

    setMessages((prev) => [...prev, { id: generateId(), role: "user", text: value }]);
    setInput("");

    switch (state) {
      case "ask_name": {
        const firstName = value.split(" ")[0];
        setUserData((d) => ({ ...d, name: value }));
        setState("ask_company");
        await addJerichoMsg(`Nice to meet you, ${firstName}. What company do you work for?`);
        break;
      }

      case "ask_company": {
        setUserData((d) => ({ ...d, company: value }));
        setState("checking_company");

        await addJerichoMsg("Let me check if we've worked together before...", 400);

        // Lookup company
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name")
          .ilike("name", `%${value}%`)
          .limit(1);

        if (companies && companies.length > 0) {
          setUserData((d) => ({ ...d, companyId: companies[0].id }));
          setState("found_company");
          await addJerichoMsg(
            `I see **${companies[0].name}** in our system! Looks like your team is already set up. You should have received login credentials — check your email, or ask your manager to add you.`
          );
          await addJerichoMsg(
            "If you're new to the team, I can still show you what I do. Want to keep chatting?",
            1000
          );
          setState("ask_challenge");
        } else {
          setState("ask_role");
          await addJerichoMsg(
            `Haven't worked with ${value} before — no worries, that's what I'm here for. What's your role there?`
          );
        }
        break;
      }

      case "ask_role": {
        setUserData((d) => ({ ...d, role: value }));
        setState("ask_challenge");
        await addJerichoMsg(
          `Got it — ${value}. So what's eating your lunch right now? What's the biggest challenge you're dealing with? (sales, operations, team management, something else?)`
        );
        break;
      }

      case "ask_challenge": {
        setUserData((d) => ({ ...d, challenge: value }));
        setState("show_value");

        const challenge = value.toLowerCase();
        let response: string;

        if (challenge.includes("sales") || challenge.includes("pipeline") || challenge.includes("deal") || challenge.includes("close")) {
          response = `Sales challenges — that's my wheelhouse. Here's how I'd help:\n\n→ You tell me about a deal over text. I track it, remind you to follow up, and prep you before every call.\n→ Need a proposal? Just describe what the customer needs — I'll write it.\n→ Forgot what you sold them last year? I'll pull it up instantly.\n\nNo CRM forms. No logging in. Just talk to me like you'd talk to a coworker.`;
        } else if (challenge.includes("team") || challenge.includes("manage") || challenge.includes("people") || challenge.includes("develop")) {
          response = `Managing people is hard — I make it easier.\n\n→ I help each person on your team set 90-day goals and build daily habits.\n→ I generate personalized coaching podcasts for every team member.\n→ Before your 1-on-1s, I'll prep you with exactly what to talk about.\n\nYou focus on leading. I handle the system behind it.`;
        } else if (challenge.includes("operation") || challenge.includes("project") || challenge.includes("busy") || challenge.includes("organize")) {
          response = `I hear you — too much to track, not enough time.\n\n→ Tell me your priorities and I'll build a 90-day plan.\n→ I'll check in daily to keep you accountable.\n→ I can coordinate with your team so everyone knows what matters.\n\nThink of me as the assistant who never forgets.`;
        } else {
          response = `I can definitely help with that. Here's the thing — I'm not just a chatbot. I'm a system that wraps around your work.\n\n→ Set goals, build habits, track progress — all through conversation.\n→ I generate personalized content and coaching just for you.\n→ And I get smarter about your needs the more we talk.`;
        }

        await addJerichoMsg(response);
        await addJerichoMsg(CAPABILITIES_MSG, 1500);
        setState("ask_convert");
        await addJerichoMsg(
          "Want me to set this up for you? I'll create your account and send you login details so you can start using this right away.",
          1500
        );
        break;
      }

      case "ask_convert": {
        const yes = /yes|yeah|sure|yep|absolutely|let's|do it|go|ok|okay/i.test(value);
        if (yes) {
          setState("ask_email");
          await addJerichoMsg("Let's do it. What's your email address?");
        } else {
          await addJerichoMsg(
            "No pressure at all. If you change your mind, just come back here — I'll be ready. Have a great day! 👋"
          );
          setState("done");
        }
        break;
      }

      case "ask_email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          await addJerichoMsg("Hmm, that doesn't look like a valid email. Try again?", 400);
          return;
        }
        setUserData((d) => ({ ...d, email: value }));
        setState("ask_phone");
        await addJerichoMsg("And your phone number? (I can text you reminders and coaching — totally optional)");
        break;
      }

      case "ask_phone": {
        const phone = value.toLowerCase() === "skip" || value.toLowerCase() === "no" ? undefined : value;
        setUserData((d) => ({ ...d, phone }));
        setState("creating_account");

        await addJerichoMsg("Setting up your account now...", 400);

        try {
          const password = generatePassword();
          const finalData = { ...userData, phone, email: userData.email! };

          const { data, error } = await supabase.functions.invoke("try-jericho-onboard", {
            body: {
              email: finalData.email,
              fullName: finalData.name || "New User",
              role: finalData.role || null,
              phone: finalData.phone || null,
              company: finalData.company || null,
              companyId: finalData.companyId || null,
              challenge: finalData.challenge || null,
              password,
            },
          });

          if (error) throw error;

          setState("done");
          await addJerichoMsg(
            `You're all set, ${(finalData.name || "").split(" ")[0]}! 🎉\n\nI've sent your login details to **${finalData.email}**. Check your inbox.\n\nWhen you log in, I'll already know about your goals — we'll pick up right where we left off.\n\nSee you inside. 🤝`
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
                  I help sales reps close more deals, managers develop their teams, and operations leaders crush their goals — all through conversation.
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
                  No login required. Takes 2 minutes.
                </p>
              </motion.div>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap justify-center gap-3 mt-16 max-w-lg"
              >
                {["Sales Coaching", "Team Development", "Goal Tracking", "AI Podcasts", "Deal Management"].map((f) => (
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
              {state !== "done" && state !== "creating_account" && state !== "checking_company" && (
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
                          : "Type your message..."
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
