import { useState, useRef, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, ArrowRight, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { trackEvent, getVariant } from "@/lib/posthog";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  role: "jericho" | "user";
  text: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Session token management via cookie ──
function getOrCreateSessionToken(): string {
  const COOKIE_NAME = "jericho_try_session";
  const existing = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (existing) {
    return existing.split("=")[1];
  }
  const token = crypto.randomUUID();
  // 30-day cookie
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  return token;
}

export default function TryJericho() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken] = useState(() => getOrCreateSessionToken());
  const [reportReady, setReportReady] = useState(false);
  const [reportProfileId, setReportProfileId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // ── Poll for report readiness once we have a profile_id ──
  useEffect(() => {
    if (!reportProfileId || reportReady) return;

    const poll = async () => {
      try {
        const { data } = await supabase
          .from("user_active_context")
          .select("report_status")
          .eq("profile_id", reportProfileId)
          .single();

        if (data?.report_status === "delivered" || data?.report_status === "generated") {
          setReportReady(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // silently retry
      }
    };

    pollRef.current = setInterval(poll, 8000);
    poll(); // immediate first check

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [reportProfileId, reportReady]);

  const handleStart = async () => {
    setStarted(true);
    trackEvent("coaching_conversation_started", { variant: getVariant("try_opening_variant") });
    setTimeout(() => inputRef.current?.focus(), 400);
    await sendToJericho("hi");
  };

  const sendToJericho = async (userText: string) => {
    const userMsg: Message = { id: generateId(), role: "user", text: userText };
    const assistantMsg: Message = { id: generateId(), role: "jericho", text: "" };

    const isInitial = messages.length === 0 && userText === "hi";

    setMessages((prev) => isInitial ? [...prev, assistantMsg] : [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    const history = messages.map((m) => ({
      role: m.role === "jericho" ? "assistant" : "user",
      content: m.text,
    }));

    if (!isInitial) {
      history.push({ role: "user", content: userText });
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-try-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            tryMode: true,
            sessionId: sessionToken,
            messages: history,
            message: isInitial ? "" : userText,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Chat error:", response.status, errText);
        throw new Error("Failed to get response");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let textBuffer = "";

      // Strip all hidden signal markers from display text
      const stripMarkers = (text: string) =>
        text
          .replace(/<!--ONBOARDING_COMPLETE:[\s\S]*?-->/g, "")
          .replace(/<!--CONTEXT_UPDATE[\s\S]*?-->/g, "")
          .replace(/<!--.*?-->/g, "")
          .trim();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);

            // Check for profile_id to start polling
            if (data.profile_id && !reportProfileId) {
              setReportProfileId(data.profile_id);
            }

            if (typeof data.content === "string" && data.content.length) {
              accumulated += data.content;
              const display = stripMarkers(accumulated);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (next[lastIdx]?.role === "jericho") {
                  next[lastIdx] = { ...next[lastIdx], text: display };
                }
                return next;
              });
            }

            if (data.done) break;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.profile_id && !reportProfileId) {
              setReportProfileId(data.profile_id);
            }
            if (typeof data.content === "string" && data.content.length) {
              accumulated += data.content;
              const display = stripMarkers(accumulated);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (next[lastIdx]?.role === "jericho") {
                  next[lastIdx] = { ...next[lastIdx], text: display };
                }
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.role === "jericho" && !next[lastIdx].text) {
          next[lastIdx] = {
            ...next[lastIdx],
            text: "Something went wrong — try sending your message again.",
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || isLoading) return;
    setInput("");
    await sendToJericho(value);
  };

  return (
    <>
      <Helmet>
        <title>Try Jericho — Your AI Performance Coach</title>
        <meta
          name="description"
          content="Meet Jericho, your performance coach. Start a conversation and get a free Growth Map in minutes."
        />
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
            <a
              href="/auth"
              className="text-sm text-muted-foreground hover:text-primary-foreground transition-colors"
            >
              Already have an account? Log in →
            </a>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {!started ? (
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
                  Your Performance Coach.
                </h1>

                <p className="text-lg sm:text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
                  Let's build your Growth Map.
                </p>

                <Button
                  size="lg"
                  onClick={handleStart}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 rounded-xl shadow-lg shadow-accent/25 font-semibold group"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Start
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                <p className="text-sm text-white/40 mt-6">
                  No login required. Takes about 3 minutes.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap justify-center gap-3 mt-16 max-w-lg"
              >
                {["Growth Map", "Career Clarity", "Coaching", "90-Day Sprint", "Strengths Map"].map(
                  (f) => (
                    <span
                      key={f}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60"
                    >
                      {f}
                    </span>
                  )
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col min-h-screen pt-16"
            >
              {/* Report Ready Banner */}
              <AnimatePresence>
                {reportReady && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mx-4 mt-2"
                  >
                    <div className="max-w-2xl mx-auto bg-accent/15 border border-accent/30 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                         <p className="text-accent font-semibold text-sm">🎉 Your Growth Map is ready!</p>
                         <p className="text-white/60 text-xs mt-0.5">Check your email — we've sent your Growth Map.</p>
                      </div>
                      <a
                        href="/auth"
                        className="shrink-0"
                      >
                        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          Log In to View
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-accent text-accent-foreground rounded-br-md"
                            : "bg-white/10 text-primary-foreground rounded-bl-md"
                        }`}
                      >
                        <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role !== "jericho" && (
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
                    placeholder="Type your answer..."
                    disabled={isLoading}
                    className="flex-1 bg-white/10 border-white/20 text-primary-foreground placeholder:text-white/40 focus-visible:ring-accent"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
