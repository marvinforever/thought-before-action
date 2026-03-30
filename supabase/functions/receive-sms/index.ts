import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Twilio sends form-urlencoded data
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string || "").trim();
    const messageSid = formData.get("MessageSid") as string;

    console.log(`[receive-sms] From ${from}: ${body.slice(0, 80)}`);

    if (!from || !body) {
      return twimlResponse("");
    }

    const normalizedPhone = from.startsWith("+") ? from : `+${from}`;

    // ── Find the user ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, sms_opted_in")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (!profile) {
      console.log("[receive-sms] Unknown phone:", normalizedPhone);
      return twimlResponse(
        "Hey! I don't recognize this number yet. Ask your admin to add your phone number to your Jericho profile, then text me again."
      );
    }

    // ── Handle STOP / unsubscribe ──
    const lowerBody = body.toLowerCase();
    if (["stop", "unsubscribe", "quit", "end", "cancel"].includes(lowerBody)) {
      await supabase
        .from("profiles")
        .update({ sms_opted_in: false })
        .eq("id", profile.id);
      await logSMS(supabase, profile, normalizedPhone, body, messageSid, "unsubscribe");
      return twimlResponse(
        "You've been unsubscribed from Jericho SMS. Reply START anytime to re-subscribe."
      );
    }

    // ── Handle START / re-subscribe ──
    if (["start", "subscribe", "begin"].includes(lowerBody)) {
      await supabase
        .from("profiles")
        .update({ sms_opted_in: true })
        .eq("id", profile.id);
      await logSMS(supabase, profile, normalizedPhone, body, messageSid, "subscribe");
      return twimlResponse(
        `Welcome back${profile.full_name ? ", " + profile.full_name.split(" ")[0] : ""}! 🎯 You can text me anything — ask about customers, update your pipeline, get coaching tips. What's on your mind?`
      );
    }

    // ── Handle HELP ──
    if (["help", "?", "commands"].includes(lowerBody)) {
      await logSMS(supabase, profile, normalizedPhone, body, messageSid, "help");
      return twimlResponse(
        "Jericho SMS:\n• Ask about any customer or deal\n• \"Add [company] to pipeline\"\n• \"Talked to [name] today\"\n• Ask for coaching tips\n• STOP to unsubscribe\n\nJust text naturally — I'll figure it out!"
      );
    }

    // ── Log inbound message ──
    await logSMS(supabase, profile, normalizedPhone, body, messageSid, "coaching");

    // ── Load recent SMS conversation for context ──
    const { data: recentSMS } = await supabase
      .from("sms_messages")
      .select("direction, message, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationHistory = (recentSMS || [])
      .reverse()
      .map((m: any) =>
        m.direction === "inbound"
          ? `user: ${m.message}`
          : `assistant: ${m.message}`
      )
      .join("\n\n");

    // ── Call sales-coach with the user's message ──
    console.log(`[receive-sms] Routing to sales-coach for user ${profile.id}`);

    const coachResponse = await fetch(
      `${supabaseUrl}/functions/v1/sales-coach`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: body,
          conversationHistory,
          chatMode: "coach",
          viewAsUserId: profile.id,
          viewAsCompanyId: profile.company_id,
        }),
      }
    );

    if (!coachResponse.ok) {
      const errText = await coachResponse.text();
      console.error(`[receive-sms] sales-coach error [${coachResponse.status}]:`, errText);
      return twimlResponse(
        "I'm having a moment — try again in a sec. 🤔"
      );
    }

    const coachData = await coachResponse.json();
    let aiMessage = coachData.message || "Got it — let me think on that.";

    // ── Clean up the AI response for SMS ──
    aiMessage = formatForSMS(aiMessage);

    // ── Split into SMS segments if needed (1600 char limit) ──
    const segments = splitSMSMessage(aiMessage, 1550);

    // If only 1 segment, use TwiML inline for fastest delivery
    if (segments.length === 1) {
      // Log outbound
      await logSMS(supabase, profile, normalizedPhone, segments[0], null, "coaching", "outbound");
      return twimlResponse(segments[0]);
    }

    // Multiple segments: send first via TwiML, rest via send-sms
    await logSMS(supabase, profile, normalizedPhone, segments[0], null, "coaching", "outbound");

    // Fire-and-forget additional segments with slight delays
    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      sendFollowUpSMS(supabase, supabaseUrl, supabaseServiceKey, profile.id, normalizedPhone, segment, profile.company_id).catch((err) =>
        console.error(`[receive-sms] follow-up segment ${i} failed:`, err)
      );
    }

    return twimlResponse(segments[0]);
  } catch (error) {
    console.error("[receive-sms] Error:", error);
    return twimlResponse("");
  }
});

// ── Helpers ──

function twimlResponse(message: string): Response {
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function logSMS(
  supabase: any,
  profile: any,
  phone: string,
  message: string,
  twilioSid: string | null,
  messageType: string,
  direction: string = "inbound"
) {
  try {
    await supabase.from("sms_messages").insert({
      profile_id: profile.id,
      company_id: profile.company_id,
      direction,
      phone_number: phone,
      message,
      message_type: messageType,
      twilio_sid: twilioSid,
      status: direction === "inbound" ? "received" : "sent",
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[receive-sms] log error:", err);
  }
}

async function sendFollowUpSMS(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  profileId: string,
  phone: string,
  message: string,
  companyId: string | null
) {
  // Small delay so messages arrive in order
  await new Promise((r) => setTimeout(r, 1500));

  const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profileId,
      phoneNumber: phone,
      message,
      messageType: "coaching",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[receive-sms] send-sms follow-up failed [${res.status}]:`, errText);
  }

  // Log outbound
  await supabase.from("sms_messages").insert({
    profile_id: profileId,
    company_id: companyId,
    direction: "outbound",
    phone_number: phone,
    message,
    message_type: "coaching",
    status: "sent",
  });
}

/**
 * Strip markdown formatting that doesn't render well in SMS.
 */
function formatForSMS(text: string): string {
  return (
    text
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Convert markdown headers to plain text
      .replace(/^#{1,4}\s+/gm, "")
      // Convert markdown links to plain text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Convert markdown bullets to simple dashes
      .replace(/^[\s]*[-*]\s+/gm, "• ")
      // Remove horizontal rules
      .replace(/^---+$/gm, "")
      // Collapse multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Split a message into SMS-friendly segments at sentence/paragraph boundaries.
 */
function splitSMSMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      segments.push(remaining.trim());
      break;
    }

    // Try to split at a paragraph break
    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (splitIdx < maxLen * 0.3) {
      // Try sentence break
      splitIdx = remaining.lastIndexOf(". ", maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      // Hard split at maxLen
      splitIdx = maxLen;
    }

    segments.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return segments.filter((s) => s.length > 0);
}
