import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Calendar, TrendingUp, MessageSquareHeart } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
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

const AXES: Array<{ key: keyof CategoryScores; label: string }> = [
  { key: "wins", label: "Wins" },
  { key: "stuck", label: "Stuck" },
  { key: "focus", label: "Focus" },
  { key: "asks", label: "Asks" },
  { key: "vibe", label: "Vibe" },
];

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Weekly Reflections</CardTitle>
          <CardDescription>Your Friday Debrief radar</CardDescription>
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
          <CardDescription>Your Friday Debrief radar</CardDescription>
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
  const last4 = debriefs.slice(0, 4);

  const radarData = AXES.map(({ key, label }) => ({
    axis: label,
    current: Number(current.category_scores?.[key] ?? 0),
    avg4: avg(last4.map((d) => Number(d.category_scores?.[key] ?? 0))),
  }));

  // Trend strip data: chronological
  const trend = [...debriefs].reverse().map((d) => {
    const s = d.category_scores ?? {};
    return {
      week: d.week_of?.slice(5),
      wins: Number(s.wins ?? 0),
      stuck: Number(s.stuck ?? 0),
      focus: Number(s.focus ?? 0),
      asks: Number(s.asks ?? 0),
      vibe: Number(s.vibe ?? 0),
    };
  });

  const themes = Array.from(
    new Set(
      debriefs.slice(0, 4).flatMap((d) => (d.extracted_themes ?? []).map(String))
    )
  ).slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Weekly Reflections
            </CardTitle>
            <CardDescription>
              Your Friday Debrief radar — current week vs. 4-week average
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Week of {new Date(current.week_of).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar */}
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Radar
                  name="4-week avg"
                  dataKey="avg4"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.15}
                />
                <Radar
                  name="This week"
                  dataKey="current"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.45}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Narrative + scores */}
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {AXES.map(({ key, label }) => {
                const v = Number(current.category_scores?.[key] ?? 0);
                return (
                  <div key={key} className="rounded-lg border bg-card p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold text-foreground">{v.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
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
        </div>

        {/* Trend strip */}
        {trend.length > 1 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              12-Week Trend
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} hide />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="wins" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="focus" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} dot={false} opacity={0.7} />
                  <Line type="monotone" dataKey="vibe" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} opacity={0.6} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> Wins</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-foreground/60" /> Focus</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" /> Vibe</span>
            </div>
          </div>
        )}

        {/* Past debriefs list */}
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
                  <Badge variant="outline" className="text-[10px] capitalize">{d.channel}</Badge>
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