import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Flame, Frown, HelpCircle, Calendar, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/contexts/ViewAsContext";

interface RiskFlag {
  id: string;
  profile_id: string;
  risk_type: 'burnout' | 'flight_risk' | 'disengaged' | 'unclear_path';
  risk_level: 'critical' | 'moderate' | 'low';
  risk_score: number;
  notes: string;
  detected_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface TeamHealthRisksProps {
  onScheduleOneOnOne?: (employeeId: string, employeeName: string) => void;
}

export function TeamHealthRisks({ onScheduleOneOnOne }: TeamHealthRisksProps) {
  const [loading, setLoading] = useState(true);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    loadRiskFlags();
  }, [viewAsCompanyId]);

  const loadRiskFlags = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let employeeIds: string[] = [];
      let companyId = viewAsCompanyId;

      if (companyId) {
        // Super admin viewing as company - get all employees in that company
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId);
        
        employeeIds = profiles?.map(p => p.id) || [];
      } else {
        // Regular manager - get their direct reports
        const { data: assignments } = await supabase
          .from("manager_assignments")
          .select("employee_id")
          .eq("manager_id", user.id);

        employeeIds = assignments?.map(a => a.employee_id) || [];
      }

      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get unresolved risk flags for team members
      const { data: risks, error } = await supabase
        .from("employee_risk_flags")
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .in("profile_id", employeeIds)
        .is("resolved_at", null)
        .order("risk_score", { ascending: false });

      if (error) throw error;

      setRiskFlags((risks || []) as RiskFlag[]);
    } catch (error: any) {
      console.error("Error loading risk flags:", error);
      toast({
        title: "Error loading team health data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskIcon = (type: string) => {
    switch (type) {
      case 'burnout': return <Flame className="h-4 w-4" />;
      case 'flight_risk': return <AlertTriangle className="h-4 w-4" />;
      case 'disengaged': return <Frown className="h-4 w-4" />;
      case 'unclear_path': return <HelpCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'moderate': return 'default';
      default: return 'secondary';
    }
  };

  const getRiskLabel = (type: string) => {
    switch (type) {
      case 'burnout': return 'Burnout Risk';
      case 'flight_risk': return 'Flight Risk';
      case 'disengaged': return 'Disengaged';
      case 'unclear_path': return 'Unclear Path';
      default: return type;
    }
  };

  const getInterventionPrompt = (risk: RiskFlag) => {
    switch (risk.risk_type) {
      case 'burnout':
        return risk.risk_level === 'critical'
          ? "Schedule immediate 1-on-1 to discuss workload and work-life balance"
          : "Check in on energy levels and discuss sustainable work practices";
      case 'flight_risk':
        return risk.risk_level === 'critical'
          ? "URGENT: Schedule career conversation to build 3-year growth plan"
          : "Discuss growth opportunities and long-term career vision";
      case 'disengaged':
        return "Re-engage through capability development and meaningful work assignments";
      case 'unclear_path':
        return "Schedule career planning session to clarify role and growth trajectory";
      default:
        return "Schedule check-in conversation";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Health Risk Indicators</CardTitle>
          <CardDescription>Loading team health data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (riskFlags.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-green-900">Team Health: All Clear 🟢</CardTitle>
          <CardDescription className="text-green-700">
            No critical risk indicators detected. Your team is thriving!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const criticalRisks = riskFlags.filter(r => r.risk_level === 'critical');
  const moderateRisks = riskFlags.filter(r => r.risk_level === 'moderate');

  return (
    <Card className={criticalRisks.length > 0 ? "border-destructive" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Team Health Risk Indicators
        </CardTitle>
        <CardDescription>
          {criticalRisks.length > 0 && (
            <span className="text-destructive font-medium">
              🔴 {criticalRisks.length} critical alert(s) requiring immediate action
            </span>
          )}
          {criticalRisks.length === 0 && moderateRisks.length > 0 && (
            <span className="text-yellow-600 font-medium">
              🟡 {moderateRisks.length} moderate concern(s) - proactive intervention recommended
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskFlags.map((risk) => (
          <Card key={risk.id} className={risk.risk_level === 'critical' ? "border-destructive bg-destructive/5" : ""}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Employee & Risk Type */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">{risk.profiles.full_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {getRiskIcon(risk.risk_type)}
                      <span className="text-sm text-muted-foreground">
                        {getRiskLabel(risk.risk_type)}
                      </span>
                      <Badge variant={getRiskColor(risk.risk_level) as any}>
                        {risk.risk_level.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        Risk Score: {risk.risk_score}/100
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Risk Details */}
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-sm">{risk.notes}</p>
                </div>

                {/* Intervention Prompts */}
                <div className="border-l-4 border-primary pl-4 py-2 bg-primary/5">
                  <p className="text-sm font-medium mb-2">🎯 Recommended Action:</p>
                  <p className="text-sm text-muted-foreground">
                    {getInterventionPrompt(risk)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onScheduleOneOnOne?.(risk.profile_id, risk.profiles.full_name)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule 1-on-1
                  </Button>
                  <Button size="sm" variant="outline">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Full Context
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}