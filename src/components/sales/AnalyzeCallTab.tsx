import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerSelector } from "@/components/sales/CustomerSelector";
import {
  Loader2,
  CalendarIcon,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Mic,
  Target,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyzeCallTabProps {
  userId: string;
  profile: any;
  effectiveCompanyId: string | null;
  isSuperAdmin: boolean;
  isManager: boolean;
  viewAsUserId: string | null;
  viewAsUserName: string | null;
}

interface CoachingScore {
  discovery: number;
  listening: number;
  agronomy_depth: number;
  business_value: number;
  next_steps: number;
  overall: number;
}

interface AIOutput {
  one_thing_to_fix_next_call?: string;
  call_summary?: string;
  what_went_well?: string[];
  missed_opportunities?: string[];
  better_questions?: string[];
  improved_recommendation?: string;
  recommendation_source?: string;
  needs_agronomist_review?: boolean;
  knowledge_used?: string[];
  missing_context?: string[];
  follow_up_email?: { subject?: string; body?: string };
  farmer_concerns?: string[];
  objections?: string[];
  product_opportunities?: string[];
  market_trend_tags?: Array<
    | string
    | {
        trend_type?: string;
        trend_label?: string;
        evidence?: string;
        confidence?: number;
      }
  >;
  coaching_score?: CoachingScore;
  rep_coaching_note?: string;
}

interface AnalysisRow {
  id: string;
  customer_id: string | null;
  call_date: string | null;
  crop_context: string | null;
  region: string | null;
  notes: string | null;
  transcript: string;
  ai_output: AIOutput | null;
  created_at: string;
  customer?: { name: string } | null;
}

interface RepOption {
  id: string;
  full_name: string | null;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Number(value) * 10));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="capitalize text-muted-foreground">{label.replace(/_/g, " ")}</span>
        <span className="font-medium">{value}/10</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={onCopy} className="gap-2">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function AnalysisResults({ output }: { output: AIOutput }) {
  const score = output.coaching_score;
  const email = output.follow_up_email;
  const emailText = email ? `Subject: ${email.subject || ""}\n\n${email.body || ""}` : "";

  return (
    <div className="space-y-4">
      {/* 1. One Thing to Fix */}
      {output.one_thing_to_fix_next_call && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              One Thing to Fix Next Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed font-medium">{output.one_thing_to_fix_next_call}</p>
          </CardContent>
        </Card>
      )}

      {/* 2. Missed opportunities */}
      {output.missed_opportunities?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Missed Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              {output.missed_opportunities.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* 3. Improved recommendation */}
      {output.improved_recommendation && (
        <Card className={output.needs_agronomist_review ? "border-amber-500/50" : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>Improved Recommendation</span>
              {output.recommendation_source && (
                <Badge
                  variant={
                    output.needs_agronomist_review
                      ? "destructive"
                      : output.recommendation_source.toLowerCase().includes("company")
                        ? "default"
                        : "secondary"
                  }
                  className="text-[10px] uppercase tracking-wide"
                >
                  {output.recommendation_source}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {output.needs_agronomist_review && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Flagged for agronomist review before sharing with the grower.</span>
              </div>
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{output.improved_recommendation}</p>
            {output.knowledge_used?.length ? (
              <div className="pt-2 border-t">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Knowledge Used
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {output.knowledge_used.map((k, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">{k}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {output.missing_context?.length ? (
              <div className="pt-2 border-t">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Missing Context
                </div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {output.missing_context.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* 4. Follow-up email */}
      {email && (email.subject || email.body) && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Follow-Up Email</CardTitle>
            <CopyButton text={emailText} />
          </CardHeader>
          <CardContent className="space-y-2">
            {email.subject && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Subject</div>
                <div className="text-sm font-medium">{email.subject}</div>
              </div>
            )}
            {email.body && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Body</div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{email.body}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Everything else */}
      {/* Coaching Score */}
      {score && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coaching Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">{score.overall}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Overall</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreBar label="discovery" value={score.discovery} />
              <ScoreBar label="listening" value={score.listening} />
              <ScoreBar label="agronomy_depth" value={score.agronomy_depth} />
              <ScoreBar label="business_value" value={score.business_value} />
              <ScoreBar label="next_steps" value={score.next_steps} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* What went well */}
      {output.what_went_well?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What Went Well</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              {output.what_went_well.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Better questions */}
      {output.better_questions?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Better Questions to Ask</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              {output.better_questions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Farmer Insights */}
      {(output.farmer_concerns?.length || output.objections?.length) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Farmer Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Concerns</div>
                {output.farmer_concerns?.length ? (
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {output.farmer_concerns.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">None identified.</p>}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Objections</div>
                {output.objections?.length ? (
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {output.objections.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">None identified.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Trends */}
      {output.market_trend_tags?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Market Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {output.market_trend_tags.map((t, i) => {
                if (typeof t === "string") {
                  return <Badge key={i} variant="secondary">{t}</Badge>;
                }
                const label = t.trend_label || "(unlabeled)";
                const type = t.trend_type || "other";
                const conf = typeof t.confidence === "number" ? t.confidence : null;
                return (
                  <div key={i} className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{type.replace(/_/g, " ")}</Badge>
                        <span className="font-medium text-sm">{label}</span>
                      </div>
                      {conf !== null && (
                        <Badge variant="secondary" className="text-xs">
                          Confidence {conf}/10
                        </Badge>
                      )}
                    </div>
                    {t.evidence && (
                      <p className="text-xs text-muted-foreground italic">"{t.evidence}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Product Opportunities (extra detail when present) */}
      {output.product_opportunities?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Product Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              {output.product_opportunities.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Summary (de-prioritized) */}
      {output.call_summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{output.call_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Coach's note callout */}
      {output.rep_coaching_note && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Coach's Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{output.rep_coaching_note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AnalyzeCallTab({
  userId,
  profile,
  effectiveCompanyId,
  isSuperAdmin,
  isManager,
  viewAsUserId,
  viewAsUserName,
}: AnalyzeCallTabProps) {
  const { toast } = useToast();

  // Determine the rep doing the analysis (default = current viewer / current user)
  const defaultRepId = viewAsUserId || userId;
  const defaultRepName = viewAsUserName || profile?.full_name || "You";

  const [salesRepId, setSalesRepId] = useState<string>(defaultRepId);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [cropContext, setCropContext] = useState("");
  const [region, setRegion] = useState("");
  const [callDate, setCallDate] = useState<Date | undefined>(new Date());
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AIOutput | null>(null);

  const [history, setHistory] = useState<AnalysisRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load reps the manager/super admin can pick from
  useEffect(() => {
    const loadReps = async () => {
      if (!isManager && !isSuperAdmin) {
        setReps([{ id: defaultRepId, full_name: defaultRepName }]);
        return;
      }
      const companyToQuery = effectiveCompanyId || profile?.company_id;
      if (!companyToQuery) {
        setReps([{ id: defaultRepId, full_name: defaultRepName }]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", companyToQuery)
        .order("full_name");
      setReps(data || [{ id: defaultRepId, full_name: defaultRepName }]);
    };
    loadReps();
  }, [effectiveCompanyId, isManager, isSuperAdmin, profile?.company_id, defaultRepId, defaultRepName]);

  // Reset rep selection when viewer context changes
  useEffect(() => {
    setSalesRepId(defaultRepId);
  }, [defaultRepId]);

  // Load history for the selected rep
  const loadHistory = async () => {
    if (!salesRepId) return;
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("sales_call_analyses")
        .select("id, customer_id, call_date, crop_context, region, notes, transcript, ai_output, created_at, customer:sales_companies(name)")
        .eq("sales_rep_id", salesRepId)
        .order("created_at", { ascending: false })
        .limit(25);
      setHistory((data as any) || []);
    } catch (e) {
      console.error("Error loading history:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesRepId]);

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      toast({ title: "Transcript required", description: "Paste the call transcript before analyzing.", variant: "destructive" });
      return;
    }
    if (!salesRepId) {
      toast({ title: "Select a sales rep", variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    setCurrentResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-sales-call", {
        body: {
          user_id: userId,
          sales_rep_id: salesRepId,
          org_id: effectiveCompanyId || profile?.company_id || null,
          customer_id: customerId,
          crop_context: cropContext,
          region,
          call_date: callDate ? format(callDate, "yyyy-MM-dd") : null,
          transcript,
          notes,
        },
      });

      if (error) throw error;
      const ai = data?.analysis?.ai_output as AIOutput | undefined;
      if (!ai) {
        throw new Error(data?.error || "No analysis returned");
      }
      setCurrentResult(ai);
      toast({ title: "Analysis ready" });
      loadHistory();
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast({ title: "Analysis failed", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Analyze a Sales Call
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sales Rep</Label>
              {(isManager || isSuperAdmin) && reps.length > 1 ? (
                <Select value={salesRepId} onValueChange={setSalesRepId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {reps.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={defaultRepName} disabled />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Customer</Label>
              <CustomerSelector
                userId={salesRepId}
                selectedCustomerId={customerId}
                selectedCustomerName={customerName}
                onSelect={(id, name) => { setCustomerId(id); setCustomerName(name); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crop">Crop / Context</Label>
              <Input id="crop" value={cropContext} onChange={(e) => setCropContext(e.target.value)} placeholder="e.g. Corn, soybeans, wheat" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="region">Region</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Eastern Iowa" />
            </div>

            <div className="space-y-1.5">
              <Label>Call Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !callDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {callDate ? format(callDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={callDate}
                    onSelect={setCallDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the full sales call transcript here..."
              className="min-h-[220px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Optional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else worth knowing about this call..."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={analyzing || !transcript.trim()} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "Analyzing..." : "Analyze Call"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analyzing && !currentResult && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Jericho is reviewing the call...</p>
          </CardContent>
        </Card>
      )}

      {currentResult && <AnalysisResults output={currentResult} />}

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Previous Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No previous analyses yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((row) => {
                const isOpen = expandedId === row.id;
                const overall = row.ai_output?.coaching_score?.overall;
                const custName = row.customer?.name || "—";
                const dateStr = row.call_date ? format(new Date(row.call_date), "MMM d, yyyy") : format(new Date(row.created_at), "MMM d, yyyy");
                const summary =
                  row.ai_output?.one_thing_to_fix_next_call ||
                  row.ai_output?.call_summary ||
                  row.notes ||
                  "";
                return (
                  <Collapsible key={row.id} open={isOpen} onOpenChange={(o) => setExpandedId(o ? row.id : null)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2.5 text-left hover:bg-accent transition-colors">
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{custName}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{dateStr}</span>
                          </div>
                          {summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 pt-0.5">
                          {typeof overall === "number" && (
                            <Badge variant="secondary" className="font-mono">{overall}/10</Badge>
                          )}
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      {row.ai_output ? (
                        <AnalysisResults output={row.ai_output} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No analysis output stored.</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}