import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, Calendar, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type TargetBreakdownDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: {
    id: string;
    goal_text: string;
    quarter: string;
    category: string;
    benchmarks?: any[];
    sprints?: any[];
  } | null;
  onSave: () => void;
};

export default function TargetBreakdownDialog({
  open,
  onOpenChange,
  target,
  onSave,
}: TargetBreakdownDialogProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const streamJericho = async ({
    message,
    onToken,
  }: {
    message: string;
    onToken: (delta: string) => void;
  }) => {
    // NOTE: chat-with-jericho responds as an SSE stream in personal coaching mode.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-jericho`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message,
          conversationId: null,
          contextType: "90-day-breakdown",
          stream: true,
        }),
      }
    );

    if (!resp.ok || !resp.body) {
      const t = await resp.text().catch(() => "");
      throw new Error(t || `Jericho request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events separated by blank lines
      let boundaryIndex: number;
      while ((boundaryIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const lines = rawEvent.split("\n");
        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.done) {
              done = true;
              break;
            }
            if (typeof parsed.content === "string") {
              onToken(parsed.content);
            }
          } catch {
            // ignore malformed chunks
          }
        }

        if (done) break;
      }
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!target) return;

    setGenerating(true);
    setMessages([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const initialPrompt = `Help me break down this 90-day target into actionable steps:

Goal: ${target.goal_text}
Quarter: ${target.quarter}
Category: ${target.category}

Please provide:
1. Three 30-day benchmarks that build toward this goal
2. Specific 7-day sprints for the next week to get started

Format your response clearly with sections for benchmarks and sprints.`;

      setMessages([
        { role: "user", content: initialPrompt },
        { role: "assistant", content: "" },
      ]);

      let assistantSoFar = "";
      await streamJericho({
        message: initialPrompt,
        onToken: (delta) => {
          assistantSoFar += delta;
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          );
        },
      });

      if (!assistantSoFar.trim()) {
        throw new Error("No response received from Jericho");
      }
    } catch (error: any) {
      console.error("Error generating suggestions:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate suggestions",
        variant: "destructive",
      });
      // Remove the empty assistant bubble if any
      setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && !m.content)));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !target) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }, { role: "assistant", content: "" }]);

      let assistantSoFar = "";
      await streamJericho({
        message: userMessage,
        onToken: (delta) => {
          assistantSoFar += delta;
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          );
        },
      });

      if (!assistantSoFar.trim()) {
        throw new Error("No response received from Jericho");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send message",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && !m.content)));
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!target || messages.length === 0) return;

    try {
      const lastAssistantMessage = messages
        .filter((m) => m.role === "assistant")
        .pop();

      if (!lastAssistantMessage) return;

      // Parse the message to extract benchmarks and sprints
      // This is a simple implementation - you could make it more sophisticated
      const content = lastAssistantMessage.content;
      
      const { error } = await supabase
        .from("ninety_day_targets")
        .update({
          benchmarks: [{ content, generated_at: new Date().toISOString() }],
          sprints: [{ content, generated_at: new Date().toISOString() }],
        })
        .eq("id", target.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Suggestions saved to your target",
      });

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error applying suggestions:", error);
      toast({
        title: "Error",
        description: "Failed to apply suggestions",
        variant: "destructive",
      });
    }
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Break Down Your 90-Day Target
          </DialogTitle>
          <DialogDescription>
            Work with Jericho to create 30-day benchmarks and 7-day sprints
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Your Goal:</h3>
              <p className="text-sm text-muted-foreground">{target.goal_text}</p>
            </CardContent>
          </Card>

          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Let Jericho help you break this down into actionable steps
              </p>
              <Button
                onClick={handleGenerateSuggestions}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Get Jericho's Suggestions
                  </>
                )}
              </Button>
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary/10 ml-8"
                      : "bg-muted mr-8"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask Jericho for adjustments..."
                  className="flex-1 px-3 py-2 border rounded-md"
                  disabled={loading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApplySuggestions}>
                  Apply Suggestions
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
