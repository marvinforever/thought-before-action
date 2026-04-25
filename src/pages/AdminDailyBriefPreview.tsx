import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type UserState = 'ENGAGED' | 'DRIFTING' | 'DISENGAGED' | 'DORMANT';
type BriefFormat = 'html' | 'markdown' | 'plain';

interface PreviewResult {
  brief: { subject: string; body: string; shortSummary: string };
  qa: {
    wordCount: number;
    bannedHits: string[];
    checks: { label: string; pass: boolean; detail: string }[];
    passCount: number;
    totalChecks: number;
  };
  contextSummary: Record<string, any>;
}

const STATE_DESCRIPTIONS: Record<UserState, string> = {
  ENGAGED: 'Active in last 3 days. Full rich brief.',
  DRIFTING: '4-7 days since activity. 80-140 word nudge.',
  DISENGAGED: '8-14 days. Re-engagement message, 40-80 words.',
  DORMANT: '15+ days. Reactivation note with reset/mute options.',
};

export default function AdminDailyBriefPreview() {
  const { toast } = useToast();
  const [state, setState] = useState<UserState>('ENGAGED');
  const [format, setFormat] = useState<BriefFormat>('html');
  const [salesperson, setSalesperson] = useState(true);
  const [hasRecentSalesActivity, setHasRecentSalesActivity] = useState(true);
  const [includeStalledDeals, setIncludeStalledDeals] = useState(true);
  const [includeMissedFollowUps, setIncludeMissedFollowUps] = useState(true);
  const [includeOpportunities, setIncludeOpportunities] = useState(true);
  const [includeCalendarEvents, setIncludeCalendarEvents] = useState(true);
  const [includeMeaningfulHabit, setIncludeMeaningfulHabit] = useState(true);
  const [includePlaybook, setIncludePlaybook] = useState(true);
  const [firstName, setFirstName] = useState('Sam');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('preview-daily-brief', {
        body: {
          state,
          format,
          salesperson,
          hasRecentSalesActivity,
          includeStalledDeals,
          includeMissedFollowUps,
          includeOpportunities,
          includeCalendarEvents,
          includeMeaningfulHabit,
          includePlaybook,
          firstName,
        },
      });
      if (error) throw error;
      setResult(data as PreviewResult);
    } catch (e: any) {
      toast({
        title: 'Preview failed',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Daily Brief Preview</h1>
          <p className="text-sm text-muted-foreground">
            Simulate user states and verify the brief output matches the rules.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulation Controls</CardTitle>
            <CardDescription>Override what the brief sees about this user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>User State</Label>
              <Select value={state} onValueChange={(v) => setState(v as UserState)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['ENGAGED', 'DRIFTING', 'DISENGAGED', 'DORMANT'] as UserState[]).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{STATE_DESCRIPTIONS[state]}</p>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as BriefFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML (email)</SelectItem>
                  <SelectItem value="markdown">Markdown (Telegram)</SelectItem>
                  <SelectItem value="plain">Plain text (SMS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="sp">Salesperson</Label>
                <Switch id="sp" checked={salesperson} onCheckedChange={setSalesperson} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ra" className={!salesperson ? 'opacity-50' : ''}>
                  Recent sales activity
                </Label>
                <Switch
                  id="ra"
                  disabled={!salesperson}
                  checked={hasRecentSalesActivity}
                  onCheckedChange={setHasRecentSalesActivity}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sd" className={!salesperson || !hasRecentSalesActivity ? 'opacity-50' : ''}>
                  Include stalled deals
                </Label>
                <Switch
                  id="sd"
                  disabled={!salesperson || !hasRecentSalesActivity}
                  checked={includeStalledDeals}
                  onCheckedChange={setIncludeStalledDeals}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="mf" className={!salesperson || !hasRecentSalesActivity ? 'opacity-50' : ''}>
                  Include missed follow-ups
                </Label>
                <Switch
                  id="mf"
                  disabled={!salesperson || !hasRecentSalesActivity}
                  checked={includeMissedFollowUps}
                  onCheckedChange={setIncludeMissedFollowUps}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="op" className={!salesperson || !hasRecentSalesActivity ? 'opacity-50' : ''}>
                  Include opportunities
                </Label>
                <Switch
                  id="op"
                  disabled={!salesperson || !hasRecentSalesActivity}
                  checked={includeOpportunities}
                  onCheckedChange={setIncludeOpportunities}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="cal">Include calendar events</Label>
                <Switch id="cal" checked={includeCalendarEvents} onCheckedChange={setIncludeCalendarEvents} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hab">Include 5+ day habit streak</Label>
                <Switch id="hab" checked={includeMeaningfulHabit} onCheckedChange={setIncludeMeaningfulHabit} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pb">Include playbook data</Label>
                <Switch id="pb" checked={includePlaybook} onCheckedChange={setIncludePlaybook} />
              </div>
            </div>

            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : 'Generate Preview'}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <div className="space-y-6">
          {!result && !loading && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Set up a scenario on the left and hit "Generate Preview".
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-16 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Calling the same generator the live system uses…
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* QA Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    QA Report
                    <Badge variant={result.qa.passCount === result.qa.totalChecks ? 'default' : 'destructive'}>
                      {result.qa.passCount}/{result.qa.totalChecks} checks
                    </Badge>
                    <Badge variant="outline">{result.qa.wordCount} words</Badge>
                  </CardTitle>
                  <CardDescription>
                    Heuristic checks against the system rules. Not a replacement for human review.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {result.qa.checks.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {c.pass ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className={c.pass ? '' : 'text-destructive font-medium'}>{c.label}</div>
                          {c.detail && (
                            <div className="text-xs text-muted-foreground">{c.detail}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Brief preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subject</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-foreground">{result.brief.subject}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Body</CardTitle>
                  <CardDescription>Format: {result.contextSummary.format}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={format === 'html' ? 'rendered' : 'raw'}>
                    <TabsList>
                      {format === 'html' && <TabsTrigger value="rendered">Rendered</TabsTrigger>}
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                    {format === 'html' && (
                      <TabsContent value="rendered">
                        <div
                          className="prose prose-sm max-w-none p-4 border rounded-md bg-background"
                          dangerouslySetInnerHTML={{ __html: result.brief.body }}
                        />
                      </TabsContent>
                    )}
                    <TabsContent value="raw">
                      <pre className="text-xs whitespace-pre-wrap p-4 border rounded-md bg-muted overflow-x-auto">
                        {result.brief.body}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Short summary (SMS)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{result.brief.shortSummary}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.brief.shortSummary.length} chars
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Context used</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap p-3 border rounded-md bg-muted">
                    {JSON.stringify(result.contextSummary, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
