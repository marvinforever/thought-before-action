import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { customerId, customerName, productContext, conversationContext, companyId } = await req.json();

    if (!customerName) {
      return new Response(JSON.stringify({ error: "Customer name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gather customer data
    let customerData = "";
    let purchaseHistory = "";
    let knowledgeContent = "";

    if (customerId) {
      const { data: customer } = await supabase
        .from("sales_companies")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customer) {
        customerData = `Customer: ${customer.name}\nLocation: ${customer.location || "Unknown"}\nIndustry: ${customer.industry || "Agriculture"}\nOperation Details: ${JSON.stringify(customer.operation_details || {})}\nGroower History: ${customer.grower_history || "No history"}`;
      }
    }

    // Get purchase history
    if (companyId && customerName) {
      const { data: purchases } = await supabase
        .from("customer_purchase_history")
        .select("*")
        .eq("company_id", companyId)
        .ilike("customer_name", `%${customerName}%`)
        .limit(50);

      if (purchases && purchases.length > 0) {
        const topProducts = purchases.reduce((acc: Record<string, number>, p: any) => {
          acc[p.product_name] = (acc[p.product_name] || 0) + Number(p.total_amount || 0);
          return acc;
        }, {});
        const sorted = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        purchaseHistory = `\nPurchase History:\n${sorted.map(([p, v]) => `- ${p}: $${v.toLocaleString()}`).join("\n")}`;
      }
    }

    // Get company knowledge (product catalog, etc.)
    if (companyId) {
      const { data: knowledge } = await supabase
        .from("company_knowledge")
        .select("title, content, category")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .in("category", ["product_catalog", "product", "sales_materials"])
        .limit(10);

      if (knowledge && knowledge.length > 0) {
        knowledgeContent = `\nProduct Knowledge:\n${knowledge.map(k => `[${k.title}]: ${(k.content || "").substring(0, 2000)}`).join("\n\n")}`;
      }
    }

    // Generate pitch deck content with AI
    const prompt = `You are creating a product pitch deck for a sales meeting. Generate a JSON object for a compelling presentation.

CUSTOMER CONTEXT:
${customerData || `Customer Name: ${customerName}`}
${purchaseHistory}
${knowledgeContent}

PRODUCT/CONVERSATION CONTEXT:
${productContext || conversationContext || "General product overview meeting"}

Generate a JSON response with this EXACT structure:
{
  "title": "Short presentation title (e.g., 'Growth Solutions for [Customer]')",
  "subtitle": "A compelling tagline",
  "customerName": "Customer name",
  "slides": [
    {
      "type": "intro",
      "title": "Opening slide title",
      "subtitle": "Subtitle",
      "bulletPoints": ["Key point 1", "Key point 2"]
    },
    {
      "type": "challenge",
      "title": "Understanding Your Operation",
      "bulletPoints": ["Challenge/need 1 specific to this customer", "Challenge/need 2", "Challenge/need 3"],
      "note": "Brief speaker note"
    },
    {
      "type": "solution",
      "title": "Our Recommended Solution",
      "bulletPoints": ["Solution point 1 with specific product", "Solution point 2", "Solution point 3"],
      "note": "Brief speaker note"
    },
    {
      "type": "benefits",
      "title": "Expected Results",
      "items": [
        {"label": "Yield Impact", "value": "+X bu/acre", "detail": "Based on..."},
        {"label": "ROI", "value": "$X/acre", "detail": "Compared to..."},
        {"label": "Efficiency", "value": "X% improvement", "detail": "Through..."}
      ]
    },
    {
      "type": "products",
      "title": "Recommended Products",
      "products": [
        {"name": "Product Name", "description": "What it does", "benefit": "Why it matters for this customer"}
      ]
    },
    {
      "type": "timeline",
      "title": "Seasonal Program",
      "steps": [
        {"timing": "Pre-Season", "action": "Action item", "product": "Related product"},
        {"timing": "Early Season", "action": "Action item", "product": "Related product"},
        {"timing": "Mid-Season", "action": "Action item", "product": "Related product"}
      ]
    },
    {
      "type": "closing",
      "title": "Next Steps",
      "bulletPoints": ["Specific next step 1", "Next step 2", "Next step 3"],
      "callToAction": "Let's build your program together"
    }
  ]
}

RULES:
- Tailor EVERYTHING to this specific customer
- Use their purchase history to inform recommendations
- If product data is available, reference REAL products only
- Keep bullet points concise (under 15 words each)
- Include 5-7 slides total
- Make ROI/value props specific with numbers when possible`;

    const result = await callAI(
      { taskType: "chat", functionName: "generate-pitch-deck" },
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 4096 }
    );

    let deckData;
    try {
      const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      deckData = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deck: deckData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating pitch deck:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
