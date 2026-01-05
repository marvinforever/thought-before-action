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

    const { profileIds, batchSize = 3 } = await req.json();
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`Auto-generating podcasts for ${today}`);

    // If specific profileIds provided, use those; otherwise find users needing podcasts
    let usersToProcess: string[] = [];
    
    if (profileIds && profileIds.length > 0) {
      usersToProcess = profileIds;
    } else {
      // Find users with email enabled who don't have a podcast for today
      const { data: preferences, error: prefError } = await supabase
        .from("email_preferences")
        .select(`
          profile_id,
          profile:profiles(id, company_id)
        `)
        .eq("email_enabled", true)
        .eq("include_podcast", true);

      if (prefError) {
        throw new Error(`Failed to fetch preferences: ${prefError.message}`);
      }

      if (!preferences || preferences.length === 0) {
        console.log("No users with podcast email enabled");
        return new Response(
          JSON.stringify({ message: "No users to process", generated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check which users already have today's podcast
      const profileIdsToCheck = preferences.map(p => p.profile_id);
      const { data: existingEpisodes } = await supabase
        .from("podcast_episodes")
        .select("profile_id")
        .eq("episode_date", today)
        .in("profile_id", profileIdsToCheck);

      const existingProfileIds = new Set(existingEpisodes?.map(e => e.profile_id) || []);
      usersToProcess = profileIdsToCheck.filter(id => !existingProfileIds.has(id));
    }

    console.log(`Found ${usersToProcess.length} users needing podcasts`);

    if (usersToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: "All users have podcasts for today", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process in batches to respect API rate limits
    const results: any[] = [];
    
    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);

      const batchPromises = batch.map(async (profileId) => {
        try {
          // Get profile info
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, company_id")
            .eq("id", profileId)
            .single();

          if (!profile) {
            return { profileId, success: false, error: "Profile not found" };
          }

          // Generate podcast script
          console.log(`Generating script for ${profileId}`);
          const scriptResponse = await supabase.functions.invoke("generate-podcast-script", {
            body: { profileId, companyId: profile.company_id }
          });

          if (scriptResponse.error) {
            console.error(`Script generation failed for ${profileId}:`, scriptResponse.error);
            return { profileId, success: false, error: scriptResponse.error.message };
          }

          const scriptData = scriptResponse.data;
          if (!scriptData?.script) {
            return { profileId, success: false, error: "No script generated" };
          }

          // Generate audio using TTS
          console.log(`Generating audio for ${profileId}`);
          const ttsResponse = await supabase.functions.invoke("elevenlabs-tts", {
            body: {
              script: scriptData.script,
              profileId,
              episodeDate: today,
              storeAudio: true
            }
          });

          if (ttsResponse.error) {
            console.error(`TTS failed for ${profileId}:`, ttsResponse.error);
            // Still save the script even if audio fails
            await supabase.from("podcast_episodes").upsert({
              profile_id: profileId,
              company_id: profile.company_id,
              episode_date: today,
              title: scriptData.title || `Your Daily Brief - ${today}`,
              script: scriptData.script,
              topics_covered: scriptData.topics || [],
              daily_challenge: scriptData.dailyChallenge || null,
              capability_focus_index: scriptData.capabilityFocusIndex || 0
            }, { onConflict: 'profile_id,episode_date' });

            return { profileId, success: false, error: "Audio generation failed", scriptSaved: true };
          }

          const audioUrl = ttsResponse.data?.url || ttsResponse.data?.audioUrl;

          // Save complete episode
          const { error: saveError } = await supabase.from("podcast_episodes").upsert({
            profile_id: profileId,
            company_id: profile.company_id,
            episode_date: today,
            title: scriptData.title || `Your Daily Brief - ${today}`,
            script: scriptData.script,
            audio_url: audioUrl,
            duration_seconds: scriptData.durationSeconds || 180,
            topics_covered: scriptData.topics || [],
            daily_challenge: scriptData.dailyChallenge || null,
            capability_focus_index: scriptData.capabilityFocusIndex || 0
          }, { onConflict: 'profile_id,episode_date' });

          if (saveError) {
            console.error(`Failed to save episode for ${profileId}:`, saveError);
            return { profileId, success: false, error: saveError.message };
          }

          console.log(`Successfully generated podcast for ${profileId}`);
          return { profileId, success: true, audioUrl };
        } catch (err) {
          console.error(`Exception processing ${profileId}:`, err);
          return { profileId, success: false, error: err instanceof Error ? err.message : String(err) };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait between batches to avoid rate limits
      if (i + batchSize < usersToProcess.length) {
        console.log("Waiting 5 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Podcast generation complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        generated: successCount,
        failed: failCount,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-generate-podcasts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
