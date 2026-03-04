import { useState } from "react";
import { ChevronDown, Star, Clock, BookOpen, Video, Headphones, GraduationCap, Dumbbell, Users, Wrench } from "lucide-react";
import { IGPRecommendation, IGPCapability, formatLevel, getGap, RESOURCE_TYPE_CONFIG, LEVEL_COLORS } from "./igp-types";

interface IGPCapabilityDetailProps {
  recommendation: IGPRecommendation;
  capability: IGPCapability | undefined;
  isTopPriority: boolean;
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  book: BookOpen,
  video: Video,
  podcast: Headphones,
  course: GraduationCap,
  exercise: Dumbbell,
  mentorship: Users,
  tool: Wrench,
};

export function IGPCapabilityDetail({ recommendation: rec, capability: cap, isTopPriority }: IGPCapabilityDetailProps) {
  const [expanded, setExpanded] = useState(isTopPriority);
  const gap = cap ? getGap(cap.current_level, cap.target_level) : 0;

  return (
    <div
      id={`igp-cap-${rec.capability_name.replace(/\s+/g, '-').toLowerCase()}`}
      className="rounded-lg border bg-card overflow-hidden print:break-inside-avoid"
    >
      {/* Collapsed Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isTopPriority && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/20 text-accent-foreground px-2 py-0.5 text-xs font-bold">
                <Star className="h-3 w-3" /> Top Priority
              </span>
            )}
            <h3 className="text-sm md:text-base font-bold text-foreground">{rec.capability_name}</h3>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {cap && (
              <>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[cap.current_level]?.bg || "bg-muted"} ${LEVEL_COLORS[cap.current_level]?.text || "text-muted-foreground"}`}>
                  {formatLevel(cap.current_level)}
                </span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[cap.target_level]?.bg || "bg-muted"} ${LEVEL_COLORS[cap.target_level]?.text || "text-muted-foreground"}`}>
                  {formatLevel(cap.target_level)}
                </span>
                {gap > 0 && (
                  <span className={`text-xs font-bold ${gap >= 2 ? "text-red-600" : "text-amber-600"}`}>
                    +{gap} level{gap > 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded Body */}
      {expanded && (
        <div className="border-t px-4 pb-4 space-y-5">
          {/* Assessment */}
          {rec.current_assessment && (
            <div className="pt-4">
              <p className="text-sm text-foreground/80 leading-relaxed">{rec.current_assessment}</p>
            </div>
          )}

          {/* Why This Matters */}
          {rec.why_this_matters && (
            <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
              <p className="text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-1">Why This Matters</p>
              <p className="text-sm text-foreground/80">{rec.why_this_matters}</p>
            </div>
          )}

          {/* Approach & Timeline */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
              rec.advancement_approach === "natural" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
              rec.advancement_approach === "training_needed" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
              "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            }`}>
              {rec.advancement_approach === "natural" ? "Experiential" :
               rec.advancement_approach === "training_needed" ? "Instructional" : "Mixed Approach"}
            </span>
            {rec.estimated_timeline && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {rec.estimated_timeline}
              </span>
            )}
          </div>

          {rec.advancement_reasoning && (
            <p className="text-xs text-muted-foreground italic">{rec.advancement_reasoning}</p>
          )}

          {/* Training Resources */}
          {rec.training_items?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Training Recommendations</p>
              <div className="space-y-3">
                {rec.training_items.map((item, i) => {
                  const typeConfig = RESOURCE_TYPE_CONFIG[item.type] || RESOURCE_TYPE_CONFIG.tool;
                  const Icon = RESOURCE_ICONS[item.type] || Wrench;
                  return (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${typeConfig.bgColor} ${typeConfig.color}`}>
                          <Icon className="h-3 w-3" />
                          {typeConfig.label}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          item.cost_indicator === "free"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        }`}>
                          {item.cost_indicator === "free" ? "FREE" : `PAID${item.cost_detail ? ` (${item.cost_detail})` : ""}`}
                        </span>
                        {item.target_level && (
                          <span className="text-xs text-muted-foreground">→ {formatLevel(item.target_level)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {item.free_alternative && (
                        <div className="rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-2 text-xs">
                          <span className="font-medium text-green-700 dark:text-green-400">Free Alternative: </span>
                          <span className="text-green-800 dark:text-green-300">{item.free_alternative}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Level Progression */}
          {rec.level_progression?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Level Progression Path</p>
              <div className="space-y-4">
                {rec.level_progression.map((lp, i) => {
                  const lc = LEVEL_COLORS[lp.level] || LEVEL_COLORS.foundational;
                  return (
                    <div key={i} className={`rounded-lg border-l-4 pl-4 py-2 ${lc.bg.replace("bg-", "border-")}`}>
                      <p className={`text-sm font-bold ${lc.text}`}>{formatLevel(lp.level)}</p>
                      {lp.definition && (
                        <div className="mt-1">
                          <span className="text-xs font-medium text-muted-foreground">What it looks like: </span>
                          <span className="text-xs text-foreground/80">{lp.definition}</span>
                        </div>
                      )}
                      {lp.how_to_achieve && (
                        <div className="mt-1">
                          <span className="text-xs font-medium text-muted-foreground">How to achieve: </span>
                          <span className="text-xs text-foreground/80">{lp.how_to_achieve}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
