import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  password: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, password, loginUrl }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to ${email} (${fullName})`);

    const firstName = fullName?.split(' ')[0] || 'there';

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [email],
        subject: `Welcome to Jericho, ${firstName}! 🚀`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Jericho</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0F1419; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0F1419;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%;">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #E5A530 0%, #F5C563 100%); width: 48px; height: 48px; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 24px; font-weight: bold; color: #0F1419;">J</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Jericho</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(180deg, #1A2332 0%, #151D2B 100%); border-radius: 16px; border: 1px solid rgba(229, 165, 48, 0.2);">
                
                <!-- Welcome Header -->
                <tr>
                  <td style="padding: 40px 40px 24px 40px;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                      Welcome to Jericho, ${firstName}! 🎉
                    </h1>
                  </td>
                </tr>

                <!-- Intro Text -->
                <tr>
                  <td style="padding: 0 40px 24px 40px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #9CA3AF;">
                      Your account is ready! Jericho is your personal AI growth companion — helping you develop the capabilities that matter most for your role and career goals.
                    </p>
                  </td>
                </tr>

                <!-- Feature Highlights -->
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 20px; background-color: rgba(229, 165, 48, 0.08); border-radius: 12px; border-left: 3px solid #E5A530;">
                          <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #E5A530; text-transform: uppercase; letter-spacing: 1px;">
                            What you'll get
                          </p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="padding: 8px 0; color: #D1D5DB; font-size: 15px;">
                                <span style="color: #E5A530; margin-right: 10px;">✦</span> Personalized daily growth podcasts
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #D1D5DB; font-size: 15px;">
                                <span style="color: #E5A530; margin-right: 10px;">✦</span> AI coaching with Jericho, your growth guide
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #D1D5DB; font-size: 15px;">
                                <span style="color: #E5A530; margin-right: 10px;">✦</span> Curated learning resources tailored to you
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #D1D5DB; font-size: 15px;">
                                <span style="color: #E5A530; margin-right: 10px;">✦</span> Track your capability development
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Credentials Box -->
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(240, 165, 0, 0.06); border-radius: 12px; border: 1px solid rgba(240, 165, 0, 0.25);">
                      <tr>
                        <td style="padding: 24px;">
                          <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #F0A500; text-transform: uppercase; letter-spacing: 1px;">
                            🔐 Your Login Credentials
                          </p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="padding: 10px 0;">
                                <span style="color: #9CA3AF; font-size: 14px;">Email:</span>
                                <span style="color: #FFFFFF; font-size: 14px; font-weight: 500; margin-left: 12px;">${email}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0;">
                                <span style="color: #9CA3AF; font-size: 14px;">Temporary Password:</span>
                                <code style="color: #F0A500; font-size: 15px; font-weight: 600; margin-left: 12px; background: rgba(240, 165, 0, 0.15); padding: 6px 12px; border-radius: 6px; letter-spacing: 0.5px;">${password}</code>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 16px 0 0 0; font-size: 13px; color: #6B7280; font-style: italic;">
                            Please change your password after your first login.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Getting Started Steps -->
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;">
                      📋 Getting Started
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 10px 0; color: #9CA3AF; font-size: 15px;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(229, 165, 48, 0.2); border-radius: 50%; text-align: center; line-height: 24px; color: #E5A530; font-size: 13px; font-weight: 600; margin-right: 12px;">1</span>
                          Click the button below to log in
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #9CA3AF; font-size: 15px;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(229, 165, 48, 0.2); border-radius: 50%; text-align: center; line-height: 24px; color: #E5A530; font-size: 13px; font-weight: 600; margin-right: 12px;">2</span>
                          Change your password for security
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #9CA3AF; font-size: 15px;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(229, 165, 48, 0.2); border-radius: 50%; text-align: center; line-height: 24px; color: #E5A530; font-size: 13px; font-weight: 600; margin-right: 12px;">3</span>
                          Complete your onboarding checklist
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #9CA3AF; font-size: 15px;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(229, 165, 48, 0.2); border-radius: 50%; text-align: center; line-height: 24px; color: #E5A530; font-size: 13px; font-weight: 600; margin-right: 12px;">4</span>
                          Meet Jericho, your AI growth coach!
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;" align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius: 10px; background: linear-gradient(135deg, #E5A530 0%, #D4942A 100%); box-shadow: 0 4px 14px rgba(229, 165, 48, 0.35);">
                          <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 600; color: #0F1419; text-decoration: none; border-radius: 10px;">
                            Log In to Jericho →
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0 0; font-size: 12px; color: #6B7280;">
                      or copy this link: <a href="${loginUrl}" style="color: #E5A530; text-decoration: underline;">${loginUrl}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6B7280;">
                Powered by <span style="color: #E5A530; font-weight: 600;">The Momentum Company</span>
              </p>
              <p style="margin: 0; font-size: 12px; color: #4B5563;">
                Questions? Reach out to your administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    const emailData = await emailResponse.json();
    console.log("Welcome email sent successfully:", emailData);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
