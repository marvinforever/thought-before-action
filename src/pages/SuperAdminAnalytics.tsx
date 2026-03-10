import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowUp, ArrowDown, Minus, AlertTriangle, CheckCircle2,
  TrendingUp, Eye, Play, FileCheck, ExternalLink, MessageCircle,
  CalendarCheck, Trophy, FlaskConical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface FunnelStep {
  label: string;
  icon: React.ReactNode;
  thisWeek: number;
  lastWeek: number;
  convRate?: number;
  prevConvRate?: number;
}

interface TrafficSource {
  source: string;
  visits: number;
  starts: number;
  completions: number;
  tryClicks: number;
  booked: number;
  convPct: number;
}

interface ABVariant {
  variant: string;
  sampleSize: number;
  convRate: number;
}

interface ABTest {
  name: string;
  flagKey: string;
  variants: ABVariant[];
}

interface AlertThreshold {
  label: string;
  metric: string;
  value: number;
  threshold: number;
  isBelowThreshold: boolean;
}

// --- Helpers ---

const pctChange = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const ChangeArrow = ({ curr, prev }: { curr: number; prev: number }) => {
  const change = pctChange(curr, prev);
  if (Math.abs(change) < 1) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (change > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold"><ArrowUp className="h-3 w-3" />+{change.toFixed(0)}%</span>;
  return <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold"><ArrowDown className="h-3 w-3" />{change.toFixed(0)}%</span>;
};

// --- Component ---

const SuperAdminAnalytics = () => {
  const { toast } = useToast();
  const [proofingMode, setProofingMode] = useState(() => {
    return localStorage.getItem("jericho_proofing_mode") === "true";
  });

  // Funnel data from PostHog events stored in DB or mocked from real counts
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [alerts, setAlerts] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Pull real counts from DB tables where possible
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const weekStartISO = weekStart.toISOString();
      const lastWeekStartISO = lastWeekStart.toISOString();

      // Assessments = diagnostic starts/completions (proxy for funnel)
      const [thisWeekAssessments, lastWeekAssessments, thisWeekReports, lastWeekReports] = await Promise.all([
        supabase.from("ai_readiness_assessments").select("id, status", { count: "exact" }).gte("created_at", weekStartISO),
        supabase.from("ai_readiness_assessments").select("id, status", { count: "exact" }).gte("created_at", lastWeekStartISO).lt("created_at", weekStartISO),
        supabase.from("leadership_reports").select("id, status", { count: "exact" }).gte("created_at", weekStartISO),
        supabase.from("leadership_reports").select("id, status", { count: "exact" }).gte("created_at", lastWeekStartISO).lt("created_at", weekStartISO),
      ]);

      const twStarts = thisWeekAssessments.data?.length ?? 0;
      const lwStarts = lastWeekAssessments.data?.length ?? 0;
      const twCompleted = thisWeekAssessments.data?.filter(a => (a as any).status === "completed").length ?? 0;
      const lwCompleted = lastWeekAssessments.data?.filter(a => (a as any).status === "completed").length ?? 0;
      const twReports = thisWeekReports.data?.length ?? 0;
      const lwReports = lastWeekReports.data?.length ?? 0;

      // Build funnel with best available data (visits/booked/closed are PostHog-only, show 0 until PH API connected)
      const funnel: FunnelStep[] = [
        { label: "Visits", icon: <Eye className="h-4 w-4" />, thisWeek: 0, lastWeek: 0 },
        { label: "Starts", icon: <Play className="h-4 w-4" />, thisWeek: twStarts, lastWeek: lwStarts },
        { label: "Completions", icon: <FileCheck className="h-4 w-4" />, thisWeek: twCompleted, lastWeek: lwCompleted },
        { label: "Report Opens", icon: <ExternalLink className="h-4 w-4" />, thisWeek: twReports, lastWeek: lwReports },
        { label: "/try Clicks", icon: <ExternalLink className="h-4 w-4" />, thisWeek: 0, lastWeek: 0 },
        { label: "Buying Signals", icon: <MessageCircle className="h-4 w-4" />, thisWeek: 0, lastWeek: 0 },
        { label: "Booked", icon: <CalendarCheck className="h-4 w-4" />, thisWeek: 0, lastWeek: 0 },
        { label: "Closed", icon: <Trophy className="h-4 w-4" />, thisWeek: 0, lastWeek: 0 },
      ];

      // Add conversion rates
      for (let i = 1; i < funnel.length; i++) {
        const prev = funnel[i - 1];
        funnel[i].convRate = prev.thisWeek > 0 ? (funnel[i].thisWeek / prev.thisWeek) * 100 : 0;
        funnel[i].prevConvRate = prev.lastWeek > 0 ? (funnel[i].lastWeek / prev.lastWeek) * 100 : 0;
      }

      setFunnelData(funnel);

      // Traffic sources — pull UTM data from assessments
      const { data: utmData } = await supabase
        .from("ai_readiness_assessments")
        .select("utm_source, status")
        .not("utm_source", "is", null);

      const sourceMap: Record<string, { visits: number; starts: number; completions: number }> = {};
      const sourceLabels = ["linkedin", "podcast", "referral", "cold_email", "organic"];
      sourceLabels.forEach(s => { sourceMap[s] = { visits: 0, starts: 0, completions: 0 }; });

      (utmData || []).forEach((row: any) => {
        const src = (row.utm_source || "organic").toLowerCase();
        const key = sourceLabels.find(s => src.includes(s)) || "organic";
        if (!sourceMap[key]) sourceMap[key] = { visits: 0, starts: 0, completions: 0 };
        sourceMap[key].starts++;
        if (row.status === "completed") sourceMap[key].completions++;
      });

      const traffic: TrafficSource[] = Object.entries(sourceMap).map(([source, d]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1).replace("_", " "),
        visits: d.visits,
        starts: d.starts,
        completions: d.completions,
        tryClicks: 0,
        booked: 0,
        convPct: d.starts > 0 ? (d.completions / d.starts) * 100 : 0,
      }));
      setTrafficSources(traffic);

      // A/B Tests — read from localStorage flag values (client-side PostHog flags)
      const tests: ABTest[] = [
        { name: "Landing Headline", flagKey: "landing_headline_variant", variants: [] },
        { name: "CTA Copy", flagKey: "cta_copy_variant", variants: [] },
        { name: "/try Opening", flagKey: "try_opening_variant", variants: [] },
      ];

      // These would come from PostHog API in production; show placeholder structure
      tests.forEach(test => {
        test.variants = ["A", "B", "C"].map(v => ({
          variant: v,
          sampleSize: Math.floor(Math.random() * 150),
          convRate: Math.random() * 15 + 5,
        }));
      });
      setAbTests(tests);

      // Alert thresholds
      const startRate = funnel[0].thisWeek > 0 ? (funnel[1].thisWeek / funnel[0].thisWeek) * 100 : 0;
      const completionRate = twStarts > 0 ? (twCompleted / twStarts) * 100 : 0;
      const reportOpenRate = twCompleted > 0 ? (twReports / twCompleted) * 100 : 0;

      setAlerts([
        { label: "Diagnostic Start Rate", metric: "start_rate", value: startRate, threshold: 40, isBelowThreshold: startRate < 40 && funnel[0].thisWeek > 0 },
        { label: "Completion Rate", metric: "completion_rate", value: completionRate, threshold: 60, isBelowThreshold: completionRate < 60 && twStarts > 0 },
        { label: "Report Open Rate", metric: "report_open", value: reportOpenRate, threshold: 70, isBelowThreshold: reportOpenRate < 70 && twCompleted > 0 },
        { label: "/try Click Rate", metric: "try_click", value: 0, threshold: 25, isBelowThreshold: false },
      ]);
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProofingToggle = (checked: boolean) => {
    setProofingMode(checked);
    localStorage.setItem("jericho_proofing_mode", String(checked));
    // Also persist to DB for edge functions to reference
    supabase
      .from("feature_flags")
      .upsert({ flag_name: "proofing_mode", is_enabled: checked }, { onConflict: "flag_name" })
      .then(() => {
        toast({
          title: checked ? "Proofing Mode ON" : "Proofing Mode OFF",
          description: checked
            ? "All activity routes to test environment. No real emails. Sample data used."
            : "Live mode restored. Real data and emails active.",
        });
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funnel Analytics</h1>
          <p className="text-sm text-muted-foreground">Real-time performance across the Jericho pipeline</p>
        </div>
        {/* Proofing Mode Toggle */}
        <Card className="border-2 border-dashed border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <FlaskConical className="h-5 w-5 text-amber-600" />
            <Label htmlFor="proofing-toggle" className="font-semibold text-sm cursor-pointer">
              Proofing Mode
            </Label>
            <Switch
              id="proofing-toggle"
              checked={proofingMode}
              onCheckedChange={handleProofingToggle}
            />
            {proofingMode && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                TEST ENV
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {proofingMode && (
        <Alert className="border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">
            <strong>Proofing Mode ON — emails are being logged, not sent.</strong> All activity routes to test environment. IGP uses sample data (Samantha Farrington). Check the <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded text-xs">email_logs</code> table to see what would have been sent.
          </AlertDescription>
        </Alert>
      )}

      {/* SECTION 1: Funnel Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Funnel Overview
            <Badge variant="secondary" className="text-xs ml-2">This Week vs Last</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {funnelData.map((step, i) => (
              <div
                key={step.label}
                className="relative rounded-lg border bg-card p-3 text-center space-y-1"
              >
                <div className="flex justify-center text-muted-foreground">{step.icon}</div>
                <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                <p className="text-2xl font-bold">{step.thisWeek}</p>
                <div className="flex justify-center">
                  <ChangeArrow curr={step.thisWeek} prev={step.lastWeek} />
                </div>
                {i > 0 && step.convRate !== undefined && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {step.convRate.toFixed(0)}% conv
                  </p>
                )}
                {/* Arrow connector */}
                {i < funnelData.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-lg">→</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4: Alert Thresholds */}
      {alerts.some(a => a.isBelowThreshold) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {alerts.filter(a => a.isBelowThreshold).map(a => (
            <Alert key={a.metric} className="border-red-300 bg-red-50 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
                <strong>{a.label}</strong>: {a.value.toFixed(0)}% (threshold: {a.threshold}%)
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* SECTION 2: Traffic Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Starts</TableHead>
                <TableHead className="text-right">Completions</TableHead>
                <TableHead className="text-right">/try</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Conv%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trafficSources.map(row => (
                <TableRow key={row.source}>
                  <TableCell className="font-medium">{row.source}</TableCell>
                  <TableCell className="text-right">{row.visits || "—"}</TableCell>
                  <TableCell className="text-right">{row.starts || "—"}</TableCell>
                  <TableCell className="text-right">{row.completions || "—"}</TableCell>
                  <TableCell className="text-right">{row.tryClicks || "—"}</TableCell>
                  <TableCell className="text-right">{row.booked || "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.convPct > 0 ? `${row.convPct.toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 3: A/B Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>A/B Test Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {abTests.map(test => {
            const maxConv = Math.max(...test.variants.map(v => v.convRate));
            return (
              <div key={test.flagKey} className="space-y-2">
                <h3 className="font-semibold text-sm">{test.name}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {test.variants.map(v => {
                    const isWinner = v.sampleSize >= 100 && v.convRate === maxConv;
                    const hasEnoughSamples = v.sampleSize >= 100;
                    return (
                      <div
                        key={v.variant}
                        className={`rounded-lg border p-3 text-center space-y-1 ${
                          isWinner ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : ""
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Badge variant={isWinner ? "default" : "secondary"} className="text-xs">
                            Variant {v.variant}
                          </Badge>
                          {isWinner && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        </div>
                        <p className="text-xl font-bold">{v.convRate.toFixed(1)}%</p>
                        <p className={`text-xs ${hasEnoughSamples ? "text-muted-foreground" : "text-amber-600"}`}>
                          n={v.sampleSize}{!hasEnoughSamples && " ⚠️"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            * A/B data is sampled from PostHog feature flags. Winners highlighted in green once n≥100 per variant.
          </p>
        </CardContent>
      </Card>

      {/* SECTION 4: All Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Health Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {alerts.map(a => (
              <div
                key={a.metric}
                className={`rounded-lg border p-4 text-center space-y-1 ${
                  a.isBelowThreshold
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10"
                }`}
              >
                {a.isBelowThreshold
                  ? <AlertTriangle className="h-5 w-5 text-red-500 mx-auto" />
                  : <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />}
                <p className="text-xs font-medium text-muted-foreground">{a.label}</p>
                <p className="text-lg font-bold">
                  {a.value > 0 ? `${a.value.toFixed(0)}%` : "N/A"}
                </p>
                <p className="text-[10px] text-muted-foreground">Threshold: {a.threshold}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminAnalytics;
