import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      employeeId, 
      employeeName,
      managerName,
      capabilityName, 
      previousLevel, 
      newLevel,
      reason 
    } = await req.json();

    // Get employee's email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", employeeId)
      .single();

    if (!profile?.email) {
      throw new Error("Employee email not found");
    }

    // Construct message about the change
    let changeDetails = `${managerName} has updated your capability: ${capabilityName}\n\n`;
    
    if (previousLevel !== newLevel) {
      changeDetails += `Level changed from ${previousLevel} to ${newLevel}\n`;
    }
    
    if (reason) {
      changeDetails += `\nReason: ${reason}`;
    }

    console.log("Capability change notification:", {
      employee: employeeName,
      manager: managerName,
      capability: capabilityName,
      changes: { previousLevel, newLevel }
    });

    // Send email notification
    const emailSubject = previousLevel !== newLevel 
      ? `🎉 Capability Level Upgrade Approved!`
      : `Capability Update: ${capabilityName}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="padding: 40px;">
      <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0 0 24px 0;">🎉 Capability Level Upgrade Approved!</h1>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi ${employeeName},</p>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        ${managerName} has approved your capability level upgrade request!
      </p>
      
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #667eea;">
        <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
          ${capabilityName}
        </h3>
        
        ${previousLevel !== newLevel ? `
        <div style="margin-bottom: 8px;">
          <span style="background: #e2e8f0; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: #718096; text-transform: capitalize; font-size: 14px;">
            ${previousLevel}
          </span>
          <span style="color: #667eea; font-size: 18px; margin: 0 8px;">→</span>
          <span style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); padding: 6px 12px; border-radius: 4px; font-weight: 600; color: white; text-transform: capitalize; font-size: 14px;">
            ${newLevel}
          </span>
        </div>
        ` : ''}
      </div>
      
      ${reason ? `
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <h3 style="color: #2d3748; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">📝 Manager's Feedback</h3>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0;">
          ${reason}
        </p>
      </div>
      ` : ''}
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Keep up the excellent work! Your dedication to growth and development is truly impressive.
      </p>
      
      <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">Keep growing,<br><strong>Jericho</strong></p>
      <p style="color: #718096; font-size: 13px; line-height: 1.5; margin: 16px 0 20px 0; font-style: italic;">
        <strong>P.S.</strong> View your updated capabilities in your Growth Plan—I'm here if you need help!
      </p>
      
      <div style="margin-top: 20px;">
        <a href="https://www.askjericho.com" style="display: inline-block; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">View My Growth Plan</a>
      </div>
    </div>
    
    <div style="background-color: #f7fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #a0aec0; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} The Momentum Company • <a href="https://www.askjericho.com" style="color: #667eea; text-decoration: none;">askjericho.com</a>
      </p>
      <p style="color: #a0aec0; font-size: 11px; margin: 8px 0 0 0;">
        Questions? Reply to this email or reach out to <a href="mailto:jericho@askjericho.com" style="color: #667eea; text-decoration: none;">jericho@askjericho.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const emailResult = await resend.emails.send({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [profile.email],
        subject: emailSubject,
        html: emailHtml,
      });

      console.log("Email sent successfully:", emailResult);
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      // Don't fail the whole request if email fails
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification sent",
        details: changeDetails
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
