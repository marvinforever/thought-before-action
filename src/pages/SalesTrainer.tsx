import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, LayoutDashboard, Loader2 } from "lucide-react";
import { SalesAgentHeader } from "@/components/sales/SalesAgentHeader";
import { SalesChatInterface } from "@/components/sales/SalesChatInterface";
import { AddDealDialog } from "@/components/sales/AddDealDialog";
import { DealCoachDialog } from "@/components/sales/DealCoachDialog";
import { PrepDocumentGenerator } from "@/components/sales/PrepDocumentGenerator";
import { SalesProposalWizard } from "@/components/sales/SalesProposalWizard";
import { FourCallPlanTracker } from "@/components/sales/FourCallPlanTracker";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface Company {
  id: string;
  name: string;
}

interface CompanyUser {
  id: string;
  full_name: string;
}

const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

type ChatMode = "coach" | "rec";

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
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasMethodologyAccess, setHasMethodologyAccess] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [viewAsCompanyId, setViewAsCompanyId] = useState<string | null>(null);
  const [viewAsCompanyName, setViewAsCompanyName] = useState<string | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<string>("");
  const [showPrepGenerator, setShowPrepGenerator] = useState(false);
  const [showProposalWizard, setShowProposalWizard] = useState(false);
  const [showCallPlanTracker, setShowCallPlanTracker] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    const saved = localStorage.getItem('salesTrainerChatMode');
    return (saved === 'coach' || saved === 'rec') ? saved : 'rec';
  });

  // Derive methodology access from the *effective* company (View As company overrides profile company).
  // This prevents the 4-Call buttons from disappearing due to stale state.
  const effectiveCompanyId = viewAsCompanyId || profile?.company_id || null;
  const effectiveHasMethodologyAccess =
    effectiveCompanyId === STATELINE_COMPANY_ID || effectiveCompanyId === MOMENTUM_COMPANY_ID;

  useEffect(() => {
    // Keep existing state in sync for any other callers.
    setHasMethodologyAccess(effectiveHasMethodologyAccess);
  }, [effectiveHasMethodologyAccess]);

  const loadConversation = async (userId: string, companyId: string | null) => {
    if (!companyId) return;
    
    try {
      const { data: conversations } = await supabase
        .from("sales_coach_conversations")
        .select("id")
        .eq("profile_id", userId)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        const conv = conversations[0];
        setConversationId(conv.id);

        const { data: msgs } = await supabase
          .from("sales_coach_messages")
          .select("id, role, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        if (msgs && msgs.length > 0) {
          setMessages(msgs.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
          setHasStarted(true);
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const fetchUserContext = async (userId: string) => {
    try {
      const { data: diagnostic } = await supabase
        .from("diagnostic_responses")
        .select("twelve_month_growth_goal, three_year_goal, one_year_vision, skill_to_master")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: habits } = await supabase
        .from("leading_indicators")
        .select("habit_name, target_frequency, habit_description")
        .eq("profile_id", userId)
        .eq("is_active", true)
        .limit(10);

      let context = "";
      if (diagnostic) {
        if (diagnostic.twelve_month_growth_goal) context += `12-Month Goal: ${diagnostic.twelve_month_growth_goal}\n`;
        if (diagnostic.three_year_goal) context += `3-Year Goal: ${diagnostic.three_year_goal}\n`;
        if (diagnostic.skill_to_master) context += `Skill Focus: ${diagnostic.skill_to_master}\n`;
      }
      if (habits && habits.length > 0) {
        context += `\n90-Day Habits:\n${habits.map(h => `- ${h.habit_name}`).join("\n")}`;
      }
      setUserContext(context);
    } catch (error) {
      console.error("Error fetching user context:", error);
    }
  };

  const createConversation = async () => {
    if (!user?.id || !profile?.company_id) return null;
    
    const { data, error } = await supabase
      .from("sales_coach_conversations")
      .insert({
        profile_id: user.id,
        company_id: profile.company_id,
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
    const { data } = await supabase
      .from("sales_coach_messages")
      .insert({ conversation_id: convId, role, content })
      .select("id")
      .single();

    await supabase
      .from("sales_coach_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    return data?.id;
  };

  const startNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setHasStarted(false);
    toast({ title: "Started fresh conversation" });
  };

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
      setHasMethodologyAccess(
        profileData?.company_id === STATELINE_COMPANY_ID || 
        profileData?.company_id === MOMENTUM_COMPANY_ID
      );
      
      const { data: superAdminRole } = await supabase.rpc('has_role', { 
        _user_id: session.user.id, 
        _role: 'super_admin' 
      });
      setIsSuperAdmin(!!superAdminRole);
      
      if (superAdminRole) {
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        setCompanies(companiesData || []);
      }
      
      await fetchDeals(session.user.id);
      await loadConversation(session.user.id, profileData?.company_id);
      await fetchUserContext(session.user.id);
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

      const welcomeMsg = `Hey ${firstName}! 👋 Ready to get some deals moving?\n\n${openingMessage}`;
      
      let currentConvId = conversationId;
      if (!currentConvId) {
        currentConvId = await createConversation();
        if (currentConvId) setConversationId(currentConvId);
      }
      
      let msgId: string | undefined;
      if (currentConvId) {
        msgId = await saveMessage(currentConvId, "assistant", welcomeMsg);
      }
      
      setMessages([{ role: "assistant", content: welcomeMsg, id: msgId }]);
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

    let currentConvId = conversationId;
    if (!currentConvId) {
      currentConvId = await createConversation();
      if (currentConvId) setConversationId(currentConvId);
    }

    if (currentConvId) {
      await saveMessage(currentConvId, "user", text);
    }

    try {
      const pipelineContext = deals.length > 0 
        ? deals.map(d => 
            `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || 'Unknown'}. Priority: ${d.priority}/5. ${d.notes ? `Notes: ${d.notes}` : ''}`
          ).join("\n")
        : "No deals in pipeline yet.";

      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");

      const lowerText = text.toLowerCase();
      const isCallPlanRequest = lowerText.includes('4-call') || 
                                lowerText.includes('4 call') ||
                                lowerText.includes('four call') ||
                                lowerText.includes('four-call') ||
                                (lowerText.includes('generate') && lowerText.includes('call plan')) ||
                                (lowerText.includes('create') && lowerText.includes('call plan'));

      const response = await supabase.functions.invoke("sales-coach", {
        body: {
          message: text,
          deal: null,
          conversationHistory,
          userContext,
          generateCallPlan: isCallPlanRequest && effectiveHasMethodologyAccess,
          viewAsCompanyId: viewAsCompanyId || undefined,
          viewAsUserId: viewAsUserId || undefined,
          chatMode,
          dealsCount: deals.length,
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "Let me think on that...";
      
      let msgId: string | undefined;
      if (currentConvId) {
        msgId = await saveMessage(currentConvId, "assistant", assistantMessage);
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage, id: msgId }]);
      
      if ((response.data?.dealCreated || response.data?.pipelineActions?.length > 0) && user?.id) {
        fetchDeals(user.id);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Coach unavailable", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const handleViewAsChange = async (companyId: string | null, companyName: string | null) => {
    setViewAsCompanyId(companyId);
    setViewAsCompanyName(companyName);
    setViewAsUserId(null);
    setViewAsUserName(null);
    setMessages([]);
    setHasStarted(false);
    
    // Update methodology access based on viewed company
    const effectiveCompanyId = companyId || profile?.company_id;
    setHasMethodologyAccess(
      effectiveCompanyId === STATELINE_COMPANY_ID || 
      effectiveCompanyId === MOMENTUM_COMPANY_ID
    );
    
    // Fetch users for the selected company
    if (companyId) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .order('full_name');
      setCompanyUsers(users || []);
    } else {
      setCompanyUsers([]);
    }
  };

  const handleViewAsUserChange = async (userId: string | null, userName: string | null) => {
    setViewAsUserId(userId);
    setViewAsUserName(userName);
    setMessages([]);
    setHasStarted(false);
    
    // Fetch deals for the selected user
    if (userId) {
      await fetchDealsForUser(userId);
    } else if (user?.id) {
      await fetchDeals(user.id);
    }
  };

  const fetchDealsForUser = async (userId: string) => {
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

  const handleChatModeChange = (mode: ChatMode) => {
    setChatMode(mode);
    localStorage.setItem('salesTrainerChatMode', mode);
  };

  if (loading || flagLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <SalesAgentHeader
        user={user}
        profile={profile}
        deals={deals}
        totalValue={totalValue}
        hasStarted={hasStarted}
        isSuperAdmin={isSuperAdmin}
        companies={companies}
        companyUsers={companyUsers}
        viewAsCompanyId={viewAsCompanyId}
        viewAsCompanyName={viewAsCompanyName}
        viewAsUserId={viewAsUserId}
        viewAsUserName={viewAsUserName}
        chatMode={chatMode}
        onViewAsChange={handleViewAsChange}
        onViewAsUserChange={handleViewAsUserChange}
        onChatModeChange={handleChatModeChange}
        onNewConversation={startNewConversation}
        onAddDeal={() => setShowAddDeal(true)}
        onDealsRefresh={() => viewAsUserId ? fetchDealsForUser(viewAsUserId) : fetchDeals(user?.id)}
      />

      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col max-w-3xl">
        <SalesChatInterface
          messages={messages}
          input={input}
          chatLoading={chatLoading}
          hasStarted={hasStarted}
          hasMethodologyAccess={effectiveHasMethodologyAccess}
          chatMode={chatMode}
          deals={deals}
          profile={profile}
          companyId={effectiveCompanyId || ""}
          userId={user?.id || ""}
          onInputChange={setInput}
          onSendMessage={sendMessage}
          onStartCoaching={startCoaching}
          onAddDeal={() => setShowAddDeal(true)}
          onShowProposalWizard={() => setShowProposalWizard(true)}
          onShowCallPlanTracker={() => setShowCallPlanTracker(true)}
        />
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

      <PrepDocumentGenerator
        open={showPrepGenerator}
        onOpenChange={setShowPrepGenerator}
        conversationContext={messages.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n")}
      />

      <SalesProposalWizard
        open={showProposalWizard}
        onOpenChange={setShowProposalWizard}
        conversationContext={messages.slice(-10).map(m => `${m.role}: ${m.content}`).join("\n")}
        companyId={viewAsCompanyId || profile?.company_id}
      />

      <FourCallPlanTracker
        open={showCallPlanTracker}
        onOpenChange={setShowCallPlanTracker}
        companyId={viewAsCompanyId || profile?.company_id || ""}
        userId={viewAsUserId || user?.id || ""}
        userName={viewAsUserName || profile?.full_name}
      />
    </div>
  );
};

export default SalesTrainer;
