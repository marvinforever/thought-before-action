import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InboundEmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: string;
  headers?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received inbound email webhook");

    // Verify webhook signature (Resend security)
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature");
      // Note: Full verification would use Svix library, simplified for now
      console.log("Webhook signature present:", !!signature);
    }

    const payload: InboundEmailPayload = await req.json();
    console.log("Email from:", payload.from);
    console.log("Email to:", payload.to);
    console.log("Subject:", payload.subject);

    // Clean the email body - strip signatures and quoted text
    const cleanedBody = cleanEmailBody(payload.text);
    console.log("Cleaned body length:", cleanedBody.length);

    // Store in email_reply_logs with pending status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: logEntry, error: logError } = await supabase
      .from("email_reply_logs")
      .insert({
        email_from: payload.from,
        email_subject: payload.subject,
        email_body: cleanedBody,
        processing_status: "pending",
        parsed_data: {
          original_to: payload.to,
          received_at: payload.date,
          has_html: !!payload.html,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error("Error storing email log:", logError);
      throw logError;
    }

    console.log("Email logged with ID:", logEntry.id);

    // Invoke process-email-reply function asynchronously (fire and forget)
    const processUrl = `${supabaseUrl}/functions/v1/process-email-reply`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ logId: logEntry.id }),
    }).catch((err) => console.error("Error invoking process-email-reply:", err));

    console.log("Triggered process-email-reply function");

    // Return 200 immediately to Resend
    return new Response(
      JSON.stringify({ success: true, logId: logEntry.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in receive-email-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function cleanEmailBody(text: string): string {
  // Remove common email signatures
  const signaturePatterns = [
    /Sent from my iPhone/i,
    /Sent from my Android/i,
    /Get Outlook for iOS/i,
    /Get Outlook for Android/i,
    /\n--\s*\n/,
    /\n________________________________/,
  ];

  let cleaned = text;
  for (const pattern of signaturePatterns) {
    cleaned = cleaned.split(pattern)[0];
  }

  // Remove quoted text (lines starting with >)
  cleaned = cleaned
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n");

  // Remove excessive whitespace
  cleaned = cleaned.trim().replace(/\n{3,}/g, "\n\n");

  return cleaned;
}
