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
    console.log(`SENDING TO ALL USERS by default (opt-out model)`);

    // Get users who have explicitly opted out of email
    const { data: optedOutUsers, error: optOutError } = await supabase
      .from("email_preferences")
      .select("profile_id")
      .eq("email_enabled", false);

    if (optOutError) {
      console.error(`Failed to fetch opt-out list: ${optOutError.message}`);
    }

    const optedOutIds = new Set((optedOutUsers || []).map(u => u.profile_id));
    console.log(`${optedOutIds.size} users have opted out of daily brief emails`);

    // Get ALL users with an email address
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .not("email", "is", null);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log("No users found");
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

      // Skip users who opted out
      if (optedOutIds.has(profile.id)) {
        console.log(`Skipping ${profile.email} - opted out of daily brief`);
        continue;
      }

      // Check if user wants to skip weekend emails
      const easternDayName = easternTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
      const isWeekendDay = easternDayName === 'Saturday' || easternDayName === 'Sunday';
      if (isWeekendDay) {
        const { data: userEmailPref } = await supabase
          .from("email_preferences")
          .select("skip_weekends")
          .eq("profile_id", profile.id)
          .single();

        if (userEmailPref?.skip_weekends) {
          console.log(`Skipping ${profile.email} - skip_weekends enabled and it's ${easternDayName}`);
          continue;
        }
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

            // Fetch user's delivery channel preferences
            const { data: channelPrefs } = await supabase
              .from("email_preferences")
              .select("delivery_channels")
              .eq("profile_id", user.id)
              .single();

            const channels = channelPrefs?.delivery_channels || { email: true, telegram: false, sms: false };
            const channelResults: string[] = [];

            // Send email if enabled (default behavior)
            if (channels.email !== false) {
              console.log(`Sending daily brief email to ${user.email}`);
              const emailResult = await supabase.functions.invoke("send-daily-brief-email", {
                body: { profileId: user.id, episodeDate: today }
              });
              if (emailResult.error) {
                console.error(`Email failed for ${user.email}:`, emailResult.error);
              } else {
                channelResults.push('email');
              }
            }

            // Send Telegram if enabled
            if (channels.telegram) {
              console.log(`Sending daily brief telegram to ${user.email}`);
              const tgResult = await supabase.functions.invoke("send-daily-brief-telegram", {
                body: { profileId: user.id }
              });
              if (tgResult.error) {
                console.error(`Telegram failed for ${user.email}:`, tgResult.error);
              } else {
                channelResults.push('telegram');
              }
            }

            // Send SMS if enabled
            if (channels.sms) {
              console.log(`Sending daily brief SMS to ${user.email}`);
              const smsResult = await supabase.functions.invoke("send-daily-brief-sms", {
                body: { profileId: user.id }
              });
              if (smsResult.error) {
                console.error(`SMS failed for ${user.email}:`, smsResult.error);
              } else {
                channelResults.push('sms');
              }
            }

            console.log(`Successfully sent daily brief to ${user.email} via: ${channelResults.join(', ') || 'none'}`);
            return { userId: user.id, email: user.email, type: 'brief', success: channelResults.length > 0, channels: channelResults };
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
