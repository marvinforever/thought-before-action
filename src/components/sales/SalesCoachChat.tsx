import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageCircle, Sparkles, Plus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesCoachChatProps {
  userId: string;
  userName?: string;
  companyId?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Welcoming conversation starters - just ONE question each
const conversationStarters = [
  { label: "I'm working a deal", prompt: "I've got a deal I'm working on..." },
  { label: "New prospect", prompt: "I just met a potential new customer..." },
  { label: "Manage pipeline", prompt: "Show me my current pipeline" },
  { label: "Stuck on something", prompt: "I'm stuck on something and need help..." },
];

export const SalesCoachChat = ({ userId, userName, companyId }: SalesCoachChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing conversation and user context on mount
  useEffect(() => {
    if (userId && companyId) {
      Promise.all([
        loadConversation(),
        fetchUserContext()
      ]).finally(() => setInitialLoading(false));
    }
  }, [userId, companyId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchUserContext = async () => {
    try {
      // Fetch deals
      const { data: deals } = await supabase
        .from("sales_deals")
        .select(`
          deal_name, stage, value, expected_close_date, priority, notes,
          sales_companies(name),
          sales_contacts(name, title)
        `)
        .eq("profile_id", userId)
        .order("priority")
        .limit(20);

      // Fetch 90-day goals / leading indicators (habits)
      const { data: habits } = await supabase
        .from("leading_indicators")
        .select("habit_name, target_frequency, habit_description")
        .eq("profile_id", userId)
        .eq("is_active", true)
        .limit(10);

      // Fetch user profile with job title
      const { data: profile } = await supabase
        .from("profiles")
        .select("job_title, full_name")
        .eq("id", userId)
        .single();

      // Fetch diagnostic responses for goals
      const { data: diagnostic } = await supabase
        .from("diagnostic_responses")
        .select("twelve_month_growth_goal, three_year_goal, one_year_vision, skill_to_master")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch recent growth journal entries
      const { data: journal } = await supabase
        .from("growth_journal")
        .select("entry_text, entry_date")
        .eq("profile_id", userId)
        .order("entry_date", { ascending: false })
        .limit(5);

      // Build context string
      let context = "";

      if (profile) {
        if (profile.job_title) context += `Role: ${profile.job_title}\n`;
      }

      if (diagnostic) {
        if (diagnostic.twelve_month_growth_goal) context += `12-Month Goal: ${diagnostic.twelve_month_growth_goal}\n`;
        if (diagnostic.three_year_goal) context += `3-Year Goal: ${diagnostic.three_year_goal}\n`;
        if (diagnostic.one_year_vision) context += `Vision: ${diagnostic.one_year_vision}\n`;
        if (diagnostic.skill_to_master) context += `Skill Focus: ${diagnostic.skill_to_master}\n`;
      }

      if (deals && deals.length > 0) {
        context += `\nCurrent Pipeline (${deals.length} deals):\n`;
        context += deals.map(d => 
          `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || 'Unknown'}. Priority: ${d.priority}. Close: ${d.expected_close_date || 'TBD'}.`
        ).join("\n");
      }

      if (habits && habits.length > 0) {
        context += `\n\n90-Day Habits/Goals:\n`;
        context += habits.map(h => `- ${h.habit_name} (${h.target_frequency}): ${h.habit_description || ''}`).join("\n");
      }

      if (journal && journal.length > 0) {
        context += `\n\nRecent Growth Journal:\n`;
        context += journal.map(j => `- ${j.entry_date}: ${j.entry_text.substring(0, 100)}...`).join("\n");
      }

      setUserContext(context);
    } catch (error) {
      console.error("Error fetching user context:", error);
    }
  };

  const loadConversation = async () => {
    try {
      // Get the most recent conversation for this user
      const { data: conversations } = await supabase
        .from("sales_coach_conversations")
        .select("id, created_at")
        .eq("profile_id", userId)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        const conv = conversations[0];
        setConversationId(conv.id);

        // Load messages
        const { data: msgs } = await supabase
          .from("sales_coach_messages")
          .select("role, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        if (msgs && msgs.length > 0) {
          setMessages(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const createConversation = async () => {
    const { data, error } = await supabase
      .from("sales_coach_conversations")
      .insert({
        profile_id: userId,
        company_id: companyId,
        title: "Sales Coaching Session"
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
    return data.id;
  };

  const saveMessage = async (convId: string, role: "user" | "assistant", content: string) => {
    await supabase
      .from("sales_coach_messages")
      .insert({
        conversation_id: convId,
        role,
        content
      });

    // Update conversation timestamp
    await supabase
      .from("sales_coach_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);
  };

  const startNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    toast({ title: "Started fresh conversation" });
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    // Ensure we have a conversation
    let currentConvId = conversationId;
    if (!currentConvId) {
      currentConvId = await createConversation();
      if (currentConvId) setConversationId(currentConvId);
    }

    // Save user message
    if (currentConvId) {
      await saveMessage(currentConvId, "user", text);
    }

    // Build conversation history for context
    const conversationHistory = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Jericho'}: ${m.content}`)
      .join('\n');

    try {
      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: text,
          conversationHistory,
          userContext, // Pass the rich user context
        },
      });

      if (response.error) throw response.error;

      let assistantMessage = response.data?.message || "I'm having trouble responding right now. Please try again.";
      
      // Clean up any deal detection blocks from the message
      assistantMessage = assistantMessage
        .replace(/\[DEAL_DETECTED\][\s\S]*?\[\/DEAL_DETECTED\]/g, '')
        .replace(/\[PIPELINE_ACTION\][\s\S]*?\[\/PIPELINE_ACTION\]/g, '')
        .trim();
      
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);

      // Save assistant message
      if (currentConvId) {
        await saveMessage(currentConvId, "assistant", assistantMessage);
      }

      // Show notifications for pipeline actions
      const pipelineActions = response.data?.pipelineActions || [];
      for (const action of pipelineActions) {
        if (action.success) {
          toast({ 
            title: action.action === 'move_deal' ? "📊 Deal moved!" :
                   action.action === 'update_deal' ? "✏️ Deal updated!" :
                   action.action === 'delete_deal' ? "🗑️ Deal deleted!" :
                   action.action === 'list_pipeline' ? "📋 Pipeline loaded" : "✅ Done!",
            description: action.message
          });
        } else {
          toast({ 
            title: "Action failed", 
            description: action.message,
            variant: "destructive" 
          });
        }
      }

      // Show deal creation notification
      if (response.data?.dealCreated) {
        toast({ title: "💼 New deal added to your pipeline!" });
      }

      // Refresh context if any pipeline changes were made
      if (response.data?.dealCreated || pipelineActions.length > 0) {
        fetchUserContext();
      }
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

  if (initialLoading) {
    return (
      <Card className="h-full flex flex-col border-0 shadow-none bg-transparent">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your conversation...</p>
          </div>
        </div>
      </Card>
    );
  }

  const hasStarted = messages.length > 0;

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
            I'm Jericho, your sales coach. I already know your pipeline, goals, and 90-day habits. Tell me what you're working on and I'll help you move it forward.
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
          {/* Header with new conversation button */}
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {messages.length} messages in this session
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              New Chat
            </Button>
          </div>

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
