import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ThumbsUp, ThumbsDown, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PodcastFeedbackProps {
  episodeId: string;
  profileId: string;
  episodeTitle: string;
  topicsCovered: string[];
  className?: string;
}

export function PodcastFeedback({
  episodeId,
  profileId,
  episodeTitle,
  topicsCovered,
  className,
}: PodcastFeedbackProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRating = async (newRating: "up" | "down") => {
    if (saved) return;
    
    setRating(newRating);
    
    if (newRating === "down") {
      setShowFeedbackInput(true);
      return;
    }
    
    await submitFeedback(newRating);
  };

  const submitFeedback = async (finalRating: "up" | "down", text?: string) => {
    setSaving(true);
    
    try {
      const { error } = await supabase.from("podcast_feedback").insert({
        profile_id: profileId,
        episode_id: episodeId,
        rating: finalRating,
        feedback_text: text || null,
        context_snapshot: {
          episode_title: episodeTitle,
          topics_covered: topicsCovered,
        },
      });

      if (error) throw error;

      setSaved(true);
      setShowFeedbackInput(false);
      
      if (finalRating === "up") {
        toast({ 
          title: "Thanks! 👍",
          description: "Jericho is learning from your feedback"
        });
      } else {
        toast({ 
          title: "Feedback submitted",
          description: "We'll use this to improve your briefs"
        });
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast({ title: "Failed to save feedback", variant: "destructive" });
      setRating(null);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Check className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs">Feedback saved</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">How was today's brief?</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/20",
            rating === "up" && "bg-green-100 dark:bg-green-900/20 text-green-600"
          )}
          onClick={() => handleRating("up")}
          disabled={saving}
        >
          {saving && rating === "up" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
        </Button>

        <Popover open={showFeedbackInput} onOpenChange={setShowFeedbackInput}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/20",
                rating === "down" && "bg-red-100 dark:bg-red-900/20 text-red-600"
              )}
              onClick={() => handleRating("down")}
              disabled={saving}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">What could be better?</h4>
                <p className="text-xs text-muted-foreground">
                  Your feedback helps Jericho improve
                </p>
              </div>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g., Too long, felt repetitive, challenge wasn't specific enough..."
                rows={3}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFeedbackInput(false);
                    setRating(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitFeedback("down", feedbackText)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
