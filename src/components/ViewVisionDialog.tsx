import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Target } from "lucide-react";

interface ViewVisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "1-year" | "3-year";
  content: string | null;
}

export function ViewVisionDialog({
  open,
  onOpenChange,
  type,
  content,
}: ViewVisionDialogProps) {
  const isOneYear = type === "1-year";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isOneYear ? (
              <Target className="h-5 w-5 text-primary" />
            ) : (
              <Eye className="h-5 w-5 text-primary" />
            )}
            <div className="flex-1">
              <DialogTitle>
                {isOneYear ? "1 Year Vision" : "3 Year Vision"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isOneYear 
                  ? "One year from now, what do you want the story to be?"
                  : "Three years from now, what do you want to have achieved?"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto max-h-[400px] pr-2 border rounded-md p-4 bg-muted/30">
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {content || "No vision set yet."}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
