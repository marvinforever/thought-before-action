import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Link2 } from "lucide-react";

const ConnectGoogle = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "initiating" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const stateToken = searchParams.get("token");
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "true") {
      setStatus("success");
      return;
    }
    if (error) {
      setStatus("error");
      setErrorMsg(
        error === "invalid_state" ? "This link has expired. Please request a new one from Jericho."
        : error === "token_exchange_failed" ? "Google denied the connection. Please try again."
        : "Something went wrong. Please try again."
      );
      return;
    }

    // If we have a state token, initiate OAuth
    if (stateToken) {
      initiateOAuth();
    } else {
      // No token and no result — just show connect button
      setStatus("loading");
      checkSessionAndInit();
    }
  }, []);

  const checkSessionAndInit = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Redirect to login with return URL
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setStatus("loading");
  };

  const initiateOAuth = async () => {
    setStatus("initiating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }

      const res = await supabase.functions.invoke("google-oauth-init");

      if (res.error || !res.data?.url) {
        setStatus("error");
        setErrorMsg("Failed to start Google connection. Please try again.");
        return;
      }

      // Redirect to Google consent screen
      window.location.href = res.data.url;
    } catch {
      setStatus("error");
      setErrorMsg("Connection failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl border-accent/20">
        <CardHeader className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">J</span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-primary">Jericho</h1>
              <p className="text-xs text-muted-foreground">Google Integration</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          {status === "initiating" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
              <p className="text-muted-foreground">Connecting to Google...</p>
              <p className="text-xs text-muted-foreground">You'll be redirected to Google to grant access.</p>
            </>
          )}

          {status === "loading" && (
            <>
              <Link2 className="h-12 w-12 text-accent mx-auto" />
              <div className="space-y-2">
                <p className="font-medium">Connect Google to Jericho</p>
                <p className="text-sm text-muted-foreground">
                  Grant Jericho read access to your calendar and email so it can provide smarter coaching.
                </p>
                <ul className="text-xs text-muted-foreground text-left space-y-1 mt-3">
                  <li>📅 Calendar (read-only) — know your schedule</li>
                  <li>📧 Email (read-only) — context from conversations</li>
                  <li>✏️ Drafts (compose) — help you write emails</li>
                </ul>
              </div>
              <Button variant="accent" className="w-full" onClick={initiateOAuth}>
                Connect Google Account
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-accent">Google Connected!</p>
                <p className="text-sm text-muted-foreground">
                  Jericho now has access to your calendar and email. You can close this window and return to Telegram.
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-destructive-foreground">Connection Failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={initiateOAuth}>
                Try Again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectGoogle;
