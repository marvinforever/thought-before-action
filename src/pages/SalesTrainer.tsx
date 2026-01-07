import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Users, 
  Building2, 
  MessageSquare, 
  TrendingUp,
  Plus,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import { PipelineView } from "@/components/sales/PipelineView";
import { DealsTable } from "@/components/sales/DealsTable";
import { CompaniesManager } from "@/components/sales/CompaniesManager";
import { ContactsManager } from "@/components/sales/ContactsManager";
import { SalesCoachChat } from "@/components/sales/SalesCoachChat";
import { AddDealDialog } from "@/components/sales/AddDealDialog";
import { useToast } from "@/hooks/use-toast";

const SalesTrainer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealStats, setDealStats] = useState({
    total: 0,
    totalValue: 0,
    byStage: {} as Record<string, number>
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth?redirect=/sales-trainer");
        return;
      }

      setUser(session.user);
      
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);
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
    if (!user) return;

    const fetchDealStats = async () => {
      const { data: deals } = await supabase
        .from("sales_deals")
        .select("stage, value")
        .eq("profile_id", user.id);

      if (deals) {
        const byStage: Record<string, number> = {};
        let totalValue = 0;

        deals.forEach(deal => {
          byStage[deal.stage] = (byStage[deal.stage] || 0) + 1;
          totalValue += Number(deal.value) || 0;
        });

        setDealStats({
          total: deals.length,
          totalValue,
          byStage
        });
      }
    };

    fetchDealStats();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Jericho Sales Trainer</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Deal Coaching</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || user?.email}
            </span>
            {profile?.company_id && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-fit">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{dealStats.total} Deals</span>
              <span className="text-sm text-muted-foreground">
                ${dealStats.totalValue.toLocaleString()} pipeline
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              {stages.map(stage => (
                <Badge 
                  key={stage.key} 
                  variant="secondary" 
                  className="text-xs whitespace-nowrap"
                >
                  {stage.label}: {dealStats.byStage[stage.key] || 0}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="pipeline" className="gap-2">
                <Target className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                All Deals
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" />
                Companies
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2">
                <Users className="h-4 w-4" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="coach" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                AI Coach
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => setShowAddDeal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Deal
            </Button>
          </div>

          <TabsContent value="pipeline" className="mt-0">
            <PipelineView userId={user?.id} stages={stages} />
          </TabsContent>

          <TabsContent value="deals" className="mt-0">
            <DealsTable userId={user?.id} />
          </TabsContent>

          <TabsContent value="companies" className="mt-0">
            <CompaniesManager userId={user?.id} />
          </TabsContent>

          <TabsContent value="contacts" className="mt-0">
            <ContactsManager userId={user?.id} />
          </TabsContent>

          <TabsContent value="coach" className="mt-0">
            <SalesCoachChat userId={user?.id} userName={profile?.full_name} />
          </TabsContent>
        </Tabs>
      </main>

      <AddDealDialog 
        open={showAddDeal} 
        onOpenChange={setShowAddDeal}
        userId={user?.id}
        onSuccess={() => {
          setShowAddDeal(false);
          // Refresh stats
          window.location.reload();
        }}
      />
    </div>
  );
};

export default SalesTrainer;
