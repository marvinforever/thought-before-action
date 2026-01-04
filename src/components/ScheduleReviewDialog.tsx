import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ScheduleReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
    email?: string;
  };
}

export function ScheduleReviewDialog({ open, onOpenChange, employee }: ScheduleReviewDialogProps) {
  const [reviewDate, setReviewDate] = useState<Date | undefined>();
  const [reviewTime, setReviewTime] = useState<string>("10:00");
  const [reviewType, setReviewType] = useState<string>("quarterly");
  const [managerNotes, setManagerNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [sendCalendarInvite, setSendCalendarInvite] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const { toast } = useToast();

  const handleGenerateReview = async () => {
    setGenerating(true);
    try {
      const reviewPeriods: Record<string, string> = {
        monthly: "Last month",
        quarterly: "Last 3 months",
        "semi-annual": "Last 6 months",
        annual: "Last 12 months",
        onboarding: "Since onboarding",
        probation: "Probation period"
      };

      const { data, error } = await supabase.functions.invoke("generate-performance-review", {
        body: {
          employeeId: employee.id,
          reviewPeriod: reviewPeriods[reviewType] || "Last 3 months"
        }
      });

      if (error) throw error;

      setAiDraft(data.review);
      toast({
        title: "Review generated!",
        description: `Used ${data.context.oneOnOneCount} 1-on-1s, ${data.context.recognitionCount} recognitions, and ${data.context.goalsCompleted}/${data.context.goalsTotal} goals`,
      });
    } catch (error: any) {
      toast({
        title: "Error generating review",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!reviewDate) {
      toast({
        title: "Missing date",
        description: "Please select a review date",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("performance_reviews")
        .insert({
          profile_id: employee.id,
          company_id: employee.company_id,
          scheduled_by: user.id,
          review_date: format(reviewDate, "yyyy-MM-dd"),
          review_type: reviewType,
          manager_notes: managerNotes || null,
          ai_draft: aiDraft || null,
          status: "scheduled",
          scheduled_time: reviewTime + ":00",
          calendar_invite_sent: sendCalendarInvite,
        } as any);

      if (error) throw error;

      // Send calendar invite if requested
      if (sendCalendarInvite && employee.email) {
        setSendingInvite(true);
        try {
          const { data: manager } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", user.id)
            .single();

          if (manager?.email) {
            await supabase.functions.invoke("send-calendar-invite", {
              body: {
                managerEmail: manager.email,
                managerName: manager.full_name || "Manager",
                employeeEmail: employee.email,
                employeeName: employee.full_name,
                meetingType: "review",
                meetingTitle: `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Review: ${employee.full_name}`,
                meetingDate: format(reviewDate, "yyyy-MM-dd"),
                meetingTime: reviewTime,
                durationMinutes: 60,
                description: `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} performance review scheduled via Jericho`,
              },
            });

            toast({
              title: "Calendar invites sent!",
              description: `Invites sent to ${manager.email} and ${employee.email}`,
            });
          }
        } catch (inviteError: any) {
          console.error("Failed to send calendar invite:", inviteError);
          toast({
            title: "Review scheduled, but invite failed",
            description: inviteError.message,
            variant: "destructive",
          });
        } finally {
          setSendingInvite(false);
        }
      }

      toast({
        title: "Review scheduled",
        description: `Performance review scheduled for ${employee.full_name}`,
      });

      // Reset form
      setReviewDate(undefined);
      setReviewTime("10:00");
      setReviewType("quarterly");
      setManagerNotes("");
      setAiDraft("");
      setSendCalendarInvite(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error scheduling review",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Performance Review</DialogTitle>
          <DialogDescription>
            Schedule and prepare review for {employee.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Review Type</Label>
              <Select value={reviewType} onValueChange={setReviewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Review Date & Time</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("flex-1 justify-start text-left font-normal", !reviewDate && "text-muted-foreground")}
                    >
                      {reviewDate ? format(reviewDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={reviewDate}
                      onSelect={setReviewDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Select value={reviewTime} onValueChange={setReviewTime}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {Array.from({ length: 19 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 8;
                      const min = i % 2 === 0 ? "00" : "30";
                      const time = `${hour.toString().padStart(2, "0")}:${min}`;
                      const displayTime = `${hour > 12 ? hour - 12 : hour}:${min} ${hour >= 12 ? "PM" : "AM"}`;
                      return (
                        <SelectItem key={time} value={time}>
                          {displayTime}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {reviewDate && employee.email && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="send-review-invite" 
                    checked={sendCalendarInvite}
                    onCheckedChange={(checked) => setSendCalendarInvite(checked === true)}
                  />
                  <label
                    htmlFor="send-review-invite"
                    className="text-sm flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                    Send calendar invite to both of us
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>AI-Generated Draft</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateReview}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Review
              </Button>
            </div>
            {aiDraft && (
              <Textarea
                value={aiDraft}
                onChange={(e) => setAiDraft(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Additional Manager Notes (Optional)</Label>
            <Textarea
              placeholder="Any additional context or notes..."
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={submitting || sendingInvite || !reviewDate}>
            {submitting || sendingInvite ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {sendingInvite ? "Sending invite..." : "Scheduling..."}
              </>
            ) : (
              "Schedule Review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
