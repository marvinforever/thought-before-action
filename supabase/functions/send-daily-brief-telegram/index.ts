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
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    // Look up telegram link
    const { data: telegramLink } = await supabase
      .from("telegram_links")
      .select("telegram_chat_id")
      .eq("user_id", profileId)
      .single();

    if (!telegramLink?.telegram_chat_id) {
      console.log(`No telegram link for profile ${profileId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "no_telegram_link" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatId = telegramLink.telegram_chat_id;

    // Gather context and generate markdown content
    console.log(`Generating telegram brief for ${profileId}`);
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("timezone")
      .eq("profile_id", profileId)
      .single();
    const userTimezone = prefs?.timezone || 'America/New_York';
    const context = await gatherUserContext(supabase, profileId, userTimezone);
    const { subject, body } = await generateBriefContent(context, 'markdown');

    // Send via Telegram Bot API with markdown fallback
    const fullMessage = `*${subject}*\n\n${body}`;
    const truncated = fullMessage.substring(0, 4000);

    let sendResult = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "📊 Open Full Brief", url: `${context.appUrl}/dashboard/my-growth-plan` },
            { text: "✅ My Tasks", url: `${context.appUrl}/dashboard/personal-assistant` }
          ]]
        }
      }),
    });

    // Fallback to plain text if markdown fails
    if (!sendResult.ok) {
      const errData = await sendResult.json();
      console.warn("Markdown send failed, retrying plain text:", errData);
      sendResult = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: truncated.replace(/[*_`\[\]()~>#+\-=|{}.!]/g, ''),
          reply_markup: {
            inline_keyboard: [[
              { text: "📊 Open Full Brief", url: `${context.appUrl}/dashboard/my-growth-plan` }
            ]]
          }
        }),
      });
    }

    const telegramResult = await sendResult.json();

    if (!sendResult.ok) {
      console.error("Telegram send failed:", telegramResult);
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }

    // Log delivery
    await supabase.from("email_deliveries").insert({
      profile_id: profileId,
      company_id: null,
      subject,
      body: truncated,
      sent_at: new Date().toISOString(),
      status: 'sent',
      channel: 'telegram',
      resources_included: { telegram_message_id: telegramResult.result?.message_id }
    });

    console.log(`Telegram brief sent to chat ${chatId} for ${profileId}`);
    return new Response(
      JSON.stringify({ success: true, chatId, messageId: telegramResult.result?.message_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-brief-telegram:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
