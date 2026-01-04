import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RequestMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RequestMeetingDialog({ open, onOpenChange, onSuccess }: RequestMeetingDialogProps) {
  const [topic, setTopic] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [preferredDate, setPreferredDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [managerInfo, setManagerInfo] = useState<{ id: string; name: string } | null>(null);
  const [loadingManager, setLoadingManager] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadManagerInfo();
    }
  }, [open]);

  const loadManagerInfo = async () => {
    try {
      setLoadingManager(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the user's manager
      const { data: assignment } = await supabase
        .from("manager_assignments")
        .select(`
          manager_id,
          profiles!manager_assignments_manager_id_fkey(id, full_name)
        `)
        .eq("employee_id", user.id)
        .single();

      if (assignment?.profiles) {
        setManagerInfo({
          id: (assignment.profiles as any).id,
          name: (assignment.profiles as any).full_name || "Your Manager"
        });
      }
    } catch (error) {
      console.error("Error loading manager:", error);
    } finally {
      setLoadingManager(false);
    }
  };

  const handleSubmit = async () => {
    if (!managerInfo) {
      toast({
        title: "No manager assigned",
        description: "Please contact your admin to assign you to a manager.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      const { error } = await supabase
        .from("meeting_requests")
        .insert({
          requester_id: user.id,
          requested_manager_id: managerInfo.id,
          company_id: profile.company_id,
          topic: topic.trim() || null,
          urgency,
          preferred_date: preferredDate ? format(preferredDate, "yyyy-MM-dd") : null,
          status: "pending"
        });

      if (error) throw error;

      toast({
        title: "Meeting Requested",
        description: `Your request has been sent to ${managerInfo.name}.`
      });

      // Reset form
      setTopic("");
      setUrgency("normal");
      setPreferredDate(undefined);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error requesting meeting:", error);
      toast({
        title: "Error",
        description: "Failed to send meeting request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Request a Meeting
          </DialogTitle>
          <DialogDescription>
            {loadingManager ? (
              "Loading..."
            ) : managerInfo ? (
              `Send a meeting request to ${managerInfo.name}`
            ) : (
              "You don't have a manager assigned yet."
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingManager ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !managerInfo ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Please contact your administrator to assign you to a manager.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">What would you like to discuss? (optional)</Label>
              <Textarea
                id="topic"
                placeholder="E.g., Career growth, project feedback, personal situation..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - When convenient</SelectItem>
                  <SelectItem value="normal">Normal - Within a week</SelectItem>
                  <SelectItem value="high">High - As soon as possible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preferred Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !preferredDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preferredDate ? format(preferredDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={preferredDate}
                    onSelect={setPreferredDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !managerInfo}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}