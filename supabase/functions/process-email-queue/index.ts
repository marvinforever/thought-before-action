import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const utcNow = now.toISOString();

    console.log(`Processing email queue at ${utcNow}`);

    // Fetch all users with email preferences
    const { data: preferences, error: prefError } = await supabase
      .from("email_preferences")
      .select(`
        *,
        profile:profiles(id, email, full_name, company_id)
      `)
      .eq("email_enabled", true);

    if (prefError) {
      throw new Error(`Failed to fetch preferences: ${prefError.message}`);
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users with email enabled");
      return new Response(
        JSON.stringify({ message: "No users to process" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const eligibleUsers: any[] = [];

    for (const pref of preferences) {
      // Get current time in user's timezone (default to America/New_York if not set)
      const userTimezone = pref.timezone || 'America/New_York';
      const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const currentHourInUserTz = userLocalTime.getHours();
      const currentDayInUserTz = userLocalTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        timeZone: userTimezone 
      });
      
      // Parse preferred time (format: HH:MM:SS)
      const [prefHour] = pref.preferred_time.split(':').map(Number);
      
      console.log(`User ${pref.profile?.email}: timezone=${userTimezone}, localHour=${currentHourInUserTz}, prefHour=${prefHour}, frequency=${pref.frequency}`);
      
      // Check if it's time to send based on frequency
      if (pref.frequency === 'daily') {
        // For daily, check if current hour in USER'S TIMEZONE matches preferred hour
        if (currentHourInUserTz === prefHour) {
          // Check if already sent today (using UTC for database comparison)
          const todayStart = new Date(now);
          todayStart.setUTCHours(0, 0, 0, 0);
          
          const { data: todayEmails } = await supabase
            .from("email_deliveries")
            .select("id")
            .eq("profile_id", pref.profile_id)
            .gte("sent_at", todayStart.toISOString())
            .limit(1);

          if (!todayEmails || todayEmails.length === 0) {
            console.log(`Eligible: ${pref.profile?.email} - matched daily at ${currentHourInUserTz}:00 ${userTimezone}`);
            eligibleUsers.push(pref.profile);
          } else {
            console.log(`Skipping ${pref.profile?.email} - already sent today`);
          }
        }
      } else if (pref.frequency === 'weekly') {
        // For weekly, check if current day AND hour in USER'S TIMEZONE match preferences
        if (currentDayInUserTz.toLowerCase() === pref.preferred_day?.toLowerCase() && currentHourInUserTz === prefHour) {
          // Check if already sent this week
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setUTCHours(0, 0, 0, 0);

          const { data: weekEmails } = await supabase
            .from("email_deliveries")
            .select("id")
            .eq("profile_id", pref.profile_id)
            .gte("sent_at", weekStart.toISOString())
            .limit(1);

          if (!weekEmails || weekEmails.length === 0) {
            console.log(`Eligible: ${pref.profile?.email} - matched weekly on ${currentDayInUserTz} at ${currentHourInUserTz}:00 ${userTimezone}`);
            eligibleUsers.push(pref.profile);
          } else {
            console.log(`Skipping ${pref.profile?.email} - already sent this week`);
          }
        }
      }
    }

    console.log(`Found ${eligibleUsers.length} eligible users for emails`);

    // Send emails with rate limiting (process in batches)
    const results = [];
    const batchSize = 5; // Process 5 at a time to avoid overwhelming Resend

    for (let i = 0; i < eligibleUsers.length; i += batchSize) {
      const batch = eligibleUsers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (user) => {
        try {
          const { data, error } = await supabase.functions.invoke("send-growth-email", {
            body: { profileId: user.id },
          });

          if (error) {
            console.error(`Failed to send email to ${user.email}:`, error);
            return { userId: user.id, success: false, error: error.message };
          }

          console.log(`Email sent successfully to ${user.email}`);
          return { userId: user.id, success: true, data };
        } catch (err) {
          console.error(`Exception sending email to ${user.email}:`, err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          return { userId: user.id, success: false, error: errorMessage };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait 2 seconds between batches to respect rate limits
      if (i + batchSize < eligibleUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Email processing complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: eligibleUsers.length,
        sent: successCount,
        failed: failCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-email-queue:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
