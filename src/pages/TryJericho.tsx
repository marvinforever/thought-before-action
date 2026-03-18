import { useState, useRef, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, ArrowRight, Loader2, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { trackEvent, getVariant } from "@/lib/posthog";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

type InteractiveElement = {
  element: "scale" | "quick-select" | "yes-no";
  id: string;
  prompt: string;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
  options?: Array<{ key: string; label: string }>;
};

type Message = {
  id: string;
  role: "jericho" | "user" | "interactive";
  text: string;
  interactiveData?: InteractiveElement;
  interactiveResponse?: string | number;
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
  if (existing) return existing.split("=")[1];
  const token = crypto.randomUUID();
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  return token;
}

// ── Progress Bar ──
function PlaybookProgressBar({ percent, label }: { percent: number; label: string }) {
  if (percent <= 0) return null;
  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-2xl mx-auto">
        <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent/80 to-accent rounded-full"
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-white/40 mt-1.5 text-center"
          >
            {label}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Scale Input (1–10) ──
function ScaleInput({
  id, prompt, min = 1, max = 10, labels, onSelect, disabled, selectedValue,
}: {
  id: string; prompt: string; min?: number; max?: number;
  labels?: Record<string, string>; onSelect: (id: string, value: number) => void;
  disabled?: boolean; selectedValue?: number;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70 font-medium">{prompt}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => !disabled && onSelect(id, v)}
            disabled={disabled}
            className={`w-10 h-10 rounded-full text-sm font-semibold transition-all flex items-center justify-center shrink-0 ${
              selectedValue === v
                ? "bg-accent text-accent-foreground scale-110 shadow-lg shadow-accent/30"
                : disabled
                ? "bg-white/5 text-white/20 cursor-default"
                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80 cursor-pointer"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between text-[11px] text-white/30 px-1">
          <span>{labels[String(min)]}</span>
          <span>{labels[String(max)]}</span>
        </div>
      )}
    </div>
  );
}

// ── Quick Select ──
function QuickSelect({
  id, prompt, options, onSelect, disabled, selectedKey,
}: {
  id: string; prompt: string; options: Array<{ key: string; label: string }>;
  onSelect: (id: string, key: string) => void; disabled?: boolean; selectedKey?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70 font-medium">{prompt}</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => !disabled && onSelect(id, opt.key)}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
              selectedKey === opt.key
                ? "bg-accent text-accent-foreground font-medium"
                : disabled
                ? "bg-white/5 text-white/20 cursor-default"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white/90 cursor-pointer"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Yes/No Input ──
function YesNoInput({
  id, prompt, onSelect, disabled, selectedValue,
}: {
  id: string; prompt: string; onSelect: (id: string, value: string) => void;
  disabled?: boolean; selectedValue?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70 font-medium">{prompt}</p>
      <div className="flex gap-3">
        {[{ key: "yes", label: "Yes" }, { key: "no", label: "No" }].map((opt) => (
          <button
            key={opt.key}
            onClick={() => !disabled && onSelect(id, opt.key)}
            disabled={disabled}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              selectedValue === opt.key
                ? "bg-accent text-accent-foreground"
                : disabled
                ? "bg-white/5 text-white/20 cursor-default"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 cursor-pointer"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Playbook Generating Animation ──
function PlaybookGenerating({ ready, onViewPlaybook }: { ready: boolean; onViewPlaybook: () => void }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = [
    "Analyzing your strengths…",
    "Mapping your growth edge…",
    "Curating your resources…",
    "Personalizing your roadmap…",
    "Finishing touches…",
  ];

  useEffect(() => {
    if (ready) return;
    const interval = setInterval(() => setStatusIdx((i) => (i + 1) % statuses.length), 3500);
    return () => clearInterval(interval);
  }, [ready]);

  return (
    <div className="border-t border-white/10 bg-primary/95 backdrop-blur-sm p-6">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        {!ready ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto"
            >
              <Sparkles className="w-7 h-7 text-accent" />
            </motion.div>
            <h3 className="text-lg font-semibold text-primary-foreground">Building your Playbook…</h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={statusIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm text-white/50"
              >
                {statuses[statusIdx]}
              </motion.p>
            </AnimatePresence>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto"
            >
              <span className="text-2xl">🎉</span>
            </motion.div>
            <h3 className="text-lg font-semibold text-primary-foreground">Your Playbook is ready!</h3>
            <p className="text-sm text-white/50">Check your email — we've sent your login details.</p>
            <Button
              onClick={onViewPlaybook}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            >
              <Download className="w-4 h-4" />
              Log In to View Your Playbook
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Interactive Response Display ──
function InteractiveResponseBubble({ data, response }: { data: InteractiveElement; response: string | number }) {
  if (data.element === "scale") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-accent-foreground">{response}</span>
        <span className="text-sm text-accent-foreground/70">/ {data.max || 10}</span>
      </div>
    );
  }
  if (data.element === "quick-select") {
    const opt = data.options?.find((o) => o.key === response);
    return <span className="text-sm">{opt?.label || String(response)}</span>;
  }
  return <span className="text-sm font-medium">{response === "yes" ? "Yes" : "No"}</span>;
}

// ══════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════

export default function TryJericho() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken] = useState(() => getOrCreateSessionToken());
  const [reportReady, setReportReady] = useState(false);
  const [reportProfileId, setReportProfileId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [playbookReady, setPlaybookReady] = useState(false);
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
          setPlaybookReady(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* silently retry */ }
    };
    pollRef.current = setInterval(poll, 8000);
    poll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [reportProfileId, reportReady]);

  const handleStart = async () => {
    setStarted(true);
    trackEvent("coaching_conversation_started", { variant: getVariant("try_opening_variant") });
    setTimeout(() => inputRef.current?.focus(), 400);
    await sendToJericho("hi");
  };

  const handleInteractiveSelect = async (id: string, value: string | number) => {
    // Mark answered
    setMessages((prev) =>
      prev.map((m) =>
        m.interactiveData?.id === id ? { ...m, interactiveResponse: value } : m
      )
    );
    await sendToJericho(`[INTERACTIVE:${id}:${value}]`);
  };

  const sendToJericho = async (userText: string) => {
    const isInteractive = userText.startsWith("[INTERACTIVE:");
    const isInitial = messages.length === 0 && userText === "hi";

    const userMsg: Message = { id: generateId(), role: "user", text: userText };
    const assistantMsg: Message = { id: generateId(), role: "jericho", text: "" };

    if (isInitial) {
      setMessages((prev) => [...prev, assistantMsg]);
    } else if (isInteractive) {
      // Don't show raw interactive messages as user bubbles — they're already rendered inline
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    }
    setIsLoading(true);

    const history = messages
      .filter((m) => m.role !== "interactive")
      .map((m) => ({
        role: m.role === "jericho" ? "assistant" : "user",
        content: m.text,
      }));

    if (!isInitial) {
      history.push({ role: "user", content: userText });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

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
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) throw new Error("Failed to get response");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let textBuffer = "";

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
            const type = data.type || (data.content !== undefined ? "text" : data.done ? "done" : "text");

            switch (type) {
              case "text": {
                if (data.profile_id && !reportProfileId) {
                  setReportProfileId(data.profile_id);
                }
                if (typeof data.content === "string" && data.content.length) {
                  accumulated += data.content;
                  const display = accumulated.trim();
                  setMessages((prev) => {
                    const next = [...prev];
                    const lastIdx = next.length - 1;
                    if (next[lastIdx]?.role === "jericho") {
                      next[lastIdx] = { ...next[lastIdx], text: display };
                    }
                    return next;
                  });
                }
                break;
              }
              case "interactive": {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    role: "interactive",
                    text: "",
                    interactiveData: {
                      element: data.element,
                      id: data.id,
                      prompt: data.prompt,
                      min: data.min,
                      max: data.max,
                      labels: data.labels,
                      options: data.options,
                    },
                  },
                ]);
                break;
              }
              case "progress": {
                setProgressPercent(data.percent || 0);
                setProgressLabel(data.label || "");
                break;
              }
              case "generation": {
                if (data.status === "started") {
                  setGenerating(true);
                  setProgressPercent(100);
                  setProgressLabel("Building your Playbook…");
                } else if (data.status === "complete") {
                  setPlaybookReady(true);
                  if (data.profile_id) setReportProfileId(data.profile_id);
                }
                break;
              }
              case "done": {
                break;
              }
            }
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
            if (data.profile_id && !reportProfileId) setReportProfileId(data.profile_id);
            if (typeof data.content === "string" && data.content.length) {
              accumulated += data.content;
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (next[lastIdx]?.role === "jericho") {
                  next[lastIdx] = { ...next[lastIdx], text: accumulated.trim() };
                }
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      console.error("Stream error:", isTimeout ? "Request timed out" : err);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.role === "jericho" && !next[lastIdx].text) {
          next[lastIdx] = {
            ...next[lastIdx],
            text: isTimeout
              ? "Still thinking… tap to retry ↻"
              : "Something went wrong — try sending your message again.",
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
          content="Meet Jericho, your performance coach. Start a conversation and get your personalized Growth Playbook."
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
            <a href="/auth" className="text-sm text-muted-foreground hover:text-primary-foreground transition-colors">
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
                  Let's build your Growth Playbook.
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
                  No login required. Just a conversation.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap justify-center gap-3 mt-16 max-w-lg"
              >
                {["Growth Playbook", "Career Clarity", "Strengths Map", "Development Edge", "Quick Win"].map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60">
                    {f}
                  </span>
                ))}
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
              {/* Progress Bar */}
              <PlaybookProgressBar percent={progressPercent} label={progressLabel} />

              {/* Report Ready Banner */}
              <AnimatePresence>
                {reportReady && !generating && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mx-4 mt-2"
                  >
                    <div className="max-w-2xl mx-auto bg-accent/15 border border-accent/30 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-accent font-semibold text-sm">🎉 Your Growth Playbook is ready!</p>
                        <p className="text-white/60 text-xs mt-0.5">Check your email — we've sent your Playbook.</p>
                      </div>
                      <a href="/auth" className="shrink-0">
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
                  {messages.map((msg) => {
                    // Interactive element
                    if (msg.role === "interactive" && msg.interactiveData) {
                      const d = msg.interactiveData;
                      const answered = msg.interactiveResponse !== undefined;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex justify-start"
                        >
                          <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md px-4 py-3 bg-white/10">
                            {d.element === "scale" && (
                              <ScaleInput
                                id={d.id}
                                prompt={d.prompt}
                                min={d.min}
                                max={d.max}
                                labels={d.labels}
                                onSelect={handleInteractiveSelect}
                                disabled={answered}
                                selectedValue={answered ? Number(msg.interactiveResponse) : undefined}
                              />
                            )}
                            {d.element === "quick-select" && d.options && (
                              <QuickSelect
                                id={d.id}
                                prompt={d.prompt}
                                options={d.options}
                                onSelect={handleInteractiveSelect}
                                disabled={answered}
                                selectedKey={answered ? String(msg.interactiveResponse) : undefined}
                              />
                            )}
                            {d.element === "yes-no" && (
                              <YesNoInput
                                id={d.id}
                                prompt={d.prompt}
                                onSelect={handleInteractiveSelect}
                                disabled={answered}
                                selectedValue={answered ? String(msg.interactiveResponse) : undefined}
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    }

                    // User interactive response bubble
                    if (msg.role === "user" && msg.text.startsWith("[INTERACTIVE:")) {
                      return null; // Hidden — response shown inline on the interactive element
                    }

                    // Regular messages
                    return (
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
                          {msg.role === "user" && msg.interactiveData && msg.interactiveResponse !== undefined ? (
                            <InteractiveResponseBubble data={msg.interactiveData} response={msg.interactiveResponse} />
                          ) : (
                            <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2">
                              <ReactMarkdown>{msg.text.replace(/\[INTERACTIVE:[^\]]*\]/g, '').trim()}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {isLoading && messages[messages.length - 1]?.role !== "jericho" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
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

              {/* Input or Generation Animation */}
              {generating ? (
                <PlaybookGenerating ready={playbookReady} onViewPlaybook={() => window.location.href = "/auth"} />
              ) : (
                <div className="border-t border-white/10 bg-primary/95 backdrop-blur-sm p-4">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
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
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
