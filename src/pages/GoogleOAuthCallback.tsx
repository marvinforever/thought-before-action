import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const GoogleOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMsg("Google denied the connection. Please try again.");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMsg("Missing authorization parameters.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/google-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        );

        // The edge function redirects on success/error, but if called via fetch
        // it may return a redirect response. Check both cases.
        if (res.redirected) {
          const redirectUrl = new URL(res.url);
          if (redirectUrl.searchParams.get("success") === "true") {
            setStatus("success");
          } else {
            setStatus("error");
            setErrorMsg(redirectUrl.searchParams.get("error") || "Connection failed.");
          }
          return;
        }

        // If no redirect, check status
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(data.error || "Connection failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    };

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl border-accent/20">
        <CardHeader className="text-center">
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
          {status === "processing" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
              <p className="text-muted-foreground">Connecting your Google account...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
              <div className="space-y-2">
                <p className="font-medium">Google Connected!</p>
                <p className="text-sm text-muted-foreground">
                  You can close this tab and return to Telegram.
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <p className="font-medium">Something went wrong</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;
