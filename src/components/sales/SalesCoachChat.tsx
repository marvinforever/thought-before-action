import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageCircle, Sparkles, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesCoachChatProps {
  userId: string;
  userName?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Welcoming conversation starters - just ONE question each
const conversationStarters = [
  { label: "I'm working a deal", prompt: "I've got a deal I'm working on..." },
  { label: "New prospect", prompt: "I just met a potential new customer..." },
  { label: "Stuck on something", prompt: "I'm stuck on something and need help..." },
];

export const SalesCoachChat = ({ userId, userName }: SalesCoachChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pipelineContext, setPipelineContext] = useState<string>("");
  const [hasStarted, setHasStarted] = useState(false);
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

  // Parse deal info from AI response and auto-create
  const extractAndCreateDeal = async (response: string) => {
    const dealMatch = response.match(/\[DEAL_DETECTED\]([\s\S]*?)\[\/DEAL_DETECTED\]/);
    if (!dealMatch) return response;

    const dealBlock = dealMatch[1];
    const getField = (field: string) => {
      const match = dealBlock.match(new RegExp(`${field}:\\s*(.+)`, 'i'));
      return match ? match[1].trim() : null;
    };

    const companyName = getField('company_name');
    const contactName = getField('contact_name');
    const stage = getField('stage') || 'prospecting';
    const valueStr = getField('value');
    const notes = getField('notes');

    if (companyName && companyName !== 'null') {
      try {
        // Create or find company
        let companyId: string | null = null;
        const { data: existingCompany } = await supabase
          .from('sales_companies')
          .select('id')
          .eq('profile_id', userId)
          .ilike('name', companyName)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const { data: newCompany } = await supabase
            .from('sales_companies')
            .insert({ name: companyName, profile_id: userId })
            .select('id')
            .single();
          companyId = newCompany?.id || null;
        }

        // Create deal
        const value = valueStr && valueStr !== 'null' ? parseInt(valueStr.replace(/[^0-9]/g, '')) : null;
        
        const { error: dealError } = await supabase
          .from('sales_deals')
          .insert({
            deal_name: `${companyName} Opportunity`,
            company_id: companyId,
            profile_id: userId,
            stage: stage as any,
            value: value,
            notes: notes,
            priority: 3,
          });

        if (!dealError) {
          toast({
            title: "Deal added to your pipeline!",
            description: `${companyName} - ${stage}`,
          });
          fetchPipelineContext(); // Refresh context
        }
      } catch (e) {
        console.error('Auto-create deal error:', e);
      }
    }

    // Remove the deal block from visible message
    return response.replace(/\[DEAL_DETECTED\][\s\S]*?\[\/DEAL_DETECTED\]/g, '').trim();
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setHasStarted(true);
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    // Build conversation history for context
    const conversationHistory = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Jericho'}: ${m.content}`)
      .join('\n');

    try {
      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: text,
          conversationHistory,
        },
      });

      if (response.error) throw response.error;

      let assistantMessage = response.data?.message || "I'm having trouble responding right now. Please try again.";
      
      // Extract and auto-create any detected deals
      assistantMessage = await extractAndCreateDeal(assistantMessage);
      
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
    <Card className="h-full flex flex-col border-0 shadow-none bg-transparent">
      {!hasStarted ? (
        // Welcome state - warm, inviting
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Hey{userName ? `, ${userName.split(' ')[0]}` : ''}!</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            I'm Jericho, your sales coach. Tell me what you're working on and I'll help you move it forward.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {conversationStarters.map((starter, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="gap-2"
                onClick={() => sendMessage(starter.prompt)}
              >
                <MessageCircle className="h-4 w-4" />
                {starter.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Pro tip: When you tell me about deals, I'll automatically add them to your pipeline ✨
          </p>
        </div>
      ) : (
        // Chat state
        <>
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div 
                        className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:font-semibold"
                        dangerouslySetInnerHTML={{ 
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/^### (.*$)/gm, '<h4>$1</h4>')
                            .replace(/^## (.*$)/gm, '<h3>$1</h3>')
                            .replace(/^# (.*$)/gm, '<h2>$1</h2>')
                            .replace(/^- (.*$)/gm, '<li>$1</li>')
                            .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
                            .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4">$&</ul>')
                            .replace(/\n\n/g, '</p><p>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input - clean, simple */}
          <div className="p-4 border-t">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                className="resize-none rounded-xl"
                rows={1}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                size="icon"
                className="rounded-xl shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
