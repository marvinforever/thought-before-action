import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye, Rocket, MessageSquare } from "lucide-react";

interface DevelopmentRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  implemented_at: string | null;
  profile: { full_name: string; email: string } | null;
  company: { name: string } | null;
}

interface DevelopmentRequestsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500", icon: <Clock className="h-3 w-3" /> },
  reviewing: { label: "Reviewing", color: "bg-blue-500", icon: <Eye className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-green-500", icon: <CheckCircle className="h-3 w-3" /> },
  denied: { label: "Denied", color: "bg-red-500", icon: <XCircle className="h-3 w-3" /> },
  implemented: { label: "Implemented", color: "bg-purple-500", icon: <Rocket className="h-3 w-3" /> },
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-400",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

export function DevelopmentRequestsManager({ open, onOpenChange }: DevelopmentRequestsManagerProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<DevelopmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DevelopmentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("development_requests")
        .select(`
          *,
          profile:profiles!development_requests_profile_id_fkey(full_name, email),
          company:companies!development_requests_company_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "Failed to load development requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open]);

  const updateRequest = async (requestId: string, updates: Partial<DevelopmentRequest>) => {
    try {
      const { error } = await supabase
        .from("development_requests")
        .update({
          ...updates,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({ title: "Request updated" });
      fetchRequests();
      setSelectedRequest(null);
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast({
        title: "Error",
        description: "Failed to update request.",
        variant: "destructive",
      });
    }
  };

  const filteredRequests = statusFilter === "all" 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Development Requests
            <Badge variant="secondary">{requests.length} total</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="implemented">Implemented</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No requests found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {request.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{request.profile?.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.company?.name || "No company"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${priorityColors[request.priority]} text-white`}>
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`${statusConfig[request.status]?.color} text-white border-0 gap-1`}
                      >
                        {statusConfig[request.status]?.icon}
                        {statusConfig[request.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(request);
                          setAdminNotes(request.admin_notes || "");
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Detail View */}
        {selectedRequest && (
          <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{selectedRequest.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Description</div>
                  <p className="text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Priority</div>
                    <Badge className={`${priorityColors[selectedRequest.priority]} text-white`}>
                      {selectedRequest.priority}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Submitted</div>
                    <span className="text-sm">{format(new Date(selectedRequest.created_at), "PPp")}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</div>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this request..."
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateRequest(selectedRequest.id, { status: "reviewing", admin_notes: adminNotes })}
                  >
                    <Eye className="h-4 w-4 mr-1" /> Mark Reviewing
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => updateRequest(selectedRequest.id, { status: "approved", admin_notes: adminNotes })}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateRequest(selectedRequest.id, { status: "denied", admin_notes: adminNotes })}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Deny
                  </Button>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => updateRequest(selectedRequest.id, { 
                      status: "implemented", 
                      admin_notes: adminNotes,
                      implemented_at: new Date().toISOString()
                    })}
                  >
                    <Rocket className="h-4 w-4 mr-1" /> Mark Implemented
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
