import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecognitionNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  giverName: string;
  title: string;
  description: string;
  impactLevel: string;
  category?: string;
  capabilityName?: string;
  goalText?: string;
  isQuickKudos?: boolean;
}

const getImpactEmoji = (level: string): string => {
  switch (level) {
    case "exceptional": return "🏆";
    case "significant": return "🌟";
    default: return "⭐";
  }
};

const getImpactLabel = (level: string): string => {
  switch (level) {
    case "exceptional": return "Exceptional Achievement";
    case "significant": return "Significant Contribution";
    default: return "Great Work";
  }
};

const getImpactColor = (level: string): string => {
  switch (level) {
    case "exceptional": return "#FFD700";
    case "significant": return "#C0C0C0";
    default: return "#CD7F32";
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const {
      recipientEmail,
      recipientName,
      giverName,
      title,
      description,
      impactLevel,
      category,
      capabilityName,
      goalText,
      isQuickKudos,
    }: RecognitionNotificationRequest = await req.json();

    console.log(`Sending recognition notification to ${recipientEmail}`);

    const firstName = recipientName.split(" ")[0];
    const impactEmoji = getImpactEmoji(impactLevel);
    const impactLabel = getImpactLabel(impactLevel);
    const accentColor = getImpactColor(impactLevel);

    const appUrl = Deno.env.get("APP_URL") || "https://askjericho.com";

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Recognized!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Celebration Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div style="font-size: 64px; line-height: 1;">${impactEmoji}</div>
              <h1 style="margin: 20px 0 8px 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                You've Been Recognized!
              </h1>
              <p style="margin: 0; font-size: 16px; color: #94A3B8;">
                ${giverName} celebrated your work
              </p>
            </td>
          </tr>

          <!-- Recognition Card -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
                <tr>
                  <td style="padding: 28px;">
                    
                    <!-- Impact Badge -->
                    <div style="margin-bottom: 16px;">
                      <span style="display: inline-block; padding: 6px 14px; background: linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}11 100%); border: 1px solid ${accentColor}44; border-radius: 20px; font-size: 12px; font-weight: 600; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${impactLabel}
                      </span>
                    </div>

                    <!-- Title -->
                    <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                      ${title}
                    </h2>

                    <!-- Description -->
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #CBD5E1;">
                      "${description}"
                    </p>

                    <!-- From Section -->
                    <div style="display: flex; align-items: center; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding-right: 12px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                              <span style="color: #FFFFFF; font-size: 16px; font-weight: 600; line-height: 40px; text-align: center; display: block; width: 100%;">${giverName.charAt(0).toUpperCase()}</span>
                            </div>
                          </td>
                          <td>
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #FFFFFF;">From ${giverName}</p>
                            <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748B;">Your ${isQuickKudos ? 'colleague' : 'manager'}</p>
                          </td>
                        </tr>
                      </table>
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${category || capabilityName || goalText ? `
          <!-- Tags Section -->
          <tr>
            <td style="padding: 20px 24px 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    ${category ? `<span style="display: inline-block; margin: 0 6px 8px 0; padding: 6px 12px; background: rgba(99, 102, 241, 0.15); border-radius: 8px; font-size: 13px; color: #A5B4FC;">🏷️ ${category}</span>` : ''}
                    ${capabilityName ? `<span style="display: inline-block; margin: 0 6px 8px 0; padding: 6px 12px; background: rgba(34, 197, 94, 0.15); border-radius: 8px; font-size: 13px; color: #86EFAC;">🎯 ${capabilityName}</span>` : ''}
                    ${goalText ? `<span style="display: inline-block; margin: 0 6px 8px 0; padding: 6px 12px; background: rgba(251, 191, 36, 0.15); border-radius: 8px; font-size: 13px; color: #FCD34D;">⭐ Linked to your goal</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Motivational Message -->
          <tr>
            <td style="padding: 24px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0; font-size: 15px; color: #C7D2FE; line-height: 1.5;">
                      Your hard work doesn't go unnoticed, ${firstName}. <br/>
                      <strong style="color: #FFFFFF;">Keep being extraordinary!</strong> 🚀
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="${appUrl}/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); border-radius: 12px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);">
                View Your Recognition
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #FFFFFF;">Jericho</p>
                    <p style="margin: 0; font-size: 13px; color: #64748B;">
                      Your AI-powered growth partner
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Sub-footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td style="padding: 24px 20px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475569;">
                This recognition was sent through Jericho • <a href="${appUrl}" style="color: #6366F1; text-decoration: none;">askjericho.com</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const subjectLine = isQuickKudos 
      ? `👏 ${giverName} just sent you kudos!`
      : `${impactEmoji} You've been recognized: ${title}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [recipientEmail],
        subject: subjectLine,
        html: htmlEmail,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Recognition notification sent successfully:", result);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error sending recognition notification:", error);
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
