import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decryptToken(ciphertext: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

function encryptToken(plaintext: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const textBytes = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: accept service role key or user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let userId: string;

    if (token === serviceRoleKey) {
      const body = await req.json().catch(() => ({}));
      if (!body.userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = body.userId;
    } else {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // Look up Google integration
    const { data: integration, error: lookupErr } = await adminClient
      .from("user_integrations")
      .select("*")
      .eq("profile_id", userId)
      .eq("provider", "google")
      .eq("sync_status", "connected")
      .single();

    if (lookupErr || !integration) {
      return new Response(JSON.stringify({ error: "Google not connected", connected: false }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encKey = serviceRoleKey.substring(0, 32);
    let accessToken = decryptToken(integration.access_token, encKey);

    // Check if token is expired
    const isExpired = integration.token_expires_at && new Date(integration.token_expires_at) <= new Date();

    if (isExpired && integration.refresh_token) {
      const refreshed = await refreshAccessToken(
        decryptToken(integration.refresh_token, encKey)
      );

      if (refreshed.error) {
        // If refresh fails, mark as disconnected
        await adminClient
          .from("user_integrations")
          .update({ sync_status: "error", sync_error: refreshed.error })
          .eq("id", integration.id);

        return new Response(JSON.stringify({ error: "Token refresh failed. Please reconnect Google." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = refreshed.access_token;

      // Update stored tokens
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await adminClient
        .from("user_integrations")
        .update({
          access_token: encryptToken(refreshed.access_token, encKey),
          token_expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
          // Update refresh token if a new one was issued
          ...(refreshed.refresh_token
            ? { refresh_token: encryptToken(refreshed.refresh_token, encKey) }
            : {}),
        })
        .eq("id", integration.id);
    }

    // Call Google Calendar API
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const calParams = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: sevenDaysLater.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${calParams.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("Calendar API error:", calRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to fetch calendar events", status: calRes.status }), {
        status: calRes.status === 401 ? 401 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calData = await calRes.json();

    return new Response(JSON.stringify({ events: calData.items || [], summary: calData.summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-read error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    return { error: data.error_description || data.error || "Refresh failed" };
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in || 3600,
    refresh_token: data.refresh_token || null,
  };
}
