import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ hasAccess: false, reason: "Not authenticated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { requireAdmin, requireManager } = await req.json();

    console.log(`Checking permissions for user ${user.id}: requireAdmin=${requireAdmin}, requireManager=${requireManager}`);

    // Check admin status if required
    if (requireAdmin) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, is_super_admin")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return new Response(
          JSON.stringify({ hasAccess: false, reason: "Error checking permissions" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const hasAdminAccess = profile?.is_admin || profile?.is_super_admin;
      console.log(`Admin check result: ${hasAdminAccess}`);

      return new Response(
        JSON.stringify({ hasAccess: hasAdminAccess }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check manager status if required
    if (requireManager) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["manager", "admin", "super_admin"]);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        return new Response(
          JSON.stringify({ hasAccess: false, reason: "Error checking permissions" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const hasManagerAccess = roles && roles.length > 0;
      console.log(`Manager check result: ${hasManagerAccess}`);

      return new Response(
        JSON.stringify({ hasAccess: hasManagerAccess }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No special requirements - authenticated users have access
    return new Response(
      JSON.stringify({ hasAccess: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-user-permissions:", error);
    return new Response(
      JSON.stringify({ hasAccess: false, reason: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
