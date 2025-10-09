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

        {/* What This Means */}
        <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              What This Means
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed">
              {domain === "Retention" && "Retention reflects how connected your team feels to their work and the company. It's about belonging, purpose, and whether people see a future here. Low scores? That's your canary in the coal mine—people are mentally checking out before they physically leave."}
              {domain === "Engagement" && "Engagement is the heartbeat of your team—it measures energy, motivation, and how much people genuinely care about their work. High engagement means people are fired up and bringing their A-game. Low engagement? That's the sound of people going through the motions."}
              {domain === "Burnout" && "Burnout is the silent killer of performance. It shows up when demands consistently outpace capacity—when your team is running on fumes. High burnout means you're heading for a crash: mistakes, turnover, and a toxic ripple effect across the organization."}
              {domain === "Manager" && "Manager Support measures whether your leaders are actually leading—providing clarity, removing obstacles, and helping people grow. Great managers multiply team performance. Weak ones? They're often the #1 reason talented people walk out the door."}
              {domain === "Career" && "Career Development is about growth and possibility. Can people see where they're headed? Do they believe they're building skills that matter? When this score drops, it signals stagnation—and talented people don't stick around for stagnation."}
              {domain === "Clarity" && "Role Clarity determines whether people know what's expected of them and how their work connects to the bigger picture. Confusion creates chaos. Clarity creates confidence. Low scores here mean your team is guessing instead of executing."}
              {domain === "Learning" && "Learning Opportunities show whether your team is growing or stagnating. People want to get better, not just busier. When learning flatlines, motivation follows—and your best people start looking for challenges elsewhere."}
              {domain === "Skills" && "Skills Confidence measures whether your team believes they have what it takes to succeed. Low confidence isn't just a morale issue—it's a performance killer. When people doubt their abilities, they play it safe, avoid challenges, and underperform."}
            </p>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              What's Really Happening
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{insights}</p>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              What You Should Do About It
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex gap-3 items-start">
                  <span className="text-primary font-bold text-lg leading-none mt-0.5">→</span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
