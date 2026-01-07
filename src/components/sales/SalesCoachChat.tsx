import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Target, Lightbulb, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesCoachChatProps {
  userId: string;
  userName?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const quickPrompts = [
  { icon: Target, label: "Review my pipeline", prompt: "Can you review my current pipeline and suggest priorities for this week?" },
  { icon: Lightbulb, label: "Prospecting ideas", prompt: "Give me 3 creative prospecting strategies for agricultural sales." },
  { icon: TrendingUp, label: "Closing tips", prompt: "I have deals in closing stage - what are best practices to get them across the finish line?" },
];

export const SalesCoachChat = ({ userId, userName }: SalesCoachChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pipelineContext, setPipelineContext] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPipelineContext();
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchPipelineContext = async () => {
    const { data: deals } = await supabase
      .from("sales_deals")
      .select(`
        deal_name, stage, value, expected_close_date, priority, notes,
        sales_companies(name),
        sales_contacts(name, title)
      `)
      .eq("profile_id", userId)
      .order("priority");

    if (deals && deals.length > 0) {
      const context = deals.map(d => 
        `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || 'Unknown company'}. Priority: ${d.priority}. Close: ${d.expected_close_date || 'TBD'}. ${d.notes ? `Notes: ${d.notes}` : ''}`
      ).join("\n");
      setPipelineContext(context);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      // Fetch sales knowledge
      const { data: knowledge } = await supabase
        .from("sales_knowledge")
        .select("title, content, category, stage")
        .eq("is_active", true)
        .limit(10);

      const knowledgeContext = knowledge?.map(k => 
        `[${k.category || k.stage || 'General'}] ${k.title}: ${k.content}`
      ).join("\n\n") || "";

      const systemPrompt = `You are Jericho, an expert AI sales coach specializing in agricultural sales for cooperatives and ag retailers. You practice consultative selling principles.

USER'S CURRENT PIPELINE:
${pipelineContext || "No deals in pipeline yet."}

SALES KNOWLEDGE BASE:
${knowledgeContext || "No specific training content loaded yet."}

YOUR COACHING APPROACH:
1. Be direct and actionable - salespeople need concrete next steps
2. Reference their specific deals when relevant
3. Use consultative selling frameworks: discovery questions, value selling, objection handling
4. Understand ag industry cycles (planting season, harvest, budget planning)
5. Help them prioritize based on deal stage and close dates
6. Encourage relationship building and understanding customer operations
7. Be encouraging but honest - push them to take action

Keep responses focused and practical. If they ask about a specific deal, pull context from their pipeline.`;

      const response = await supabase.functions.invoke("chat-with-jericho", {
        body: {
          message: text,
          systemPrompt,
          context: {
            mode: "sales_coach",
            userName,
            pipeline: pipelineContext,
          },
        },
      });

      if (response.error) throw response.error;

      // Handle streaming or direct response
      const assistantMessage = response.data?.message || response.data?.response || "I'm having trouble responding right now. Please try again.";
      
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error getting response", variant: "destructive" });
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
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

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Jericho Sales Coach
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get AI-powered coaching on your deals, prospecting strategies, and closing techniques
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Quick Prompts */}
        {messages.length === 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((qp, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sendMessage(qp.prompt)}
                >
                  <qp.icon className="h-3 w-3" />
                  {qp.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Ask me about your deals, prospecting strategies, or closing techniques.</p>
                <p className="text-xs mt-2">I have context on your pipeline and can give specific advice.</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
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
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your deals, get prospecting ideas, or request coaching..."
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
      </CardContent>
    </Card>
  );
};
