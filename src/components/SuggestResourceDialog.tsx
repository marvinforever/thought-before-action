import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";

export function SuggestResourceDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    external_url: "",
    content_type: "",
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.external_url || !formData.content_type) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.external_url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsSubmitting(true);
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
        .from("resource_suggestions")
        .insert({
          profile_id: user.id,
          company_id: profile.company_id,
          title: formData.title,
          description: formData.description || null,
          external_url: formData.external_url,
          content_type: formData.content_type,
        });

      if (error) throw error;

      toast.success("Resource suggestion submitted! Your admin will review it.");
      setFormData({ title: "", description: "", external_url: "", content_type: "" });
      setOpen(false);
    } catch (error: any) {
      console.error("Error submitting suggestion:", error);
      toast.error("Failed to submit suggestion");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Suggest a Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Suggest a Resource</DialogTitle>
          <DialogDescription>
            Know a great book, video, or course? Share it with your team!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., The 5 Levels of Leadership"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_type">Type *</Label>
            <Select
              value={formData.content_type}
              onValueChange={(value) => setFormData({ ...formData, content_type: value })}
            >
              <SelectTrigger id="content_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="podcast">Podcast</SelectItem>
                <SelectItem value="course">Course</SelectItem>
                <SelectItem value="article">Article</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://..."
              value={formData.external_url}
              onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Why is this resource valuable?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Suggestion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
