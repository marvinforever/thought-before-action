import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Target, MessageSquare, Activity, Check, X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface RepDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string | null;
  repName: string | null;
}

interface CallPlanRecord {
  customer_name: string;
  call_1_completed: boolean;
  call_2_completed: boolean;
  call_3_completed: boolean;
  call_4_completed: boolean;
  total_revenue: number;
  updated_at: string;
}

interface Deal {
  id: string;
  deal_name: string;
  company_id: string | null;
  stage: string;
  value: number;
  last_activity_at: string;
}

interface CoachingConversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface SalesActivity {
  id: string;
  activity_type: string;
  subject: string | null;
  notes: string | null;
  created_at: string;
}

export function RepDetailDialog({ open, onOpenChange, repId, repName }: RepDetailDialogProps) {
  const [callPlans, setCallPlans] = useState<CallPlanRecord[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [conversations, setConversations] = useState<CoachingConversation[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open || !repId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const currentYear = new Date().getFullYear();

      const [callPlanResult, dealsResult, conversationsResult, activitiesResult] = await Promise.all([
        supabase
          .from("call_plan_tracking")
          .select("customer_name, call_1_completed, call_2_completed, call_3_completed, call_4_completed, total_revenue, updated_at")
          .eq("profile_id", repId)
          .eq("plan_year", currentYear)
          .order("total_revenue", { ascending: false }),
        
        supabase
          .from("sales_deals")
          .select("id, deal_name, company_id, stage, value, last_activity_at")
          .eq("profile_id", repId)
          .order("value", { ascending: false })
          .limit(20),
        
        supabase
          .from("sales_coach_conversations")
          .select("id, title, created_at")
          .eq("profile_id", repId)
          .order("created_at", { ascending: false })
          .limit(10),
        
        supabase
          .from("sales_activities")
          .select("id, activity_type, subject, notes, created_at")
          .eq("profile_id", repId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setCallPlans((callPlanResult.data as CallPlanRecord[]) || []);
      setDeals((dealsResult.data as Deal[]) || []);
      setConversations((conversationsResult.data as CoachingConversation[]) || []);
      setActivities((activitiesResult.data as SalesActivity[]) || []);
      setIsLoading(false);
    };

    fetchData();
  }, [open, repId]);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospecting: "bg-blue-500",
      discovery: "bg-purple-500",
      proposal: "bg-amber-500",
      closing: "bg-green-500",
      follow_up: "bg-teal-500",
      won: "bg-emerald-500",
      lost: "bg-red-500",
    };
    return colors[stage] || "bg-gray-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {repName?.charAt(0) || "?"}
            </span>
            {repName || "Rep Details"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="calls" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-4 mx-6">
              <TabsTrigger value="calls" className="gap-1">
                <Phone className="h-4 w-4" />
                4-Call
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-1">
                <Target className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="coaching" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                Coaching
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 p-6">
              <TabsContent value="calls" className="mt-0">
                <div className="space-y-2">
                  {callPlans.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No 4-Call tracking records
                    </p>
                  ) : (
                    callPlans.map((plan, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{plan.customer_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                ${plan.total_revenue?.toLocaleString() || 0} revenue
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {[plan.call_1_completed, plan.call_2_completed, plan.call_3_completed, plan.call_4_completed].map((completed, i) => (
                                <div
                                  key={i}
                                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                    completed
                                      ? "bg-green-500/20 text-green-600"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {completed ? <Check className="h-4 w-4" /> : i + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="space-y-2">
                  {deals.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No deals in pipeline
                    </p>
                  ) : (
                    deals.map((deal) => (
                      <Card key={deal.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{deal.deal_name}</h4>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${deal.value?.toLocaleString() || 0}</p>
                              <Badge className={`${getStageColor(deal.stage)} text-white text-xs`}>
                                {deal.stage.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="coaching" className="mt-0">
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No coaching conversations
                    </p>
                  ) : (
                    conversations.map((conv) => (
                      <Card key={conv.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-medium">{conv.title || "Coaching Session"}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <div className="space-y-2">
                  {activities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No recent activity
                    </p>
                  ) : (
                    activities.map((activity) => (
                      <Card key={activity.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <Badge variant="outline" className="mb-1">
                                {activity.activity_type.replace("_", " ")}
                              </Badge>
                              <p className="text-sm">{activity.subject || activity.notes || "No details"}</p>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(activity.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
