import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Link2, Link2Off, Copy, ExternalLink, RefreshCw, Check, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_USERNAME = "Teamjerichobot";

export function TelegramLinkCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const checkLinkStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("telegram_links")
        .select("telegram_username, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        setLinked(true);
        setTelegramUsername(data.telegram_username);
        setCode(null);
      } else {
        setLinked(false);
      }
    } catch (err) {
      console.error("Error checking Telegram link:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLinkStatus();
  }, [checkLinkStatus]);

  // Poll for link status when code is active
  useEffect(() => {
    if (!code || linked) return;
    const interval = setInterval(checkLinkStatus, 5000);
    return () => clearInterval(interval);
  }, [code, linked, checkLinkStatus]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || linked) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      if (diff <= 0) {
        setCode(null);
        setExpiresAt(null);
        setTimeLeft("");
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${String(secs).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, linked]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      const { error } = await supabase.from("telegram_link_codes").insert({
        user_id: user.id,
        code: newCode,
        expires_at: expires.toISOString(),
      });

      if (error) throw error;

      setCode(newCode);
      setExpiresAt(expires);
      toast({ title: "Code generated!", description: "Use the link below or send the code to the bot." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("telegram_links")
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (error) throw error;

      setLinked(false);
      setTelegramUsername(null);
      toast({ title: "Telegram disconnected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  };

  const deepLink = code ? `https://t.me/${BOT_USERNAME}?start=${code}` : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-2 border-[hsl(var(--accent))]/20 hover:border-[hsl(var(--accent))]/40 transition-colors">
      <CardHeader className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/0.9] text-primary-foreground pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center shadow-lg">
              <MessageCircle className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Telegram</CardTitle>
              <CardDescription className="text-primary-foreground/70">
                Jericho in your pocket
              </CardDescription>
            </div>
          </div>
          {linked && (
            <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
              <Check className="h-3 w-3 mr-1" /> Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <AnimatePresence mode="wait">
          {linked ? (
            <motion.div
              key="linked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Link2 className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-medium">
                    Connected as {telegramUsername ? `@${telegramUsername}` : "Telegram User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Message the bot anytime for coaching, updates, or kudos
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinking}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Link2Off className="h-4 w-4 mr-2" />
                {unlinking ? "Disconnecting..." : "Disconnect"}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="unlinked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Connect Telegram to get AI coaching, pipeline updates, kudos, and growth plan check-ins — right from your phone.
              </p>

              {!code ? (
                <Button
                  onClick={generateCode}
                  disabled={generating}
                  className="w-full bg-[hsl(var(--accent))] text-accent-foreground hover:bg-[hsl(var(--accent))]/90 shadow-md"
                >
                  {generating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-2" />
                  )}
                  {generating ? "Generating..." : "Connect Telegram"}
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  {/* Deep Link Button */}
                  <a
                    href={deepLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[hsl(var(--accent))] text-accent-foreground rounded-lg font-semibold hover:bg-[hsl(var(--accent))]/90 transition-colors shadow-md"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Telegram — One Tap Connect
                  </a>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or send this code</span>
                    </div>
                  </div>

                  {/* Manual Code */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex gap-1">
                      {code.split("").map((digit, i) => (
                        <div
                          key={i}
                          className="w-10 h-12 flex items-center justify-center bg-muted rounded-lg text-xl font-bold text-foreground border border-border"
                        >
                          {digit}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(code)}
                    >
                      {copied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Expires in {timeLeft}</span>
                  </div>

                  {/* Regenerate */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateCode}
                    disabled={generating}
                    className="w-full text-muted-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Generate new code
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
