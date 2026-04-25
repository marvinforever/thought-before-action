import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CallRecord {
  call_date: string | null;
  created_at: string;
  customer_name?: string | null;
  scores: {
    discovery?: number;
    listening?: number;
    agronomy_depth?: number;
    business_value?: number;
    next_steps?: number;
    overall?: number;
  };
  one_thing_to_fix?: string;
  call_summary?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string = body?.targetUserId || userData.user.id;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error } = await supabase
      .from("sales_call_analyses")
      .select(
        "id, call_date, created_at, ai_output, customer:sales_companies(name)",
      )
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const calls: CallRecord[] = (rows || [])
      .map((r: any) => {
        const ai = r.ai_output || {};
        return {
          call_date: r.call_date,
          created_at: r.created_at,
          customer_name: r.customer?.name || null,
          scores: ai.coaching_score || {},
          one_thing_to_fix: ai.one_thing_to_fix_next_call,
          call_summary: ai.call_summary,
        };
      })
      .filter((c) => c.scores && typeof c.scores.overall === "number");

    if (calls.length < 2) {
      return new Response(
        JSON.stringify({
          summary:
            calls.length === 0
              ? "Analyze your first sales call to start tracking your development."
              : "Analyze at least one more call so we can spot trends in your performance.",
          insufficient_data: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Order chronologically (oldest first) for the prompt
    const chronological = [...calls].reverse();
    const compact = chronological.map((c, i) => ({
      call: i + 1,
      date: c.call_date || c.created_at?.slice(0, 10),
      customer: c.customer_name || "Unknown",
      scores: c.scores,
      fix: c.one_thing_to_fix,
    }));

    const systemPrompt =
      "You are a sales coach analyzing performance over time. Given a rep's last 5–10 analyzed calls, identify: where they are improving, where they are stuck, and the single biggest opportunity for growth. Be concise and direct. Speak directly to the rep ('you'). No preamble.";

    const userPrompt = `Here are this rep's last ${compact.length} analyzed calls (oldest to newest). Scores are 1-10 across discovery, listening, agronomy_depth, business_value, next_steps, overall.\n\n${JSON.stringify(compact, null, 2)}\n\nReturn a JSON object with these fields:\n{\n  "improving_in": "1-2 sentence summary of where the rep is getting better",\n  "stuck_on": "1-2 sentence summary of categories or behaviors that aren't improving",\n  "biggest_opportunity": "the single highest-leverage thing to focus on next",\n  "headline": "one short, punchy line summarizing momentum (max 90 chars)"\n}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rep_development_summary",
              description: "Concise development summary for a sales rep.",
              parameters: {
                type: "object",
                properties: {
                  improving_in: { type: "string" },
                  stuck_on: { type: "string" },
                  biggest_opportunity: { type: "string" },
                  headline: { type: "string" },
                },
                required: [
                  "improving_in",
                  "stuck_on",
                  "biggest_opportunity",
                  "headline",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "rep_development_summary" },
        },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits required. Add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let summary: any = null;
    if (toolCall?.function?.arguments) {
      try {
        summary = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments", e);
      }
    }

    return new Response(
      JSON.stringify({
        summary,
        call_count: calls.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("rep-development-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});