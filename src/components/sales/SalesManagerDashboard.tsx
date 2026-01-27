import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Phone, Target, MessageSquare, Users } from "lucide-react";
import { SalesTeamOverviewCards } from "./SalesTeamOverviewCards";
import { FourCallProgressTable } from "./FourCallProgressTable";
import { PipelineHealthChart } from "./PipelineHealthChart";
import { CoachingEngagementTable } from "./CoachingEngagementTable";
import { RepDetailDialog } from "./RepDetailDialog";
import { useToast } from "@/hooks/use-toast";

interface SalesManagerDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewAsCompanyId: string | null;
  viewAsUserId: string | null;
}

interface OverviewData {
  activeSellers: number;
  totalPipelineValue: number;
  avgFourCallCompletion: number;
  coachingSessions: number;
  lastActivity: string | null;
}

interface FourCallProgress {
  repId: string;
  repName: string;
  customersTracked: number;
  call1Pct: number;
  call2Pct: number;
  call3Pct: number;
  call4Pct: number;
  overallPct: number;
  customers: Array<{
    customerName: string;
    call1: boolean;
    call2: boolean;
    call3: boolean;
    call4: boolean;
    revenue: number;
    notes: { call1: string | null; call2: string | null; call3: string | null; call4: string | null };
  }>;
}

interface PipelineSummary {
  repId: string;
  repName: string;
  totalValue: number;
  dealCount: number;
  byStage: Record<string, { count: number; value: number }>;
  staleDeals: number;
  lastActivity: string | null;
}

interface CoachingEngagement {
  repId: string;
  repName: string;
  conversationCount: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  lastSession: string | null;
  topics: string[];
}

export function SalesManagerDashboard({
  open,
  onOpenChange,
  viewAsCompanyId,
  viewAsUserId,
}: SalesManagerDashboardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData>({
    activeSellers: 0,
    totalPipelineValue: 0,
    avgFourCallCompletion: 0,
    coachingSessions: 0,
    lastActivity: null,
  });
  const [fourCallProgress, setFourCallProgress] = useState<FourCallProgress[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary[]>([]);
  const [coachingEngagement, setCoachingEngagement] = useState<CoachingEngagement[]>([]);
  
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [selectedRepName, setSelectedRepName] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!open) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("get-sales-team-report", {
        body: {
          viewAsCompanyId,
          viewAsUserId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      setOverview(data.overview);
      setFourCallProgress(data.fourCallProgress);
      setPipelineSummary(data.pipelineSummary);
      setCoachingEngagement(data.coachingEngagement);
    } catch (error: any) {
      console.error("Error fetching team report:", error);
      toast({
        title: "Failed to load team report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [open, viewAsCompanyId, viewAsUserId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRepClick = (repId: string) => {
    const rep = fourCallProgress.find((r) => r.repId === repId) ||
                pipelineSummary.find((r) => r.repId === repId) ||
                coachingEngagement.find((r) => r.repId === repId);
    setSelectedRepId(repId);
    setSelectedRepName(rep?.repName || null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b bg-primary text-primary-foreground">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Sales Team Dashboard
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={fetchData}
                disabled={isLoading}
                className="gap-1"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Overview Cards */}
            <SalesTeamOverviewCards data={overview} isLoading={isLoading} />

            {/* Tabs */}
            <Tabs defaultValue="four-call" className="flex-1">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="four-call" className="gap-1">
                  <Phone className="h-4 w-4" />
                  4-Call Progress
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="gap-1">
                  <Target className="h-4 w-4" />
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="coaching" className="gap-1">
                  <MessageSquare className="h-4 w-4" />
                  AI Coaching
                </TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <TabsContent value="four-call">
                  <FourCallProgressTable
                    data={fourCallProgress}
                    isLoading={isLoading}
                    onRepClick={handleRepClick}
                  />
                </TabsContent>

                <TabsContent value="pipeline">
                  <PipelineHealthChart
                    data={pipelineSummary}
                    isLoading={isLoading}
                    onRepClick={handleRepClick}
                  />
                </TabsContent>

                <TabsContent value="coaching">
                  <CoachingEngagementTable
                    data={coachingEngagement}
                    isLoading={isLoading}
                    onRepClick={handleRepClick}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rep Detail Dialog */}
      <RepDetailDialog
        open={!!selectedRepId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRepId(null);
            setSelectedRepName(null);
          }
        }}
        repId={selectedRepId}
        repName={selectedRepName}
      />
    </>
  );
}
