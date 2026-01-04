import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Target, 
  AlertTriangle, 
  Award,
  Clock,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/contexts/ViewAsContext";

interface PriorityAction {
  id: string;
  type: "one_on_one" | "capability_request" | "risk" | "recognition";
  title: string;
  subtitle: string;
  urgency: "high" | "medium" | "low";
  employeeId?: string;
  employeeName?: string;
}

interface ManagerPriorityActionsProps {
  onStartOneOnOne: (employee: { id: string; full_name: string; company_id: string }) => void;
  onViewCapabilityRequests: () => void;
  onGiveRecognition: (employee: { id: string; full_name: string; company_id: string }) => void;
  onViewToDoTab?: () => void;
}

export function ManagerPriorityActions({
  onStartOneOnOne,
  onViewCapabilityRequests,
  onGiveRecognition,
  onViewToDoTab,
}: ManagerPriorityActionsProps) {
  const [actions, setActions] = useState<PriorityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadPriorityActions();
  }, [viewAsCompanyId]);

  const loadPriorityActions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const priorityActions: PriorityAction[] = [];

      // Get direct reports
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select(`
          employee:profiles!manager_assignments_employee_id_fkey (
            id,
            full_name,
            company_id
          )
        `)
        .eq("manager_id", user.id);

      const directReports = assignments?.map((a: any) => a.employee).filter(Boolean) || [];
      const directReportIds = directReports.map((dr: any) => dr.id);

      if (directReportIds.length === 0) {
        setLoading(false);
        return;
      }

      // Check for pending capability requests
      const { data: pendingRequests } = await supabase
        .from("capability_level_requests")
        .select("id, profile_id, profiles!capability_level_requests_profile_id_fkey(full_name)")
        .in("profile_id", directReportIds)
        .eq("status", "pending")
        .limit(3);

      if (pendingRequests && pendingRequests.length > 0) {
        priorityActions.push({
          id: "cap-requests",
          type: "capability_request",
          title: `${pendingRequests.length} capability request${pendingRequests.length > 1 ? 's' : ''} pending`,
          subtitle: "Team members waiting for your review",
          urgency: "high",
        });
      }

      // Check for employees without recent 1:1s (in last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: recentNotes } = await supabase
        .from("one_on_one_notes")
        .select("employee_id, meeting_date")
        .eq("manager_id", user.id)
        .in("employee_id", directReportIds)
        .gte("meeting_date", twoWeeksAgo.toISOString().split("T")[0]);

      const employeesWithRecent1on1 = new Set(recentNotes?.map(n => n.employee_id) || []);
      const overdueEmployees = directReports.filter(
        (dr: any) => !employeesWithRecent1on1.has(dr.id)
      );

      if (overdueEmployees.length > 0) {
        // If there are multiple overdue employees, show a summary action that links to To-Do tab
        if (overdueEmployees.length > 1 && onViewToDoTab) {
          priorityActions.push({
            id: `overdue-check-ins`,
            type: "one_on_one",
            title: `${overdueEmployees.length} team members need a check-in`,
            subtitle: "View all in your To-Do list",
            urgency: overdueEmployees.length > 2 ? "high" : "medium",
            employeeId: "", // Empty - will route to To-Do tab
            employeeName: "",
          });
        } else {
          // Single overdue employee - show direct 1:1 action
          const firstOverdue = overdueEmployees[0];
          priorityActions.push({
            id: `one-on-one-${firstOverdue.id}`,
            type: "one_on_one",
            title: `Schedule a 1:1 with ${firstOverdue.full_name}`,
            subtitle: "No 1:1 in the last 2 weeks",
            urgency: "medium",
            employeeId: firstOverdue.id,
            employeeName: firstOverdue.full_name,
          });
        }
      }

      // Check for risk flags
      const { data: riskFlags } = await supabase
        .from("employee_risk_flags")
        .select("id, profile_id, risk_type, profiles!employee_risk_flags_profile_id_fkey(full_name)")
        .in("profile_id", directReportIds)
        .is("resolved_at", null)
        .order("detected_at", { ascending: false })
        .limit(2);

      if (riskFlags && riskFlags.length > 0) {
        const flag = riskFlags[0] as any;
        priorityActions.push({
          id: `risk-${flag.id}`,
          type: "risk",
          title: `${flag.profiles?.full_name || 'Team member'} may need support`,
          subtitle: flag.risk_type.replace(/_/g, " "),
          urgency: "high",
          employeeId: flag.profile_id,
          employeeName: flag.profiles?.full_name,
        });
      }

      // Suggest recognition if no recent recognition given (check recognition_notes, not achievements)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: recentRecognitions } = await supabase
        .from("recognition_notes")
        .select("id")
        .eq("given_by", user.id)
        .gte("created_at", oneWeekAgo.toISOString())
        .limit(1);

      if (!recentRecognitions || recentRecognitions.length === 0) {
        const randomReport = directReports[Math.floor(Math.random() * directReports.length)];
        if (randomReport) {
          priorityActions.push({
            id: "recognition-prompt",
            type: "recognition",
            title: "Celebrate a win!",
            subtitle: `Consider recognizing ${randomReport.full_name} for recent work`,
            urgency: "low",
            employeeId: randomReport.id,
            employeeName: randomReport.full_name,
          });
        }
      }

      setActions(priorityActions.slice(0, 3));
    } catch (error) {
      console.error("Error loading priority actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (type: PriorityAction["type"]) => {
    switch (type) {
      case "one_on_one": return MessageSquare;
      case "capability_request": return Target;
      case "risk": return AlertTriangle;
      case "recognition": return Award;
    }
  };

  const getActionColor = (type: PriorityAction["type"]) => {
    switch (type) {
      case "one_on_one": return "text-blue-500 bg-blue-500/10";
      case "capability_request": return "text-emerald-500 bg-emerald-500/10";
      case "risk": return "text-orange-500 bg-orange-500/10";
      case "recognition": return "text-amber-500 bg-amber-500/10";
    }
  };

  const getUrgencyBadge = (urgency: PriorityAction["urgency"]) => {
    switch (urgency) {
      case "high": return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case "medium": return <Badge variant="secondary" className="text-xs">Soon</Badge>;
      default: return null;
    }
  };

  const handleActionClick = async (action: PriorityAction) => {
    if (action.type === "capability_request") {
      onViewCapabilityRequests();
      return;
    }

    // If action has no employeeId and we have onViewToDoTab, route there
    if (!action.employeeId && onViewToDoTab) {
      onViewToDoTab();
      return;
    }

    if (!action.employeeId) return;

    // Get employee details
    const { data: employee } = await supabase
      .from("profiles")
      .select("id, full_name, company_id")
      .eq("id", action.employeeId)
      .single();

    if (!employee) return;

    switch (action.type) {
      case "one_on_one":
      case "risk":
        onStartOneOnOne(employee);
        break;
      case "recognition":
        onGiveRecognition(employee);
        break;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">You're all caught up! 🎉</p>
            <p className="text-sm text-muted-foreground">
              No urgent actions right now. Keep up the great work!
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Priority Actions</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {actions.length} pending
        </Badge>
      </div>

      <div className="space-y-3">
        {actions.map((action, index) => {
          const Icon = getActionIcon(action.type);
          const colorClass = getActionColor(action.type);
          
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3 hover:bg-muted/50"
                onClick={() => handleActionClick(action)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2 rounded-lg ${colorClass.split(" ")[1]}`}>
                    <Icon className={`h-4 w-4 ${colorClass.split(" ")[0]}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{action.title}</span>
                      {getUrgencyBadge(action.urgency)}
                    </div>
                    <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
