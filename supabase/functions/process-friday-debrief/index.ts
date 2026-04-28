// ============================================================================
// process-friday-debrief
//
// Single intake handler for Friday Debrief submissions from any channel:
// email reply, voice transcript, web chat, or (future) SMS voice memo.
//
// 1. Parses the 4 fields (Wins / Stuck / Focus / Need) from the raw response
// 2. Extracts themes and scores 5 categories (wins, stuck, focus, asks, vibe)
// 3. Generates a 1-paragraph narrative
// 4. Upserts into friday_debriefs (unique on profile_id + week_of)
// 5. Updates the user's streak record
// 6. Marks the matching invite as responded
// 7. Enqueues a 1-hour Jericho synthesis reply (via send-email-reply)
//
// Called from:
//   - process-email-reply (when subject contains "Friday Debrief" or
//     In-Reply-To matches a friday_debrief_invites.message_id)
//   - JerichoVoiceChat / JerichoChat (?mode=friday_debrief on session end)
//   - "Start a debrief now" anytime button
// ============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ExtractionResult {
  wins_text: string | null;
  stuck_text: string | null;
  focus_text: string | null;
  need_text: string | null;
  extracted_themes: string[];
  category_scores: {
    wins: number;
    stuck: number;
    focus: number;
    asks: number;
    vibe: number;
  };
  narrative_summary: string;
  jericho_reply: string;
}

// Monday of the current ISO week (the "week_of" anchor)
function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7; // days back to Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

async function extractDebrief(
  rawResponse: string,
  senderName: string,
  lastWeekContext: string | null
): Promise<ExtractionResult> {
  const prompt = `You are Jericho, a sharp performance coach. ${senderName} just submitted their Friday Debrief.

Their response (could be email reply, voice transcript, or chat — any length):
"""
${rawResponse.slice(0, 8000)}
"""

${lastWeekContext ? `Last Friday they said: "${lastWeekContext.slice(0, 600)}"\n` : ""}

Your job: parse it, extract 4 fields, score 5 categories, write 1 narrative paragraph + 1 short Jericho reply.

Return ONLY this JSON (no markdown):
{
  "wins_text": "<what they said about wins this week, 1-3 sentences, or null if not mentioned>",
  "stuck_text": "<where they got stuck or frustrated, or null>",
  "focus_text": "<what they're working on, or null>",
  "need_text": "<what they need from anyone, or null>",
  "extracted_themes": ["<3-6 short theme labels: e.g. 'pricing pushback', 'pipeline building', 'time management', 'team alignment'>"],
  "category_scores": {
    "wins": <0-10 frequency + weight of wins called out>,
    "stuck": <0-10 INVERTED — high score = unstuck/flowing, low = blocked>,
    "focus": <0-10 clarity vs scatter on what they're working on>,
    "asks": <0-10 are they naming what they need clearly>,
    "vibe": <0-10 overall sentiment / energy>
  },
  "narrative_summary": "<1 paragraph (3-5 sentences) connecting wins, stuck, focus, asks. Reference specific things they said. Compare to last week if context given. Sharp friend voice.>",
  "jericho_reply": "<2-4 sentences max. Acknowledge what you heard (specific, not generic). Then ONE sharp next-step nudge. End '— Jericho'. No 'thanks for sharing' fluff.>"
}

Rules:
- If a field isn't mentioned, set to null. Don't invent.
- Themes are SHORT (2-4 words each).
- Scores reflect what's IN the response — silence on a category = midrange (5), not 0.
- Sharp friend energy: skip preambles, be specific, challenge gently.
- Never fabricate customer/product names.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini extraction failed ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw = (json.choices?.[0]?.message?.content || "")
    .replace(/```json\n?/g, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(raw);

  // Clamp scores 0-10
  const clamp = (n: any) => Math.max(0, Math.min(10, Number(n) || 5));
  parsed.category_scores = {
    wins: clamp(parsed.category_scores?.wins),
    stuck: clamp(parsed.category_scores?.stuck),
    focus: clamp(parsed.category_scores?.focus),
    asks: clamp(parsed.category_scores?.asks),
    vibe: clamp(parsed.category_scores?.vibe),
  };
  parsed.extracted_themes = Array.isArray(parsed.extracted_themes)
    ? parsed.extracted_themes.slice(0, 8).map((t: any) => String(t).slice(0, 60))
    : [];
  return parsed;
}

async function updateStreak(supabase: any, profileId: string, weekOf: string) {
  const { data: existing } = await supabase
    .from("friday_debrief_streaks")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  // Calculate new streak: if last week was the immediately prior week, +1; else reset to 1.
  const thisWeek = new Date(weekOf);
  let newCurrent = 1;
  if (existing?.last_debrief_week) {
    const last = new Date(existing.last_debrief_week);
    const diffDays = Math.round((thisWeek.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      newCurrent = existing.current_streak; // re-submission same week, no change
    } else if (diffDays === 7) {
      newCurrent = (existing.current_streak || 0) + 1;
    } else {
      newCurrent = 1;
    }
  }
  const newLongest = Math.max(newCurrent, existing?.longest_streak || 0);
  const newTotal = (existing?.total_debriefs || 0) + (existing?.last_debrief_week === weekOf ? 0 : 1);

  await supabase
    .from("friday_debrief_streaks")
    .upsert(
      {
        profile_id: profileId,
        current_streak: newCurrent,
        longest_streak: newLongest,
        last_debrief_week: weekOf,
        total_debriefs: newTotal,
      },
      { onConflict: "profile_id" }
    );

  return { current: newCurrent, longest: newLongest, total: newTotal };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      profileId,
      rawResponse,
      transcript,
      audioUrl,
      channel, // 'email' | 'voice' | 'web' | 'sms'
      sendReply = true, // for voice/web channels you may want to skip the email reply
    } = body;

    if (!profileId || !channel) {
      return new Response(
        JSON.stringify({ error: "profileId and channel required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const text = (rawResponse || transcript || "").trim();
    if (!text) {
      return new Response(
        JSON.stringify({ error: "raw_response or transcript required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Profile lookup
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, company_id")
      .eq("id", profileId)
      .single();
    if (pErr || !profile) throw new Error(`profile not found: ${profileId}`);

    const weekOf = mondayOf(new Date());

    // Last week's narrative for callback context
    const { data: lastWeek } = await supabase
      .from("friday_debriefs")
      .select("narrative_summary, week_of")
      .eq("profile_id", profileId)
      .lt("week_of", weekOf)
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`[friday-debrief] processing for ${profile.full_name} week_of=${weekOf} channel=${channel}`);

    const extracted = await extractDebrief(
      text,
      profile.full_name || "there",
      lastWeek?.narrative_summary || null
    );

    // Upsert debrief (unique on profile_id + week_of — re-submissions overwrite)
    const { data: debrief, error: insErr } = await supabase
      .from("friday_debriefs")
      .upsert(
        {
          profile_id: profileId,
          week_of: weekOf,
          channel,
          raw_response: channel === "email" ? text : null,
          transcript: channel === "voice" || channel === "sms" ? text : null,
          audio_url: audioUrl || null,
          wins_text: extracted.wins_text,
          stuck_text: extracted.stuck_text,
          focus_text: extracted.focus_text,
          need_text: extracted.need_text,
          extracted_themes: extracted.extracted_themes,
          category_scores: extracted.category_scores,
          narrative_summary: extracted.narrative_summary,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,week_of" }
      )
      .select()
      .single();

    if (insErr) throw new Error(`debrief upsert failed: ${insErr.message}`);

    // Update streak
    const streak = await updateStreak(supabase, profileId, weekOf);

    // Mark invite as responded
    await supabase
      .from("friday_debrief_invites")
      .update({ responded_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .eq("week_of", weekOf);

    // Send Jericho reply (1-hour synthesis) via existing send-email-reply
    let replySent = false;
    if (sendReply && profile.email) {
      try {
        const subjectLine = `Re: Friday Debrief — ${new Date(weekOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const replyBody =
          extracted.jericho_reply +
          (streak.current >= 2
            ? `\n\n🔥 ${streak.current} weeks in a row.`
            : "");
        await supabase.functions.invoke("send-email-reply", {
          body: {
            toEmail: profile.email,
            toName: profile.full_name,
            subject: subjectLine,
            bodyText: replyBody,
          },
        });
        replySent = true;
        await supabase
          .from("friday_debriefs")
          .update({ jericho_reply_sent_at: new Date().toISOString() })
          .eq("id", debrief.id);
      } catch (err) {
        console.error("[friday-debrief] reply send failed (non-fatal):", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        debrief_id: debrief.id,
        week_of: weekOf,
        streak,
        scores: extracted.category_scores,
        themes: extracted.extracted_themes,
        narrative: extracted.narrative_summary,
        jericho_reply: extracted.jericho_reply,
        reply_sent: replySent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[process-friday-debrief] error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});