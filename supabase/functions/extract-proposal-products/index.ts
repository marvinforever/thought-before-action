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
    const { conversationContext } = await req.json();
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!conversationContext) {
      return new Response(
        JSON.stringify({ products: [], customerName: '', farmName: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a helpful assistant that extracts product recommendations from sales conversations.

Analyze the conversation and extract:
1. Any products or services recommended
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
      "price": "Price if mentioned, otherwise empty string"
    }
  ],
  "customerName": "Customer name if mentioned",
  "farmName": "Farm/operation name if mentioned",
  "introMessage": "A personalized intro based on the conversation"
}

Rules:
- Extract ALL products mentioned in recommendations
- For benefits, focus on specific outcomes, not features
- Keep pitches concise (1 sentence)
- If no products found, return empty products array
- Make the intro message personal and reference the conversation`;

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
