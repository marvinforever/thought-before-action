import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { dealId, callType, callObjective, prospectName, prospectCompany, prospectRole, conversationContext } = await req.json();

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

    // Build prompt for AI
    const systemPrompt = `You are a sales preparation document generator. Create professional, actionable sales prep content.

Company: ${company?.name || "Unknown"}
Seller: ${profile.full_name || "Sales Rep"} (${profile.job_title || "Account Executive"})

${companyKnowledge?.length ? `
Company Products/Knowledge:
${companyKnowledge.map(k => `- ${k.title}: ${k.content?.substring(0, 200)}`).join("\n")}
` : ""}

${dealInfo ? `
Deal Context:
- Deal: ${dealInfo.name}
- Stage: ${dealInfo.stage}
- Value: $${dealInfo.value?.toLocaleString() || "TBD"}
- Notes: ${dealInfo.notes || "None"}
` : ""}

Generate a structured sales prep document with the following JSON format:
{
  "title": "Call prep title",
  "talking_points": [
    {"point": "Key talking point", "detail": "Supporting detail or stat"}
  ],
  "discovery_questions": [
    {"question": "Question to ask", "purpose": "Why this matters"}
  ],
  "product_recommendations": [
    {"product": "Product name", "value_prop": "Why it fits their needs"}
  ],
  "objection_handlers": [
    {"objection": "Common objection", "response": "How to handle it"}
  ],
  "next_steps": "Recommended next steps after the call"
}

Generate 3-5 items for each array. Be specific and actionable. Focus on the prospect's perspective and business value.`;

    const userPrompt = `Generate a sales prep document for:
- Call Type: ${callType || "Discovery Call"}
- Objective: ${callObjective || "Understand their needs and qualify the opportunity"}
- Prospect: ${prospectName || "Unknown"} at ${prospectCompany || "Unknown Company"} (${prospectRole || "Decision Maker"})

${conversationContext ? `Recent conversation context:\n${conversationContext}` : ""}

Return ONLY valid JSON, no markdown or explanation.`;

    // Call AI API
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
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
        title: `${callType || "Sales"} Prep - ${prospectCompany || "Prospect"}`,
        talking_points: [{ point: "Unable to generate", detail: "Please try again" }],
        discovery_questions: [{ question: "What are your main priorities?", purpose: "Understand their needs" }],
        product_recommendations: [],
        objection_handlers: [],
        next_steps: "Schedule a follow-up call",
      };
    }

    // Save to database
    const { data: document, error: insertError } = await supabase
      .from("sales_prep_documents")
      .insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        deal_id: dealId || null,
        title: parsedContent.title || `${callType || "Sales"} Prep - ${prospectCompany || "Prospect"}`,
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_role: prospectRole,
        call_type: callType,
        call_objective: callObjective,
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
