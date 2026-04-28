// ============================================================================
// send-friday-debrief-invite
//
// Cron-driven (hourly Fri/Sat). Finds users whose local time matches their
// chosen debrief slot AND who don't yet have an invite for this week, then
// sends them a warm conversational email with the 4 questions inline.
//
// Each invite includes a "Last Friday you said:..." callback when available.
// Reply-To routes to jericho@sender.askjericho.com so plain replies flow into
// process-email-reply -> friday-debrief intent routing.
//
// Single-user mode: pass { profileId } in the request body to send one invite
// immediately (used for testing and the "Start a debrief now" button).
// ============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map preference key -> { dayOfWeek (0=Sun..6=Sat), hour (0-23) } in user's local tz
const SLOT_MAP: Record<string, { dow: number; hour: number }> = {
  thu_pm: { dow: 4, hour: 16 },
  fri_am: { dow: 5, hour: 9 },
  fri_9am: { dow: 5, hour: 9 }, // default
  fri_pm: { dow: 5, hour: 15 },
  sun_pm: { dow: 0, hour: 18 },
};

function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Get { dayOfWeek, hour } for a given timezone using Intl
function localPartsInTz(tz: string): { dow: number; hour: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wkd = parts.find((p) => p.type === "weekday")?.value || "";
    const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[wkd];
    if (dow === undefined) return null;
    const hour = parseInt(hourStr, 10) % 24;
    return { dow, hour };
  } catch {
    return null;
  }
}

function buildInviteHtml(
  fullName: string,
  lastWeekCallback: string | null,
  streakCount: number
): { html: string; text: string; subject: string } {
  const firstName = (fullName || "there").split(" ")[0];

  const callbackBlock = lastWeekCallback
    ? `
    <tr><td style="padding: 16px 24px; background: #f4f1ea; border-left: 3px solid #d4af37; font-style: italic; color: #1a2540; font-size: 14px; line-height: 1.6;">
      Last Friday you said: "${lastWeekCallback.replace(/"/g, "&quot;").slice(0, 280)}${lastWeekCallback.length > 280 ? "…" : ""}"
    </td></tr>
    <tr><td style="height: 20px;"></td></tr>`
    : "";

  const streakBadge = streakCount >= 2
    ? `<span style="background: #d4af37; color: #1a2540; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">🔥 ${streakCount} weeks</span>`
    : "";

  const subject = `Your Friday Debrief — 5 minutes, your call on how`;

  const text = `Hey ${firstName},

Your Friday Debrief is here. ${streakCount >= 2 ? `🔥 ${streakCount} weeks running.` : ""}

${lastWeekCallback ? `Last Friday you said: "${lastWeekCallback.slice(0, 280)}${lastWeekCallback.length > 280 ? "…" : ""}"\n\n` : ""}Four quick prompts. Hit reply with whatever lands — 2 sentences or 2 paragraphs, both count.

1. WINS — what won this week? (small or big, count it)
2. STUCK — where did you get stuck or frustrated?
3. FOCUS — what are you working on right now?
4. NEED — what do you need this week — from me, your team, a customer, or yourself?

Prefer to talk it out? Open Jericho voice: https://askjericho.com/voice?mode=friday_debrief
Or chat: https://askjericho.com/chat?mode=friday_debrief

I'll read it within an hour and shoot back what I heard plus one nudge.

— Jericho`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background: #f4f1ea; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ea; padding: 30px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius: 8px; overflow: hidden;">
        <tr><td style="background: #1a2540; padding: 24px 28px;">
          <table width="100%"><tr>
            <td style="color:#ffffff; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;">Friday Debrief</td>
            <td align="right">${streakBadge}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding: 32px 28px 16px 28px;">
          <h1 style="margin:0 0 8px; font-size: 24px; color: #1a2540;">Hey ${firstName} —</h1>
          <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">5 minutes, your call on how. Hit reply with whatever lands — 2 sentences or 2 paragraphs, both count.</p>
        </td></tr>

        ${callbackBlock}

        <tr><td style="padding: 4px 28px 8px 28px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${[
              ["1.", "WINS", "What won this week? Small or big — count it."],
              ["2.", "STUCK", "Where did you get stuck or frustrated?"],
              ["3.", "FOCUS", "What are you working on right now?"],
              ["4.", "NEED", "What do you need this week — from me, your team, a customer, or yourself?"],
            ]
              .map(
                ([n, label, desc]) => `
              <tr><td style="padding: 14px 0; border-bottom: 1px solid #e8e4d9;">
                <table width="100%"><tr>
                  <td width="38" style="font-size: 18px; color: #d4af37; font-weight: 700; vertical-align: top;">${n}</td>
                  <td>
                    <div style="font-size: 13px; letter-spacing: 1px; color: #1a2540; font-weight: 700; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 14px; color: #475569; line-height: 1.5;">${desc}</div>
                  </td>
                </tr></table>
              </td></tr>`
              )
              .join("")}
          </table>
        </td></tr>

        <tr><td style="padding: 24px 28px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#1a2540; border-radius: 4px;"><a href="https://askjericho.com/voice?mode=friday_debrief" style="display: inline-block; padding: 12px 18px; color:#ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">🎙 Talk it out</a></td>
              <td style="width: 8px;"></td>
              <td style="background:#ffffff; border: 1px solid #1a2540; border-radius: 4px;"><a href="https://askjericho.com/chat?mode=friday_debrief" style="display: inline-block; padding: 12px 18px; color:#1a2540; text-decoration: none; font-size: 14px; font-weight: 600;">💬 Quick chat</a></td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding: 8px 28px 28px 28px; font-size: 14px; color: #475569; line-height: 1.6;">
          I'll read it within an hour and shoot back what I heard plus one nudge.<br><br>
          — Jericho
        </td></tr>

        <tr><td style="background: #f4f1ea; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center;">
          Don't want these? <a href="https://askjericho.com/settings/email" style="color:#94a3b8;">Pause Friday Debriefs</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { html, text, subject };
}

async function sendOneInvite(
  supabase: any,
  profileId: string,
  email: string,
  fullName: string
): Promise<{ ok: boolean; error?: string }> {
  const weekOf = mondayOf(new Date());

  // Skip if already invited this week
  const { data: existingInvite } = await supabase
    .from("friday_debrief_invites")
    .select("id, responded_at")
    .eq("profile_id", profileId)
    .eq("week_of", weekOf)
    .maybeSingle();
  if (existingInvite) {
    return { ok: false, error: "already_invited_this_week" };
  }

  // Last week's narrative for the callback
  const { data: lastWeek } = await supabase
    .from("friday_debriefs")
    .select("narrative_summary, wins_text, week_of")
    .eq("profile_id", profileId)
    .lt("week_of", weekOf)
    .order("week_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  const callback = lastWeek?.wins_text || lastWeek?.narrative_summary || null;

  // Streak count
  const { data: streak } = await supabase
    .from("friday_debrief_streaks")
    .select("current_streak")
    .eq("profile_id", profileId)
    .maybeSingle();

  const { html, text, subject } = buildInviteHtml(
    fullName,
    callback,
    streak?.current_streak || 0
  );

  // Send via Resend (matches existing send-growth-email pattern)
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Jericho <jericho@sender.askjericho.com>",
      to: [email],
      subject,
      html,
      text,
      headers: {
        "Reply-To": "jericho@sender.askjericho.com",
        "X-Jericho-Type": "friday_debrief_invite",
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return { ok: false, error: `resend ${resp.status}: ${errText.slice(0, 200)}` };
  }
  const sendJson = await resp.json();

  // Record the invite
  await supabase.from("friday_debrief_invites").insert({
    profile_id: profileId,
    week_of: weekOf,
    channel_invited: "email",
    message_id: sendJson?.id || null,
  });

  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Single-user mode (manual trigger / "Start a debrief now")
    if (body.profileId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", body.profileId)
        .single();
      if (!profile?.email) throw new Error("profile email not found");
      const result = await sendOneInvite(supabase, profile.id, profile.email, profile.full_name);
      return new Response(JSON.stringify({ success: result.ok, ...result }), {
        status: result.ok ? 200 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode: scan all eligible users whose local time matches their slot
    const { data: candidates, error: candErr } = await supabase
      .from("user_active_context")
      .select(`
        profile_id,
        friday_debrief_enabled,
        friday_debrief_day_time,
        profiles!inner ( id, email, full_name ),
        email_preferences ( timezone )
      `)
      .eq("friday_debrief_enabled", true);

    if (candErr) throw candErr;

    const results = { invited: 0, skipped: 0, failed: 0, details: [] as any[] };

    for (const row of candidates || []) {
      const slotKey = (row.friday_debrief_day_time || "fri_9am") as string;
      const slot = SLOT_MAP[slotKey] || SLOT_MAP.fri_9am;
      const tz = (row as any).email_preferences?.timezone || "America/Chicago";
      const local = localPartsInTz(tz);
      if (!local) {
        results.skipped++;
        continue;
      }
      // Match dow + hour exactly (±0; cron runs hourly so within the hour is fine)
      if (local.dow !== slot.dow || local.hour !== slot.hour) {
        results.skipped++;
        continue;
      }
      const prof = (row as any).profiles;
      if (!prof?.email) {
        results.skipped++;
        continue;
      }
      const r = await sendOneInvite(supabase, prof.id, prof.email, prof.full_name);
      if (r.ok) results.invited++;
      else if (r.error === "already_invited_this_week") results.skipped++;
      else {
        results.failed++;
        results.details.push({ profile_id: prof.id, error: r.error });
      }
    }

    console.log(`[friday-debrief-invite] cron run:`, results);
    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-friday-debrief-invite] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});