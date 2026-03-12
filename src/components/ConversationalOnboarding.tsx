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

export function ConversationalOnboarding({ onComplete }: ConversationalOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading && open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, open, messages.length]);

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  const checkIfShouldShow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: context } = await supabase
        .from("user_active_context")
        .select("onboarding_complete")
        .eq("profile_id", user.id)
        .maybeSingle();

      if ((context as any)?.onboarding_complete) return;

      const { data: completeness } = await supabase
        .from("user_data_completeness")
        .select("onboarding_score")
        .eq("profile_id", user.id)
        .maybeSingle();

      if ((completeness as any)?.onboarding_score >= 50) return;
      if (sessionStorage.getItem("conversational_onboarding_dismissed")) return;

      setProfileId(user.id);
      setOpen(true);

      // Send initial greeting to backend
      if (!initializedRef.current) {
        initializedRef.current = true;
        await sendToBackend("hi", true);
      }
    } catch (error) {
      console.error("Error checking onboarding:", error);
    }
  };

  const sendToBackend = useCallback(async (userText: string, isInitial = false) => {
    if (!isInitial) {
      setMessages(prev => [...prev, { role: "user", content: userText }]);
    }

    setLoading(true);

    // Build history for context
    const history = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
    if (!isInitial) {
      history.push({ role: "user", content: userText });
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-jericho`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            message: isInitial ? "" : userText,
            messages: history,
            channel: "web",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Chat error: ${response.status}`);
      }

      // Handle streaming response
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let textBuffer = "";
        const placeholderId = Date.now();

        // Add placeholder assistant message
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
              if (typeof data.content === "string" && data.content.length) {
                accumulated += data.content;
                // Strip hidden context update blocks
                const display = accumulated.replace(/<!--CONTEXT_UPDATE[\s\S]*?-->/g, "").trim();
                setMessages(prev => {
                  const next = [...prev];
                  const lastIdx = next.length - 1;
                  if (next[lastIdx]?.role === "assistant") {
                    next[lastIdx] = { ...next[lastIdx], content: display };
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
              if (typeof data.content === "string" && data.content.length) {
                accumulated += data.content;
                const display = accumulated.replace(/<!--CONTEXT_UPDATE[\s\S]*?-->/g, "").trim();
                setMessages(prev => {
                  const next = [...prev];
                  const lastIdx = next.length - 1;
                  if (next[lastIdx]?.role === "assistant") {
                    next[lastIdx] = { ...next[lastIdx], content: display };
                  }
                  return next;
                });
              }
            } catch { /* ignore */ }
          }
        }

        // If no streaming content received, try to parse as regular JSON
        if (!accumulated) {
          // Already consumed the body via stream, nothing to do
        }
      } else {
        // Non-streaming response
        const data = await response.json();
        const reply = data.reply || data.response || data.content || "I'm here — what's on your mind?";
        const display = reply.replace(/<!--CONTEXT_UPDATE[\s\S]*?-->/g, "").trim();
        setMessages(prev => [...prev, { role: "assistant", content: display }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Something went wrong — try sending your message again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || isComplete) return;
    setInput("");
    await sendToBackend(trimmed);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("conversational_onboarding_dismissed", "true");
    setOpen(false);
    onComplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              <p className="text-xs text-primary-foreground/70">Your AI coach</p>
            </div>
          </div>
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
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
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
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
          >
            I'll finish this later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
