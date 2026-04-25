import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MyDevelopmentTabProps {
  userId: string;
  viewAsUserId: string | null;
  viewAsUserName: string | null;
}

interface CoachingScore {
  discovery?: number;
  listening?: number;
  agronomy_depth?: number;
  business_value?: number;
  next_steps?: number;
  overall?: number;
}

interface CallRow {
  id: string;
  call_date: string | null;
  created_at: string;
  customer_name: string | null;
  scores: CoachingScore;
}

interface SummaryPayload {
  improving_in: string;
  stuck_on: string;
  biggest_opportunity: string;
  headline: string;
}

const CATEGORIES: { key: keyof CoachingScore; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "listening", label: "Listening" },
  { key: "agronomy_depth", label: "Agronomy Depth" },
  { key: "business_value", label: "Business Value" },
  { key: "next_steps", label: "Next Steps" },
];

function trendBetween(first: number, last: number) {
  const delta = last - first;
  if (delta >= 0.5) return { icon: TrendingUp, label: "Improving", tone: "text-emerald-600" };
  if (delta <= -0.5) return { icon: TrendingDown, label: "Slipping", tone: "text-rose-600" };
  return { icon: Minus, label: "Steady", tone: "text-muted-foreground" };
}

export function MyDevelopmentTab({ userId, viewAsUserId, viewAsUserName }: MyDevelopmentTabProps) {
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const targetUserId = viewAsUserId || userId;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!targetUserId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sales_call_analyses")
          .select("id, call_date, created_at, ai_output, customer:sales_companies(name)")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        const mapped: CallRow[] = (data || [])
          .map((r: any) => ({
            id: r.id,
            call_date: r.call_date,
            created_at: r.created_at,
            customer_name: r.customer?.name || null,
            scores: r.ai_output?.coaching_score || {},
          }))
          .filter((r) => typeof r.scores?.overall === "number");
        if (!cancelled) setCalls(mapped);
      } catch (e) {
        console.error("Error loading development data", e);
        if (!cancelled) setCalls([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const fetchSummary = async () => {
    if (calls.length < 2) return;
    setSummaryLoading(true);
    setSummary(null);
    setSummaryMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("rep-development-summary", {
        body: { targetUserId },
      });
      if (error) throw error;
      if (data?.summary) {
        setSummary(data.summary);
      } else if (data?.insufficient_data) {
        setSummaryMsg(data.summary || "Not enough data yet.");
      } else if (data?.error) {
        setSummaryMsg(data.error);
      }
    } catch (e: any) {
      console.error("Summary error", e);
      setSummaryMsg(e?.message || "Could not generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  // Chronological order (oldest -> newest) for chart
  const chronological = useMemo(() => [...calls].reverse(), [calls]);

  const chartData = useMemo(
    () =>
      chronological.map((c, i) => ({
        name: c.call_date
          ? format(parseISO(c.call_date), "MMM d")
          : format(parseISO(c.created_at), "MMM d"),
        callIdx: i + 1,
        overall: c.scores.overall ?? 0,
        customer: c.customer_name || "Call",
      })),
    [chronological],
  );

  const categoryTrends = useMemo(() => {
    if (chronological.length === 0) return [];
    const first = chronological[0].scores;
    const last = chronological[chronological.length - 1].scores;
    const avg = (key: keyof CoachingScore) => {
      const vals = chronological
        .map((c) => c.scores[key])
        .filter((v): v is number => typeof v === "number");
      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      first: first[c.key] ?? 0,
      last: last[c.key] ?? 0,
      avg: Number(avg(c.key).toFixed(1)),
    }));
  }, [chronological]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <Target className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">No analyzed calls yet</p>
          <p className="text-sm text-muted-foreground">
            Use the <strong>Analyze Call</strong> tab to score your first call. Your development trends will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = chronological[chronological.length - 1];
  const first = chronological[0];
  const overallTrend = trendBetween(first.scores.overall ?? 0, latest.scores.overall ?? 0);
  const TrendIcon = overallTrend.icon;

  return (
    <div className="space-y-6">
      {viewAsUserName && (
        <div className="text-sm text-muted-foreground">
          Viewing development for <strong>{viewAsUserName}</strong>
        </div>
      )}

      {/* Overall trend */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Overall Score Trend</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Last {calls.length} analyzed call{calls.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className={`flex items-center gap-2 ${overallTrend.tone}`}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{overallTrend.label}</span>
              <Badge variant="secondary" className="ml-2">
                Latest: {latest.scores.overall ?? 0}/10
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any) => [`${value}/10`, "Overall"]}
                  labelFormatter={(label, payload) => {
                    const p: any = payload?.[0]?.payload;
                    return p?.customer ? `${p.customer} — ${label}` : label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category trends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Category Trends</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparing your first vs. most recent call in each category
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryTrends.map((c) => {
              const t = trendBetween(c.first, c.last);
              const TIcon = t.icon;
              const pct = Math.max(0, Math.min(100, c.last * 10));
              return (
                <div key={c.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.label}</span>
                    <div className={`flex items-center gap-1.5 ${t.tone}`}>
                      <TIcon className="h-3.5 w-3.5" />
                      <span className="text-xs">
                        {c.first}/10 → {c.last}/10
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Avg across calls: {c.avg}/10</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI improvement insight */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">Improvement Insight</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchSummary}
              disabled={summaryLoading || calls.length < 2}
            >
              {summaryLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : summary ? (
                "Refresh"
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!summary && !summaryMsg && !summaryLoading && (
            <p className="text-sm text-muted-foreground">
              {calls.length < 2
                ? "Analyze at least 2 calls to unlock your AI-generated coaching summary."
                : 'Click "Generate" to get a quick read on what\'s improving and where to focus next.'}
            </p>
          )}
          {summaryMsg && !summary && (
            <p className="text-sm text-muted-foreground">{summaryMsg}</p>
          )}
          {summary && (
            <div className="space-y-4">
              {summary.headline && (
                <p className="text-base font-medium">{summary.headline}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Improving
                  </div>
                  <p className="text-sm">{summary.improving_in}</p>
                </div>
                <div className="rounded-lg border bg-rose-500/5 border-rose-500/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 mb-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    Still Stuck
                  </div>
                  <p className="text-sm">{summary.stuck_on}</p>
                </div>
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                    <Target className="h-3.5 w-3.5" />
                    Biggest Opportunity
                  </div>
                  <p className="text-sm">{summary.biggest_opportunity}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}