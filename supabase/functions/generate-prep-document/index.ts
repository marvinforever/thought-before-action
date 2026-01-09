import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Companies with access to Stateline-specific methodologies (4-call plan, season review, 111.4 strategy)
const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const FOUR_CALL_COMPANIES = [STATELINE_COMPANY_ID, MOMENTUM_COMPANY_ID];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dealId, conversationContext } = await req.json();

    if (!conversationContext) {
      return new Response(JSON.stringify({ error: "No conversation context provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, job_title")
      .eq("email", user.email)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", profile.company_id)
      .single();

    // Get deal info if provided
    let dealInfo = null;
    if (dealId) {
      const { data: deal } = await supabase
        .from("sales_deals")
        .select("*")
        .eq("id", dealId)
        .single();
      dealInfo = deal;
    }

    // Get company knowledge/products
    const { data: companyKnowledge } = await supabase
      .from("company_knowledge")
      .select("title, content, category")
      .eq("company_id", profile.company_id)
      .limit(10);

    // Check if user has access to Stateline-specific methodologies
    const hasMethodologyAccess = FOUR_CALL_COMPANIES.includes(profile.company_id);

    // Build prompt for AI - the AI will extract prospect info from the conversation
    const methodologySection = hasMethodologyAccess ? `
SALES METHODOLOGY CONTEXT:
You can reference the 4-Call Plan methodology, Season Review process, and 111.4 strategy when relevant.
` : '';

    const systemPrompt = `You are a sales preparation document generator. Analyze the conversation and create a professional, actionable sales prep document.

Company: ${company?.name || "Unknown"}
Seller: ${profile.full_name || "Sales Rep"} (${profile.job_title || "Account Executive"})
${methodologySection}
${companyKnowledge?.length ? `
Available Products/Knowledge:
${companyKnowledge.map(k => `- ${k.title}: ${k.content?.substring(0, 300)}`).join("\n")}
` : ""}

${dealInfo ? `
Related Deal:
- Deal: ${dealInfo.name}
- Stage: ${dealInfo.stage}
- Value: $${dealInfo.value?.toLocaleString() || "TBD"}
- Notes: ${dealInfo.notes || "None"}
` : ""}

Analyze the conversation to:
1. Extract who the prospect is (name, company, role if mentioned)
2. Identify the key challenges/needs discussed
3. Pull out any product recommendations that were made
4. Determine what the call objective should be

Generate a structured sales prep document with the following JSON format:
{
  "title": "Descriptive prep title based on the situation",
  "prospect_name": "Name if mentioned, or null",
  "prospect_company": "Company if mentioned, or null", 
  "prospect_role": "Role if mentioned, or null",
  "call_type": "Discovery Call, Product Demo, Follow-up, etc.",
  "call_objective": "What to accomplish based on the conversation",
  "talking_points": [
    {"point": "Key talking point from the conversation", "detail": "Supporting detail or stat"}
  ],
  "discovery_questions": [
    {"question": "Question to ask based on their situation", "purpose": "Why this matters"}
  ],
  "product_recommendations": [
    {"product": "Product name that was recommended", "value_prop": "Why it fits their specific needs"}
  ],
  "objection_handlers": [
    {"objection": "Potential concern they might have", "response": "How to address it"}
  ],
  "next_steps": "Recommended next steps based on the conversation"
}

Generate 3-5 items for talking_points, discovery_questions, and product_recommendations.
Generate 2-3 objection_handlers.
Be SPECIFIC to what was discussed - don't be generic!`;

    const userPrompt = `Here is the conversation to analyze and turn into a sales prep document:

${conversationContext}

Extract all relevant details and create a comprehensive prep document. Return ONLY valid JSON, no markdown or explanation.`;

    // Call AI API
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let parsedContent;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedContent = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      parsedContent = {
        title: "Sales Prep Document",
        prospect_name: null,
        prospect_company: null,
        prospect_role: null,
        call_type: "Follow-up Call",
        call_objective: "Review recommendations and address questions",
        talking_points: [{ point: "Review the recommendations discussed", detail: "Based on the conversation" }],
        discovery_questions: [{ question: "What are your main priorities for this season?", purpose: "Understand their needs" }],
        product_recommendations: [],
        objection_handlers: [],
        next_steps: "Schedule a follow-up call to finalize the plan",
      };
    }

    // Save to database
    const { data: document, error: insertError } = await supabase
      .from("sales_prep_documents")
      .insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        deal_id: dealId || null,
        title: parsedContent.title || "Sales Prep Document",
        prospect_name: parsedContent.prospect_name,
        prospect_company: parsedContent.prospect_company,
        prospect_role: parsedContent.prospect_role,
        call_type: parsedContent.call_type,
        call_objective: parsedContent.call_objective,
        talking_points: parsedContent.talking_points,
        discovery_questions: parsedContent.discovery_questions,
        product_recommendations: parsedContent.product_recommendations,
        objection_handlers: parsedContent.objection_handlers,
        next_steps: parsedContent.next_steps,
        is_public: false,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          ...document,
          company_name: company?.name,
          company_logo: company?.logo_url,
          seller_name: profile.full_name,
          seller_title: profile.job_title,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating prep document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
