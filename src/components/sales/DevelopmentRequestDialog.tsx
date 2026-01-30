import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Send } from "lucide-react";

interface DevelopmentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  companyId?: string;
  userName?: string;
}

export function DevelopmentRequestDialog({
  open,
  onOpenChange,
  userId,
  companyId,
  userName,
}: DevelopmentRequestDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide both a title and description.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Insert the development request
      const { error: insertError } = await supabase
        .from("development_requests")
        .insert({
          profile_id: userId,
          company_id: companyId || null,
          title: title.trim(),
          description: description.trim(),
          priority,
        });

      if (insertError) throw insertError;

      // Send email notification to super admins
      const { error: emailError } = await supabase.functions.invoke("notify-dev-request", {
        body: {
          title: title.trim(),
          description: description.trim(),
          priority,
          userName: userName || "Unknown User",
        },
      });

      if (emailError) {
        console.error("Email notification failed:", emailError);
        // Don't fail the whole request if email fails
      }

      toast({
        title: "Request submitted!",
        description: "Your development request has been sent to the team.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            Development Request
          </DialogTitle>
          <DialogDescription>
            Submit a feature request or improvement idea. Our team reviews all submissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief summary of your request..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the feature or improvement in detail. What problem does it solve? How would it help you?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Nice to have</SelectItem>
                <SelectItem value="medium">Medium - Would help a lot</SelectItem>
                <SelectItem value="high">High - Really need this</SelectItem>
                <SelectItem value="critical">Critical - Blocking my work</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
