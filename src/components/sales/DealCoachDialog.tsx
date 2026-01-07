import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Building2, DollarSign, Target, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DealCoachDialogProps {
  deal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const stageLabels: Record<string, string> = {
  prospecting: "Prospecting",
  discovery: "Discovery",
  proposal: "Proposal",
  closing: "Closing",
  follow_up: "Follow Up",
};

const stagePrompts: Record<string, string[]> = {
  prospecting: [
    "How should I approach this prospect?",
    "What research should I do before reaching out?",
    "Give me a compelling opening message",
  ],
  discovery: [
    "What discovery questions should I ask?",
    "How do I uncover their real pain points?",
    "What should I learn about their operation?",
  ],
  proposal: [
    "How should I structure my proposal?",
    "What objections should I prepare for?",
    "How do I differentiate from competition?",
  ],
  closing: [
    "What closing techniques should I use?",
    "How do I handle if they need to 'think about it'?",
    "What's the best way to ask for the business?",
  ],
  follow_up: [
    "How do I stay top of mind without being pushy?",
    "What value can I add in follow-up?",
    "How do I re-engage a stalled deal?",
  ],
};

export const DealCoachDialog = ({ deal, open, onOpenChange }: DealCoachDialogProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMessages([]);
      // Auto-generate initial analysis
      generateInitialAnalysis();
    }
  }, [open, deal?.id]);

  const generateInitialAnalysis = async () => {
    setLoading(true);
    try {
      const dealContext = `
Deal: ${deal.deal_name}
Company: ${deal.sales_companies?.name || "Unknown"}
Stage: ${stageLabels[deal.stage]}
Value: $${deal.value?.toLocaleString() || "Not specified"}
Expected Close: ${deal.expected_close_date ? format(new Date(deal.expected_close_date), "MMM d, yyyy") : "Not set"}
Priority: ${deal.priority}/5
Probability: ${deal.probability}%
Notes: ${deal.notes || "None"}
`;

      // Get stage-specific knowledge
      const { data: knowledge } = await supabase
        .from("sales_knowledge")
        .select("title, content")
        .or(`stage.eq.${deal.stage},category.eq.general`)
        .eq("is_active", true)
        .limit(5);

      const knowledgeContext = knowledge?.map(k => `${k.title}: ${k.content}`).join("\n\n") || "";

      const response = await supabase.functions.invoke("chat-with-jericho", {
        body: {
          message: `Analyze this deal and give me 3-4 specific, actionable recommendations for moving it forward. Consider the current stage (${stageLabels[deal.stage]}) and any notes provided.`,
          systemPrompt: `You are Jericho, an expert agricultural sales coach. Analyze this deal and provide specific, actionable coaching.

DEAL DETAILS:
${dealContext}

SALES KNOWLEDGE:
${knowledgeContext}

Provide your analysis in this format:
1. Quick assessment (1-2 sentences)
2. 3-4 specific action items for this stage
3. One thing to watch out for

Be direct and practical. Reference specific details from the deal.`,
          context: { mode: "deal_coach", deal },
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || response.data?.response || "Let me analyze this deal for you...";
      setMessages([{ role: "assistant", content: assistantMessage }]);
    } catch (error) {
      console.error("Initial analysis error:", error);
      setMessages([{ role: "assistant", content: "I'm ready to help you with this deal. What would you like to know?" }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const dealContext = `
Deal: ${deal.deal_name}
Company: ${deal.sales_companies?.name || "Unknown"}
Stage: ${stageLabels[deal.stage]}
Value: $${deal.value?.toLocaleString() || "Not specified"}
Notes: ${deal.notes || "None"}
`;

      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");

      const response = await supabase.functions.invoke("chat-with-jericho", {
        body: {
          message: text,
          systemPrompt: `You are Jericho, an expert agricultural sales coach helping with a specific deal.

DEAL CONTEXT:
${dealContext}

CONVERSATION SO FAR:
${conversationHistory}

Provide specific, actionable advice for this deal. Be direct and practical.`,
          context: { mode: "deal_coach", deal },
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || response.data?.response || "I'm having trouble responding. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error getting response", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentStagePrompts = stagePrompts[deal?.stage] || stagePrompts.prospecting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Coach: {deal?.deal_name}
          </DialogTitle>
        </DialogHeader>

        {/* Deal Summary */}
        <Card className="p-3 bg-muted/50">
          <div className="flex items-center gap-4 text-sm">
            {deal?.sales_companies?.name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {deal.sales_companies.name}
              </span>
            )}
            <Badge>{stageLabels[deal?.stage]}</Badge>
            {deal?.value && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {Number(deal.value).toLocaleString()}
              </span>
            )}
            {deal?.expected_close_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(deal.expected_close_date), "MMM d")}
              </span>
            )}
          </div>
        </Card>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2">
          {currentStagePrompts.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => sendMessage(prompt)}
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-[200px] pr-4">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this deal..."
            className="resize-none"
            rows={2}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
