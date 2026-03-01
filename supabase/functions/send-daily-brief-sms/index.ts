import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { gatherUserContext, generateBriefContent } from "../_shared/daily-brief-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check SMS opt-in and phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone, sms_opted_in, company_id")
      .eq("id", profileId)
      .single();

    if (!profile?.sms_opted_in || !profile?.phone) {
      console.log(`Profile ${profileId} not SMS eligible (opted_in: ${profile?.sms_opted_in}, phone: ${!!profile?.phone})`);
      return new Response(
        JSON.stringify({ success: false, reason: "not_sms_eligible" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate brief content
    console.log(`Generating SMS brief for ${profileId}`);
    const context = await gatherUserContext(supabase, profileId);
    const { shortSummary } = await generateBriefContent(context, 'plain');

    // Send via send-sms function
    const { data: smsResult, error: smsError } = await supabase.functions.invoke("send-sms", {
      body: {
        profileId,
        message: shortSummary,
        messageType: "daily_brief"
      }
    });

    if (smsError) {
      console.error(`SMS send failed for ${profileId}:`, smsError);
      throw new Error(`SMS delivery failed: ${smsError.message}`);
    }

    // Log delivery
    await supabase.from("email_deliveries").insert({
      profile_id: profileId,
      company_id: profile.company_id,
      subject: "Daily Brief SMS",
      body: shortSummary,
      sent_at: new Date().toISOString(),
      status: 'sent',
      channel: 'sms',
      resources_included: { sms_sid: smsResult?.messageSid }
    });

    console.log(`SMS brief sent to ${profileId}`);
    return new Response(
      JSON.stringify({ success: true, messageSid: smsResult?.messageSid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-brief-sms:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
