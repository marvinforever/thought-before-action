import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ResourceSuggestion = {
  id: string;
  suggested_by_email: string | null;
  suggested_by_name: string | null;
  resource_type: string;
  title: string;
  description: string | null;
  url: string | null;
  vendor_name: string | null;
  estimated_cost: number | null;
  capability_tags: string[] | null;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

export default function ResourceSuggestions() {
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ResourceSuggestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from("resource_suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading suggestions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: ResourceSuggestion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("resource_suggestions")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestion.id);

      if (error) throw error;

      toast({ title: "Resource approved", description: "The suggestion has been approved and can now be added to the resource library." });
      loadSuggestions();
    } catch (error: any) {
      toast({ title: "Error approving resource", description: error.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    try {
      if (!selectedSuggestion || !rejectionReason.trim()) {
        toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("resource_suggestions")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedSuggestion.id);

      if (error) throw error;

      toast({ title: "Resource rejected", description: "The suggestion has been rejected." });
      setReviewDialogOpen(false);
      setRejectionReason("");
      loadSuggestions();
    } catch (error: any) {
      toast({ title: "Error rejecting resource", description: error.message, variant: "destructive" });
    }
  };

  const openRejectDialog = (suggestion: ResourceSuggestion) => {
    setSelectedSuggestion(suggestion);
    setReviewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const reviewedSuggestions = suggestions.filter((s) => s.status !== "pending");

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resource Suggestions</h1>
        <p className="text-muted-foreground">
          Review and approve community-submitted learning resources
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Pending Review ({pendingSuggestions.length})</h2>
        {pendingSuggestions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No pending suggestions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingSuggestions.map((suggestion) => (
              <Card key={suggestion.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {suggestion.title}
                        {getStatusBadge(suggestion.status)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Suggested by: {suggestion.suggested_by_name || suggestion.suggested_by_email || "Anonymous"}
                      </p>
                    </div>
                    <Badge variant="outline">{suggestion.resource_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3">{suggestion.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {suggestion.vendor_name && (
                      <Badge variant="secondary">Vendor: {suggestion.vendor_name}</Badge>
                    )}
                    {suggestion.estimated_cost !== null && (
                      <Badge variant="secondary">
                        Cost: ${suggestion.estimated_cost}
                      </Badge>
                    )}
                    {suggestion.capability_tags?.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                  {suggestion.url && (
                    <a
                      href={suggestion.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 mb-4"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {suggestion.url}
                    </a>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={() => handleApprove(suggestion)} size="sm">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => openRejectDialog(suggestion)}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Previously Reviewed ({reviewedSuggestions.length})</h2>
        <div className="space-y-4">
          {reviewedSuggestions.map((suggestion) => (
            <Card key={suggestion.id} className="opacity-75">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {suggestion.title}
                      {getStatusBadge(suggestion.status)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Suggested by: {suggestion.suggested_by_name || suggestion.suggested_by_email || "Anonymous"}
                    </p>
                  </div>
                  <Badge variant="outline">{suggestion.resource_type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-2">{suggestion.description}</p>
                {suggestion.status === "rejected" && suggestion.rejection_reason && (
                  <div className="mt-3 p-3 bg-destructive/10 rounded">
                    <p className="text-sm font-semibold">Rejection Reason:</p>
                    <p className="text-sm">{suggestion.rejection_reason}</p>
                  </div>
                )}
                {suggestion.url && (
                  <a
                    href={suggestion.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {suggestion.url}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Resource Suggestion</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this suggestion. This will help improve future submissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
