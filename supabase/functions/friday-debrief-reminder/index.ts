// ============================================================================
// friday-debrief-reminder
//
// Cron-driven (hourly Saturday). Sends ONE soft reminder per missed week to
// users whose Friday Debrief invite is still unanswered, at ~10am their local
// time. Skipped users get one nudge — never two.
// ============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function localHourInTz(tz: string): { dow: number; hour: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short", hour: "numeric", hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wkd = parts.find((p) => p.type === "weekday")?.value || "";
    const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    if (dowMap[wkd] === undefined) return null;
    return { dow: dowMap[wkd], hour: parseInt(hourStr, 10) % 24 };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const weekOf = mondayOf(new Date());

    // Pending invites for this week with no response and no reminder yet
    const { data: pending, error } = await supabase
      .from("friday_debrief_invites")
      .select(`
        id, profile_id, week_of,
        profiles!inner ( id, email, full_name ),
        email_preferences:profiles!inner ( email_preferences ( timezone ) )
      `)
      .eq("week_of", weekOf)
      .is("responded_at", null)
      .is("reminder_sent_at", null);
    if (error) throw error;

    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const results = { reminded: 0, skipped: 0, failed: 0 };

    for (const inv of pending || []) {
      const prof = (inv as any).profiles;
      // Get tz separately to keep query simple
      const { data: prefs } = await supabase
        .from("email_preferences")
        .select("timezone")
        .eq("profile_id", prof.id)
        .maybeSingle();
      const tz = prefs?.timezone || "America/Chicago";
      const local = localHourInTz(tz);
      // Send Saturday between 10-10:59 local
      if (!local || local.dow !== 6 || local.hour !== 10) {
        results.skipped++;
        continue;
      }
      if (!prof?.email) {
        results.skipped++;
        continue;
      }

      const firstName = (prof.full_name || "there").split(" ")[0];
      const text = `Hey ${firstName} —

No Friday Debrief landed yesterday. Two quick minutes now, or skip this week — your call.

Just hit reply with whatever's on your mind: wins, what's stuck, what you're working on, what you need.

Or talk it out: https://askjericho.com/voice?mode=friday_debrief

— Jericho`;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Jericho <jericho@sender.askjericho.com>",
          to: [prof.email],
          subject: "Skip or 2 minutes? — Friday Debrief",
          text,
          headers: {
            "Reply-To": "jericho@sender.askjericho.com",
            "X-Jericho-Type": "friday_debrief_reminder",
          },
        }),
      });
      if (!resp.ok) {
        results.failed++;
        continue;
      }
      await supabase
        .from("friday_debrief_invites")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", (inv as any).id);
      results.reminded++;
    }

    console.log("[friday-debrief-reminder]", results);
    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[friday-debrief-reminder] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});