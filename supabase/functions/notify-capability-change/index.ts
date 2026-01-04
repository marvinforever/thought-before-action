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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Great News!</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hi ${employeeName},
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
            ${managerName} has approved your capability level upgrade request!
          </p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #667eea;">
            <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #111827;">
              ${capabilityName}
            </h2>
            
            ${previousLevel !== newLevel ? `
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="background: #e5e7eb; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: #6b7280; text-transform: capitalize;">
                  ${previousLevel}
                </span>
                <span style="color: #667eea; font-size: 20px;">→</span>
                <span style="background: #667eea; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: white; text-transform: capitalize;">
                  ${newLevel}
                </span>
              </div>
            ` : ''}
          </div>
          
          ${reason ? `
            <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #111827;">Manager's Feedback:</h3>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                ${reason}
              </p>
            </div>
          ` : ''}
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 10px;">
            Keep up the excellent work! Your dedication to growth and development is truly impressive.
          </p>
          
          <p style="font-size: 14px; color: #6b7280; margin: 30px 0 0 0;">
            You can view your updated capabilities in your Growth Plan.
          </p>
        </div>
        
        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated notification from your Growth Management System
          </p>
        </div>
      </div>
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
