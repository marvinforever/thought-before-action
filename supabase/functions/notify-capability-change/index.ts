import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      previousPriority,
      newPriority,
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
    
    if (previousPriority !== newPriority) {
      changeDetails += `Priority changed from ${previousPriority} to ${newPriority}\n`;
    }
    
    if (reason) {
      changeDetails += `\nReason: ${reason}`;
    }

    console.log("Capability change notification:", {
      employee: employeeName,
      manager: managerName,
      capability: capabilityName,
      changes: { previousLevel, newLevel, previousPriority, newPriority }
    });

    // TODO: In production, integrate with actual notification service (email/SMS)
    // For now, we log the notification
    
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
