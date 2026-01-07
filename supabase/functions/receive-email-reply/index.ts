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
    
    // Log the FULL payload to see what Resend is sending
    console.log("FULL RAW PAYLOAD:", JSON.stringify(rawPayload, null, 2));
    
    // Handle Resend's nested structure
    const emailData = rawPayload.data || rawPayload;
    console.log("Email data keys:", Object.keys(emailData || {}));
    console.log("FULL EMAIL DATA:", JSON.stringify(emailData, null, 2));
    
    const from = emailData.from || rawPayload.from;
    const to = Array.isArray(emailData.to) ? emailData.to[0] : (emailData.to || rawPayload.to);
    const subject = emailData.subject || rawPayload.subject;
    const emailId = emailData.email_id;
    
    // Try ALL possible field names for body content directly from payload
    let text = emailData.text || emailData.body || emailData.plain || emailData.plain_body || 
               emailData.text_body || emailData.content || rawPayload.text || rawPayload.body || "";
    let html = emailData.html || emailData.html_body || rawPayload.html || "";
    
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

    // If no text/html from payload and we have emailId, try fetching from Resend API
    if (!text && !html && emailId) {
      console.log("No content in payload, trying Resend API...");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
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
        } else {
          const errorText = await emailContentResponse.text();
          console.error("Failed to fetch email content:", emailContentResponse.status, errorText);
        }
      } catch (fetchError) {
        console.error("Error fetching email content:", fetchError);
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
          has_html: !!html,
          direct_text_length: text?.length || 0,
          direct_html_length: html?.length || 0,
          // Store the raw payload for debugging
          raw_payload: rawPayload,
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
