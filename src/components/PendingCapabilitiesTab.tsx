import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, X, User } from "lucide-react";
import { Label } from "@/components/ui/label";

interface CapabilityRequest {
  id: string;
  profile_id: string;
  capability_id: string;
  current_level: string;
  requested_level: string;
  evidence_text: string;
  status: string;
  created_at: string;
  manager_notes: string | null;
  employee_name: string;
  capability_name: string;
  is_self_request?: boolean;
}

export function PendingCapabilitiesTab() {
  const [requests, setRequests] = useState<CapabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get manager's direct reports
      const { data: reports } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      const employeeIds = reports?.map((r) => r.employee_id) || [];

      // Check if current user has a manager
      const { data: userAssignment } = await supabase
        .from("manager_assignments")
        .select("manager_id")
        .eq("employee_id", user.id)
        .maybeSingle();

      // If user has no manager, include their own requests for self-approval
      if (!userAssignment?.manager_id) {
        employeeIds.push(user.id);
      }

      if (employeeIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Get pending requests for direct reports (and self if no manager)
      const { data, error } = await supabase
        .from("capability_level_requests")
        .select(`
          *,
          profiles!capability_level_requests_profile_id_fkey(full_name),
          capabilities!capability_level_requests_capability_id_fkey(name)
        `)
        .in("profile_id", employeeIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const formattedRequests = (data || []).map((req: any) => ({
        id: req.id,
        profile_id: req.profile_id,
        capability_id: req.capability_id,
        current_level: req.current_level,
        requested_level: req.requested_level,
        evidence_text: req.evidence_text,
        status: req.status,
        created_at: req.created_at,
        manager_notes: req.manager_notes,
        employee_name: req.profile_id === currentUser?.id 
          ? `${req.profiles?.full_name || "Unknown"} (You)` 
          : req.profiles?.full_name || "Unknown",
        capability_name: req.capabilities?.name || "Unknown",
        is_self_request: req.profile_id === currentUser?.id,
      }));

      setRequests(formattedRequests);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: CapabilityRequest) => {
    setProcessingId(request.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the request
      const { error: updateError } = await supabase
        .from("capability_level_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          manager_notes: managerNotes[request.id] || null,
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Update the employee capability
      const { error: capError } = await supabase
        .from("employee_capabilities")
        .update({ current_level: request.requested_level as "foundational" | "advancing" | "independent" | "mastery" })
        .eq("profile_id", request.profile_id)
        .eq("capability_id", request.capability_id);

      if (capError) throw capError;

      // Log the change in history
      const { error: historyError } = await supabase
        .from("capability_level_history")
        .insert({
          profile_id: request.profile_id,
          capability_id: request.capability_id,
          from_level: request.current_level,
          to_level: request.requested_level,
          changed_by: user.id,
          request_id: request.id,
          change_reason: "Manager approved level change request",
        });

      if (historyError) throw historyError;

      // Send email notification to employee
      try {
        await supabase.functions.invoke('notify-capability-change', {
          body: {
            employeeId: request.profile_id,
            employeeName: request.employee_name.replace(" (You)", ""),
            managerName: "Your Manager", // Could be enhanced to get actual manager name
            capabilityName: request.capability_name,
            previousLevel: request.current_level,
            newLevel: request.requested_level,
            previousPriority: null,
            newPriority: null,
            reason: managerNotes[request.id] || "Your capability level upgrade request has been approved!",
          }
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the approval if email fails
      }

      toast.success(`Approved ${request.employee_name}'s request and sent notification email`);
      loadRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: CapabilityRequest) => {
    if (!managerNotes[request.id]?.trim()) {
      toast.error("Please provide feedback for rejection");
      return;
    }

    setProcessingId(request.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("capability_level_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          manager_notes: managerNotes[request.id],
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success(`Rejected request with feedback`);
      loadRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending capability requests
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {request.employee_name}
                </CardTitle>
                <CardDescription>{request.capability_name}</CardDescription>
              </div>
              <div className="flex gap-2">
                {request.is_self_request && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    Self-Approval
                  </Badge>
                )}
                <Badge variant="secondary">Pending</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Current Level:</span>
                <div className="font-medium capitalize">{request.current_level}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested Level:</span>
                <div className="font-medium capitalize">{request.requested_level}</div>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Evidence Provided:</Label>
              <div className="mt-1 text-sm bg-muted/50 p-3 rounded-md">
                {request.evidence_text}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`notes-${request.id}`}>Manager Feedback</Label>
              <Textarea
                id={`notes-${request.id}`}
                placeholder="Add your feedback (required for rejection)..."
                value={managerNotes[request.id] || ""}
                onChange={(e) =>
                  setManagerNotes({ ...managerNotes, [request.id]: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => handleReject(request)}
                disabled={processingId === request.id}
              >
                {processingId === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => handleApprove(request)}
                disabled={processingId === request.id}
              >
                {processingId === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
