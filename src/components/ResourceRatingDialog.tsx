import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResourceRatingDialogProps {
  resourceId: string;
  resourceTitle: string;
  currentRating?: number;
  currentReview?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingSubmitted: () => void;
}

export function ResourceRatingDialog({
  resourceId,
  resourceTitle,
  currentRating,
  currentReview,
  open,
  onOpenChange,
  onRatingSubmitted,
}: ResourceRatingDialogProps) {
  const [rating, setRating] = useState(currentRating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState(currentReview || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if rating exists
      const { data: existing } = await supabase
        .from("resource_ratings")
        .select("id")
        .eq("resource_id", resourceId)
        .eq("profile_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing rating
        const { error } = await supabase
          .from("resource_ratings")
          .update({
            rating,
            review_text: reviewText || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new rating
        const { error } = await supabase
          .from("resource_ratings")
          .insert({
            profile_id: user.id,
            resource_id: resourceId,
            rating,
            review_text: reviewText || null,
          });

        if (error) throw error;
      }

      toast.success("Rating submitted successfully!");
      onRatingSubmitted();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rate Resource</DialogTitle>
          <DialogDescription>
            Share your experience with "{resourceTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {rating === 0 ? "Select a rating" : `${rating} out of 5 stars`}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Your Review (Optional)
            </label>
            <Textarea
              placeholder="Share what you liked or learned from this resource..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
