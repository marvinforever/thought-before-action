import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface JobDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    role?: string;
  };
}

interface CapabilitySuggestion {
  capability_id: string;
  capability_name: string;
  current_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  target_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  priority: number;
  reasoning: string;
}

export function JobDescriptionDialog({ open, onOpenChange, employee }: JobDescriptionDialogProps) {
  const { toast } = useToast();
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<CapabilitySuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Job description required",
        description: "Please enter a job description to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-job-description', {
        body: { jobDescription, employeeId: employee.id }
      });

      if (error) throw error;

      setSuggestions(data.suggestions || []);
      setSelectedSuggestions(new Set(data.suggestions.map((s: CapabilitySuggestion) => s.capability_id)));
      
      toast({
        title: "Analysis complete",
        description: `Found ${data.suggestions?.length || 0} capability suggestions`,
      });
    } catch (error) {
      console.error('Error analyzing job description:', error);
      toast({
        title: "Analysis failed",
        description: "Could not analyze job description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestion = (capabilityId: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(capabilityId)) {
        next.delete(capabilityId);
      } else {
        next.add(capabilityId);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      const capabilitiesToAssign = suggestions
        .filter(s => selectedSuggestions.has(s.capability_id))
        .map(s => {
          const priority =
            Number.isFinite(Number(s.priority))
              ? Math.min(5, Math.max(1, Math.round(Number(s.priority))))
              : 3;
          return {
            profile_id: employee.id,
            capability_id: s.capability_id,
            current_level: s.current_level,
            target_level: s.target_level,
            priority,
            ai_reasoning: s.reasoning,
          };
        });

      const { error } = await supabase
        .from('employee_capabilities')
        .upsert(capabilitiesToAssign, {
          onConflict: 'profile_id,capability_id',
        });

      if (error) throw error;

      toast({
        title: "Capabilities assigned",
        description: `Successfully assigned ${capabilitiesToAssign.length} capabilities to ${employee.full_name}`,
      });

      onOpenChange(false);
      setSuggestions([]);
      setJobDescription("");
      setSelectedSuggestions(new Set());
    } catch (error) {
      console.error('Error assigning capabilities:', error);
      toast({
        title: "Assignment failed",
        description: "Could not assign capabilities. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      case 'intermediate': return 'bg-green-500/10 text-green-700 dark:text-green-300';
      case 'advanced': return 'bg-purple-500/10 text-purple-700 dark:text-purple-300';
      case 'expert': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analyze Job Description - {employee.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Job Description
            </label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              rows={8}
              className="resize-none"
            />
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !jobDescription.trim()}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Analyze with AI
              </>
            )}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">AI Suggestions</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedSuggestions.size} of {suggestions.length} selected
                </p>
              </div>

              <div className="space-y-3">
                {suggestions.map((suggestion) => {
                  const isSelected = selectedSuggestions.has(suggestion.capability_id);
                  return (
                    <Card
                      key={suggestion.capability_id}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                      }`}
                      onClick={() => toggleSuggestion(suggestion.capability_id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold">{suggestion.capability_name}</h4>
                            <Badge variant="outline">Priority {suggestion.priority}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getLevelColor(suggestion.current_level)}>
                              Current: {suggestion.current_level}
                            </Badge>
                            <Badge className={getLevelColor(suggestion.target_level)}>
                              Target: {suggestion.target_level}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Button 
                onClick={handleAssign}
                disabled={isAssigning || selectedSuggestions.size === 0}
                className="w-full"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${selectedSuggestions.size} Capabilities`
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
