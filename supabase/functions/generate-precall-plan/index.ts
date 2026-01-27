import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerName, selectedProducts, allProducts, totalRevenue } = await req.json();

    if (!customerName || !selectedProducts || selectedProducts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Customer name and at least one selected product are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Format product lists for the prompt
    const selectedProductsText = selectedProducts
      .map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`)
      .join('\n');

    const allProductsText = allProducts
      .map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`)
      .join('\n');

    const systemPrompt = `You are Jericho, an expert agricultural sales coach. Generate a concise, actionable pre-call plan for an initial planning call with a grower customer.

Your response should be structured and practical:
1. **Call Objectives** (2-3 bullet points of what to accomplish)
2. **Key Discussion Points** (for each selected product, provide 1-2 talking points about value, timing, or application)
3. **Cross-Sell Opportunities** (based on their 2025 purchases, suggest 1-2 related products they might need)
4. **Questions to Ask** (3-4 discovery questions to understand their plans)
5. **Success Metrics** (how to know if the call was successful)

Keep it brief and actionable - this is a field reference, not a report.`;

    const userPrompt = `Create a pre-call plan for **${customerName}** (2025 Revenue: $${totalRevenue?.toLocaleString() || 0}).

**Products to focus on in this call:**
${selectedProductsText}

**Their complete 2025 purchase history:**
${allProductsText}

Generate a practical pre-call plan I can reference before and during the call.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const plan = data.choices?.[0]?.message?.content || 'Unable to generate plan.';

    return new Response(
      JSON.stringify({ plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating pre-call plan:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
