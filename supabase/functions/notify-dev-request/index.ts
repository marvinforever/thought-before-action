import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DevRequestNotification {
  title: string;
  description: string;
  priority: string;
  userName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, priority, userName }: DevRequestNotification = await req.json();

    // Get super admin emails
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: superAdmins } = await supabase
      .from("profiles")
      .select("email")
      .eq("is_super_admin", true);

    const adminEmails = superAdmins?.map(a => a.email).filter(Boolean) || [];
    
    if (adminEmails.length === 0) {
      console.log("No super admin emails found");
      return new Response(JSON.stringify({ message: "No admins to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const priorityColors: Record<string, string> = {
      low: "#6b7280",
      medium: "#3b82f6",
      high: "#f97316",
      critical: "#dc2626",
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Jericho <notifications@momentumtraining.app>",
        to: adminEmails,
        subject: `[${priority.toUpperCase()}] New Dev Request: ${title}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">New Development Request</h1>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <div style="margin-bottom: 16px;">
                <span style="background: ${priorityColors[priority] || "#6b7280"}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                  ${priority} priority
                </span>
              </div>
              <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px;">${title}</h2>
              <p style="color: #475569; margin: 0 0 20px 0; line-height: 1.6; white-space: pre-wrap;">${description}</p>
              <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                <p style="color: #64748b; margin: 0; font-size: 14px;">
                  <strong>Submitted by:</strong> ${userName}
                </p>
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
                View and manage this request in the Jericho Sales Agent admin panel.
              </p>
            </div>
          </div>
        `,
      }),
    });
    
    const emailResult = await emailResponse.json();

    console.log("Email sent:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-dev-request:", error);
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
