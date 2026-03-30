import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Compass, Zap, Target, BookOpen, TrendingUp, Shield,
  ChevronRight, ExternalLink, Flame, Award, Lightbulb,
  CheckCircle2, Star, ArrowUpRight, Brain
} from "lucide-react";

// ── Types ──

export interface EngagementScores {
  composite: number;
  burnoutRisk: number;
  roleStrain: number;
  satisfaction: number;
  selfEfficacy: number;
  orgSupport: number;
  strengthUtil: number;
  growthBarriers: number;
  overallEngagement: number;
}

interface NarrativePriority {
  title: string;
  description: string;
}

interface LearningResource {
  type: string;
  title: string;
  description: string;
  time_estimate?: string;
}

interface Narrative {
  snapshot_paragraphs?: string[];
  north_star_text?: string;
  north_star_followup?: string;
  superpower_paragraphs?: string[];
  growth_edge_quote?: string;
  growth_edge_intro?: string;
  priorities?: NarrativePriority[];
  quick_win_title?: string;
  quick_win_intro?: string;
  quick_win_steps?: string[];
  quick_win_closer?: string;
  quick_win_hours?: string;
  learning_intro?: string;
  learning_resources?: LearningResource[];
  diagnostic_commentary?: string;
  burnout_alert?: string;
  closing_statement?: string;
  unlock_target?: string;
  unlock_brief?: string;
  unlock_tracking?: string;
  unlock_capabilities?: string;
  unlock_learning?: string;
  unlock_memory?: string;
}

interface CapabilityEntry {
  capability_name: string;
  category: string;
  current_level: string;
  target_level: string;
  is_priority: boolean;
  reasoning: string;
  level_descriptions?: Record<string, string>;
}

interface PlaybookViewerProps {
  narrative: Narrative;
  scores: EngagementScores;
  capabilities: CapabilityEntry[];
  htmlFallback?: string;
  onOpenInNewTab?: () => void;
}

// ── Helpers ──

const levelOrder = ["foundational", "advancing", "independent", "mastery"];
const levelNum = (l: string) => levelOrder.indexOf(l) + 1;
const levelColor = (l: string) => {
  switch (l) {
    case "foundational": return "bg-orange-100 text-orange-700 border-orange-200";
    case "advancing": return "bg-blue-100 text-blue-700 border-blue-200";
    case "independent": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "mastery": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-muted text-muted-foreground";
  }
};

const scoreColor = (val: number): "default" | "success" | "warning" | "danger" => {
  if (val >= 70) return "success";
  if (val >= 50) return "warning";
  return "danger";
};

const resourceIcon = (type: string) => {
  switch (type) {
    case "podcast": return "🎙️";
    case "video": return "🎥";
    case "article": return "📄";
    case "framework": return "📐";
    case "reflection": return "🪞";
    default: return "📚";
  }
};

// ── Section Components ──

function SectionHeader({ icon: Icon, title, accent }: { icon: any; title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-accent/20" : "bg-primary/10"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-accent" : "text-primary"}`} />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );
}

// ── Main Component ──

export function PlaybookViewer({ narrative, scores, capabilities, htmlFallback, onOpenInNewTab }: PlaybookViewerProps) {
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  const priorityCaps = capabilities.filter(c => c.is_priority);
  const strengthCaps = capabilities.filter(c => !c.is_priority);

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── North Star ── */}
        {narrative.north_star_text && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-accent/30 bg-gradient-to-br from-accent/5 via-accent/10 to-accent/5 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Compass className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Your North Star</p>
                    <p className="text-xl font-bold text-foreground leading-snug">"{narrative.north_star_text}"</p>
                    {narrative.north_star_followup && (
                      <p className="text-sm text-muted-foreground mt-2">{narrative.north_star_followup}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Engagement Scores ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SectionHeader icon={TrendingUp} title="Engagement Diagnostic" />
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Gauge
                  value={scores.composite}
                  max={100}
                  size={130}
                  strokeWidth={14}
                  colorScheme={scoreColor(scores.composite)}
                  label="Composite"
                  className="shrink-0"
                />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                  {[
                    { label: "Burnout Risk", value: scores.burnoutRisk, invert: true },
                    { label: "Role Strain", value: scores.roleStrain, invert: true },
                    { label: "Satisfaction", value: scores.satisfaction },
                    { label: "Self-Efficacy", value: scores.selfEfficacy },
                    { label: "Org Support", value: scores.orgSupport },
                    { label: "Strength Use", value: scores.strengthUtil },
                    { label: "Growth Barriers", value: scores.growthBarriers, invert: true },
                    { label: "Engagement", value: scores.overallEngagement },
                  ].map(({ label, value, invert }) => (
                    <div key={label} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {narrative.diagnostic_commentary && (
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{narrative.diagnostic_commentary}</p>
              )}
              {narrative.burnout_alert && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Flame className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{narrative.burnout_alert}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Snapshot ── */}
        {narrative.snapshot_paragraphs?.length ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionHeader icon={Brain} title="Your Snapshot" />
            <Card>
              <CardContent className="p-6 space-y-3">
                {narrative.snapshot_paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: p }} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* ── Superpower + Growth Edge ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Superpower */}
            {narrative.superpower_paragraphs?.length ? (
              <Card className="border-emerald-200/50 bg-emerald-50/30">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-foreground">Your Superpower</h3>
                  </div>
                  <div className="space-y-2">
                    {narrative.superpower_paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: p }} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Growth Edge */}
            {narrative.growth_edge_quote && (
              <Card className="border-amber-200/50 bg-amber-50/30">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-foreground">Your Growth Edge</h3>
                  </div>
                  <blockquote className="text-sm italic text-foreground border-l-2 border-amber-400 pl-3 mb-2">
                    "{narrative.growth_edge_quote}"
                  </blockquote>
                  {narrative.growth_edge_intro && (
                    <p className="text-sm text-muted-foreground">{narrative.growth_edge_intro}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* ── Capability Map ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SectionHeader icon={Target} title="Capability Map" accent />

          {/* Priorities */}
          {priorityCaps.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Development Priorities
              </p>
              <div className="space-y-3">
                {priorityCaps.map((cap) => (
                  <CapabilityCard
                    key={cap.capability_name}
                    cap={cap}
                    expanded={expandedCap === cap.capability_name}
                    onToggle={() => setExpandedCap(expandedCap === cap.capability_name ? null : cap.capability_name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {strengthCaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Strengths
              </p>
              <div className="space-y-3">
                {strengthCaps.map((cap) => (
                  <CapabilityCard
                    key={cap.capability_name}
                    cap={cap}
                    expanded={expandedCap === cap.capability_name}
                    onToggle={() => setExpandedCap(expandedCap === cap.capability_name ? null : cap.capability_name)}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Priority Actions ── */}
        {narrative.priorities?.length ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <SectionHeader icon={Lightbulb} title="Priority Actions" />
            <div className="space-y-3">
              {narrative.priorities.map((p, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-accent/20 text-accent font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{p.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ── Quick Win ── */}
        {narrative.quick_win_title && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <SectionHeader icon={Zap} title="Your Quick Win" accent />
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-foreground">{narrative.quick_win_title}</h3>
                  {narrative.quick_win_hours && (
                    <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">
                      ~{narrative.quick_win_hours} hrs/week recovered
                    </Badge>
                  )}
                </div>
                {narrative.quick_win_intro && (
                  <p className="text-sm text-muted-foreground mb-4" dangerouslySetInnerHTML={{ __html: narrative.quick_win_intro }} />
                )}
                {narrative.quick_win_steps?.length ? (
                  <ul className="space-y-2">
                    {narrative.quick_win_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {narrative.quick_win_closer && (
                  <p className="text-sm text-muted-foreground mt-4 italic">{narrative.quick_win_closer}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Learning Resources ── */}
        {narrative.learning_resources?.length ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <SectionHeader icon={BookOpen} title="Curated Learning" />
            {narrative.learning_intro && (
              <p className="text-sm text-muted-foreground mb-3">{narrative.learning_intro}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {narrative.learning_resources.map((r, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0">{resourceIcon(r.type)}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                        {r.time_estimate && (
                          <p className="text-xs text-accent mt-1.5 font-medium">{r.time_estimate}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ── Closing ── */}
        {narrative.closing_statement && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5 text-center">
                <p className="text-base font-medium text-foreground italic">"{narrative.closing_statement}"</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Fallback link ── */}
        {onOpenInNewTab && (
          <div className="flex justify-center pb-4">
            <Button variant="ghost" size="sm" onClick={onOpenInNewTab} className="text-muted-foreground gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              View full report in new tab
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Capability Card ──

function CapabilityCard({ cap, expanded, onToggle }: { cap: CapabilityEntry; expanded: boolean; onToggle: () => void }) {
  const progress = ((levelNum(cap.current_level)) / 4) * 100;
  const targetProgress = ((levelNum(cap.target_level)) / 4) * 100;

  return (
    <Card className={`cursor-pointer transition-all ${cap.is_priority ? "border-accent/20" : ""}`} onClick={onToggle}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {cap.is_priority && <Star className="w-4 h-4 text-accent shrink-0" />}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{cap.capability_name}</p>
              <p className="text-xs text-muted-foreground">{cap.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-xs ${levelColor(cap.current_level)}`}>
              {cap.current_level}
            </Badge>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            <Badge variant="outline" className={`text-xs ${levelColor(cap.target_level)}`}>
              {cap.target_level}
            </Badge>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mt-3 relative h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="absolute h-full bg-primary/30 rounded-full transition-all" style={{ width: `${targetProgress}%` }} />
          <div className="absolute h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{cap.reasoning}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
