import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { gatherUserContext, generateBriefContent, classifyUserStateForProfile } from "../_shared/daily-brief-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, episodeDate, isWelcome, preview = false, testRecipient = null } = await req.json();

    if (!profileId) {
      throw new Error("profileId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const today = episodeDate || new Date().toISOString().split('T')[0];
    const appUrl = `https://askjericho.com`;

    // Get profile (with retry for transient errors)
    let profile: any = null;
    let email: string | null = null;
    for (let i = 0; i < 2; i++) {
      const result = await supabase
        .from("profiles")
        .select("id, email, full_name, company_id")
        .eq("id", profileId)
        .maybeSingle();
      if (result.data?.email) {
        profile = result.data;
        email = profile.email;
        break;
      }
      if (i === 0) await new Promise((r) => setTimeout(r, 200));
    }

    if (!email) {
      const authRes = await supabase.auth.admin.getUserById(profileId);
      email = authRes?.data?.user?.email ?? null;
      console.warn("Profile missing email; falling back to auth email", { profileId, hasAuthEmail: !!email });
    }

    if (!email) {
      throw new Error(`Profile not found or missing email (profileId=${profileId})`);
    }

    const firstName = profile?.full_name?.split(' ')[0] || email.split('@')[0] || 'there';

    // ── Welcome email (unchanged) ──
    if (isWelcome) {
      console.log(`Sending WELCOME email to ${email} (never logged in)`);
      const welcomeSubject = `${firstName}, your growth coach is ready`;
      const welcomeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a1628; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a1628;">
    <div style="padding: 40px 32px 24px 32px; text-align: center;">
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #d4a855;">Jericho</h1>
      <p style="color: #8892a8; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;">YOUR AI GROWTH COACH</p>
    </div>
    <div style="margin: 0 16px; background: linear-gradient(180deg, #132238 0%, #0e1a2d 100%); border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden;">
      <div style="padding: 32px; color: #ffffff; font-size: 16px; line-height: 1.7;">
        <p style="margin: 0 0 20px 0;">Hey ${firstName},</p>
        <p style="margin: 0 0 20px 0;">Your account is set up and ready to change your life.</p>
        <p style="margin: 0 0 20px 0;">I'm Jericho — your AI-powered growth coach. Here's what I can help you with:</p>
        <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #d4a855;">
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Daily Podcasts</strong> — Personalized 5-minute episodes based on your goals</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">90-Day Goals</strong> — Set and track meaningful quarterly targets</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Habit Tracking</strong> — Build the behaviors that drive results</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Skill Development</strong> — Level up your professional capabilities</li>
        </ul>
        <p style="margin: 0 0 20px 0;">Click below to log in and let's get started.</p>
        <p style="margin: 0; color: #d4a855;">Your growth journey starts now.</p>
      </div>
      <div style="padding: 0 32px 32px 32px;">
        <a href="${appUrl}/auth" style="display: block; background: linear-gradient(135deg, #d4a855 0%, #c49545 100%); color: #0a1628; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center;">
          Log In & Get Started
        </a>
      </div>
    </div>
    <div style="padding: 32px; text-align: center;">
      <p style="color: #8892a8; font-size: 13px; margin: 0;">Questions? Just reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

      const rawFrom = Deno.env.get("RESEND_FROM");
      const cleanedFrom = (rawFrom || "").trim().replace(/^"|"$/g, "");
      const isBareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedFrom);
      const fromAddress = cleanedFrom
        ? (isBareEmail ? `Jericho <${cleanedFrom}>` : cleanedFrom)
        : "Jericho <onboarding@resend.dev>";

      const emailResponse = await resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: welcomeSubject,
        html: welcomeHtml,
      });

      const resendError = (emailResponse as any)?.error;
      if (resendError) {
        console.error(`Resend error sending welcome to ${email}:`, resendError);
        return new Response(
          JSON.stringify({ success: false, error: resendError?.message }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("email_deliveries").insert({
        profile_id: profileId,
        company_id: profile?.company_id,
        subject: welcomeSubject,
        body: welcomeHtml,
        sent_at: new Date().toISOString(),
        status: 'sent',
        resources_included: { type: 'welcome', isWelcome: true },
      });

      console.log(`Welcome email sent to ${email}`);
      return new Response(
        JSON.stringify({ success: true, to: email, type: 'welcome' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Regular daily brief ──
    // Get user preferences
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("brief_format, timezone")
      .eq("profile_id", profileId)
      .single();

    const briefFormat = prefs?.brief_format || 'both';
    const userTimezone = prefs?.timezone || 'America/New_York';

    // ── Behavior-aware cadence: dormant users get ≤1 brief / 7 days ──
    // Skip the send entirely when the user is DORMANT and has received any
    // brief in the past 7 days. Preview/test sends bypass this throttle so
    // admins can still inspect output for any user.
    if (!preview && !testRecipient) {
      try {
        const { state } = await classifyUserStateForProfile(supabase, profileId);
        if (state === 'DORMANT') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentDelivery } = await supabase
            .from("email_deliveries")
            .select("sent_at")
            .eq("profile_id", profileId)
            .eq("status", "sent")
            .gte("sent_at", sevenDaysAgo)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recentDelivery) {
            console.log(`[daily-brief-email] Skipping DORMANT user ${profileId} — last brief sent ${recentDelivery.sent_at}`);
            return new Response(
              JSON.stringify({ success: true, skipped: true, reason: "dormant_throttle", lastSentAt: recentDelivery.sent_at }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (stateErr) {
        // Never block the send on a classifier failure — fail open, send the brief.
        console.error("[daily-brief-email] Dormant cadence check failed (sending anyway):", stateErr);
      }
    }

    // Use shared module for context gathering + content generation
    const context = await gatherUserContext(supabase, profileId, userTimezone);

    if (!context.episodeTitle || context.episodeTitle === "Your Daily Growth Brief") {
      // Check if episode actually exists
      const { data: ep } = await supabase
        .from("podcast_episodes")
        .select("id")
        .eq("profile_id", profileId)
        .eq("episode_date", today)
        .maybeSingle();
      if (!ep) {
        throw new Error(`No podcast episode found for ${today}`);
      }
    }

    console.log("Generating daily brief email for", firstName, "via shared module");

    const { subject, body: personalizedBody } = await generateBriefContent(context, 'html');

    // Build stats for footer
    const totalHabitCompletions = context.habits.reduce((sum, h) => sum + h.completionsThisWeek, 0);

    // Wrap in Jericho-branded email template
    const dashboardUrl = `${appUrl}/dashboard/my-growth-plan`;
    const emailHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your Daily Brief from Jericho</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    [data-ogsc] body, [data-ogsb] body { background-color: #0a1628 !important; }
    @media (prefers-color-scheme: dark) {
      body, .body-bg { background-color: #0a1628 !important; }
      .email-text { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-link { color: #d4a855 !important; }
      .email-muted { color: #8892a8 !important; }
      .email-card { background-color: #132238 !important; }
      u + .body .email-text { color: #ffffff !important; }
    }
  </style>
</head>
<body class="body-bg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a1628; margin: 0; padding: 0; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a1628; color: #ffffff;" class="body-bg">
    
    <!-- Header -->
    <div style="padding: 40px 32px 24px 32px; text-align: center;">
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #d4a855;" class="email-link">Jericho</h1>
      <p style="color: #8892a8; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;" class="email-muted">${formatDate(new Date()).toUpperCase()}</p>
    </div>

    <!-- Main content card -->
    <div style="margin: 0 16px; background: #132238; border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden;" class="email-card">
      <div style="padding: 32px; color: #ffffff; font-size: 16px; line-height: 1.7;" class="email-text">
        <div style="color: #ffffff;" class="email-text">
          ${personalizedBody
            .replace(/\s*style="[^"]*"/g, '')
            .replace(/<p([^>]*)>/g, '<p$1 style="color: #ffffff; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<strong([^>]*)>/g, '<strong$1 style="color: #ffffff;" class="email-text">')
            .replace(/<li([^>]*)>/g, '<li$1 style="color: #ffffff; margin-bottom: 8px;" class="email-text">')
            .replace(/<span([^>]*)>/g, '<span$1 style="color: #ffffff;" class="email-text">')
            .replace(/<div([^>]*)>/g, '<div$1 style="color: #ffffff;" class="email-text">')
            .replace(/<ul([^>]*)>/g, '<ul$1 style="color: #ffffff; padding-left: 20px; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<ol([^>]*)>/g, '<ol$1 style="color: #ffffff; padding-left: 20px; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<h1([^>]*)>/g, '<h1$1 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;" class="email-heading">')
            .replace(/<h2([^>]*)>/g, '<h2$1 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;" class="email-heading">')
            .replace(/<h3([^>]*)>/g, '<h3$1 style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;" class="email-heading">')
            .replace(/<a([^>]*?)(?:\s*style="[^"]*")?([^>]*)>/g, '<a$1$2 style="color: #d4a855; text-decoration: underline;" class="email-link">')
          }
        </div>
      </div>

      <!-- Listen button -->
      ${briefFormat !== 'text' ? `
      <div style="padding: 0 32px 32px 32px;">
        <a href="${dashboardUrl}" style="display: block; background: linear-gradient(135deg, #1e3a5f 0%, #2a4a6f 50%, #d4a855 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
          🎧 Listen to Today's Episode
        </a>
      </div>
      ` : ''}

      <!-- Stats bar -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #1e3a5f; border-collapse: collapse;">
        <tr>
          ${context.capabilityScore !== null ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f;">
            <div style="color: #d4a855; font-size: 24px; font-weight: 700;">${context.capabilityScore}%</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Capability Score</div>
          </td>
          ` : ''}
          ${context.ninetyDayTargets.length > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f;">
            <div style="color: #d4a855; font-size: 24px; font-weight: 700;">${context.ninetyDayTargets.length}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">90-Day Goals</div>
          </td>
          ` : ''}
          ${context.totalBenchmarks > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center;">
            <div style="color: #22c55e; font-size: 24px; font-weight: 700;">${context.completedBenchmarks}/${context.totalBenchmarks}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Benchmarks</div>
          </td>
          ` : ''}
        </tr>
      </table>
    </div>

    <!-- Quick Reflect CTA -->
    <div style="margin: 16px 16px 0 16px; background: linear-gradient(180deg, #1a2f47 0%, #132238 100%); border-radius: 16px; border: 1px solid #2a4a6f; padding: 24px 32px; text-align: center;">
      <p style="color: #d4a855; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Quick Reflect</p>
      <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hit reply and answer the reflection question above — one sentence is plenty.</p>
      <p style="color: #8892a8; font-size: 13px; margin: 0;">Just hit reply and tell me. I read every response.</p>
    </div>

    <!-- Footer -->
    <div style="padding: 32px; text-align: center;">
      <p style="color: #8892a8; font-size: 13px; margin: 0 0 16px 0;">
        Reply to this email anytime — I read every message.
      </p>
      <a href="${appUrl}/dashboard/settings" style="color: #d4a855; font-size: 13px; text-decoration: none;">Update Preferences</a>
    </div>
  </div>
</body>
</html>`;

    if (preview) {
      return new Response(
        JSON.stringify({ success: true, preview: true, html: emailHtml, subject }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email
    const rawFrom = Deno.env.get("RESEND_FROM");
    const cleanedFrom = (rawFrom || "").trim().replace(/^"|"$/g, "");
    const isBareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedFrom);
    const fromAddress = cleanedFrom
      ? (isBareEmail ? `Jericho <${cleanedFrom}>` : cleanedFrom)
      : "Jericho <onboarding@resend.dev>";

    const recipientEmail = testRecipient || email;
    console.log("Sending email from:", fromAddress, "to:", recipientEmail);

    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject: subject,
      html: emailHtml,
      reply_to: 'jericho@sender.askjericho.com',
      headers: {
        'List-Unsubscribe': `<${appUrl}>`,
        'X-Entity-Ref-ID': `jericho-daily-${profileId}-${today}`,
      },
    });

    const resendError = (emailResponse as any)?.error;
    if (resendError) {
      console.error(`Resend error sending to ${email}:`, resendError);
      await supabase.from("email_deliveries").insert({
        profile_id: profileId,
        company_id: profile?.company_id,
        subject: subject,
        body: emailHtml,
        sent_at: new Date().toISOString(),
        status: 'failed',
        resources_included: { episodeDate: today, briefFormat, resendError },
      });
      return new Response(
        JSON.stringify({ success: false, to: email, subject, error: resendError?.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Daily brief email sent to ${recipientEmail}:`, emailResponse);

    await supabase.from("email_deliveries").insert({
      profile_id: profileId,
      company_id: profile?.company_id,
      subject: subject,
      body: emailHtml,
      sent_at: new Date().toISOString(),
      status: 'sent',
      resources_included: {
        episodeDate: today,
        briefFormat,
        aiGenerated: true,
        sharedModule: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: (emailResponse as any)?.data?.id || (emailResponse as any)?.id || 'sent',
        to: recipientEmail,
        subject,
        from: fromAddress,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-brief-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
