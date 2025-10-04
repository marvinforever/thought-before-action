import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OneOnOneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
  };
}

export function OneOnOneDialog({ open, onOpenChange, employee }: OneOnOneDialogProps) {
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [wins, setWins] = useState("");
  const [concerns, setConcerns] = useState("");
  const [actionItems, setActionItems] = useState<string[]>([""]);
  const [nextMeetingDate, setNextMeetingDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAddActionItem = () => {
    setActionItems([...actionItems, ""]);
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleActionItemChange = (index: number, value: string) => {
    const newItems = [...actionItems];
    newItems[index] = value;
    setActionItems(newItems);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const validActionItems = actionItems.filter(item => item.trim() !== "");

      const { error } = await supabase
        .from("one_on_one_notes")
        .insert({
          manager_id: user.id,
          employee_id: employee.id,
          company_id: employee.company_id,
          meeting_date: format(meetingDate, "yyyy-MM-dd"),
          notes: notes || null,
          wins: wins || null,
          concerns: concerns || null,
          action_items: validActionItems,
          next_meeting_date: nextMeetingDate ? format(nextMeetingDate, "yyyy-MM-dd") : null,
        });

      if (error) throw error;

      toast({
        title: "1-on-1 notes saved",
        description: "Your meeting notes have been recorded",
      });

      // Reset form
      setNotes("");
      setWins("");
      setConcerns("");
      setActionItems([""]);
      setNextMeetingDate(undefined);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving notes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>1-on-1 with {employee.full_name}</DialogTitle>
          <DialogDescription>
            Document your conversation, wins, concerns, and action items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Meeting Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !meetingDate && "text-muted-foreground")}
                >
                  {meetingDate ? format(meetingDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                <Calendar
                  mode="single"
                  selected={meetingDate}
                  onSelect={(date) => date && setMeetingDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>General Notes</Label>
            <Textarea
              placeholder="Overall conversation notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Wins & Accomplishments</Label>
            <Textarea
              placeholder="What went well? What did they accomplish?"
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Concerns & Challenges</Label>
            <Textarea
              placeholder="Any concerns, blockers, or challenges?"
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Action Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddActionItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            {actionItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Action item..."
                  value={item}
                  onChange={(e) => handleActionItemChange(index, e.target.value)}
                />
                {actionItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveActionItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Next Meeting Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !nextMeetingDate && "text-muted-foreground")}
                >
                  {nextMeetingDate ? format(nextMeetingDate, "PPP") : "Select next meeting date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                <Calendar
                  mode="single"
                  selected={nextMeetingDate}
                  onSelect={setNextMeetingDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
