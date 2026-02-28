import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = "https://askjericho.com";

// Simple XOR-based encryption using a key derived from the service role key.
// For production, use Vault or a proper KMS.
function encryptToken(plaintext: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const textBytes = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  // Base64-encode for safe storage
  return btoa(String.fromCharCode(...encrypted));
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/connect/google?error=${error}` },
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/connect/google?error=missing_params` },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate state token
    const { data: integration, error: lookupErr } = await adminClient
      .from("user_integrations")
      .select("id, profile_id, sync_status")
      .eq("oauth_state", state)
      .eq("integration_type", "google")
      .eq("sync_status", "pending")
      .single();

    if (lookupErr || !integration) {
      console.error("State validation failed:", lookupErr);
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/connect/google?error=invalid_state` },
      });
    }

    // Exchange code for tokens
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/connect/google?error=token_exchange_failed` },
      });
    }

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Encrypt tokens before storing
    const encKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.substring(0, 32);
    const encAccessToken = encryptToken(tokenData.access_token, encKey);
    const encRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token, encKey)
      : null;

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Update integration record
    const { error: updateErr } = await adminClient
      .from("user_integrations")
      .update({
        access_token: encAccessToken,
        refresh_token: encRefreshToken,
        token_expires_at: expiresAt,
        scopes: tokenData.scope ? tokenData.scope.split(" ") : [],
        external_email: userInfo.email || null,
        external_user_id: userInfo.id || null,
        sync_status: "connected",
        connected_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
        oauth_state: null, // Clear state token after use
        provider: "google",
      })
      .eq("id", integration.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/connect/google?error=save_failed` },
      });
    }

    // Send Telegram notification
    try {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("telegram_chat_id, full_name")
        .eq("id", integration.profile_id)
        .single();

      if (profile?.telegram_chat_id) {
        const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (botToken) {
          const name = profile.full_name?.split(" ")[0] || "there";
          const message = `✅ Hey ${name}! Your Google account (${userInfo.email || "connected"}) is now linked to Jericho.\n\nI can now access your calendar and email to give you better coaching. 🎯`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: profile.telegram_chat_id,
              text: message,
              parse_mode: "HTML",
            }),
          });
        }
      }
    } catch (tgErr) {
      console.error("Telegram notification failed (non-fatal):", tgErr);
    }

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL}/connect/google?success=true` },
    });
  } catch (err) {
    console.error("google-oauth-callback error:", err);
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL}/connect/google?error=server_error` },
    });
  }
});
