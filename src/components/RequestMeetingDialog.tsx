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
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [people, setPeople] = useState<{ id: string; name: string; isManager: boolean }[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPeople();
    }
  }, [open]);

  const loadPeople = async () => {
    try {
      setLoadingPeople(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company and manager
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return;

      // Find the user's manager
      const { data: assignment } = await supabase
        .from("manager_assignments")
        .select("manager_id")
        .eq("employee_id", user.id)
        .single();

      const managerId = assignment?.manager_id || null;

      // Get all people in the company (excluding self)
      const { data: colleagues } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", profile.company_id)
        .neq("id", user.id)
        .order("full_name");

      const peopleList = (colleagues || []).map(p => ({
        id: p.id,
        name: p.full_name || "Unknown",
        isManager: p.id === managerId
      }));

      // Sort so manager appears first
      peopleList.sort((a, b) => {
        if (a.isManager) return -1;
        if (b.isManager) return 1;
        return a.name.localeCompare(b.name);
      });

      setPeople(peopleList);
      
      // Default to manager if they have one
      if (managerId && peopleList.some(p => p.id === managerId)) {
        setSelectedPersonId(managerId);
      } else if (peopleList.length > 0) {
        setSelectedPersonId(peopleList[0].id);
      }
    } catch (error) {
      console.error("Error loading people:", error);
    } finally {
      setLoadingPeople(false);
    }
  };

  const selectedPerson = people.find(p => p.id === selectedPersonId);

  const handleSubmit = async () => {
    if (!selectedPersonId) {
      toast({
        title: "Please select someone",
        description: "Choose who you'd like to meet with.",
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
          requested_manager_id: selectedPersonId,
          company_id: profile.company_id,
          topic: topic.trim() || null,
          urgency,
          preferred_date: preferredDate ? format(preferredDate, "yyyy-MM-dd") : null,
          status: "pending"
        });

      if (error) throw error;

      toast({
        title: "Meeting Requested",
        description: `Your request has been sent to ${selectedPerson?.name || "them"}.`
      });

      // Reset form
      setTopic("");
      setUrgency("normal");
      setPreferredDate(undefined);
      setSelectedPersonId("");
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
            Choose who you'd like to meet with and share what's on your mind.
          </DialogDescription>
        </DialogHeader>

        {loadingPeople ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : people.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No colleagues found in your organization.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Who would you like to meet with?</Label>
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}{person.isManager ? " (Your Manager)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
            disabled={loading || !selectedPersonId || people.length === 0}
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