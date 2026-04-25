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
    if (body.org_id) {
      const { data: knowledge } = await supabase
        .from("sales_knowledge")
        .select("title, content, category, tags")
        .eq("is_active", true)
        .or(`company_id.eq.${body.org_id},company_id.is.null`)
        .limit(40);

      if (knowledge?.length) {
        // Naive keyword relevance ranking
        const terms = [body.crop_context, body.region]
          .filter((s): s is string => !!s && s.trim().length > 0)
          .flatMap((s) => s.toLowerCase().split(/\s+/))
          .filter((t) => t.length > 2);

        const scored = knowledge.map((k: any) => {
          const haystack = `${k.title || ""} ${k.content || ""} ${(k.tags || []).join(" ")}`.toLowerCase();
          const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
          return { k, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 10).map(({ k }) => `### ${k.title} [${k.category || "general"}]\n${k.content}`);
        knowledgeBase = top.join("\n\n");
      }
    }

    // ---- Build prompt ----
    const systemPrompt = `You are Jericho, an expert agronomy sales coach and market intelligence analyst.

Analyze this sales call transcript and provide structured coaching for the sales rep.

You must:
- Coach the sales rep honestly — what worked, what didn't
- Identify missed opportunities and better discovery questions
- Improve the agronomy recommendation using the knowledge base
- Extract the farmer's real concerns and any market signals

Rules:
- Do NOT invent agronomic claims or product capabilities not present in the knowledge base
- If context is missing, say so explicitly
- Be direct and specific — generic feedback is useless

Return ONLY valid JSON, no markdown, no preamble:

{
  "call_summary": "",
  "what_went_well": [],
  "missed_opportunities": [],
  "better_questions": [],
  "improved_recommendation": "",
  "follow_up_email": { "subject": "", "body": "" },
  "farmer_concerns": [],
  "objections": [],
  "product_opportunities": [],
  "market_trend_tags": [],
  "coaching_score": {
    "discovery": 0,
    "listening": 0,
    "agronomy_depth": 0,
    "business_value": 0,
    "next_steps": 0,
    "overall": 0
  },
  "rep_coaching_note": ""
}`;

    const userPrompt = `TRANSCRIPT:
${body.transcript}

CUSTOMER CONTEXT:
${customerContext}

KNOWLEDGE BASE:
${knowledgeBase}

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