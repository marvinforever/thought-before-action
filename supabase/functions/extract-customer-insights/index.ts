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
    const { message, customerName, companyId, profileId, conversationId, messageId } = await req.json();
    
    if (!message || !companyId || !profileId) {
      return new Response(
        JSON.stringify({ error: 'message, companyId, and profileId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Extracting insights from message about:', customerName || 'unknown customer');

    const prompt = `Analyze this sales conversation message and extract any customer insights.

MESSAGE:
"${message}"

CUSTOMER NAME (if known): ${customerName || 'Unknown'}

Extract any of these insight types if present:
- buying_signal: Indicators they're ready to purchase (budget approval, timeline urgency, decision maker buy-in)
- objection: Concerns or pushback they've expressed
- preference: Their preferred way of doing business, communication, products
- opportunity: Cross-sell or upsell opportunities
- relationship: Key relationships mentioned (other decision makers, influencers)
- competitor_mention: Mentions of competitors or alternative solutions
- budget_info: Budget constraints or approvals mentioned
- timeline: Timing expectations or deadlines
- decision_maker: Who makes the buying decision
- pain_point: Problems or challenges they're facing

Only extract GENUINE insights from the message. If the message is just casual chat or doesn't contain actionable insights, return an empty array.

Respond with JSON:
{
  "insights": [
    {
      "type": "insight_type",
      "text": "The actual insight extracted",
      "confidence": "low" | "medium" | "high",
      "products_mentioned": ["any products mentioned"]
    }
  ],
  "customer_name_detected": "Name if mentioned in message"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast, cheap for extraction
        messages: [
          { role: 'system', content: 'You are a sales intelligence analyst. Extract actionable customer insights from sales conversations. Be conservative - only extract genuine, useful insights.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error('AI error:', await response.text());
      return new Response(
        JSON.stringify({ insights: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const extractionText = aiData.choices?.[0]?.message?.content || '{}';
    
    let extraction;
    try {
      extraction = JSON.parse(extractionText);
    } catch (e) {
      console.error('Failed to parse extraction:', extractionText);
      return new Response(
        JSON.stringify({ insights: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extraction.insights || extraction.insights.length === 0) {
      return new Response(
        JSON.stringify({ insights: [], message: 'No insights detected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted insights:', extraction.insights);

    // Try to find the customer in sales_companies
    const detectedName = extraction.customer_name_detected || customerName;
    let customerId = null;
    
    if (detectedName) {
      const { data: customer } = await supabase
        .from('sales_companies')
        .select('id')
        .eq('company_id', companyId)
        .ilike('name', `%${detectedName}%`)
        .limit(1)
        .single();
      
      if (customer) {
        customerId = customer.id;
      }
    }

    // Save insights to database
    const savedInsights = [];
    for (const insight of extraction.insights) {
      const { data, error } = await supabase
        .from('customer_insights')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          customer_name: detectedName || 'Unknown',
          profile_id: profileId,
          insight_type: insight.type,
          insight_text: insight.text,
          confidence: insight.confidence === 'high' ? 0.9 : insight.confidence === 'medium' ? 0.7 : 0.5,
          products_mentioned: insight.products_mentioned || [],
          source_message_id: messageId,
          source_conversation_id: conversationId,
          is_actionable: ['buying_signal', 'opportunity', 'timeline', 'budget_info'].includes(insight.type),
          is_active: true,
        })
        .select()
        .single();

      if (!error && data) {
        savedInsights.push(data);
      } else if (error) {
        console.error('Error saving insight:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights: savedInsights,
        customerDetected: detectedName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-customer-insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
