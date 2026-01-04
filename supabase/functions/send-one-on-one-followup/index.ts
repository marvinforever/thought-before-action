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
    const { toEmail, toName, meetingDate, notes, wins, concerns, actionItems, nextMeetingDate } = await req.json();
    
    console.log("Sending 1:1 follow-up email to:", toEmail);

    // Format the meeting date
    const formattedDate = new Date(meetingDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build email sections
    let emailSections: string[] = [];

    if (notes) {
      emailSections.push(`**Meeting Notes:**\n${notes}`);
    }

    if (wins) {
      emailSections.push(`**Wins & Accomplishments:**\n${wins}`);
    }

    if (concerns) {
      emailSections.push(`**Areas to Focus On:**\n${concerns}`);
    }

    if (actionItems && actionItems.length > 0) {
      const actionList = actionItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n');
      emailSections.push(`**Action Items:**\n${actionList}`);
    }

    if (nextMeetingDate) {
      const nextDate = new Date(nextMeetingDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      emailSections.push(`**Next Meeting:** ${nextDate}`);
    }

    const emailBody = `Hi ${toName || 'there'},

Thank you for our 1:1 meeting on ${formattedDate}. Here's a summary of what we discussed:

${emailSections.join('\n\n')}

Please let me know if you have any questions or if I missed anything from our conversation.

Best regards`;

    // Convert markdown-style bold to HTML
    const htmlBody = emailBody
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [toEmail],
        subject: `1:1 Follow-up - ${formattedDate}`,
        html: htmlBody,
        text: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errorText);
      throw new Error(`Email sending failed: ${resendResponse.status} - ${errorText}`);
    }

    const emailData = await resendResponse.json();
    console.log("1:1 follow-up email sent successfully:", emailData.id);

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
        subject: `1:1 Follow-up - ${formattedDate}`,
        body: emailBody,
        status: "sent",
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
    console.error("Error in send-one-on-one-followup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
