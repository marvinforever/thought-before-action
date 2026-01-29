import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATELINE_COMPANY_ID = "d32f9a18-aba5-4836-aa66-1834b8cb8edd";
const MOMENTUM_COMPANY_ID = "a]81c8fdc-4779-4ee6-ba6f-12b1ab845714";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate dates for 7-day and 1-day reminders
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(today.getDate() + 1);

    const sevenDayDate = sevenDaysFromNow.toISOString().split("T")[0];
    const oneDayDate = oneDayFromNow.toISOString().split("T")[0];

    console.log(`Processing reminders for: 7-day=${sevenDayDate}, 1-day=${oneDayDate}`);

    // Get all Stateline profiles
    const { data: statelineProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", STATELINE_COMPANY_ID);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    const profileIds = statelineProfiles?.map((p) => p.id) || [];

    if (profileIds.length === 0) {
      console.log("No Stateline profiles found");
      return new Response(
        JSON.stringify({ success: true, message: "No profiles to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${profileIds.length} Stateline profiles`);

    // Fetch all call_plan_tracking records for these profiles
    const { data: trackingRecords, error: trackingError } = await supabase
      .from("call_plan_tracking")
      .select("*")
      .in("profile_id", profileIds);

    if (trackingError) {
      throw new Error(`Failed to fetch tracking records: ${trackingError.message}`);
    }

    if (!trackingRecords || trackingRecords.length === 0) {
      console.log("No tracking records found");
      return new Response(
        JSON.stringify({ success: true, message: "No tracking records to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${trackingRecords.length} tracking records`);

    // Find meetings that need reminders
    const remindersToSend: Array<{
      profile_id: string;
      call_tracking_id: string;
      call_number: number;
      reminder_type: "7_day" | "1_day";
    }> = [];

    for (const record of trackingRecords) {
      // Check each call stage (1-4)
      for (let callNum = 1; callNum <= 4; callNum++) {
        const dateField = `call_${callNum}_date`;
        const completedField = `call_${callNum}_completed`;
        const callDate = record[dateField];
        const isCompleted = record[completedField];

        // Skip if no date set or already completed
        if (!callDate || isCompleted) continue;

        // Check for 7-day reminder
        if (callDate === sevenDayDate) {
          remindersToSend.push({
            profile_id: record.profile_id,
            call_tracking_id: record.id,
            call_number: callNum,
            reminder_type: "7_day",
          });
        }

        // Check for 1-day reminder
        if (callDate === oneDayDate) {
          remindersToSend.push({
            profile_id: record.profile_id,
            call_tracking_id: record.id,
            call_number: callNum,
            reminder_type: "1_day",
          });
        }
      }
    }

    console.log(`Found ${remindersToSend.length} potential reminders to send`);

    // Filter out already-sent reminders
    const uniqueKeys = remindersToSend.map(
      (r) => `${r.call_tracking_id}-${r.call_number}-${r.reminder_type}`
    );

    const { data: existingReminders } = await supabase
      .from("call_plan_reminders")
      .select("call_plan_tracking_id, call_number, reminder_type")
      .in("call_plan_tracking_id", remindersToSend.map((r) => r.call_tracking_id));

    const sentKeys = new Set(
      (existingReminders || []).map(
        (r) => `${r.call_plan_tracking_id}-${r.call_number}-${r.reminder_type}`
      )
    );

    const newReminders = remindersToSend.filter(
      (r) => !sentKeys.has(`${r.call_tracking_id}-${r.call_number}-${r.reminder_type}`)
    );

    console.log(`${newReminders.length} new reminders to send (${remindersToSend.length - newReminders.length} already sent)`);

    // Send reminders with rate limiting
  const results: Array<{ success: boolean; reminder: any; error?: string }> = [];
  const BATCH_SIZE = 2; // Send 2 at a time to respect Resend's 2/sec limit
  const DELAY_MS = 1500; // 1.5 seconds between batches

  for (let i = 0; i < newReminders.length; i += BATCH_SIZE) {
    const batch = newReminders.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (reminder) => {
          try {
            const response = await fetch(
              `${supabaseUrl}/functions/v1/send-call-plan-reminder`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseServiceKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(reminder),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return { success: true, reminder };
          } catch (error) {
            console.error(`Failed to send reminder for ${reminder.call_tracking_id}:`, error);
            return {
              success: false,
              reminder,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            reminder: batch[batchResults.indexOf(result)],
            error: result.reason?.message || "Promise rejected",
          });
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < newReminders.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`✅ Processed ${results.length} reminders: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        sent: successCount,
        failed: failCount,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing call plan reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
