import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Calendar, 
  ClipboardCheck, 
  Target, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/contexts/ViewAsContext";
import { format, differenceInDays, isPast, isToday } from "date-fns";

interface ToDoItem {
  id: string;
  type: "overdue_checkin" | "scheduled_1on1" | "upcoming_review" | "pending_request" | "meeting_request";
  title: string;
  subtitle: string;
  date?: string;
  time?: string;
  urgency: "high" | "medium" | "low";
  employeeId: string;
  employeeName: string;
  companyId: string;
  email?: string;
  meta?: any;
}

interface ManagerToDoTabProps {
  onStartOneOnOne: (employee: { id: string; full_name: string; company_id: string; email?: string }) => void;
  onScheduleReview: (employee: { id: string; full_name: string; company_id: string }) => void;
  onViewRequest: (requestId: string) => void;
  onHandleMeetingRequest?: (employeeId: string, employeeName: string) => void;
}

export function ManagerToDoTab({ onStartOneOnOne, onScheduleReview, onViewRequest, onHandleMeetingRequest }: ManagerToDoTabProps) {
  const [items, setItems] = useState<ToDoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadToDoItems();
  }, [viewAsCompanyId]);

  const loadToDoItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todoItems: ToDoItem[] = [];

      // Get direct reports
      let assignmentsQuery = supabase
        .from("manager_assignments")
        .select(`
          employee_id,
          company_id,
          profiles!manager_assignments_employee_id_fkey (
            id,
            full_name,
            email
          )
        `);

      if (viewAsCompanyId) {
        assignmentsQuery = assignmentsQuery.eq("company_id", viewAsCompanyId);
      } else {
        assignmentsQuery = assignmentsQuery.eq("manager_id", user.id);
      }

      const { data: assignments } = await assignmentsQuery;
      const directReports = assignments?.map((a: any) => ({
        ...a.profiles,
        company_id: a.company_id
      })).filter(Boolean) || [];
      const directReportIds = directReports.map((dr: any) => dr.id);

      if (directReportIds.length === 0) {
        setLoading(false);
        return;
      }

      // 1. Overdue check-ins (no 1:1 in last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: recentNotes } = await supabase
        .from("one_on_one_notes")
        .select("employee_id, meeting_date")
        .eq("manager_id", user.id)
        .in("employee_id", directReportIds)
        .gte("meeting_date", twoWeeksAgo.toISOString().split("T")[0]);

      const employeesWithRecent1on1 = new Set(recentNotes?.map(n => n.employee_id) || []);
      
      directReports.forEach((dr: any) => {
        if (!employeesWithRecent1on1.has(dr.id)) {
          // Get last 1:1 date for this employee
          const lastNote = recentNotes?.find(n => n.employee_id === dr.id);
          todoItems.push({
            id: `overdue-${dr.id}`,
            type: "overdue_checkin",
            title: `Check-in with ${dr.full_name}`,
            subtitle: "No 1:1 in the last 2 weeks",
            urgency: "high",
            employeeId: dr.id,
            employeeName: dr.full_name,
            companyId: dr.company_id,
            email: dr.email
          });
        }
      });

      // 2. Scheduled 1:1s (from next_meeting_date)
      const { data: scheduledMeetings } = await supabase
        .from("one_on_one_notes")
        .select("id, employee_id, next_meeting_date, scheduled_time")
        .eq("manager_id", user.id)
        .in("employee_id", directReportIds)
        .not("next_meeting_date", "is", null)
        .gte("next_meeting_date", new Date().toISOString().split("T")[0])
        .order("next_meeting_date", { ascending: true })
        .limit(10);

      scheduledMeetings?.forEach((meeting: any) => {
        const dr = directReports.find((d: any) => d.id === meeting.employee_id);
        if (dr) {
          const meetingDate = new Date(meeting.next_meeting_date);
          const daysUntil = differenceInDays(meetingDate, new Date());
          
          todoItems.push({
            id: `scheduled-${meeting.id}`,
            type: "scheduled_1on1",
            title: `1:1 with ${dr.full_name}`,
            subtitle: isToday(meetingDate) ? "Today" : `In ${daysUntil} days`,
            date: meeting.next_meeting_date,
            time: meeting.scheduled_time,
            urgency: isToday(meetingDate) ? "high" : daysUntil <= 2 ? "medium" : "low",
            employeeId: dr.id,
            employeeName: dr.full_name,
            companyId: dr.company_id,
            email: dr.email
          });
        }
      });

      // 3. Upcoming reviews
      const { data: upcomingReviews } = await supabase
        .from("performance_reviews")
        .select("id, profile_id, review_date, review_type, scheduled_time, profiles!performance_reviews_profile_id_fkey(full_name, email)")
        .in("profile_id", directReportIds)
        .eq("status", "scheduled")
        .gte("review_date", new Date().toISOString().split("T")[0])
        .order("review_date", { ascending: true })
        .limit(10);

      upcomingReviews?.forEach((review: any) => {
        const reviewDate = new Date(review.review_date);
        const daysUntil = differenceInDays(reviewDate, new Date());
        const dr = directReports.find((d: any) => d.id === review.profile_id);
        
        todoItems.push({
          id: `review-${review.id}`,
          type: "upcoming_review",
          title: `${review.review_type} review for ${review.profiles?.full_name || 'Employee'}`,
          subtitle: isToday(reviewDate) ? "Today" : `In ${daysUntil} days`,
          date: review.review_date,
          time: review.scheduled_time,
          urgency: isToday(reviewDate) ? "high" : daysUntil <= 3 ? "medium" : "low",
          employeeId: review.profile_id,
          employeeName: review.profiles?.full_name || "Employee",
          companyId: dr?.company_id || "",
          email: review.profiles?.email
        });
      });

      // 4. Pending capability requests
      const { data: pendingRequests } = await supabase
        .from("capability_level_requests")
        .select(`
          id, 
          profile_id, 
          requested_level, 
          created_at,
          profiles!capability_level_requests_profile_id_fkey(full_name, email),
          capabilities!capability_level_requests_capability_id_fkey(name)
        `)
        .in("profile_id", directReportIds)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      pendingRequests?.forEach((request: any) => {
        const daysSinceRequest = differenceInDays(new Date(), new Date(request.created_at));
        const dr = directReports.find((d: any) => d.id === request.profile_id);
        
        todoItems.push({
          id: `request-${request.id}`,
          type: "pending_request",
          title: `Review ${request.profiles?.full_name}'s capability request`,
          subtitle: `${request.capabilities?.name} → ${request.requested_level}`,
          urgency: daysSinceRequest > 7 ? "high" : daysSinceRequest > 3 ? "medium" : "low",
          employeeId: request.profile_id,
          employeeName: request.profiles?.full_name || "Employee",
          companyId: dr?.company_id || "",
          email: request.profiles?.email,
          meta: { requestId: request.id }
        });
      });

      // 5. Pending meeting requests
      let meetingRequestsQuery = supabase
        .from("meeting_requests")
        .select(`
          id,
          requester_id,
          topic,
          urgency,
          preferred_date,
          created_at,
          profiles!meeting_requests_requester_id_fkey(full_name, email)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (viewAsCompanyId) {
        meetingRequestsQuery = meetingRequestsQuery.eq("company_id", viewAsCompanyId);
      } else {
        meetingRequestsQuery = meetingRequestsQuery.eq("requested_manager_id", user.id);
      }

      const { data: meetingRequests } = await meetingRequestsQuery;

      meetingRequests?.forEach((request: any) => {
        const daysSinceRequest = differenceInDays(new Date(), new Date(request.created_at));
        const dr = directReports.find((d: any) => d.id === request.requester_id);
        
        todoItems.push({
          id: `meeting-${request.id}`,
          type: "meeting_request",
          title: `${request.profiles?.full_name} requested a meeting`,
          subtitle: request.topic || "No topic specified",
          date: request.preferred_date,
          urgency: request.urgency === "high" ? "high" : daysSinceRequest > 3 ? "medium" : "low",
          employeeId: request.requester_id,
          employeeName: request.profiles?.full_name || "Employee",
          companyId: dr?.company_id || "",
          email: request.profiles?.email,
          meta: { meetingRequestId: request.id }
        });
      });

      // Sort by urgency
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      todoItems.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      setItems(todoItems);
    } catch (error) {
      console.error("Error loading to-do items:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: ToDoItem["type"]) => {
    switch (type) {
      case "overdue_checkin": return AlertTriangle;
      case "scheduled_1on1": return MessageSquare;
      case "upcoming_review": return ClipboardCheck;
      case "pending_request": return Target;
      case "meeting_request": return User;
    }
  };

  const getIconColor = (type: ToDoItem["type"]) => {
    switch (type) {
      case "overdue_checkin": return "text-orange-500 bg-orange-500/10";
      case "scheduled_1on1": return "text-blue-500 bg-blue-500/10";
      case "upcoming_review": return "text-purple-500 bg-purple-500/10";
      case "pending_request": return "text-emerald-500 bg-emerald-500/10";
      case "meeting_request": return "text-pink-500 bg-pink-500/10";
    }
  };

  const getUrgencyBadge = (urgency: ToDoItem["urgency"]) => {
    switch (urgency) {
      case "high": return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case "medium": return <Badge variant="secondary" className="text-xs">Soon</Badge>;
      default: return null;
    }
  };

  const handleItemClick = (item: ToDoItem) => {
    switch (item.type) {
      case "overdue_checkin":
      case "scheduled_1on1":
        onStartOneOnOne({
          id: item.employeeId,
          full_name: item.employeeName,
          company_id: item.companyId,
          email: item.email
        });
        break;
      case "upcoming_review":
        onScheduleReview({
          id: item.employeeId,
          full_name: item.employeeName,
          company_id: item.companyId
        });
        break;
      case "pending_request":
        if (item.meta?.requestId) {
          onViewRequest(item.meta.requestId);
        }
        break;
      case "meeting_request":
        if (onHandleMeetingRequest) {
          onHandleMeetingRequest(item.employeeId, item.employeeName);
        } else {
          // Fallback to starting a 1:1
          onStartOneOnOne({
            id: item.employeeId,
            full_name: item.employeeName,
            company_id: item.companyId,
            email: item.email
          });
        }
        break;
    }
  };

  const toggleComplete = (id: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeItems = items.filter(item => !completedIds.has(item.id));
  const completedItems = items.filter(item => completedIds.has(item.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-muted rounded w-1/3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">All caught up! 🎉</h3>
          <p className="text-muted-foreground">
            No pending actions right now. Great job staying on top of things!
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedItems = {
    overdue: activeItems.filter(i => i.type === "overdue_checkin"),
    scheduled: activeItems.filter(i => i.type === "scheduled_1on1"),
    reviews: activeItems.filter(i => i.type === "upcoming_review"),
    requests: activeItems.filter(i => i.type === "pending_request"),
    meetingRequests: activeItems.filter(i => i.type === "meeting_request"),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={groupedItems.overdue.length > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groupedItems.overdue.length}</p>
              <p className="text-xs text-muted-foreground">Overdue Check-ins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groupedItems.scheduled.length}</p>
              <p className="text-xs text-muted-foreground">Scheduled 1:1s</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <ClipboardCheck className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groupedItems.reviews.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming Reviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Target className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groupedItems.requests.length}</p>
              <p className="text-xs text-muted-foreground">Capability Requests</p>
            </div>
          </CardContent>
        </Card>
        {groupedItems.meetingRequests.length > 0 && (
          <Card className="border-pink-500/50 bg-pink-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <User className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groupedItems.meetingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Meeting Requests</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* To-Do List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Your To-Do List
            <Badge variant="outline" className="ml-2">{activeItems.length} pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeItems.map((item, index) => {
            const Icon = getIcon(item.type);
            const colorClass = getIconColor(item.type);
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Checkbox 
                  checked={completedIds.has(item.id)}
                  onCheckedChange={() => toggleComplete(item.id)}
                />
                <div className={`p-2 rounded-lg ${colorClass.split(" ")[1]}`}>
                  <Icon className={`h-4 w-4 ${colorClass.split(" ")[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{item.title}</span>
                    {getUrgencyBadge(item.urgency)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.subtitle}</span>
                    {item.date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.date), "MMM d")}
                          {item.time && ` at ${item.time.substring(0, 5)}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleItemClick(item)}
                >
                  {item.type === "pending_request" ? "Review" : item.type === "meeting_request" ? "Schedule" : "Start"}
                </Button>
              </motion.div>
            );
          })}

          {completedItems.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Completed today ({completedItems.length})
              </p>
              {completedItems.map((item) => {
                const Icon = getIcon(item.type);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg opacity-50"
                  >
                    <Checkbox 
                      checked={true}
                      onCheckedChange={() => toggleComplete(item.id)}
                    />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm line-through">{item.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
