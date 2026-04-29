import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Flame, TrendingUp, TrendingDown, Minus, MessageSquareHeart } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as RechartsTooltip,
  YAxis,
  ReferenceLine,
} from "recharts";

type CategoryScores = {
  wins?: number;
  stuck?: number;
  focus?: number;
  asks?: number;
  vibe?: number;
};

type Debrief = {
  id: string;
  week_of: string;
  submitted_at: string;
  channel: string;
  wins_text: string | null;
  stuck_text: string | null;
  focus_text: string | null;
  need_text: string | null;
  category_scores: CategoryScores | null;
  narrative_summary: string | null;
  extracted_themes: string[] | null;
};

type AxisDef = {
  key: keyof CategoryScores;
  label: string;
  // higher is better (true) or lower is better (false, e.g. Stuck)
  higherBetter: boolean;
  description: string;
};

const AXES: AxisDef[] = [
  { key: "wins",  label: "Wins",  higherBetter: true,  description: "Things that worked" },
  { key: "focus", label: "Focus", higherBetter: true,  description: "Clarity on what matters" },
  { key: "vibe",  label: "Vibe",  higherBetter: true,  description: "Energy & momentum" },
  { key: "asks",  label: "Asks",  higherBetter: true,  description: "Willingness to ask for help" },
  { key: "stuck", label: "Stuck", higherBetter: false, description: "Friction (lower is better)" },
];

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Momentum Score 0-100: weighted average of normalized axes (Stuck inverted)
function momentumScore(scores: CategoryScores | null | undefined): number {
  if (!scores) return 0;
  const norm = AXES.map((a) => {
    const v = Number(scores[a.key] ?? 0);
    const clamped = Math.max(0, Math.min(10, v));
    return a.higherBetter ? clamped : 10 - clamped;
  });
  return Math.round((avg(norm) / 10) * 100);
}

function streakWeeks(debriefs: Debrief[]): number {
  if (!debriefs.length) return 0;
  const sorted = [...debriefs].sort((a, b) => b.week_of.localeCompare(a.week_of));
  let streak = 0;
  let cursor = new Date(sorted[0].week_of);
  for (const d of sorted) {
    const wk = new Date(d.week_of);
    const diffDays = Math.round((cursor.getTime() - wk.getTime()) / (1000 * 60 * 60 * 24));
    if (streak === 0 && diffDays <= 7) {
      streak = 1;
      cursor = wk;
      continue;
    }
    if (diffDays >= 6 && diffDays <= 8) {
      streak += 1;
      cursor = wk;
    } else if (diffDays === 0) {
      // duplicate same week, skip
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function trendDelta(values: number[], higherBetter: boolean): { dir: "up" | "down" | "flat"; delta: number } {
  if (values.length < 2) return { dir: "flat", delta: 0 };
  const recent = values.slice(-3);
  const prior = values.slice(0, -3);
  if (!prior.length) return { dir: "flat", delta: 0 };
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  const raw = recentAvg - priorAvg;
  const adjusted = higherBetter ? raw : -raw;
  if (Math.abs(adjusted) < 0.3) return { dir: "flat", delta: Math.round(adjusted * 10) / 10 };
  return { dir: adjusted > 0 ? "up" : "down", delta: Math.round(adjusted * 10) / 10 };
}

export function ReflectionRadar() {
  const [loading, setLoading] = useState(true);
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Debrief | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("friday_debriefs")
        .select("id,week_of,submitted_at,channel,wins_text,stuck_text,focus_text,need_text,category_scores,narrative_summary,extracted_themes")
        .eq("profile_id", user.id)
        .order("week_of", { ascending: false })
        .limit(12);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load debriefs", error);
        setDebriefs([]);
      } else {
        setDebriefs((data as any[])?.map((d) => ({
          ...d,
          category_scores: (d.category_scores ?? {}) as CategoryScores,
          extracted_themes: Array.isArray(d.extracted_themes) ? d.extracted_themes : [],
        })) ?? []);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const chrono = useMemo(() => [...debriefs].reverse(), [debriefs]);

  const momentum = useMemo(() => {
    if (!debriefs.length) return { current: 0, prior: 0, delta: 0 };
    const current = momentumScore(debriefs[0].category_scores);
    const prior = debriefs[1] ? momentumScore(debriefs[1].category_scores) : current;
    return { current, prior, delta: current - prior };
  }, [debriefs]);

  const streak = useMemo(() => streakWeeks(debriefs), [debriefs]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Weekly Reflections</CardTitle>
          <CardDescription>Your Friday Debrief momentum</CardDescription>
        </CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  if (debriefs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Weekly Reflections</CardTitle>
          <CardDescription>Your Friday Debrief momentum</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-2">
            <MessageSquareHeart className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No Friday Debriefs yet. We'll email you Friday at 9am local with four short prompts:
              <span className="font-medium text-foreground"> Wins, Stuck, Focus, Need.</span>
            </p>
            <p className="text-xs text-muted-foreground">Five minutes. Big payoff.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = debriefs[0];
  const themes = Array.from(
    new Set(debriefs.slice(0, 4).flatMap((d) => (d.extracted_themes ?? []).map(String)))
  ).slice(0, 8);

  const momentumDir = momentum.delta > 2 ? "up" : momentum.delta < -2 ? "down" : "flat";
  const MomentumIcon = momentumDir === "up" ? TrendingUp : momentumDir === "down" ? TrendingDown : Minus;
  const momentumColor =
    momentumDir === "up" ? "text-emerald-500" : momentumDir === "down" ? "text-rose-500" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Weekly Reflections
            </CardTitle>
            <CardDescription>
              Momentum across your last {debriefs.length} {debriefs.length === 1 ? "week" : "weeks"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                {streak} week{streak === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Momentum Score hero */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Momentum Score</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-5xl font-bold text-foreground tabular-nums">{momentum.current}</div>
              <div className={`flex items-center gap-1 text-sm font-medium ${momentumColor}`}>
                <MomentumIcon className="h-4 w-4" />
                {momentum.delta > 0 ? "+" : ""}{momentum.delta} vs last week
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Week of {new Date(current.week_of).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>
          {chrono.length > 1 && (
            <div className="h-16 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chrono.map((d) => ({ score: momentumScore(d.category_scores) }))}>
                  <YAxis domain={[0, 100]} hide />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Small multiples — one sparkline per axis */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            By Dimension
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {AXES.map((axis) => {
              const series = chrono.map((d) => Number(d.category_scores?.[axis.key] ?? 0));
              const currentVal = series[series.length - 1] ?? 0;
              const t = trendDelta(series, axis.higherBetter);
              const TIcon = t.dir === "up" ? TrendingUp : t.dir === "down" ? TrendingDown : Minus;
              const tColor =
                t.dir === "up" ? "text-emerald-500" :
                t.dir === "down" ? "text-rose-500" :
                "text-muted-foreground";
              const lineColor = axis.higherBetter ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
              const data = series.map((v, i) => ({ i, v }));
              return (
                <div key={axis.key} className="rounded-lg border bg-card p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-foreground">{axis.label}</div>
                    <div className={`flex items-center gap-0.5 text-[11px] ${tColor}`}>
                      <TIcon className="h-3 w-3" />
                      {t.delta > 0 ? "+" : ""}{t.delta}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-semibold text-foreground tabular-nums">{currentVal.toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground">/10</div>
                  </div>
                  <div className="h-10">
                    {data.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                          <YAxis domain={[0, 10]} hide />
                          <ReferenceLine y={5} stroke="hsl(var(--border))" strokeDasharray="2 2" />
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={{ r: 1.5, fill: lineColor }}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                              fontSize: 11,
                              padding: "4px 8px",
                            }}
                            formatter={(val: any) => [val, axis.label]}
                            labelFormatter={() => ""}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center text-[10px] text-muted-foreground">
                        Need 2+ weeks for trend
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{axis.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Narrative + themes */}
        {(current.narrative_summary || themes.length > 0) && (
          <div className="space-y-3">
            {current.narrative_summary && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Your story this week
                </div>
                {current.narrative_summary}
              </div>
            )}
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {themes.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent debriefs */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Recent Debriefs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {debriefs.slice(0, 6).map((d) => (
              <button
                key={d.id}
                onClick={() => { setSelected(d); setDetailOpen(true); }}
                className="text-left rounded-lg border bg-card hover:bg-accent transition-colors p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    {new Date(d.week_of).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {momentumScore(d.category_scores)}
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">{d.channel}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {d.wins_text || d.narrative_summary || "—"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Friday Debrief — {selected && new Date(selected.week_of).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </DialogTitle>
            <DialogDescription>Your reflection and Jericho's read.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Momentum {momentumScore(selected.category_scores)}</Badge>
                <Badge variant="outline" className="capitalize">{selected.channel}</Badge>
              </div>
              {[
                { label: "Wins", value: selected.wins_text },
                { label: "Stuck", value: selected.stuck_text },
                { label: "Focus", value: selected.focus_text },
                { label: "Need", value: selected.need_text },
              ].map((row) => row.value ? (
                <div key={row.label}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</div>
                  <p className="text-foreground whitespace-pre-wrap">{row.value}</p>
                </div>
              ) : null)}
              {selected.narrative_summary && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Synthesis</div>
                  <p>{selected.narrative_summary}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ReflectionRadar;
