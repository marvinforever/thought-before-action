import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface JobDescription {
  id: string;
  title: string | null;
  description: string;
  created_at: string;
  is_current: boolean;
  analysis_results: any;
}

interface ViewJobDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobDescription: JobDescription | null;
}

export function ViewJobDescriptionDialog({
  open,
  onOpenChange,
  jobDescription,
}: ViewJobDescriptionDialogProps) {
  if (!jobDescription) return null;

  const capabilitiesCount = jobDescription.analysis_results?.suggestions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {jobDescription.title || "Untitled Role"}
                {jobDescription.is_current && (
                  <Badge variant="default" className="text-xs">Current</Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Analyzed {new Date(jobDescription.created_at).toLocaleDateString()} • {capabilitiesCount} capabilities identified
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto max-h-[400px] pr-2 border rounded-md p-4 bg-muted/30">
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {jobDescription.description}
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
