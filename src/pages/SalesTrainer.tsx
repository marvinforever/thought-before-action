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
import { DocumentUploadDialog } from "@/components/sales/DocumentUploadDialog";
import { CustomerSelector } from "@/components/sales/CustomerSelector";
import { NewCustomerQuickCreateDialog } from "@/components/sales/NewCustomerQuickCreateDialog";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
  contactPrompts?: { name: string; companyName?: string }[];
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [newCustomerPrompt, setNewCustomerPrompt] = useState<{ name: string } | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [enableFieldMaps, setEnableFieldMaps] = useState(false);
  // Active customer context for Backboard memory threading
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeCustomerName, setActiveCustomerName] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    const saved = localStorage.getItem('salesTrainerChatMode');
    return (saved === 'coach' || saved === 'rec') ? saved : 'rec';
  });

  // Derive methodology access from the *effective* company.
  // Super admins must "View As" a Stateline/Momentum user to see methodology features.
  // Non-super-admins use their own profile's company_id.
  const effectiveCompanyId = isSuperAdmin 
    ? viewAsCompanyId  // Super admins only get access when viewing as a specific company
    : (viewAsCompanyId || profile?.company_id || null);
  const effectiveHasMethodologyAccess =
    effectiveCompanyId === STATELINE_COMPANY_ID || effectiveCompanyId === MOMENTUM_COMPANY_ID;
  const effectiveUserId = viewAsUserId || user?.id || null;

  // Fetch customers for the upload dialog
  const fetchCustomers = async () => {
    if (!effectiveUserId) return;
    try {
      const { data } = await (supabase as any)
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", effectiveUserId)
        .order("name");
      if (data) {
        setCustomers(data.map((c: any) => ({ id: c.id as string, name: c.name as string })));
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [effectiveCompanyId]);

  // Fetch company settings (including field maps gating)
  const fetchCompanySettings = async (companyId: string) => {
    try {
      const { data } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", companyId)
        .single();
      
      if (data?.settings && typeof data.settings === 'object') {
        const settings = data.settings as Record<string, boolean>;
        setEnableFieldMaps(settings.enable_field_maps === true);
      } else {
        setEnableFieldMaps(false);
      }
    } catch (error) {
      console.error("Error fetching company settings:", error);
      setEnableFieldMaps(false);
    }
  };

  // Fetch settings when effective company changes
  useEffect(() => {
    if (effectiveCompanyId) {
      fetchCompanySettings(effectiveCompanyId);
    } else {
      setEnableFieldMaps(false);
    }
  }, [effectiveCompanyId]);

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
    // Use effective user and company IDs when viewing as another user
    const effectiveProfileId = viewAsUserId || user?.id;
    const effectiveCompId = viewAsCompanyId || profile?.company_id;
    
    if (!effectiveProfileId || !effectiveCompId) return null;
    
    const { data, error } = await supabase
      .from("sales_coach_conversations")
      .insert({
        profile_id: effectiveProfileId,
        company_id: effectiveCompId,
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
      
      // Auto-default to user's own company for context persistence (especially for Momentum)
      // This ensures chat history loads correctly between sessions
      if (profileData?.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profileData.company_id)
          .single();
        
        // Set default context to user's own company
        setViewAsCompanyId(profileData.company_id);
        setViewAsCompanyName(companyData?.name || 'Your Company');
        
        // Load conversation with correct company context
        await loadConversation(session.user.id, profileData.company_id);
      }
      
      await fetchDeals(session.user.id);
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

  // Handle undo action
  const handleUndo = async (undoToken: string) => {
    try {
      const response = await supabase.functions.invoke("sales-coach", {
        body: { undoAction: undoToken },
      });
      
      if (response.data?.success) {
        toast({ title: "✅ Undone", description: response.data.message });
        // Refresh deals
        const userId = viewAsUserId || user?.id;
        if (userId) {
          viewAsUserId ? fetchDealsForUser(userId) : fetchDeals(userId);
        }
      } else {
        toast({ title: "Undo failed", description: response.data?.message || "Could not undo", variant: "destructive" });
      }
    } catch (error) {
      console.error("Undo error:", error);
      toast({ title: "Undo failed", variant: "destructive" });
    }
  };

  const cancelMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setChatLoading(false);
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    abortControllerRef.current = new AbortController();

    let currentConvId = conversationId;
    if (!currentConvId) {
      currentConvId = await createConversation();
      if (currentConvId) setConversationId(currentConvId);
    }

    if (currentConvId) {
      await saveMessage(currentConvId, "user", text);
    }

    try {
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
          activeCustomerId: activeCustomerId || undefined,
        },
      });
      
      // Update active customer if one was inferred from the message
      if (response.data?.inferredCustomerId && response.data?.inferredCustomerName) {
        if (!activeCustomerId) {
          setActiveCustomerId(response.data.inferredCustomerId);
          setActiveCustomerName(response.data.inferredCustomerName);
        }
      }

      // Show new customer prompt if detected but not in system
      if (response.data?.newCustomerPrompt) {
        setNewCustomerPrompt(response.data.newCustomerPrompt);
      }

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "Let me think on that...";
      
      let msgId: string | undefined;
      if (currentConvId) {
        msgId = await saveMessage(currentConvId, "assistant", assistantMessage);
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage, id: msgId }]);
      
      // Show action notifications with undo buttons
      const actions = response.data?.actions || [];
      for (const action of actions) {
        if (action.success && action.undoToken && action.type !== "company_exists") {
          const undoToken = action.undoToken;
          toast({
            title: action.type === "company_created" ? "🏢 Company Added" :
                   action.type === "contact_created" ? "👤 Contact Added" :
                   action.type === "deal_created" ? "💼 Deal Created" : "✅ Done",
            description: action.message || `Created ${action.details?.name || "entity"}`,
            action: (
              <button
                className="ml-2 px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                onClick={() => handleUndo(undoToken)}
              >
                Undo
              </button>
            ),
            duration: 5000,
          });
        }
      }

      // Show pipeline action notifications
      const pipelineActions = response.data?.pipelineActions || [];
      for (const action of pipelineActions) {
        if (action.success) {
          toast({ 
            title: action.action === 'move_deal' ? "📊 Deal moved!" :
                   action.action === 'update_deal' ? "✏️ Deal updated!" :
                   action.action === 'delete_deal' ? "🗑️ Deal deleted!" : "✅ Done!",
            description: action.message
          });
        }
      }
      
      // Refresh deals if any changes were made
      if (response.data?.dealCreated || actions.length > 0 || pipelineActions.length > 0) {
        const userId = viewAsUserId || user?.id;
        if (userId) {
          viewAsUserId ? fetchDealsForUser(userId) : fetchDeals(userId);
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
        // User cancelled — do nothing, state already reset by cancelMessage
        return;
      }
      console.error("Chat error:", error);
      toast({ title: "Coach unavailable", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      abortControllerRef.current = null;
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
    setConversationId(null); // Reset conversation ID so a new one is created/loaded
    setHasStarted(false);
    
    // Load conversation for the selected user
    const effectiveCompId = viewAsCompanyId || profile?.company_id;
    if (userId && effectiveCompId) {
      await loadConversation(userId, effectiveCompId);
    }
    
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
        enableFieldMaps={enableFieldMaps}
        onViewAsChange={handleViewAsChange}
        onViewAsUserChange={handleViewAsUserChange}
        onChatModeChange={handleChatModeChange}
        onNewConversation={startNewConversation}
        onAddDeal={() => setShowAddDeal(true)}
        onDealsRefresh={() => viewAsUserId ? fetchDealsForUser(viewAsUserId) : fetchDeals(user?.id)}
      />

      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col max-w-3xl">
        {/* Customer Context Selector */}
        <div className="mb-4 flex items-center gap-3">
          <CustomerSelector
            userId={effectiveUserId}
            selectedCustomerId={activeCustomerId}
            selectedCustomerName={activeCustomerName}
            onSelect={(customerId, customerName) => {
              setActiveCustomerId(customerId);
              setActiveCustomerName(customerName);
              // Clear messages when switching customer context
              if (customerId !== activeCustomerId) {
                setMessages([]);
                setHasStarted(false);
                setConversationId(null);
              }
            }}
          />
          {activeCustomerName && (
            <span className="text-sm text-muted-foreground">
              Memory focused on <strong>{activeCustomerName}</strong>
            </span>
          )}
        </div>
        
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
          newCustomerPrompt={newCustomerPrompt}
          onUploadDocument={() => setShowUploadDialog(true)}
          onInputChange={setInput}
          onSendMessage={sendMessage}
          onCancel={cancelMessage}
          onDismissNewCustomerPrompt={() => setNewCustomerPrompt(null)}
          onCreateCustomerProfile={() => setShowQuickCreate(true)}
          onStartCoaching={startCoaching}
          onAddDeal={() => setShowAddDeal(true)}
          onShowProposalWizard={() => setShowProposalWizard(true)}
          onShowCallPlanTracker={() => setShowCallPlanTracker(true)}
        />
      </main>

      <AddDealDialog 
        open={showAddDeal} 
        onOpenChange={setShowAddDeal}
        userId={viewAsUserId || user?.id}
        onSuccess={() => {
          setShowAddDeal(false);
          // Refresh deals for the effective user
          const effectiveUserId = viewAsUserId || user?.id;
          if (effectiveUserId) {
            viewAsUserId ? fetchDealsForUser(effectiveUserId) : fetchDeals(effectiveUserId);
          }
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
          userId={effectiveUserId}
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

      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        userId={effectiveUserId || ""}
        companyId={effectiveCompanyId || ""}
        customers={customers}
        onUploadComplete={() => {
          if (effectiveUserId) fetchUserContext(effectiveUserId);
        }}
      />
      <NewCustomerQuickCreateDialog
        open={showQuickCreate}
        onOpenChange={(open) => {
          setShowQuickCreate(open);
          if (!open) setNewCustomerPrompt(null);
        }}
        prefilledName={newCustomerPrompt?.name || ""}
        userId={effectiveUserId || ""}
        onSuccess={(companyId, companyName) => {
          setNewCustomerPrompt(null);
          // Refresh customers list and deals
          fetchCustomers();
          const uid = viewAsUserId || user?.id;
          if (uid) viewAsUserId ? fetchDealsForUser(uid) : fetchDeals(uid);
          // Let Jericho know the profile was created
          sendMessage(`I just created a customer profile for ${companyName}. They've been added to my companies.`);
        }}
      />
    </div>
  );
};

export default SalesTrainer;
