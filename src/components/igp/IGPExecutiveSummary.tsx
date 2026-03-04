import { Star, ArrowRight } from "lucide-react";
import { IGPAIRecommendations, IGPDiagnostic, IGPProfile } from "./igp-types";

interface IGPExecutiveSummaryProps {
  profile: IGPProfile;
  ai: IGPAIRecommendations;
  diagnostic: IGPDiagnostic | null;
}

export function IGPExecutiveSummary({ profile, ai, diagnostic }: IGPExecutiveSummaryProps) {
  // Compute diagnostic alerts
  const diagnosticScores = diagnostic ? [
    { label: "Engagement", value: diagnostic.engagement_score },
    { label: "Clarity", value: diagnostic.clarity_score },
    { label: "Career", value: diagnostic.career_score },
    { label: "Learning", value: diagnostic.learning_score },
    { label: "Manager", value: diagnostic.manager_score },
    { label: "Skills", value: diagnostic.skills_score },
    { label: "Retention", value: diagnostic.retention_score },
    { label: "Burnout Risk", value: diagnostic.burnout_score },
  ] : [];
  
  const pendingDiagnostics = diagnosticScores.filter(s => s.value === null || s.value === undefined).length;

  return (
    <div className="space-y-5 print:break-inside-avoid" id="igp-executive-summary">
      <h2 className="text-lg font-bold text-foreground">Executive Summary</h2>

      {/* Overall Summary */}
      <p className="text-sm text-foreground/80 leading-relaxed">{ai.overall_summary}</p>

      {/* Diagnostic Status */}
      {diagnostic && pendingDiagnostics > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          Diagnostic partially complete — {pendingDiagnostics} of {diagnosticScores.length} dimensions pending assessment
        </div>
      )}

      {/* Strengths Statement */}
      {ai.strengths_statement && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Strengths</p>
          <p className="text-sm text-green-800 dark:text-green-300">{ai.strengths_statement}</p>
        </div>
      )}

      {/* Primary Development Focus */}
      {ai.primary_development_focus && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Primary Focus</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">{ai.primary_development_focus}</p>
        </div>
      )}

      {/* Top 5 Priority Actions */}
      {ai.top_priority_actions?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Top Priority Actions</p>
          <div className="space-y-2">
            {ai.top_priority_actions.map((item, i) => (
              <a
                key={i}
                href={`#igp-cap-${item.capability_name?.replace(/\s+/g, '-').toLowerCase()}`}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/10 transition-colors cursor-pointer group"
              >
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent text-accent-foreground text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  {item.capability_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-3 w-3" />
                      {item.capability_name}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* At a Glance */}
      {ai.at_a_glance && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{ai.at_a_glance.total_capabilities}</p>
            <p className="text-xs text-muted-foreground">Total Capabilities</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{ai.at_a_glance.on_target_count}</p>
            <p className="text-xs text-muted-foreground">On Target</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{ai.at_a_glance.gap_1_count}</p>
            <p className="text-xs text-muted-foreground">+1 Gap</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{ai.at_a_glance.gap_2_plus_count}</p>
            <p className="text-xs text-muted-foreground">+2 Gap</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center col-span-2 md:col-span-1">
            <p className="text-2xl font-bold text-foreground">
              {ai.at_a_glance.by_level?.mastery || 0}
            </p>
            <p className="text-xs text-muted-foreground">At Mastery</p>
          </div>
        </div>
      )}
    </div>
  );
}
