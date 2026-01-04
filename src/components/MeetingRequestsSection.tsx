import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MessageSquare, Clock, CheckCircle2, XCircle, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/contexts/ViewAsContext";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface MeetingRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  topic: string | null;
  urgency: string;
  preferred_date: string | null;
  status: string;
  created_at: string;
  manager_notes: string | null;
}

interface MeetingRequestsSectionProps {
  onScheduleMeeting?: (employeeId: string, employeeName: string) => void;
}

export function MeetingRequestsSection({ onScheduleMeeting }: MeetingRequestsSectionProps) {
  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadMeetingRequests();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("meeting-requests-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_requests",
        },
        () => {
          loadMeetingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewAsCompanyId]);

  const loadMeetingRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("meeting_requests")
        .select(`
          id,
          requester_id,
          topic,
          urgency,
          preferred_date,
          status,
          created_at,
          manager_notes,
          profiles!meeting_requests_requester_id_fkey(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (viewAsCompanyId) {
        query = query.eq("company_id", viewAsCompanyId);
      } else {
        query = query.eq("requested_manager_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted = data?.map((r: any) => ({
        id: r.id,
        requester_id: r.requester_id,
        requester_name: r.profiles?.full_name || "Unknown",
        topic: r.topic,
        urgency: r.urgency,
        preferred_date: r.preferred_date,
        status: r.status,
        created_at: r.created_at,
        manager_notes: r.manager_notes
      })) || [];

      setRequests(formatted);
    } catch (error) {
      console.error("Error loading meeting requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedRequest || !scheduledDate) return;

    setActionLoading(true);
    try {
      // Combine date and time
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("meeting_requests")
        .update({
          status: "scheduled",
          scheduled_date: scheduledDateTime.toISOString()
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Meeting Scheduled",
        description: `Meeting with ${selectedRequest.requester_name} scheduled for ${format(scheduledDateTime, "PPp")}`
      });

      // Optionally trigger calendar invite
      if (onScheduleMeeting) {
        onScheduleMeeting(selectedRequest.requester_id, selectedRequest.requester_name);
      }

      setScheduleDialogOpen(false);
      setSelectedRequest(null);
      setScheduledDate(undefined);
      setScheduledTime("10:00");
      loadMeetingRequests();
    } catch (error) {
      console.error("Error accepting meeting:", error);
      toast({
        title: "Error",
        description: "Failed to schedule meeting. Please try again.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("meeting_requests")
        .update({
          status: "declined",
          manager_notes: declineReason.trim() || null
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Request Declined",
        description: `Meeting request from ${selectedRequest.requester_name} has been declined.`
      });

      setDeclineDialogOpen(false);
      setSelectedRequest(null);
      setDeclineReason("");
      loadMeetingRequests();
    } catch (error) {
      console.error("Error declining meeting:", error);
      toast({
        title: "Error",
        description: "Failed to decline request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "high": return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case "low": return <Badge variant="secondary" className="text-xs">Low</Badge>;
      default: return <Badge variant="outline" className="text-xs">Normal</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show the section if there are no pending requests
  }

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Meeting Requests
            <Badge variant="default" className="ml-2">{requests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AnimatePresence>
            {requests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg border bg-background"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(request.requester_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{request.requester_name}</span>
                    {getUrgencyBadge(request.urgency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {request.topic ? (
                      <span className="line-clamp-1">{request.topic}</span>
                    ) : (
                      <span className="italic">No topic specified</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    {request.preferred_date && (
                      <>
                        <span>•</span>
                        <span>Prefers: {format(new Date(request.preferred_date), "MMM d")}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request);
                      setDeclineDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(request);
                      if (request.preferred_date) {
                        setScheduledDate(new Date(request.preferred_date));
                      }
                      setScheduleDialogOpen(true);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>
              Set a date and time for your meeting with {selectedRequest?.requester_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedRequest?.topic && (
              <div>
                <Label className="text-muted-foreground">Topic</Label>
                <p className="text-sm mt-1">{selectedRequest.topic}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={!scheduledDate || actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Confirm & Schedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Meeting Request</DialogTitle>
            <DialogDescription>
              Let {selectedRequest?.requester_name} know why you're declining (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder="E.g., Let's discuss this in our next regular 1:1..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declining...
                </>
              ) : (
                "Decline Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}