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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    let companies: string[] = [];

    if (token === serviceRoleKey) {
      const body = await req.json().catch(() => ({}));
      if (!body.userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = body.userId;
      companies = body.companies || [];
    } else {
      const body = await req.json().catch(() => ({}));
      companies = body.companies || [];

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

    if (!companies.length) {
      return new Response(JSON.stringify({ error: "companies[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Refresh if expired
    const isExpired = integration.token_expires_at && new Date(integration.token_expires_at) <= new Date();
    if (isExpired && integration.refresh_token) {
      const refreshed = await refreshAccessToken(decryptToken(integration.refresh_token, encKey));
      if (refreshed.error) {
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
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await adminClient
        .from("user_integrations")
        .update({
          access_token: encryptToken(refreshed.access_token, encKey),
          token_expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
          ...(refreshed.refresh_token
            ? { refresh_token: encryptToken(refreshed.refresh_token, encKey) }
            : {}),
        })
        .eq("id", integration.id);
    }

    // Search Gmail for each company — last 5 emails per company
    const results: Record<string, any[]> = {};

    for (const company of companies.slice(0, 20)) {
      try {
        const query = encodeURIComponent(company);
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!listRes.ok) {
          console.error(`Gmail list error for "${company}":`, listRes.status);
          results[company] = [];
          continue;
        }

        const listData = await listRes.json();
        const messages = listData.messages || [];

        const emails: any[] = [];
        for (const msg of messages) {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!msgRes.ok) continue;
          const msgData = await msgRes.json();

          const headers = msgData.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || null;

          emails.push({
            id: msgData.id,
            subject: getHeader("Subject"),
            from: getHeader("From"),
            to: getHeader("To"),
            date: getHeader("Date"),
            snippet: msgData.snippet || null,
          });
        }

        results[company] = emails;
      } catch (err) {
        console.error(`Gmail error for "${company}":`, err);
        results[company] = [];
      }
    }

    return new Response(JSON.stringify({ emails: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-gmail-read error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
