import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ChevronDown, ChevronUp, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

interface OneOnOneNote {
  id: string;
  meeting_date: string;
  notes: string | null;
  wins: string | null;
  concerns: string | null;
  action_items: string[];
  next_meeting_date: string | null;
  created_at: string;
}

interface OneOnOneHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    email?: string;
    company_id: string;
  };
}

export function OneOnOneHistoryDialog({ open, onOpenChange, employee }: OneOnOneHistoryDialogProps) {
  const [notes, setNotes] = useState<OneOnOneNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, employee.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("one_on_one_notes")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("manager_id", user.id)
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      
      setNotes((data || []).map(note => ({
        ...note,
        action_items: Array.isArray(note.action_items) 
          ? note.action_items.map((item: unknown) => String(item))
          : []
      })));
    } catch (error: any) {
      toast({
        title: "Error loading history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendFollowUpEmail = async (note: OneOnOneNote) => {
    if (!employee.email) {
      toast({
        title: "No email address",
        description: "This employee doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmailId(note.id);
    try {
      const { error } = await supabase.functions.invoke("send-one-on-one-followup", {
        body: {
          toEmail: employee.email,
          toName: employee.full_name,
          meetingDate: note.meeting_date,
          notes: note.notes,
          wins: note.wins,
          concerns: note.concerns,
          actionItems: note.action_items,
          nextMeetingDate: note.next_meeting_date,
        },
      });

      if (error) throw error;

      toast({
        title: "Follow-up sent",
        description: `Email sent to ${employee.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error sending email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>1:1 History with {employee.full_name}</DialogTitle>
          <DialogDescription>
            View past meeting notes and send follow-up emails
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No 1:1 notes recorded yet for this employee.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Collapsible
                key={note.id}
                open={expandedId === note.id}
                onOpenChange={(open) => setExpandedId(open ? note.id : null)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base">
                            {format(new Date(note.meeting_date), "MMMM d, yyyy")}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {note.action_items?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {note.action_items.length} action items
                            </Badge>
                          )}
                          {expandedId === note.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {note.notes && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Notes</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.notes}</p>
                        </div>
                      )}
                      
                      {note.wins && (
                        <div>
                          <h4 className="text-sm font-medium mb-1 text-green-600">Wins & Accomplishments</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.wins}</p>
                        </div>
                      )}
                      
                      {note.concerns && (
                        <div>
                          <h4 className="text-sm font-medium mb-1 text-amber-600">Concerns & Challenges</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.concerns}</p>
                        </div>
                      )}
                      
                      {note.action_items?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Action Items</h4>
                          <ul className="space-y-1">
                            {note.action_items.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {note.next_meeting_date && (
                        <div className="text-sm">
                          <span className="font-medium">Next meeting: </span>
                          <span className="text-muted-foreground">
                            {format(new Date(note.next_meeting_date), "MMMM d, yyyy")}
                          </span>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendFollowUpEmail(note)}
                          disabled={sendingEmailId === note.id || !employee.email}
                        >
                          {sendingEmailId === note.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Send Follow-up Email
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
