import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toEmail, toName, subject, bodyText, inReplyTo } = await req.json();
    
    console.log("Sending email reply to:", toEmail);

    // Format the message
    const formattedMessage = `Hi ${toName || 'there'},

${bodyText}

Keep growing,
Jericho

P.S. You can reply to this email anytime to continue our conversation.`;

    // Prepare email headers for threading
    const headers: Record<string, string> = {
      "Reply-To": "jericho@sender.askjericho.com",
    };

    if (inReplyTo) {
      headers["In-Reply-To"] = inReplyTo;
      headers["References"] = inReplyTo;
    }

    // Send via Resend using fetch API (matching send-growth-email pattern)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [toEmail],
        subject: subject || "Message from Jericho",
        text: formattedMessage,
        headers,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errorText);
      throw new Error(`Email sending failed: ${resendResponse.status}`);
    }

    const emailData = await resendResponse.json();
    console.log("Email sent successfully:", emailData.id);

    // Log the delivery
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get profile ID from email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id")
      .eq("email", toEmail)
      .single();

    if (profile) {
      await supabase.from("email_deliveries").insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        subject: subject,
        body: formattedMessage,
        status: "reply_sent",
      });
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-email-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
