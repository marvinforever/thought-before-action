import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Target } from "lucide-react";

interface EmployeeCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
  };
}

type EmployeeCapability = {
  id: string;
  current_level: string;
  target_level: string;
  priority: number;
  ai_reasoning: string | null;
  capability: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
};

export function EmployeeCapabilitiesDialog({ open, onOpenChange, employee }: EmployeeCapabilitiesDialogProps) {
  const [capabilities, setCapabilities] = useState<EmployeeCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCapabilities();
    }
  }, [open, employee.id]);

  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          current_level,
          target_level,
          priority,
          ai_reasoning,
          capability:capabilities(
            id,
            name,
            category,
            description
          )
        `)
        .eq("profile_id", employee.id)
        .order("priority", { ascending: true });

      if (error) throw error;
      setCapabilities((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading capabilities",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "foundational":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "advancing":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "independent":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
      case "mastery":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted";
    }
  };

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {employee.full_name}'s Capabilities
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : capabilities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No capabilities assigned yet
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {capabilities.map((cap) => (
              <Card key={cap.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{cap.capability.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {cap.capability.category}
                      </Badge>
                    </div>
                    <Badge variant="outline">Priority {cap.priority}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {cap.capability.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Current</div>
                      <Badge className={getLevelColor(cap.current_level)}>
                        {getLevelLabel(cap.current_level)}
                      </Badge>
                    </div>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Target</div>
                      <Badge className={getLevelColor(cap.target_level)}>
                        {getLevelLabel(cap.target_level)}
                      </Badge>
                    </div>
                  </div>
                  {cap.ai_reasoning && (
                    <p className="text-xs text-muted-foreground italic pt-2 border-t">
                      {cap.ai_reasoning}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
