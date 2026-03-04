import { IGPCapability, IGPRecommendation, formatLevel, getGap, LEVEL_COLORS } from "./igp-types";

interface IGPCapabilityOverviewProps {
  capabilities: IGPCapability[];
  recommendations: IGPRecommendation[];
}

function LevelBadge({ level }: { level: string }) {
  const config = LEVEL_COLORS[level] || LEVEL_COLORS.foundational;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      {formatLevel(level)}
    </span>
  );
}

function GapBadge({ gap }: { gap: number }) {
  if (gap <= 0) {
    return <span className="text-xs font-medium text-green-600 dark:text-green-400">On Target</span>;
  }
  const color = gap >= 2
    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${color}`}>
      +{gap} level{gap > 1 ? "s" : ""}
    </span>
  );
}

function ApproachBadge({ approach }: { approach: string }) {
  const config: Record<string, { label: string; className: string }> = {
    natural: { label: "Experiential", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
    training_needed: { label: "Instructional", className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
    mixed: { label: "Mixed Approach", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  };
  const c = config[approach] || { label: approach, className: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>;
}

export function IGPCapabilityOverview({ capabilities, recommendations }: IGPCapabilityOverviewProps) {
  // Sort: gap 2+ first, then gap 1 by category, then on-target
  const sorted = [...capabilities].sort((a, b) => {
    const gapA = getGap(a.current_level, a.target_level);
    const gapB = getGap(b.current_level, b.target_level);
    if (gapA >= 2 && gapB < 2) return -1;
    if (gapB >= 2 && gapA < 2) return 1;
    if (gapA > 0 && gapB <= 0) return -1;
    if (gapB > 0 && gapA <= 0) return 1;
    if (gapA === gapB) return (a.category || "").localeCompare(b.category || "");
    return gapB - gapA;
  });

  return (
    <div className="space-y-3 print:break-inside-avoid" id="igp-capability-overview">
      <h2 className="text-lg font-bold text-foreground">Capability Overview</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Capability</th>
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Current</th>
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Target</th>
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Gap</th>
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Approach</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cap, i) => {
              const gap = getGap(cap.current_level, cap.target_level);
              const rec = recommendations.find(r => r.capability_name === cap.name);
              const isOnTarget = gap <= 0 && cap.current_level;
              return (
                <tr
                  key={cap.name}
                  className={`border-b transition-colors ${
                    isOnTarget ? "opacity-60" : ""
                  } ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
                >
                  <td className="py-2 px-3">
                    <a
                      href={`#igp-cap-${cap.name.replace(/\s+/g, '-').toLowerCase()}`}
                      className="font-medium text-foreground hover:text-accent transition-colors"
                    >
                      {cap.name}
                    </a>
                    {cap.category && (
                      <p className="text-xs text-muted-foreground">{cap.category}</p>
                    )}
                  </td>
                  <td className="py-2 px-3"><LevelBadge level={cap.current_level} /></td>
                  <td className="py-2 px-3"><LevelBadge level={cap.target_level} /></td>
                  <td className="py-2 px-3"><GapBadge gap={gap} /></td>
                  <td className="py-2 px-3">
                    {rec ? <ApproachBadge approach={rec.advancement_approach} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
