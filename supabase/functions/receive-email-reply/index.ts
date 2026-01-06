import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend webhook payload structure
interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    from: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    created_at?: string;
    email_id?: string;
    headers?: Array<{ name: string; value: string }>;
  };
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
      console.log("Webhook signature present:", !!signature);
    }

    const rawPayload = await req.json();
    console.log("Raw payload type:", rawPayload?.type);
    console.log("Raw payload keys:", Object.keys(rawPayload || {}));
    
    // Handle Resend's nested structure
    const emailData = rawPayload.data || rawPayload;
    
    const from = emailData.from || rawPayload.from;
    const to = Array.isArray(emailData.to) ? emailData.to[0] : (emailData.to || rawPayload.to);
    const subject = emailData.subject || rawPayload.subject;
    const text = emailData.text || rawPayload.text || "";
    
    console.log("Email from:", from);
    console.log("Email to:", to);
    console.log("Subject:", subject);
    console.log("Text length:", text?.length || 0);

    if (!from) {
      console.error("No 'from' field found in payload");
      console.log("Full payload:", JSON.stringify(rawPayload, null, 2));
      return new Response(
        JSON.stringify({ error: "Invalid payload - missing 'from' field", receivedKeys: Object.keys(rawPayload || {}) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean the email body - strip signatures and quoted text
    const cleanedBody = cleanEmailBody(text);
    console.log("Cleaned body length:", cleanedBody.length);

    // Store in email_reply_logs with pending status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: logEntry, error: logError } = await supabase
      .from("email_reply_logs")
      .insert({
        email_from: from,
        email_subject: subject,
        email_body: cleanedBody,
        processing_status: "pending",
        parsed_data: {
          original_to: to,
          received_at: emailData.created_at || new Date().toISOString(),
          webhook_type: rawPayload.type,
          has_html: !!emailData.html,
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
  if (!text) return "";
  
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
