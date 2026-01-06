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

    const { employeeId, capabilities } = await req.json();

    if (!employeeId || !capabilities || capabilities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No capabilities to notify about" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notifying manager about ${capabilities.length} capabilities marked not relevant by ${employeeId}`);

    // Get employee info
    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name, email, company_id")
      .eq("id", employeeId)
      .single();

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Find the employee's manager
    const { data: managerAssignment } = await supabase
      .from("manager_assignments")
      .select("manager_id, profiles!manager_assignments_manager_id_fkey(id, full_name, email)")
      .eq("employee_id", employeeId)
      .single();

    if (!managerAssignment?.profiles) {
      console.log("No manager found for employee, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No manager assigned" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const manager = managerAssignment.profiles as any;

    // Build capability list
    const capabilityList = capabilities.map((c: any) => 
      `<li style="margin-bottom: 12px;">
        <strong>${c.capabilityName}</strong>
        ${c.reason ? `<br><span style="color: #718096; font-size: 14px;">Reason: ${c.reason}</span>` : ''}
      </li>`
    ).join('');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 32px 40px; border-radius: 8px 8px 0 0;">
      <h1 style="color: #f5a623; font-size: 22px; font-weight: bold; margin: 0;">🔔 Capability Review Needed</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #1e3a5f; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi ${manager.full_name},</p>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        <strong>${employee.full_name}</strong> has marked the following ${capabilities.length === 1 ? 'capability' : 'capabilities'} as <strong>not relevant</strong> to their role during their self-assessment:
      </p>
      
      <div style="background-color: #fef9e7; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #f5a623;">
        <ul style="margin: 0; padding-left: 20px; color: #1e3a5f;">
          ${capabilityList}
        </ul>
      </div>
      
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <h3 style="color: #1e3a5f; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">📋 What You Can Do</h3>
        <ul style="color: #4a5568; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Review whether these capabilities should be adjusted or removed from their profile</li>
          <li>Discuss with ${employee.full_name.split(' ')[0]} in your next 1-on-1 to understand their perspective</li>
          <li>Update their capabilities in the Employees section if changes are warranted</li>
        </ul>
      </div>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Keeping capabilities aligned with actual role responsibilities ensures ${employee.full_name.split(' ')[0]} gets the most relevant learning resources and development support.
      </p>
      
      <div style="margin-top: 20px;">
        <a href="https://www.askjericho.com/dashboard/employees" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); color: #f5a623; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">Review Capabilities</a>
      </div>
    </div>
    
    <div style="background-color: #1e3a5f; padding: 24px 40px; border-radius: 0 0 8px 8px; text-align: center;">
      <p style="color: #a0aec0; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} The Momentum Company • <a href="https://www.askjericho.com" style="color: #f5a623; text-decoration: none;">askjericho.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const emailResult = await resend.emails.send({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [manager.email],
        subject: `${employee.full_name} flagged ${capabilities.length} ${capabilities.length === 1 ? 'capability' : 'capabilities'} as not relevant`,
        html: emailHtml,
      });

      console.log("Manager notification email sent:", emailResult);
    } catch (emailError: any) {
      console.error("Error sending manager notification:", emailError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Manager notified",
        managerId: manager.id,
        managerEmail: manager.email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in notify-capability-not-relevant:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});