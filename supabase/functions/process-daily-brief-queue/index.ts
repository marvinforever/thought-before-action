import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Timezone offsets from UTC (approximate)
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Los_Angeles': -8,
  'America/Phoenix': -7,
  'America/Anchorage': -9,
  'Pacific/Honolulu': -10,
  'UTC': 0,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Europe/Berlin': 1,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Australia/Sydney': 11,
};

function getUserLocalHour(utcHour: number, timezone: string): number {
  const offset = TIMEZONE_OFFSETS[timezone] || -6; // Default to Central
  let localHour = utcHour + offset;
  if (localHour < 0) localHour += 24;
  if (localHour >= 24) localHour -= 24;
  return localHour;
}

function getLocalDayOfWeek(utcDate: Date, timezone: string): string {
  const offset = TIMEZONE_OFFSETS[timezone] || -6;
  const localDate = new Date(utcDate.getTime() + offset * 60 * 60 * 1000);
  return localDate.toLocaleDateString('en-US', { weekday: 'long' });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const utcHour = now.getUTCHours();
    const today = now.toISOString().split('T')[0];

    console.log(`Processing daily brief queue at ${now.toISOString()} (UTC hour: ${utcHour})`);

    // Fetch all users with email preferences enabled
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${preferences.length} users with email enabled`);

    // Filter users whose preferred time matches current hour in their timezone
    const eligibleUsers: any[] = [];

    for (const pref of preferences) {
      if (!pref.profile?.id) continue;

      const [prefHour] = pref.preferred_time.split(':').map(Number);
      const userLocalHour = getUserLocalHour(utcHour, pref.timezone || 'America/Chicago');
      const userLocalDay = getLocalDayOfWeek(now, pref.timezone || 'America/Chicago');

      // Check if this is the right time for this user
      let shouldSend = false;

      if (pref.frequency === 'daily') {
        shouldSend = userLocalHour === prefHour;
      } else if (pref.frequency === 'weekly') {
        const prefDay = pref.preferred_day || 'Monday';
        shouldSend = userLocalHour === prefHour && 
                     userLocalDay.toLowerCase() === prefDay.toLowerCase();
      }

      if (shouldSend) {
        // Check if already sent today
        const { data: todayDeliveries } = await supabase
          .from("email_deliveries")
          .select("id")
          .eq("profile_id", pref.profile_id)
          .gte("sent_at", `${today}T00:00:00Z`)
          .limit(1);

        if (!todayDeliveries || todayDeliveries.length === 0) {
          eligibleUsers.push({
            ...pref.profile,
            includePodcast: pref.include_podcast !== false,
            briefFormat: pref.brief_format || 'both'
          });
        } else {
          console.log(`Skipping ${pref.profile.email} - already sent today`);
        }
      }
    }

    console.log(`${eligibleUsers.length} users eligible for daily brief this hour`);

    if (eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users eligible at this time", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process users in batches
    const results: any[] = [];
    const batchSize = 2; // Small batches due to TTS generation time

    for (let i = 0; i < eligibleUsers.length; i += batchSize) {
      const batch = eligibleUsers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);

      const batchPromises = batch.map(async (user) => {
        try {
          // Step 1: Check if podcast exists for today, generate if needed
          if (user.includePodcast) {
            const { data: existingEpisode } = await supabase
              .from("podcast_episodes")
              .select("id, audio_url")
              .eq("profile_id", user.id)
              .eq("episode_date", today)
              .single();

            if (!existingEpisode || !existingEpisode.audio_url) {
              console.log(`Generating podcast for ${user.email}`);
              const genResult = await supabase.functions.invoke("auto-generate-podcasts", {
                body: { profileIds: [user.id], batchSize: 1 }
              });

              if (genResult.error) {
                console.error(`Podcast generation failed for ${user.email}:`, genResult.error);
              }
            }
          }

          // Step 2: Send the daily brief email
          console.log(`Sending daily brief email to ${user.email}`);
          const emailResult = await supabase.functions.invoke("send-daily-brief-email", {
            body: { profileId: user.id, episodeDate: today }
          });

          if (emailResult.error) {
            console.error(`Email failed for ${user.email}:`, emailResult.error);
            return { userId: user.id, email: user.email, success: false, error: emailResult.error.message };
          }

          console.log(`Successfully sent daily brief to ${user.email}`);
          return { userId: user.id, email: user.email, success: true };
        } catch (err) {
          console.error(`Exception processing ${user.email}:`, err);
          return { 
            userId: user.id, 
            email: user.email, 
            success: false, 
            error: err instanceof Error ? err.message : String(err) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait between batches to respect rate limits
      if (i + batchSize < eligibleUsers.length) {
        console.log("Waiting 10 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Daily brief processing complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: eligibleUsers.length,
        sent: successCount,
        failed: failCount,
        results
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
