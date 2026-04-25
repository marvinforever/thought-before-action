import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  user_id: string;
  sales_rep_id: string;
  org_id?: string | null;
  customer_id?: string | null;
  crop_context?: string;
  region?: string;
  call_date?: string;
  transcript: string;
  notes?: string;
}

function safeParseJson(raw: string): any {
  if (!raw) return null;
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.transcript || !body?.user_id || !body?.sales_rep_id) {
      return new Response(
        JSON.stringify({ error: "transcript, user_id, and sales_rep_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Load customer context ----
    let customerContext = "No customer selected.";
    if (body.customer_id) {
      const { data: company } = await supabase
        .from("sales_companies")
        .select("name, industry, location, grower_history, notes, operation_details")
        .eq("id", body.customer_id)
        .maybeSingle();

      const { data: contacts } = await supabase
        .from("sales_contacts")
        .select("name, title, is_decision_maker, notes")
        .eq("company_id", body.customer_id)
        .limit(10);

      const { data: intel } = await supabase
        .from("sales_company_intelligence")
        .select("*")
        .eq("company_id", body.customer_id)
        .maybeSingle();

      let purchaseSummary = "";
      if (company?.name && body.org_id) {
        const { data: purchaseRows } = await supabase.rpc(
          "get_customer_purchase_summary_v2",
          { p_company_id: body.org_id, p_customer_name_pattern: `%${company.name}%` },
        );
        if (purchaseRows && purchaseRows[0]) {
          purchaseSummary = JSON.stringify(purchaseRows[0]);
        }
      }

      customerContext = [
        company ? `Customer: ${JSON.stringify(company)}` : "",
        contacts?.length ? `Contacts: ${JSON.stringify(contacts)}` : "",
        intel ? `Intelligence: ${JSON.stringify(intel)}` : "",
        purchaseSummary ? `Purchase History: ${purchaseSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    // ---- Load relevant knowledge base entries ----
    let knowledgeBase = "No knowledge base entries found.";
    let knowledgeTitles: string[] = [];
    if (body.org_id) {
      const { data: knowledge } = await supabase
        .from("sales_knowledge")
        .select("title, content, category, tags")
        .eq("is_active", true)
        .or(`company_id.eq.${body.org_id},company_id.is.null`)
        .limit(80);

      if (knowledge?.length) {
        // Naive keyword relevance ranking — pull terms from crop, region, transcript, notes
        const terms = [body.crop_context, body.region, body.notes, body.transcript?.slice(0, 4000)]
          .filter((s): s is string => !!s && s.trim().length > 0)
          .flatMap((s) => s.toLowerCase().split(/\s+/))
          .filter((t) => t.length > 3)
          .slice(0, 200);

        const scored = knowledge.map((k: any) => {
          const haystack = `${k.title || ""} ${k.content || ""} ${(k.tags || []).join(" ")}`.toLowerCase();
          const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
          return { k, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const topPicks = scored.slice(0, 12);
        knowledgeTitles = topPicks.map(({ k }) => `${k.title}${k.category ? ` (${k.category})` : ""}`);
        const top = topPicks.map(({ k }) => `### ${k.title} [${k.category || "general"}]\n${k.content}`);
        knowledgeBase = top.join("\n\n");
      }
    }

    // ---- Build prompt ----
    const systemPrompt = `You are Jericho, an elite agronomy sales coach.

You are direct, practical, and specific. You do not give generic advice.

Your job:
1. Coach the rep like a high-level sales leader
2. Identify what they missed in the conversation
3. Improve their agronomy recommendation so it sounds like a trusted advisor
4. Extract real farmer concerns and market signals

Knowledge usage rules:
- ALWAYS prefer the company KNOWLEDGE BASE first when it covers the topic.
- If the knowledge base does not have enough information, you MAY use general agronomic best practices — but say so.
- Label every recommendation with one of:
    "Based on company knowledge"
    "Based on general agronomic best practice"
    "Needs agronomist review"
- Do NOT invent specific company product claims, pricing, application rates, guarantees, labels, or policies.
- Do NOT present uncertain agronomic advice as confirmed.
- If the recommendation involves product rates, chemical applications, regulatory issues, or high-risk crop decisions, set "needs_agronomist_review": true and label it "Needs agronomist review".
- List the knowledge base titles you actually used in "knowledge_used".
- List anything important the rep is missing that would change the recommendation in "missing_context" (e.g. soil test, hybrid, prior chemistry, water source).

Market intelligence rules:
- Extract every market signal you can find in the transcript and put them in "market_trend_tags".
- Each trend MUST be an OBJECT with: trend_type, trend_label, evidence, confidence (1–10).
- "trend_type" must be one of: "input_cost", "yield_risk", "product_resistance", "competitor", "weather", "cash_flow", "regulatory", "agronomic_practice", "demand_shift", "other".
- "trend_label" is a short human-readable label (e.g. "Glyphosate-resistant waterhemp pressure", "Tight cash flow heading into spring", "Pioneer pricing aggressively on corn").
- "evidence" must be a short direct quote or close paraphrase from the transcript that supports the trend.
- "confidence" is 1–10 based on how clearly the transcript supports the trend (10 = explicit grower statement, 5 = implied, 1 = weak signal).
- If the transcript contains no market signals, return an empty array.
- Do NOT invent trends that aren't grounded in the transcript.

Coaching rules:
- Do NOT summarize unless necessary
- Focus on insight, not repetition
- Call out missed moments clearly
- Be specific about what should have been said
- Tie recommendations to yield, risk, cost, or timing
- If information is missing, say exactly what is missing
- Write like a real person, not AI

For "one_thing_to_fix_next_call": If the rep only fixed ONE thing, what would improve their performance the most? Be specific and actionable — one sentence, no hedging.

For "improved_recommendation": Write it as a confident advisor speaking directly to the farmer. Clear and decisive. Not a suggestion — a plan. Tie it to yield, risk, cost, or timing. Begin with the source label in brackets, e.g. "[Based on company knowledge] ..." or "[Based on general agronomic best practice] ..." or "[Needs agronomist review] ...". If you use specific product names, rates, or chemistry, they MUST come from the knowledge base — otherwise stay generic and flag for review.

Return ONLY valid JSON, no markdown, no preamble:

{
  "one_thing_to_fix_next_call": "",
  "missed_opportunities": [],
  "improved_recommendation": "",
  "recommendation_source": "",
  "needs_agronomist_review": false,
  "knowledge_used": [],
  "missing_context": [],
  "follow_up_email": { "subject": "", "body": "" },
  "call_summary": "",
  "what_went_well": [],
  "better_questions": [],
  "farmer_concerns": [],
  "objections": [],
  "product_opportunities": [],
  "market_trend_tags": [
    { "trend_type": "", "trend_label": "", "evidence": "", "confidence": 0 }
  ],
  "coaching_score": {
    "discovery": 0,
    "listening": 0,
    "agronomy_depth": 0,
    "business_value": 0,
    "next_steps": 0,
    "overall": 0
  },
  "rep_coaching_note": ""
}

"recommendation_source" must be exactly one of: "Based on company knowledge", "Based on general agronomic best practice", "Needs agronomist review".`;

    const userPrompt = `TRANSCRIPT:
${body.transcript}

Customer Context:
${customerContext}

Knowledge Base Context:
${knowledgeBase}

AVAILABLE KNOWLEDGE TITLES (use these names verbatim in "knowledge_used" when applicable):
${knowledgeTitles.length ? knowledgeTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

CROP / CONTEXT: ${body.crop_context || "(not provided)"}
REGION: ${body.region || "(not provided)"}
CALL DATE: ${body.call_date || "(not provided)"}
REP NOTES: ${body.notes || "(none)"}`;

    const aiResult = await callAI(
      {
        taskType: "sales-coaching",
        functionName: "analyze-sales-call",
        companyId: body.org_id || null,
        profileId: body.user_id,
      },
      [{ role: "user", content: userPrompt }],
      {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.4,
      },
    );

    const parsed = safeParseJson(aiResult.content);
    if (!parsed) {
      console.error("[analyze-sales-call] Failed to parse AI response:", aiResult.content?.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI response was not valid JSON", raw: aiResult.content }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Save analysis ----
    const { data: saved, error: saveError } = await supabase
      .from("sales_call_analyses")
      .insert({
        user_id: body.user_id,
        sales_rep_id: body.sales_rep_id,
        org_id: body.org_id || null,
        customer_id: body.customer_id || null,
        crop_context: body.crop_context || null,
        region: body.region || null,
        call_date: body.call_date || null,
        transcript: body.transcript,
        notes: body.notes || null,
        ai_output: parsed,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[analyze-sales-call] Save error:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis", details: saveError.message, ai_output: parsed }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ analysis: saved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[analyze-sales-call] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});