import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Award } from "lucide-react";

const RECOGNITION_CATEGORIES = [
  "Leadership",
  "Teamwork",
  "Innovation",
  "Problem Solving",
  "Customer Focus",
  "Communication",
  "Going Above & Beyond",
  "Other"
];

interface RecognitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    company_id: string;
  };
}

export function RecognitionDialog({ open, onOpenChange, employee }: RecognitionDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("private");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a title and description",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("recognition_notes")
        .insert({
          given_by: user.id,
          given_to: employee.id,
          company_id: employee.company_id,
          title: title.trim(),
          description: description.trim(),
          category: category || null,
          visibility,
        });

      if (error) throw error;

      toast({
        title: "Recognition sent!",
        description: `Your recognition for ${employee.full_name} has been recorded`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setVisibility("private");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error sending recognition",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Recognize {employee.full_name}
          </DialogTitle>
          <DialogDescription>
            Capture great work to combat recency bias in reviews
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              placeholder="e.g., Great presentation to the client"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe what they did and why it was great..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Category (Optional)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {RECOGNITION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="private">Private (only you and them)</SelectItem>
                <SelectItem value="team">Team (visible to team)</SelectItem>
                <SelectItem value="company">Company (visible to everyone)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Recognition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
