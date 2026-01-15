import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily podcast feature flag ID
const DAILY_PODCAST_FLAG_ID = '5a91c49d-3789-4544-82f7-174509d7d2fe';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`Processing daily brief queue at ${now.toISOString()}`);
    
    // CRITICAL: Only send emails at 7am Eastern (12:00 UTC in winter, 11:00 UTC in summer)
    // Check if current hour in Eastern time is 7am
    const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const easternHour = easternTime.getHours();
    
    console.log(`Current Eastern time: ${easternTime.toLocaleString()}, hour: ${easternHour}`);
    
    // Only allow sending between 6am and 8am Eastern to handle slight timing variations
    if (easternHour < 6 || easternHour > 8) {
      console.log(`BLOCKED: Outside allowed window (6-8am Eastern). Current Eastern hour: ${easternHour}`);
      return new Response(
        JSON.stringify({ 
          message: "Outside allowed time window", 
          currentEasternHour: easternHour,
          allowedWindow: "6am-8am Eastern" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`ALLOWED: Within 6-8am Eastern window. Proceeding with daily brief emails.`);
    console.log(`SENDING TO ALL USERS with daily_podcast flag enabled`);

    // Get all companies with daily_podcast flag enabled
    const { data: enabledCompanies, error: flagError } = await supabase
      .from("company_feature_flags")
      .select("company_id")
      .eq("flag_id", DAILY_PODCAST_FLAG_ID)
      .eq("is_enabled", true);

    if (flagError) {
      throw new Error(`Failed to fetch feature flags: ${flagError.message}`);
    }

    if (!enabledCompanies || enabledCompanies.length === 0) {
      console.log("No companies have the daily_podcast feature enabled");
      return new Response(
        JSON.stringify({ message: "No companies with feature enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyIds = enabledCompanies.map(c => c.company_id);
    console.log(`Found ${companyIds.length} companies with daily_podcast enabled`);

    // Get ALL users in those companies
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .in("company_id", companyIds)
      .not("email", "is", null);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log("No users found in enabled companies");
      return new Response(
        JSON.stringify({ message: "No users to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${profiles.length} total users in enabled companies`);

    // Get auth info to check last sign in - need to check each user
    const eligibleUsers: any[] = [];
    const neverLoggedInUsers: any[] = [];

    for (const profile of profiles) {
      // Skip demo emails
      if (profile.email?.includes('@jerichodemo.com')) {
        console.log(`Skipping demo email: ${profile.email}`);
        continue;
      }

      // Check if already sent today
      const { data: todayDeliveries } = await supabase
        .from("email_deliveries")
        .select("id")
        .eq("profile_id", profile.id)
        .gte("sent_at", `${today}T00:00:00Z`)
        .limit(1);

      if (todayDeliveries && todayDeliveries.length > 0) {
        console.log(`Skipping ${profile.email} - already sent today`);
        continue;
      }

      // Check last sign in via auth
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      const lastSignIn = authUser?.user?.last_sign_in_at;
      
      if (!lastSignIn) {
        neverLoggedInUsers.push(profile);
        console.log(`${profile.email} - NEVER LOGGED IN - will send welcome email`);
      } else {
        eligibleUsers.push(profile);
        console.log(`${profile.email} - last login: ${lastSignIn} - will send daily brief`);
      }
    }

    console.log(`${eligibleUsers.length} active users, ${neverLoggedInUsers.length} never-logged-in users`);

    const allResults: any[] = [];

    // Process active users - send regular daily brief
    if (eligibleUsers.length > 0) {
      console.log(`\n=== Processing ${eligibleUsers.length} active users ===`);
      const batchSize = 2;

      for (let i = 0; i < eligibleUsers.length; i += batchSize) {
        const batch = eligibleUsers.slice(i, i + batchSize);
        console.log(`Processing active batch ${Math.floor(i / batchSize) + 1}`);

        const batchPromises = batch.map(async (user) => {
          try {
            // Generate podcast if needed
            const { data: existingEpisode } = await supabase
              .from("podcast_episodes")
              .select("id, audio_url")
              .eq("profile_id", user.id)
              .eq("episode_date", today)
              .single();

            if (!existingEpisode || !existingEpisode.audio_url) {
              console.log(`Generating podcast for ${user.email}`);
              await supabase.functions.invoke("auto-generate-podcasts", {
                body: { profileIds: [user.id], batchSize: 1 }
              });
            }

            // Send daily brief
            console.log(`Sending daily brief to ${user.email}`);
            const emailResult = await supabase.functions.invoke("send-daily-brief-email", {
              body: { profileId: user.id, episodeDate: today }
            });

            if (emailResult.error) {
              console.error(`Email failed for ${user.email}:`, emailResult.error);
              return { userId: user.id, email: user.email, type: 'brief', success: false, error: emailResult.error.message };
            }

            console.log(`Successfully sent daily brief to ${user.email}`);
            return { userId: user.id, email: user.email, type: 'brief', success: true };
          } catch (err) {
            console.error(`Exception for ${user.email}:`, err);
            return { userId: user.id, email: user.email, type: 'brief', success: false, error: String(err) };
          }
        });

        const results = await Promise.all(batchPromises);
        allResults.push(...results);

        if (i + batchSize < eligibleUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Process never-logged-in users - send welcome email
    if (neverLoggedInUsers.length > 0) {
      console.log(`\n=== Processing ${neverLoggedInUsers.length} never-logged-in users ===`);
      const batchSize = 5; // Larger batches for simpler emails

      for (let i = 0; i < neverLoggedInUsers.length; i += batchSize) {
        const batch = neverLoggedInUsers.slice(i, i + batchSize);
        console.log(`Processing welcome batch ${Math.floor(i / batchSize) + 1}`);

        const batchPromises = batch.map(async (user) => {
          try {
            console.log(`Sending welcome email to ${user.email}`);
            const emailResult = await supabase.functions.invoke("send-daily-brief-email", {
              body: { profileId: user.id, episodeDate: today, isWelcome: true }
            });

            if (emailResult.error) {
              console.error(`Welcome email failed for ${user.email}:`, emailResult.error);
              return { userId: user.id, email: user.email, type: 'welcome', success: false, error: emailResult.error.message };
            }

            console.log(`Successfully sent welcome email to ${user.email}`);
            return { userId: user.id, email: user.email, type: 'welcome', success: true };
          } catch (err) {
            console.error(`Exception for ${user.email}:`, err);
            return { userId: user.id, email: user.email, type: 'welcome', success: false, error: String(err) };
          }
        });

        const results = await Promise.all(batchPromises);
        allResults.push(...results);

        if (i + batchSize < neverLoggedInUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    const successCount = allResults.filter(r => r.success).length;
    const failCount = allResults.filter(r => !r.success).length;

    console.log(`\n=== COMPLETE ===`);
    console.log(`Daily briefs: ${allResults.filter(r => r.type === 'brief' && r.success).length} sent`);
    console.log(`Welcome emails: ${allResults.filter(r => r.type === 'welcome' && r.success).length} sent`);
    console.log(`Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: eligibleUsers.length + neverLoggedInUsers.length,
        sent: successCount,
        failed: failCount,
        briefsSent: allResults.filter(r => r.type === 'brief' && r.success).length,
        welcomesSent: allResults.filter(r => r.type === 'welcome' && r.success).length,
        results: allResults
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-daily-brief-queue:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
