import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationContext, companyId } = await req.json();
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!conversationContext) {
      return new Response(
        JSON.stringify({ products: [], customerName: '', farmName: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch company's product catalog from company_knowledge
    let productCatalog = '';
    if (companyId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledge } = await supabase
        .from('company_knowledge')
        .select('title, content, category')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('category', ['products', 'pricing', 'services', 'catalog']);

      if (knowledge && knowledge.length > 0) {
        productCatalog = `\n\nCOMPANY PRODUCT CATALOG (ONLY recommend products from this list):\n${knowledge.map(k => `- ${k.title}: ${k.content?.substring(0, 500) || ''}`).join('\n')}`;
      }
    }

    const systemPrompt = `You are a helpful assistant that extracts product recommendations from sales conversations.
${productCatalog ? `\nIMPORTANT: Only recommend products that exist in the company's product catalog provided below. Do not invent or suggest products not in the catalog.${productCatalog}` : ''}

## CRITICAL PRICING RULES:
- **NEVER FABRICATE PRICES** - Only include prices that were explicitly mentioned in the conversation OR appear in the product catalog above.
- If no price was mentioned or found in the catalog, set price to empty string "".
- Do NOT estimate, guess, or invent pricing information.
- For revenue/ROI estimates in benefits, use phrases like "Potential increase (not guaranteed)" rather than specific dollar amounts.

Analyze the conversation and extract:
1. Any products or services recommended (MUST be from the company catalog if provided)
2. Customer/prospect name if mentioned
3. Farm or operation name if mentioned
4. A suitable intro message for a proposal

Return a JSON object with this structure:
{
  "products": [
    {
      "name": "Product Name",
      "pitch": "One-liner pitch or description",
      "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "price": "Price if explicitly mentioned in conversation or catalog, otherwise empty string"
    }
  ],
  "customerName": "Customer name if mentioned",
  "farmName": "Farm/operation name if mentioned",
  "introMessage": "A personalized intro based on the conversation"
}

Rules:
- Extract ALL products mentioned in recommendations${productCatalog ? ' that exist in the company catalog' : ''}
- For benefits, focus on specific outcomes, not features
- Keep pitches concise (1 sentence)
- If no products found, return empty products array
- Make the intro message personal and reference the conversation
- **PRICING**: Only include price if it was EXPLICITLY stated - never fabricate prices`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract products from this conversation:\n\n${conversationContext}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      throw new Error('Failed to extract products');
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    
    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      parsed = { products: [], customerName: '', farmName: '', introMessage: '' };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract products error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        products: [],
        customerName: '',
        farmName: ''
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
