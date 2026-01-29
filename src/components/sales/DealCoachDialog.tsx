import { useState, useEffect, useRef } from "react";
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
import { FormattedMessage } from "@/components/ui/formatted-message";
import { Send, Loader2, Building2, DollarSign, Target, Calendar, History, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PurchaseHistoryCard } from "./PurchaseHistoryCard";

interface DealCoachDialogProps {
  deal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface RelevantContext {
  content: string;
  created_at: string;
  role: string;
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

export const DealCoachDialog = ({ deal, open, onOpenChange, userId }: DealCoachDialogProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relevantContext, setRelevantContext] = useState<RelevantContext[]>([]);
  const [showContext, setShowContext] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (open && deal?.id) {
      hasLoadedRef.current = false;
      loadExistingMessages();
      loadRelevantContext();
    }
  }, [open, deal?.id]);

  // Load persisted coaching messages for this deal
  const loadExistingMessages = async () => {
    if (!deal?.id || hasLoadedRef.current) return;
    
    hasLoadedRef.current = true;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("deal_coaching_messages")
        .select("id, role, content, created_at")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setMessages(data.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
      } else {
        // No existing messages, generate initial analysis
        await generateInitialAnalysis();
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      await generateInitialAnalysis();
    } finally {
      setLoading(false);
    }
  };

  // Load relevant context from main conversation about this customer/deal
  const loadRelevantContext = async () => {
    if (!deal?.sales_companies?.name && !deal?.deal_name) return;
    
    const customerName = deal?.sales_companies?.name || deal?.deal_name;
    
    try {
      // Search conversation_messages for mentions of this customer
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("content, created_at, role")
        .or(`content.ilike.%${customerName}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        setRelevantContext(data);
      }
    } catch (error) {
      console.error("Error loading context:", error);
    }
  };

  // Save a message to the database
  const saveMessage = async (role: "user" | "assistant", content: string) => {
    if (!deal?.id || !userId) return;
    
    try {
      await supabase.from("deal_coaching_messages").insert({
        deal_id: deal.id,
        profile_id: userId,
        role,
        content,
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const generateInitialAnalysis = async () => {
    try {
      // Build context string from relevant main chat history
      const contextStr = relevantContext.length > 0
        ? `\n\nRelevant context from previous conversations:\n${relevantContext.map(c => `${c.role}: ${c.content}`).join("\n")}`
        : "";

      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: `Analyze this deal and give me 3-4 specific, actionable recommendations for moving it forward. Consider the current stage (${stageLabels[deal.stage]}) and any notes provided.${contextStr}`,
          deal,
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "Let me analyze this deal for you...";
      setMessages([{ role: "assistant", content: assistantMessage }]);
      
      // Persist the initial analysis
      await saveMessage("assistant", assistantMessage);
    } catch (error) {
      console.error("Initial analysis error:", error);
      toast({ 
        title: "Coach unavailable", 
        description: "Couldn't connect to the sales coach. Please try again.",
        variant: "destructive" 
      });
      const fallbackMsg = "I'm ready to help you with this deal. What would you like to know?";
      setMessages([{ role: "assistant", content: fallbackMsg }]);
      await saveMessage("assistant", fallbackMsg);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    // Persist user message
    await saveMessage("user", text);

    try {
      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");
      
      // Include relevant context from main chat
      const contextStr = relevantContext.length > 0
        ? `\n\nRelevant context from previous conversations about this customer:\n${relevantContext.slice(0, 5).map(c => `${c.role}: ${c.content}`).join("\n")}`
        : "";

      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: text + contextStr,
          deal,
          conversationHistory,
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "I'm having trouble responding. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
      
      // Persist assistant response
      await saveMessage("assistant", assistantMessage);
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

        {/* Relevant Context from Main Chat */}
        {relevantContext.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs flex items-center gap-1 text-muted-foreground"
              onClick={() => setShowContext(!showContext)}
            >
              <History className="h-3 w-3" />
              {showContext ? "Hide" : "Show"} {relevantContext.length} related conversations
            </Button>
            {showContext && (
              <Card className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Previous mentions of {deal?.sales_companies?.name || deal?.deal_name}:
                </p>
                <ScrollArea className="max-h-32">
                  <div className="space-y-2">
                    {relevantContext.slice(0, 5).map((ctx, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <span className="font-medium">{ctx.role === 'user' ? 'You' : 'Jericho'}:</span>{' '}
                        {ctx.content.length > 150 ? ctx.content.slice(0, 150) + '...' : ctx.content}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}
          </div>
        )}

        {/* Purchase History */}
        {deal?.sales_companies?.name && (
          <PurchaseHistoryCard 
            customerName={deal.sales_companies.name}
            defaultOpen={false}
          />
        )}

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
                  {msg.role === "assistant" ? (
                    <FormattedMessage content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
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
