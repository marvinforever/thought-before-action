import { AlertTriangle } from "lucide-react";
import { IGPDiagnostic } from "./igp-types";

interface IGPDiagnosticScorecardProps {
  diagnostic: IGPDiagnostic;
}

const METRICS = [
  { key: "engagement_score", label: "Engagement" },
  { key: "clarity_score", label: "Clarity" },
  { key: "career_score", label: "Career" },
  { key: "learning_score", label: "Learning" },
  { key: "manager_score", label: "Manager" },
  { key: "skills_score", label: "Skills" },
  { key: "retention_score", label: "Retention" },
  { key: "burnout_score", label: "Burnout Risk" },
] as const;

function getScoreColor(score: number | null): string {
  if (score === null || score === undefined) return "bg-muted";
  if (score <= 30) return "bg-red-500";
  if (score <= 60) return "bg-amber-500";
  if (score <= 85) return "bg-blue-500";
  return "bg-green-500";
}

function getScoreTextColor(score: number | null): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score <= 30) return "text-red-600 dark:text-red-400";
  if (score <= 60) return "text-amber-600 dark:text-amber-400";
  if (score <= 85) return "text-blue-600 dark:text-blue-400";
  return "text-green-600 dark:text-green-400";
}

export function IGPDiagnosticScorecard({ diagnostic }: IGPDiagnosticScorecardProps) {
  const scores = METRICS.map(m => ({
    ...m,
    value: diagnostic[m.key as keyof IGPDiagnostic] as number | null,
  }));

  const criticalAlerts = scores.filter(s => s.value !== null && s.value !== undefined && s.value <= 30);
  const pendingCount = scores.filter(s => s.value === null || s.value === undefined).length;
  const completedCount = scores.length - pendingCount;

  return (
    <div className="space-y-4 print:break-inside-avoid" id="igp-diagnostic">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Diagnostic Assessment</h2>
        <span className="text-xs text-muted-foreground">
          {completedCount} of {scores.length} dimensions assessed
        </span>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2">
          {criticalAlerts.map(alert => (
            <div key={alert.key} className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="font-medium text-red-700 dark:text-red-300">
                {alert.label}: {alert.value}% — Immediate attention recommended
              </span>
            </div>
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          Diagnostic partially complete — {pendingCount} of {scores.length} dimensions pending assessment
        </div>
      )}

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scores.map(score => (
          <div
            key={score.key}
            className={`rounded-lg border p-3 ${
              score.value === null || score.value === undefined
                ? "bg-muted/30 border-muted"
                : "bg-card border-border"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1">{score.label}</p>
            {score.value === null || score.value === undefined ? (
              <p className="text-sm text-muted-foreground italic">Awaiting Data</p>
            ) : (
              <>
                <p className={`text-xl font-bold ${getScoreTextColor(score.value)}`}>
                  {score.value}%
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getScoreColor(score.value)}`}
                    style={{ width: `${Math.min(score.value, 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
