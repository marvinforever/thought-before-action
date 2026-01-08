import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  Send, 
  Loader2,
  LogOut,
  LayoutDashboard,
  PanelRightOpen,
  Sparkles,
  Building2,
  Users,
  TrendingUp,
  Plus,
  Headphones,
  CalendarDays
} from "lucide-react";
import { VoiceRecorder } from "@/components/sales/VoiceRecorder";
import { PipelineView } from "@/components/sales/PipelineView";
import { DealsTable } from "@/components/sales/DealsTable";
import { CompaniesManager } from "@/components/sales/CompaniesManager";
import { ContactsManager } from "@/components/sales/ContactsManager";
import { AddDealDialog } from "@/components/sales/AddDealDialog";
import { DealCoachDialog } from "@/components/sales/DealCoachDialog";
import { SalesKnowledgePodcasts } from "@/components/sales/SalesKnowledgePodcasts";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Companies with access to 4-call methodology
const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const FOUR_CALL_COMPANIES = [STATELINE_COMPANY_ID, MOMENTUM_COMPANY_ID];

const SalesTrainer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isEnabled: hasAccess, loading: flagLoading } = useFeatureFlag('sales_trainer');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasMethodologyAccess, setHasMethodologyAccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth?redirect=/sales-trainer");
        return;
      }

      setUser(session.user);
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);
      
      // Check if user has access to 4-call methodology
      setHasMethodologyAccess(FOUR_CALL_COMPANIES.includes(profileData?.company_id));
      
      await fetchDeals(session.user.id);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth?redirect=/sales-trainer");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchDeals = async (userId: string) => {
    const { data } = await supabase
      .from("sales_deals")
      .select(`
        *, 
        sales_companies(name),
        sales_contacts(name, title)
      `)
      .eq("profile_id", userId)
      .order("priority");
    
    setDeals(data || []);
  };

  const startCoaching = async () => {
    setHasStarted(true);
    setChatLoading(true);

    const firstName = profile?.full_name?.split(" ")[0] || "friend";
    const dealCount = deals.length;

    try {
      let openingMessage = "";
      
      if (dealCount === 0) {
        openingMessage = `Let's build your pipeline from scratch. What's ONE prospect you've been thinking about reaching out to? Give me a company name or a grower you've had your eye on.`;
      } else {
        const stageCounts = deals.reduce((acc: any, d) => {
          acc[d.stage] = (acc[d.stage] || 0) + 1;
          return acc;
        }, {});
        
        const topStage = Object.entries(stageCounts).sort((a: any, b: any) => b[1] - a[1])[0];
        const topDeal = deals.find(d => d.priority <= 2);
        
        openingMessage = `You've got ${dealCount} deal${dealCount > 1 ? 's' : ''} cooking. Most are in ${topStage?.[0] || 'your pipeline'}. ${topDeal ? `I see "${topDeal.deal_name}" is high priority - want to game plan that one? Or tell me what's on your mind today.` : `What's the one deal you need to move forward this week?`}`;
      }

      setMessages([{
        role: "assistant",
        content: `Hey ${firstName}! 👋 Ready to get some deals moving?\n\n${openingMessage}`
      }]);
    } catch (error) {
      console.error("Error starting coaching:", error);
      setMessages([{
        role: "assistant", 
        content: "Hey! Ready to work on your sales game. What's on your mind today?"
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setChatLoading(true);

    try {
      const pipelineContext = deals.length > 0 
        ? deals.map(d => 
            `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || 'Unknown'}. Priority: ${d.priority}/5. ${d.notes ? `Notes: ${d.notes}` : ''}`
          ).join("\n")
        : "No deals in pipeline yet.";

      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");

      // Check if this is a 4-call plan request
      const isCallPlanRequest = text.toLowerCase().includes('4-call') || 
                                text.toLowerCase().includes('generate') && text.toLowerCase().includes('plan') ||
                                text.toLowerCase().includes('call plan');

      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: text,
          deal: null,
          conversationHistory,
          generateCallPlan: isCallPlanRequest && hasMethodologyAccess,
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "Let me think on that...";
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
      
      // Silently refresh deals if one was created
      if (response.data?.dealCreated && user?.id) {
        fetchDeals(user.id);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Coach unavailable", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  if (loading || flagLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Target className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Feature Not Available</h2>
            <p className="text-muted-foreground">
              The Sales Trainer feature is not enabled for your account. Contact your administrator for access.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stages = [
    { key: "prospecting", label: "Prospecting", color: "bg-blue-500" },
    { key: "discovery", label: "Discovery", color: "bg-purple-500" },
    { key: "proposal", label: "Proposal", color: "bg-amber-500" },
    { key: "closing", label: "Closing", color: "bg-green-500" },
    { key: "follow_up", label: "Follow Up", color: "bg-teal-500" }
  ];

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Compact Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Jericho</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Sales Coach</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {deals.length > 0 && (
              <Badge variant="secondary" className="hidden sm:flex">
                {deals.length} deals · ${totalValue.toLocaleString()}
              </Badge>
            )}
            <Sheet open={showDataPanel} onOpenChange={setShowDataPanel}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <PanelRightOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="h-full w-screen max-w-[100vw] sm:w-[520px] sm:max-w-[100vw] flex flex-col p-0 overflow-hidden"
              >
                <SheetHeader className="p-6 pb-4 shrink-0">
                  <SheetTitle className="flex items-center justify-between">
                    Your Pipeline
                    <Button size="sm" onClick={() => setShowAddDeal(true)} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add Deal
                    </Button>
                  </SheetTitle>
                </SheetHeader>
                <Tabs defaultValue="pipeline" className="flex-1 flex flex-col min-h-0 px-6">
                  <TabsList className="grid grid-cols-5 w-full shrink-0">
                    <TabsTrigger value="pipeline"><Target className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="deals"><TrendingUp className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="companies"><Building2 className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="contacts"><Users className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="podcasts"><Headphones className="h-4 w-4" /></TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4 pb-6">
                    <TabsContent value="pipeline" className="mt-0 h-full">
                      <PipelineView 
                        userId={user?.id} 
                        stages={stages} 
                      />
                    </TabsContent>
                    <TabsContent value="deals" className="mt-0"><DealsTable userId={user?.id} /></TabsContent>
                    <TabsContent value="companies" className="mt-0"><CompaniesManager userId={user?.id} /></TabsContent>
                    <TabsContent value="contacts" className="mt-0"><ContactsManager userId={user?.id} /></TabsContent>
                    <TabsContent value="podcasts" className="mt-0"><SalesKnowledgePodcasts userId={user?.id} /></TabsContent>
                  </div>
                </Tabs>
              </SheetContent>
            </Sheet>
            {profile?.company_id && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col max-w-3xl">
        {!hasStarted ? (
          /* Welcome State */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-6 shadow-xl">
              <Sparkles className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-bold mb-2">
              Hey{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! 👋
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              I'm Jericho, your AI sales coach. Let's work on your pipeline and close some deals together.
            </p>
            
            <Button 
              size="lg" 
              onClick={startCoaching}
              className="gap-2 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="h-5 w-5" />
              Let's Get Started
            </Button>

            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {[
                "Prospecting strategies",
                "Discovery questions", 
                "Handle objections",
                "Close more deals"
              ].map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-sm py-1.5 px-3">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          /* Active Coaching State */
          <>
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-2 mt-1 shrink-0">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-2">
                      <Sparkles className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <Card className="bg-card">
                      <CardContent className="p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {hasMethodologyAccess && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => sendMessage("Generate a 4-call plan for a grower I'm working with")}
                    className="gap-1 bg-amber-600 hover:bg-amber-700"
                  >
                    <CalendarDays className="h-3 w-3" />
                    Generate 4-Call Plan
                  </Button>
                )}
                {deals.length === 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddDeal(true)}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add my first deal
                  </Button>
                )}
                {hasMethodologyAccess ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => sendMessage("Walk me through the Season Review process")}
                    >
                      Season Review tips
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => sendMessage("How do we hit the 111.4 goal?")}
                    >
                      111.4 Strategy
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => sendMessage("Walk me through your 5-step sales process")}
                    >
                      Teach me the process
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => sendMessage("How do I set appointments effectively?")}
                    >
                      Appointment setting tips
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 pt-4 border-t bg-background/50 backdrop-blur-sm -mx-4 px-4 pb-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about sales..."
                className="resize-none min-h-[52px]"
                rows={2}
              />
              <VoiceRecorder 
                onTranscript={(text) => setInput(prev => prev ? `${prev} ${text}` : text)}
                disabled={chatLoading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={chatLoading || !input.trim()}
                className="px-4 self-end"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </main>

      <AddDealDialog 
        open={showAddDeal} 
        onOpenChange={setShowAddDeal}
        userId={user?.id}
        onSuccess={() => {
          setShowAddDeal(false);
          fetchDeals(user?.id);
          if (hasStarted) {
            sendMessage("I just added a new deal to my pipeline. What should I focus on first?");
          }
        }}
      />

      {selectedDeal && (
        <DealCoachDialog
          deal={selectedDeal}
          open={!!selectedDeal}
          onOpenChange={(open) => !open && setSelectedDeal(null)}
        />
      )}
    </div>
  );
};

export default SalesTrainer;
