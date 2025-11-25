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
    gap_size: number;
  }>;
  avg_gap_size: number;
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

      // Get all capabilities for direct reports with gaps (target > current)
      const { data: empCaps, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          profile_id,
          capability_id,
          current_level,
          target_level,
          profiles!employee_capabilities_profile_id_fkey(full_name),
          capabilities!employee_capabilities_capability_id_fkey(name, category)
        `)
        .in("profile_id", employeeIds);

      if (error) throw error;

      // Helper function to calculate gap size
      const getGapSize = (currentLevel: string, targetLevel: string) => {
        const levels = ["foundational", "advancing", "independent", "mastery"];
        const currentIdx = levels.indexOf(currentLevel);
        const targetIdx = levels.indexOf(targetLevel);
        return targetIdx - currentIdx;
      };

      // Group by capability
      const capMap = new Map<string, TeamCapability>();

      (empCaps || []).forEach((ec: any) => {
        const capId = ec.capability_id;
        const capName = ec.capabilities?.name || "Unknown";
        const category = ec.capabilities?.category || "Other";
        const gapSize = getGapSize(ec.current_level, ec.target_level);

        // Only include if there's a gap
        if (gapSize <= 0) return;

        if (!capMap.has(capId)) {
          capMap.set(capId, {
            capability_id: capId,
            capability_name: capName,
            category,
            employees: [],
            avg_gap_size: 0,
          });
        }

        const cap = capMap.get(capId)!;
        cap.employees.push({
          id: ec.profile_id,
          name: ec.profiles?.full_name || "Unknown",
          current_level: ec.current_level,
          target_level: ec.target_level,
          gap_size: gapSize,
        });
      });

      // Calculate average gap size and sort by largest gaps first
      const capsArray = Array.from(capMap.values()).map((cap) => ({
        ...cap,
        avg_gap_size:
          cap.employees.reduce((sum, emp) => sum + emp.gap_size, 0) / cap.employees.length,
      }));

      capsArray.sort((a, b) => b.avg_gap_size - a.avg_gap_size);

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

  const getGapColor = (gapSize: number) => {
    if (gapSize >= 3) return "destructive";
    if (gapSize >= 2) return "default";
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
        No capability gaps found for your team
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
              <Badge variant={getGapColor(Math.round(cap.avg_gap_size))}>
                Avg Gap: {cap.avg_gap_size.toFixed(1)} levels
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
                  <Badge variant={getGapColor(emp.gap_size)} className="text-xs">
                    Gap: {emp.gap_size}
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
