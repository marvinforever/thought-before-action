import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Mic, Square, ChevronDown, ChevronUp, History, Mail, Award, Sparkles, CalendarPlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OneOnOneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
    email?: string;
  };
  scheduleOnly?: boolean;
}

interface PreviousNote {
  id: string;
  meeting_date: string;
  notes: string | null;
  wins: string | null;
  concerns: string | null;
  action_items: string[] | null | unknown;
}

interface RecentRecognition {
  id: string;
  title: string;
  description: string;
  category: string | null;
  created_at: string;
}

export function OneOnOneDialog({ open, onOpenChange, employee, scheduleOnly = false }: OneOnOneDialogProps) {
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [wins, setWins] = useState("");
  const [concerns, setConcerns] = useState("");
  const [actionItems, setActionItems] = useState<string[]>([""]);
  const [nextMeetingDate, setNextMeetingDate] = useState<Date | undefined>();
  const [nextMeetingTime, setNextMeetingTime] = useState<string>("10:00");
  const [sendCalendarInvite, setSendCalendarInvite] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previousNotes, setPreviousNotes] = useState<PreviousNote[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [recentRecognitions, setRecentRecognitions] = useState<RecentRecognition[]>([]);
  const [recognitionOpen, setRecognitionOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && employee?.id) {
      loadPreviousNotes();
      loadRecentRecognitions();
    }
  }, [open, employee?.id]);

  const loadRecentRecognitions = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("recognition_notes")
        .select("id, title, description, category, created_at")
        .eq("given_to", employee.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentRecognitions(data || []);
    } catch (error) {
      console.error("Error loading recognitions:", error);
    }
  };

  const loadPreviousNotes = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("one_on_one_notes")
        .select("id, meeting_date, notes, wins, concerns, action_items")
        .eq("employee_id", employee.id)
        .eq("manager_id", user.id)
        .order("meeting_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setPreviousNotes(data || []);
    } catch (error: any) {
      console.error("Error loading previous notes:", error);
      toast({
        title: "Couldn't load previous 1:1s",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendFollowUp = async (note: PreviousNote) => {
    if (!employee.email) {
      toast({
        title: "No email address",
        description: "This employee doesn't have an email address on file",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(note.id);
    try {
      const { error } = await supabase.functions.invoke('send-one-on-one-followup', {
        body: {
          employeeEmail: employee.email,
          employeeName: employee.full_name,
          meetingDate: note.meeting_date,
          notes: note.notes,
          wins: note.wins,
          concerns: note.concerns,
          actionItems: note.action_items,
        }
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
      setSendingEmail(null);
    }
  };

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Your conversation is being recorded",
      });
    } catch (error: any) {
      toast({
        title: "Recording error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioBlob);
      });

      // Transcribe audio
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio }
      });

      if (transcriptionError) throw transcriptionError;
      if (!transcriptionData?.text) throw new Error("No transcription received");

      // Parse transcription into structured notes
      const { data: parsedData, error: parseError } = await supabase.functions.invoke('parse-meeting-notes', {
        body: { 
          transcript: transcriptionData.text,
          employeeName: employee.full_name
        }
      });

      if (parseError) throw parseError;

      // Populate form fields
      if (parsedData.notes) setNotes(parsedData.notes);
      if (parsedData.wins) setWins(parsedData.wins);
      if (parsedData.concerns) setConcerns(parsedData.concerns);
      if (parsedData.actionItems && Array.isArray(parsedData.actionItems) && parsedData.actionItems.length > 0) {
        setActionItems(parsedData.actionItems);
      }

      toast({
        title: "Notes generated",
        description: "Your conversation has been transcribed and organized",
      });
    } catch (error: any) {
      toast({
        title: "Processing error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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
          scheduled_time: nextMeetingDate && nextMeetingTime ? nextMeetingTime + ":00" : null,
          calendar_invite_sent: sendCalendarInvite && !!nextMeetingDate,
        } as any);

      if (error) throw error;

      // Send calendar invite if requested
      if (sendCalendarInvite && nextMeetingDate && employee.email) {
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
                meetingType: "one_on_one",
                meetingTitle: `1:1 Meeting: ${manager.full_name || "Manager"} & ${employee.full_name}`,
                meetingDate: format(nextMeetingDate, "yyyy-MM-dd"),
                meetingTime: nextMeetingTime,
                durationMinutes: 30,
                description: "Scheduled 1:1 meeting via Jericho",
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
            title: "Notes saved, but invite failed",
            description: inviteError.message,
            variant: "destructive",
          });
        } finally {
          setSendingInvite(false);
        }
      }

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
      setNextMeetingTime("10:00");
      setSendCalendarInvite(false);
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
          <DialogTitle>
            {scheduleOnly ? `Schedule 1-on-1 with ${employee.full_name}` : `1-on-1 with ${employee.full_name}`}
          </DialogTitle>
          <DialogDescription>
            {scheduleOnly 
              ? "Pick a date and time to schedule your next 1-on-1 meeting"
              : "Document your conversation, wins, concerns, and action items"
            }
          </DialogDescription>
        </DialogHeader>

        {scheduleOnly ? (
          /* Schedule-only mode - simplified UI */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Meeting Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !nextMeetingDate && "text-muted-foreground")}
                  >
                    {nextMeetingDate ? format(nextMeetingDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={nextMeetingDate}
                    onSelect={setNextMeetingDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {nextMeetingDate && (
              <div className="space-y-2">
                <Label>Select Time</Label>
                <Select value={nextMeetingTime} onValueChange={setNextMeetingTime}>
                  <SelectTrigger className="w-full">
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
            )}

            {nextMeetingDate && employee.email && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="send-invite-schedule" 
                  checked={sendCalendarInvite}
                  onCheckedChange={(checked) => setSendCalendarInvite(checked === true)}
                />
                <label
                  htmlFor="send-invite-schedule"
                  className="text-sm flex items-center gap-1 cursor-pointer"
                >
                  <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                  Send calendar invite to both of us
                </label>
              </div>
            )}
          </div>
        ) : (
          /* Full 1:1 mode */
          <>
            {/* Previous 1:1s Section */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="border rounded-lg">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto"
                  disabled={loadingHistory}
                >
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Previous 1:1s</span>
                    <span className="text-muted-foreground text-sm">({previousNotes.length})</span>
                  </div>
                  {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                {loadingHistory ? (
                  <div className="py-3 text-sm text-muted-foreground">Loading previous 1:1s…</div>
                ) : previousNotes.length === 0 ? (
                  <div className="py-3 text-sm text-muted-foreground">No previous 1:1s yet.</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previousNotes.map((note) => (
                      <Collapsible 
                        key={note.id} 
                        open={expandedNoteId === note.id}
                        onOpenChange={(isOpen) => setExpandedNoteId(isOpen ? note.id : null)}
                      >
                        <div className="border rounded-md">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-3 h-auto text-left">
                              <span className="font-medium text-sm">
                                {format(new Date(note.meeting_date), "MMMM d, yyyy")}
                              </span>
                              {expandedNoteId === note.id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3 space-y-2">
                            {note.notes && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                                <p className="text-sm">{note.notes}</p>
                              </div>
                            )}
                            {note.wins && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Wins</p>
                                <p className="text-sm">{note.wins}</p>
                              </div>
                            )}
                            {note.concerns && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Concerns</p>
                                <p className="text-sm">{note.concerns}</p>
                              </div>
                            )}
                            {Array.isArray(note.action_items) && note.action_items.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Action Items</p>
                                <ul className="list-disc list-inside text-sm">
                                  {note.action_items.map((item, idx) => (
                                    <li key={idx}>{String(item)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => handleSendFollowUp(note)}
                              disabled={sendingEmail === note.id}
                            >
                              {sendingEmail === note.id ? (
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              ) : (
                                <Mail className="h-3 w-3 mr-2" />
                              )}
                              Send as Follow-up Email
                            </Button>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Recent Recognition Section */}
            {recentRecognitions.length > 0 && (
              <Collapsible open={recognitionOpen} onOpenChange={setRecognitionOpen} className="border rounded-lg border-amber-500/20 bg-amber-500/5">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">Recent Wins to Discuss</span>
                      <Badge variant="secondary" className="text-xs">{recentRecognitions.length}</Badge>
                    </div>
                    {recognitionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Recognition from the last 30 days — great talking points!
                  </p>
                  <div className="space-y-2">
                    {recentRecognitions.map((recognition) => (
                      <div
                        key={recognition.id}
                        className="p-3 rounded-md border bg-background"
                      >
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{recognition.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {recognition.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {recognition.category && (
                                <Badge variant="outline" className="text-xs">{recognition.category}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(recognition.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="space-y-4">
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm">
                    {isRecording ? "Recording in progress..." : isProcessing ? "Processing recording..." : "Record your conversation to auto-fill notes"}
                  </span>
                  <Button
                    variant={isRecording ? "destructive" : "default"}
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing
                      </>
                    ) : isRecording ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
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
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("flex-1 justify-start text-left font-normal", !nextMeetingDate && "text-muted-foreground")}
                      >
                        {nextMeetingDate ? format(nextMeetingDate, "PPP") : "Select date"}
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
                  {nextMeetingDate && (
                    <Select value={nextMeetingTime} onValueChange={setNextMeetingTime}>
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
                  )}
                </div>
                {nextMeetingDate && employee.email && (
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox 
                      id="send-invite" 
                      checked={sendCalendarInvite}
                      onCheckedChange={(checked) => setSendCalendarInvite(checked === true)}
                    />
                    <label
                      htmlFor="send-invite"
                      className="text-sm flex items-center gap-1 cursor-pointer"
                    >
                      <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                      Send calendar invite to both of us
                    </label>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || sendingInvite || (scheduleOnly && !nextMeetingDate)}
          >
            {submitting || sendingInvite ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {sendingInvite ? "Sending invite..." : "Saving..."}
              </>
            ) : scheduleOnly ? (
              <>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule Meeting
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
