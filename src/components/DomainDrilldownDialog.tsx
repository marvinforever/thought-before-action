import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  score: number;
  risk: "low" | "medium" | "high" | "critical";
}

interface DomainDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  score: number;
  risk: "low" | "medium" | "high" | "critical";
  employees: Employee[];
  insights: string;
  recommendations: string[];
}

export function DomainDrilldownDialog({
  open,
  onOpenChange,
  domain,
  score,
  risk,
  employees,
  insights,
  recommendations,
}: DomainDrilldownDialogProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "text-destructive";
      case "high": return "text-orange-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-green-600";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case "critical": return "bg-destructive/10 border-destructive/20";
      case "high": return "bg-orange-100 border-orange-200 dark:bg-orange-950 dark:border-orange-800";
      case "medium": return "bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800";
      case "low": return "bg-green-100 border-green-200 dark:bg-green-950 dark:border-green-800";
      default: return "bg-muted";
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "critical": return "Critical";
      case "high": return "High Risk";
      case "medium": return "Moderate";
      case "low": return "Low Risk";
      default: return risk;
    }
  };

  // Group employees by risk level
  const criticalEmployees = employees.filter(e => e.risk === "critical");
  const highRiskEmployees = employees.filter(e => e.risk === "high");
  const mediumRiskEmployees = employees.filter(e => e.risk === "medium");
  const lowRiskEmployees = employees.filter(e => e.risk === "low");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            {domain} Deep Dive
            <Badge className={`${getRiskBgColor(risk)} ${getRiskColor(risk)} border`}>
              {getRiskLabel(risk)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown and actionable insights
          </DialogDescription>
        </DialogHeader>

        {/* Overall Score */}
        <Card className={`border-l-4 ${getRiskBgColor(risk)}`}>
          <CardHeader>
            <CardTitle className="text-lg">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{score}</div>
            <p className="text-sm text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{insights}</p>
          </CardContent>
        </Card>

        {/* Employee Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Breakdown ({employees.length} total)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {criticalEmployees.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Critical Risk ({criticalEmployees.length})
                </h4>
                <div className="space-y-1">
                  {criticalEmployees.map(emp => (
                    <div key={emp.id} className="text-sm flex justify-between items-center p-2 rounded bg-destructive/5">
                      <span>{emp.name}</span>
                      <span className="font-semibold text-destructive">{emp.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highRiskEmployees.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  High Risk ({highRiskEmployees.length})
                </h4>
                <div className="space-y-1">
                  {highRiskEmployees.map(emp => (
                    <div key={emp.id} className="text-sm flex justify-between items-center p-2 rounded bg-orange-100 dark:bg-orange-950">
                      <span>{emp.name}</span>
                      <span className="font-semibold text-orange-600">{emp.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mediumRiskEmployees.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Moderate Risk ({mediumRiskEmployees.length})
                </h4>
                <div className="space-y-1">
                  {mediumRiskEmployees.slice(0, 5).map(emp => (
                    <div key={emp.id} className="text-sm flex justify-between items-center p-2 rounded bg-yellow-100 dark:bg-yellow-950">
                      <span>{emp.name}</span>
                      <span className="font-semibold text-yellow-600">{emp.score}</span>
                    </div>
                  ))}
                  {mediumRiskEmployees.length > 5 && (
                    <p className="text-xs text-muted-foreground pl-2">
                      + {mediumRiskEmployees.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {lowRiskEmployees.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Low Risk ({lowRiskEmployees.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  These employees are performing well in this area.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
