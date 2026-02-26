import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Users, 
  Clock,
  Shield,
  Zap
} from "lucide-react";

export default function TelegramSetup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testChatId, setTestChatId] = useState("");
  const [stats, setStats] = useState({ linkedUsers: 0, totalMessages: 0, lastMessageAt: null as string | null });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { count: linkedCount } = await supabase
        .from("telegram_links")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: msgCount } = await supabase
        .from("telegram_conversations")
        .select("id", { count: "exact", head: true });

      const { data: lastMsg } = await supabase
        .from("telegram_conversations")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({
        linkedUsers: linkedCount || 0,
        totalMessages: msgCount || 0,
        lastMessageAt: lastMsg?.created_at || null,
      });
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      // This calls the Telegram API directly to set the webhook
      // The bot token is server-side only, so we invoke an edge function
      const { data, error } = await supabase.functions.invoke("telegram-webhook", {
        body: { action: "register_webhook" },
      });

      // Since we can't call Telegram API from here (bot token is secret),
      // provide the URL for manual registration
      toast({
        title: "Webhook URL Ready",
        description: "Use the URL below with your bot token to register the webhook via Telegram's API.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testChatId) {
      toast({ title: "Enter a chat ID", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-send-scheduled", {
        body: {},
      });
      toast({
        title: "Function invoked",
        description: "Check the scheduled messages table for results.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Telegram Bot Setup</h1>
        <p className="text-muted-foreground">Configure and monitor the Jericho Telegram integration</p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--accent))]/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.linkedUsers}</div>
              <div className="text-sm text-muted-foreground">Linked Users</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalMessages}</div>
              <div className="text-sm text-muted-foreground">Total Messages</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-[hsl(var(--success))]" />
            </div>
            <div>
              <div className="text-sm font-bold">
                {stats.lastMessageAt
                  ? new Date(stats.lastMessageAt).toLocaleDateString()
                  : "Never"}
              </div>
              <div className="text-sm text-muted-foreground">Last Message</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BotFather Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            Step 1: Create Your Bot
          </CardTitle>
          <CardDescription>One-time setup via Telegram's BotFather</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">1</Badge>
              <span>Open Telegram and search for <strong>@BotFather</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">2</Badge>
              <span>Send <code className="bg-muted px-2 py-0.5 rounded text-xs">/newbot</code> and follow the prompts to name your bot</span>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">3</Badge>
              <span>Copy the <strong>Bot API Token</strong> — save it as a backend secret named <code className="bg-muted px-2 py-0.5 rounded text-xs">TELEGRAM_BOT_TOKEN</code></span>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">4</Badge>
              <span>Optionally set a profile photo and description with <code className="bg-muted px-2 py-0.5 rounded text-xs">/setuserpic</code> and <code className="bg-muted px-2 py-0.5 rounded text-xs">/setdescription</code></span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Webhook Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Step 2: Register Webhook
          </CardTitle>
          <CardDescription>Tell Telegram where to send messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">Registration URL Template</p>
            <p className="text-xs text-muted-foreground">
              Replace <code className="bg-muted px-1 rounded">&lt;BOT_TOKEN&gt;</code> and{" "}
              <code className="bg-muted px-1 rounded">&lt;SECRET&gt;</code> with your values, then open in a browser:
            </p>
            <code className="block text-xs bg-muted p-3 rounded overflow-x-auto">
              {`https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=${webhookUrl}&secret_token=<SECRET>`}
            </code>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
            <span className="text-muted-foreground">
              The webhook validates requests using the <code className="bg-muted px-1 rounded text-xs">TELEGRAM_WEBHOOK_SECRET</code> header
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-accent" />
            Step 3: Test Connection
          </CardTitle>
          <CardDescription>Send a test message to verify everything works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The easiest way to test: open Telegram, find your bot, and send it a message. 
            If the webhook is registered correctly, you'll get a response asking you to link your account.
          </p>
          <div className="flex items-center gap-2 p-3 bg-[hsl(var(--accent))]/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-accent" />
            <span className="text-sm">
              Make sure you've saved both <strong>TELEGRAM_BOT_TOKEN</strong> and <strong>TELEGRAM_WEBHOOK_SECRET</strong> as backend secrets before testing.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
