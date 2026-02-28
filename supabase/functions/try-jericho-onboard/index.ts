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
    const { email, fullName, role, phone, company, companyId, challenge, password } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log(`[try-jericho-onboard] Creating account for ${email}`);

    // 1. Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.code === "email_exists") {
        throw new Error("An account with this email already exists. Try logging in instead.");
      }
      throw authError;
    }

    const userId = authUser.user.id;
    console.log(`[try-jericho-onboard] Auth user created: ${userId}`);

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

    // 4. Store challenge context for Jericho to reference later
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

    // 5. Send welcome email
    const loginUrl = "https://askjericho.com/auth";
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
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
    <p style="margin:16px 0 0;font-size:13px;color:#6B7280;font-style:italic;">Change your password after first login.</p>
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
