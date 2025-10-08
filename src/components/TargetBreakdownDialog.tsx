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

      setMessages([{ role: "user", content: initialPrompt }]);

      const { data, error } = await supabase.functions.invoke("chat-with-jericho", {
        body: {
          message: initialPrompt,
          conversationId: null,
          contextType: "90-day-breakdown",
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error: any) {
      console.error("Error generating suggestions:", error);
      toast({
        title: "Error",
        description: "Failed to generate suggestions",
        variant: "destructive",
      });
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
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

      const { data, error } = await supabase.functions.invoke("chat-with-jericho", {
        body: {
          message: userMessage,
          conversationId: null,
          contextType: "90-day-breakdown",
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
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
