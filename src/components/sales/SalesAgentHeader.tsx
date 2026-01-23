import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  LogOut,
  LayoutDashboard,
  PanelRightOpen,
  Sparkles,
  Building2,
  Users,
  TrendingUp,
  Plus,
  Headphones,
  Eye,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { PipelineView } from "./PipelineView";
import { DealsTable } from "./DealsTable";
import { CompaniesManager } from "./CompaniesManager";
import { ContactsManager } from "./ContactsManager";
import { SalesKnowledgePodcasts } from "./SalesKnowledgePodcasts";
import { SalesKnowledgeManager } from "./SalesKnowledgeManager";
import { AddDealDialog } from "./AddDealDialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Company {
  id: string;
  name: string;
}

interface SalesAgentHeaderProps {
  user: any;
  profile: any;
  deals: any[];
  totalValue: number;
  hasStarted: boolean;
  isSuperAdmin: boolean;
  companies: Company[];
  viewAsCompanyId: string | null;
  viewAsCompanyName: string | null;
  chatMode: "coach" | "rec";
  onViewAsChange: (companyId: string | null, companyName: string | null) => void;
  onChatModeChange: (mode: "coach" | "rec") => void;
  onNewConversation: () => void;
  onAddDeal: () => void;
  onDealsRefresh: () => void;
}

const stages = [
  { key: "prospecting", label: "Prospecting", color: "bg-blue-500" },
  { key: "discovery", label: "Discovery", color: "bg-purple-500" },
  { key: "proposal", label: "Proposal", color: "bg-amber-500" },
  { key: "closing", label: "Closing", color: "bg-green-500" },
  { key: "follow_up", label: "Follow Up", color: "bg-teal-500" }
];

export function SalesAgentHeader({
  user,
  profile,
  deals,
  totalValue,
  hasStarted,
  isSuperAdmin,
  companies,
  viewAsCompanyId,
  viewAsCompanyName,
  chatMode,
  onViewAsChange,
  onChatModeChange,
  onNewConversation,
  onAddDeal,
  onDealsRefresh,
}: SalesAgentHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  return (
    <>
      <header className="border-b bg-primary text-primary-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Animated Logo */}
            <motion.div 
              className="relative"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shadow-lg">
                <motion.span 
                  className="text-xl font-bold text-primary"
                  animate={{ 
                    textShadow: ["0 0 0px hsl(var(--accent))", "0 0 8px hsl(var(--accent))", "0 0 0px hsl(var(--accent))"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  J
                </motion.span>
              </div>
              <motion.div
                className="absolute -top-1 -right-1 h-3 w-3"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-3 w-3 text-accent" />
              </motion.div>
            </motion.div>

            <div>
              <h1 className="font-bold text-lg tracking-tight">Jericho</h1>
              <p className="text-[10px] opacity-80 uppercase tracking-widest">Sales Agent</p>
            </div>
            
            {/* Chat Mode Toggle */}
            <div className="flex items-center bg-primary-foreground/10 rounded-lg p-0.5 ml-2">
              <button
                onClick={() => onChatModeChange('coach')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  chatMode === 'coach' 
                    ? 'bg-accent text-primary shadow-sm' 
                    : 'text-primary-foreground/70 hover:text-primary-foreground'
                }`}
              >
                🎓 Coach
              </button>
              <button
                onClick={() => onChatModeChange('rec')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  chatMode === 'rec' 
                    ? 'bg-accent text-primary shadow-sm' 
                    : 'text-primary-foreground/70 hover:text-primary-foreground'
                }`}
              >
                ⚡ Rec
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Super Admin View As Selector */}
            {isSuperAdmin && (
              <div className="flex items-center gap-2 border-r border-primary-foreground/20 pr-3 mr-1">
                <Eye className="h-4 w-4 text-accent" />
                <Select 
                  value={viewAsCompanyId || "none"} 
                  onValueChange={(val) => {
                    if (val === "none") {
                      onViewAsChange(null, null);
                    } else {
                      const company = companies.find(c => c.id === val);
                      onViewAsChange(val, company?.name || null);
                    }
                  }}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                    <SelectValue placeholder="View as company..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">My Account</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {deals.length > 0 && (
              <Badge className="hidden sm:flex bg-accent text-primary hover:bg-accent/90">
                {deals.length} deals · ${totalValue.toLocaleString()}
              </Badge>
            )}

            {hasStarted && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onNewConversation} 
                className="gap-1 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            )}

            <Dialog open={showDataPanel} onOpenChange={setShowDataPanel}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-primary-foreground hover:bg-primary-foreground/10">
                  <PanelRightOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[900px] h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 shrink-0 bg-primary text-primary-foreground">
                  <DialogTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Your Pipeline & Knowledge
                    </span>
                    <Button size="sm" onClick={() => setShowAddDeal(true)} className="gap-1 bg-accent text-primary hover:bg-accent/90">
                      <Plus className="h-4 w-4" />
                      Add Deal
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="pipeline" className="flex-1 flex flex-col min-h-0 px-6">
                  <TabsList className="grid grid-cols-6 w-full shrink-0">
                    <TabsTrigger value="pipeline" className="gap-1">
                      <Target className="h-4 w-4" />
                      <span className="hidden sm:inline">Pipeline</span>
                    </TabsTrigger>
                    <TabsTrigger value="deals" className="gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="hidden sm:inline">Deals</span>
                    </TabsTrigger>
                    <TabsTrigger value="companies" className="gap-1">
                      <Building2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Companies</span>
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="gap-1">
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">Contacts</span>
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span className="hidden sm:inline">Knowledge</span>
                    </TabsTrigger>
                    <TabsTrigger value="podcasts" className="gap-1">
                      <Headphones className="h-4 w-4" />
                      <span className="hidden sm:inline">Training</span>
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4 pb-6">
                    <TabsContent value="pipeline" className="mt-0 h-full">
                      <PipelineView userId={user?.id} stages={stages} companyId={viewAsCompanyId} />
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
                    <TabsContent value="knowledge" className="mt-0">
                      <SalesKnowledgeManager 
                        userId={user?.id} 
                        companyId={viewAsCompanyId || profile?.company_id} 
                      />
                    </TabsContent>
                    <TabsContent value="podcasts" className="mt-0">
                      <SalesKnowledgePodcasts 
                        userId={user?.id} 
                        companyId={profile?.company_id} 
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </DialogContent>
            </Dialog>

            {profile?.company_id && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/dashboard")}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* View As Banner */}
      {viewAsCompanyId && viewAsCompanyName && (
        <div className="bg-accent text-primary px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" />
          Viewing as: <strong>{viewAsCompanyName}</strong>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-primary hover:bg-accent/80"
            onClick={() => onViewAsChange(null, null)}
          >
            Exit
          </Button>
        </div>
      )}

      <AddDealDialog 
        open={showAddDeal} 
        onOpenChange={setShowAddDeal}
        userId={user?.id}
        onSuccess={() => {
          setShowAddDeal(false);
          onDealsRefresh();
        }}
      />
    </>
  );
}
