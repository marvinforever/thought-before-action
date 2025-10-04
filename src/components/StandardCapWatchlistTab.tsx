import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TeamCapability {
  capability_id: string;
  capability_name: string;
  category: string;
  employees: Array<{
    id: string;
    name: string;
    current_level: string;
    target_level: string;
    priority: number;
  }>;
  avg_priority: number;
}

export function StandardCapWatchlistTab() {
  const [capabilities, setCapabilities] = useState<TeamCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamCapabilities();
  }, []);

  const loadTeamCapabilities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get manager's direct reports
      const { data: reports } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      if (!reports || reports.length === 0) {
        setCapabilities([]);
        setLoading(false);
        return;
      }

      const employeeIds = reports.map((r) => r.employee_id);

      // Get all capabilities for direct reports
      const { data: empCaps, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          profile_id,
          capability_id,
          current_level,
          target_level,
          priority,
          profiles!employee_capabilities_profile_id_fkey(full_name),
          capabilities!employee_capabilities_capability_id_fkey(name, category)
        `)
        .in("profile_id", employeeIds)
        .not("priority", "is", null)
        .order("priority", { ascending: false });

      if (error) throw error;

      // Group by capability
      const capMap = new Map<string, TeamCapability>();

      (empCaps || []).forEach((ec: any) => {
        const capId = ec.capability_id;
        const capName = ec.capabilities?.name || "Unknown";
        const category = ec.capabilities?.category || "Other";

        if (!capMap.has(capId)) {
          capMap.set(capId, {
            capability_id: capId,
            capability_name: capName,
            category,
            employees: [],
            avg_priority: 0,
          });
        }

        const cap = capMap.get(capId)!;
        cap.employees.push({
          id: ec.profile_id,
          name: ec.profiles?.full_name || "Unknown",
          current_level: ec.current_level,
          target_level: ec.target_level,
          priority: ec.priority || 0,
        });
      });

      // Calculate average priority and sort
      const capsArray = Array.from(capMap.values()).map((cap) => ({
        ...cap,
        avg_priority:
          cap.employees.reduce((sum, emp) => sum + emp.priority, 0) / cap.employees.length,
      }));

      capsArray.sort((a, b) => b.avg_priority - a.avg_priority);

      setCapabilities(capsArray);
    } catch (error) {
      console.error("Error loading team capabilities:", error);
      toast.error("Failed to load team capabilities");
    } finally {
      setLoading(false);
    }
  };

  const getLevelIcon = (current: string, target: string) => {
    const levels = ["foundational", "advancing", "independent", "mastery"];
    const currentIdx = levels.indexOf(current);
    const targetIdx = levels.indexOf(target);

    if (targetIdx > currentIdx) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (targetIdx < currentIdx) {
      return <TrendingDown className="h-4 w-4 text-orange-600" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 5) return "default";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (capabilities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No capabilities with priority set for your team
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {capabilities.map((cap) => (
        <Card key={cap.capability_id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{cap.capability_name}</CardTitle>
                <CardDescription>{cap.category}</CardDescription>
              </div>
              <Badge variant={getPriorityColor(Math.round(cap.avg_priority))}>
                Avg Priority: {cap.avg_priority.toFixed(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cap.employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getLevelIcon(emp.current_level, emp.target_level)}
                    <div>
                      <div className="font-medium text-sm">{emp.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {emp.current_level} → {emp.target_level}
                      </div>
                    </div>
                  </div>
                  <Badge variant={getPriorityColor(emp.priority)} className="text-xs">
                    P{emp.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
