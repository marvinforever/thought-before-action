import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Loader2 } from "lucide-react";

interface BatchJobDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: string; full_name: string; email: string }>;
}

export function BatchJobDescriptionDialog({ open, onOpenChange, employees }: BatchJobDescriptionDialogProps) {
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job description",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setProgress({ current: 1, total: 1 });
    
    try {
      // Get company_id from the first employee's profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', employees[0].id)
        .single();

      const { data, error } = await supabase.functions.invoke("batch-analyze-job-description", {
        body: { 
          employeeIds: employees.map(e => e.id),
          jobDescription: description,
          companyId: profileData?.company_id
        },
      });

      if (error) throw error;

      const { successCount, totalCount, failedEmployees } = data;
      
      if (successCount > 0) {
        toast({
          title: "Analysis Complete",
          description: `Successfully assigned capabilities to ${successCount} of ${totalCount} employee(s). ${failedEmployees?.length > 0 ? `${failedEmployees.length} failed.` : 'All employees received identical capability assignments.'}`,
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: "Could not analyze any employees. Please try again.",
          variant: "destructive",
        });
      }

      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error('Batch analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "An error occurred during analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Batch Analyze Job Description
          </DialogTitle>
          <DialogDescription>
            Analyze and assign capabilities to {employees.length} employee(s) based on this job description
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Selected Employees:</strong> {employees.map(e => e.full_name).join(", ")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobDescription">Job Description *</Label>
            <Textarea
              id="jobDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the complete job description here..."
              className="min-h-[300px] font-mono text-sm"
              disabled={analyzing}
            />
          </div>

          {analyzing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Analyzing job description and assigning capabilities to all {employees.length} employee(s)...
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={analyzing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={analyzing || !description.trim()}>
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Analyze All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
