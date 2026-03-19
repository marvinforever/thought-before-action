import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, role, phone, company, companyId, challenge, password: providedPassword, diagnosticData } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Auto-generate a secure 16-character password if none provided
    const password = providedPassword || Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%"[b % 67])
      .join('');

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log(`[try-jericho-onboard] Processing account for ${email}`);

    // 1. Try to create auth user — if they already exist, look them up instead
    let userId: string;
    let isNewUser = false;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.code === "email_exists") {
        console.log(`[try-jericho-onboard] User ${email} already exists, looking up profile`);
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase().trim()
        );
        if (!existingUser) {
          throw new Error("User exists in auth but could not be found — please contact support.");
        }
        userId = existingUser.id;
        console.log(`[try-jericho-onboard] Found existing user: ${userId}`);
      } else {
        throw authError;
      }
    } else {
      userId = authUser.user.id;
      isNewUser = true;
      console.log(`[try-jericho-onboard] New user created: ${userId}`);
    }

    // 2. Resolve or create company
    let targetCompanyId = companyId || null;

    if (!targetCompanyId && company) {
      // Check if company exists
      const { data: existing } = await supabaseAdmin
        .from("companies")
        .select("id")
        .ilike("name", company.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        targetCompanyId = existing[0].id;
      } else {
        // Create a new company
        const { data: newCompany, error: companyError } = await supabaseAdmin
          .from("companies")
          .insert({ name: company.trim() })
          .select("id")
          .single();

        if (companyError) {
          console.error("Company creation error:", companyError);
        } else {
          targetCompanyId = newCompany.id;
          console.log(`[try-jericho-onboard] Created company: ${targetCompanyId}`);
        }
      }
    }

    // 3. Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: email.toLowerCase().trim(),
        full_name: fullName,
        role: role || null,
        phone: phone || null,
        company_id: targetCompanyId,
        is_admin: false,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Profile error:", profileError);
    }

    // 4. Store challenge context for Jericho to reference later + preload into user_active_context
    if (challenge) {
      try {
        await supabaseAdmin.from("conversations").insert({
          profile_id: userId,
          channel: "try-page",
          summary: `User's initial challenge: ${challenge}`,
        });
      } catch (e) {
        console.error("Conversation seed error:", e);
      }
    }

    // 4b. Preload diagnostic data into user_active_context for /try → coaching continuity
    try {
      const onboardingData = diagnosticData
        ? {
            ...diagnosticData,
            source: "try-page",
            company_name: company || null,
          }
        : {
            role_org: role || null,
            challenge: challenge || null,
            source: "try-page",
            company_name: company || null,
          };

      const hasFullDiagnostic = diagnosticData && diagnosticData.engagement_score;

      await supabaseAdmin.from("user_active_context").upsert({
        profile_id: userId,
        company_id: targetCompanyId,
        onboarding_path: "try-page",
        onboarding_step: hasFullDiagnostic ? 13 : 0,
        onboarding_complete: !!hasFullDiagnostic,
        onboarding_data: onboardingData,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" });

      console.log(`[try-jericho-onboard] Context saved, complete=${!!hasFullDiagnostic}`);
    } catch (e) {
      console.error("Active context preload error:", e);
    }

    // 4c. Write coaching insights from diagnostic/playbook data
    if (diagnosticData) {
      try {
        const insights: string[] = [];

        // Legacy fields
        const eng = diagnosticData.engagement_score;
        const growth = diagnosticData.career_growth_score;
        const clarity = diagnosticData.role_clarity_score;

        if (eng && eng <= 4) insights.push(`Low engagement (${eng}/10) — may need motivation or role alignment work.`);
        if (growth && growth <= 4) insights.push(`Dissatisfied with career growth (${growth}/10) — prioritize career pathing.`);
        if (clarity && clarity <= 4) insights.push(`Low role clarity (${clarity}/10) — needs success metrics defined.`);
        if (diagnosticData.obstacles) insights.push(`Self-reported obstacles: ${String(diagnosticData.obstacles).substring(0, 200)}`);
        if (diagnosticData.natural_strengths) insights.push(`Self-reported strengths: ${String(diagnosticData.natural_strengths).substring(0, 200)}`);

        // New Playbook fields
        const severity = diagnosticData.challenge_severity;
        const energy = diagnosticData.energy_score;
        const confidence = diagnosticData.confidence_score;
        const utilization = diagnosticData.strength_utilization;
        const satisfaction = diagnosticData.satisfaction;
        const orgSupport = diagnosticData.org_support;
        const barrier = diagnosticData.learning_barrier;

        if (severity && severity >= 7) insights.push(`High challenge severity (${severity}/10) — primary challenge: ${diagnosticData.primary_challenge || 'unspecified'}.`);
        if (energy && energy <= 4) insights.push(`Low energy (${energy}/10) — burnout risk detected.`);
        if (confidence && confidence <= 4) insights.push(`Low confidence in achieving goals (${confidence}/10) — needs support and quick wins.`);
        if (utilization && utilization <= 4) insights.push(`Low strength utilization (${utilization}/10) — role may not leverage core strengths.`);
        if (satisfaction === 'b') insights.push(`Work has gotten stale — may need role evolution or new challenges.`);
        if (satisfaction === 'd') insights.push(`Seriously considering a change — retention risk.`);
        if (orgSupport === false) insights.push(`Reports company does NOT invest in growth — may feel unsupported.`);
        if (barrier === 'a') insights.push(`Biggest development barrier: time — needs micro-learning approach.`);
        if (barrier === 'c') insights.push(`Biggest development barrier: energy — learning competes with burnout.`);
        if (diagnosticData.strengths) insights.push(`Self-reported strengths: ${String(diagnosticData.strengths).substring(0, 200)}`);
        if (diagnosticData.skill_gap) insights.push(`Identified skill gap: ${String(diagnosticData.skill_gap).substring(0, 200)}`);
        if (diagnosticData.twelve_month_vision) insights.push(`12-month vision: ${String(diagnosticData.twelve_month_vision).substring(0, 200)}`);
        if (diagnosticData.quick_win) insights.push(`Quick win target: ${String(diagnosticData.quick_win).substring(0, 200)}`);

        for (const insight of insights) {
          await supabaseAdmin.from("coaching_insights").insert({
            profile_id: userId,
            company_id: targetCompanyId,
            insight_type: "onboarding_observation",
            insight_text: insight,
            confidence_level: "high",
            is_active: true,
          });
        }
        console.log(`[try-jericho-onboard] Wrote ${insights.length} coaching insights`);
      } catch (e) {
        console.error("Coaching insights error:", e);
      }
    }

    // 5. Send welcome email
    const loginUrl = "https://askjericho.com/auth";
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY && isNewUser) {
        const firstName = fullName?.split(" ")[0] || "there";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Jericho <jericho@sender.askjericho.com>",
            to: [email],
            subject: `Welcome to Jericho, ${firstName}! 🚀`,
            html: `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" style="background-color:#0F1419;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;">
  <table role="presentation"><tr>
    <td style="background:linear-gradient(135deg,#E5A530,#F5C563);width:48px;height:48px;border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-size:24px;font-weight:bold;color:#0F1419;">J</span>
    </td>
    <td style="padding-left:12px;"><span style="font-size:28px;font-weight:700;color:#FFF;">Jericho</span></td>
  </tr></table>
</td></tr>
<tr><td>
<table role="presentation" width="100%" style="background:linear-gradient(180deg,#1A2332,#151D2B);border-radius:16px;border:1px solid rgba(229,165,48,0.2);">
<tr><td style="padding:40px 40px 24px;">
  <h1 style="margin:0;font-size:28px;font-weight:700;color:#FFF;">Welcome aboard, ${firstName}! 🎉</h1>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <p style="margin:0;font-size:16px;line-height:1.7;color:#9CA3AF;">Your Jericho account is ready. I already know a bit about your goals — let's pick up where we left off.</p>
</td></tr>
<tr><td style="padding:0 40px 32px;">
  <table role="presentation" width="100%" style="background:rgba(59,130,246,0.08);border-radius:12px;border:1px solid rgba(59,130,246,0.25);">
  <tr><td style="padding:24px;">
    <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#60A5FA;text-transform:uppercase;letter-spacing:1px;">🔐 Your Login</p>
    <p style="margin:0;padding:10px 0;color:#FFF;font-size:14px;">Email: <strong>${email}</strong></p>
    <p style="margin:0;padding:10px 0;color:#FFF;font-size:14px;">Password: <code style="color:#60A5FA;background:rgba(59,130,246,0.15);padding:6px 12px;border-radius:6px;font-weight:600;">${password}</code></p>
    <p style="margin:16px 0 0;font-size:13px;color:#F59E0B;font-weight:600;">⚠️ Please change your password on first login.</p>
  </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 40px 40px;" align="center">
  <table role="presentation"><tr>
    <td style="border-radius:10px;background:linear-gradient(135deg,#E5A530,#D4942A);box-shadow:0 4px 14px rgba(229,165,48,0.35);">
      <a href="${loginUrl}" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:600;color:#0F1419;text-decoration:none;border-radius:10px;">Log In to Jericho →</a>
    </td>
  </tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:32px 20px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#4B5563;">Powered by The Momentum Company</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
          }),
        });
        console.log(`[try-jericho-onboard] Welcome email sent to ${email}`);
      }
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
      // Non-fatal
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[try-jericho-onboard] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
