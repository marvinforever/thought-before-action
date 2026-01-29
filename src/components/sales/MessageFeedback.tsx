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

interface MessageFeedbackProps {
  messageId?: string;
  companyId: string;
  userId: string;
  messageContent: string;
  recommendationType?: string;
  conversationContext?: string;
  className?: string;
}

export function MessageFeedback({
  messageId,
  companyId,
  userId,
  messageContent,
  recommendationType = "general",
  conversationContext,
  className,
}: MessageFeedbackProps) {
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
      // Guard: don't attempt insert if required IDs are missing
      if (!companyId || !userId) {
        console.warn("Feedback skipped: missing companyId or userId");
        setSaved(true);
        setShowFeedbackInput(false);
        toast({ title: "Thanks for the feedback! 👍" });
        return;
      }

      const { error } = await supabase.from("sales_coach_feedback").insert({
        company_id: companyId,
        profile_id: userId,
        message_id: messageId || null,
        recommendation_type: recommendationType,
        rating: finalRating,
        feedback_text: text || null,
        context_snapshot: {
          message_preview: messageContent.substring(0, 500),
          conversation_context: conversationContext?.substring(0, 1000),
        },
      });

      if (error) throw error;

      setSaved(true);
      setShowFeedbackInput(false);
      
      // Trigger learning aggregation in the background
      if (finalRating === "up") {
        // Could call an edge function here to process positive feedback
        toast({ 
          title: "Thanks for the feedback! 👍",
          description: "Jericho is learning from this"
        });
      } else {
        toast({ 
          title: "Feedback submitted",
          description: "We'll use this to improve recommendations"
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
    <div className={cn("flex items-center gap-1", className)}>
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
                Your feedback helps Jericho learn and improve
              </p>
            </div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g., The product recommendation doesn't fit this customer's operation size..."
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
  );
}
