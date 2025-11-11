import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Mic, Square } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
