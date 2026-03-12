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
    console.log("Raw payload.data keys:", Object.keys(rawPayload?.data || {}));
    console.log("Full payload:", JSON.stringify(rawPayload, null, 2));
    
    // Handle Resend's nested structure: data.payload.text / data.payload.html
    const emailData = rawPayload.data || rawPayload;
    const payload = emailData.payload || {};
    
    const from = emailData.from || rawPayload.from;
    const to = Array.isArray(emailData.to) ? emailData.to[0] : (emailData.to || rawPayload.to);
    const subject = emailData.subject || rawPayload.subject;
    const emailId = emailData.email_id || emailData.id || rawPayload.email_id;
    
    // Resend nests body under data.payload.text / data.payload.html
    let text = payload.text || emailData.text || emailData.body || rawPayload.text || rawPayload.body || "";
    let html = payload.html || emailData.html || rawPayload.html || "";
    
    console.log("Email from:", from);
    console.log("Email to:", to);
    console.log("Subject:", subject);
    console.log("Email ID:", emailId);
    console.log("Direct text length:", text?.length || 0);
    console.log("Direct html length:", html?.length || 0);

    if (!from) {
      console.error("No 'from' field found in payload");
      return new Response(
        JSON.stringify({ error: "Invalid payload - missing 'from' field", receivedKeys: Object.keys(rawPayload || {}) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ IDEMPOTENCY CHECK ============
    // Prevent duplicate processing of the same inbound email.
    // IMPORTANT: This must be race-condition safe (webhooks can arrive concurrently).
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const idempotencyKey = emailId
      ? `email:${emailId}`
      : `hash:${await sha256(`${from}|${to}|${subject}|${text || ''}|${html ? 'html' : ''}|${emailData.created_at || rawPayload.created_at || ''}`)}`;

    // If no text/html from payload and we have emailId, try fetching from Resend API with retries
    if (!text && !html && emailId) {
      console.log("No content in payload, trying Resend API with retries...");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      // Retry up to 3 times with increasing delays (Resend may need time to index the email)
      const delays = [1000, 2000, 3000]; // 1s, 2s, 3s
      
      for (let attempt = 0; attempt < delays.length; attempt++) {
        // Wait before fetching
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        console.log(`Attempt ${attempt + 1}: Fetching email after ${delays[attempt]}ms delay`);
        
        try {
          const emailContentResponse = await fetch(`https://api.resend.com/emails/${emailId}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
            },
          });
          
          if (emailContentResponse.ok) {
            const emailContent = await emailContentResponse.json();
            console.log("Resend API response keys:", Object.keys(emailContent || {}));
            text = emailContent.text || "";
            html = emailContent.html || "";
            console.log("Fetched text length:", text.length);
            console.log("Fetched html length:", html.length);
            
            // If we got content, break out of retry loop
            if (text || html) {
              console.log("Successfully retrieved email content on attempt", attempt + 1);
              break;
            }
          } else {
            const errorText = await emailContentResponse.text();
            console.error(`Attempt ${attempt + 1} failed:`, emailContentResponse.status, errorText);
          }
        } catch (fetchError) {
          console.error(`Attempt ${attempt + 1} error:`, fetchError);
        }
      }
    }

    // If no text but we have HTML, extract text from HTML
    if (!text && html) {
      console.log("Extracting text from HTML");
      text = extractTextFromHtml(html);
      console.log("Extracted text length:", text.length);
    }

    // Clean the email body - strip signatures and quoted text
    const cleanedBody = cleanEmailBody(text);
    console.log("Cleaned body length:", cleanedBody.length);

    // Store in email_reply_logs with pending status
    // Use DB-level uniqueness (idempotency_key) so concurrent webhooks can't double-insert.
    const insertPayload = {
      email_from: from,
      email_subject: subject,
      email_body: cleanedBody,
      processing_status: "pending",
      email_id: emailId || null,
      idempotency_key: idempotencyKey,
      parsed_data: {
        email_id: emailId, // keep for legacy/debug
        original_to: to,
        received_at: emailData.created_at || new Date().toISOString(),
        webhook_type: rawPayload.type,
        has_html: !!html,
        direct_text_length: text?.length || 0,
        direct_html_length: html?.length || 0,
      },
    };

    const { data: insertedRows, error: logError } = await supabase
      .from("email_reply_logs")
      .upsert(insertPayload, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select();

    if (logError) {
      console.error("Error storing email log:", logError);
      throw logError;
    }

    // If this was a duplicate, we will not get an inserted row back.
    if (!insertedRows || insertedRows.length === 0) {
      const { data: existing } = await supabase
        .from("email_reply_logs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .single();

      console.log("Duplicate webhook ignored (idempotency_key)", idempotencyKey);
      return new Response(
        JSON.stringify({ success: true, message: "Duplicate webhook ignored", existingLogId: existing?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logEntry = insertedRows[0];
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

    // Return 200 immediately to the webhook sender
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

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractTextFromHtml(html: string): string {
  if (!html) return "";
  
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|hr|li|tr)[^>]*>/gi, "\n");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  
  return text;
}

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
