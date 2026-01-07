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
    console.log('Sales Coach function called');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { message, deal, conversationHistory } = await req.json();

    // Authenticate user
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch sales knowledge relevant to the deal stage
    const stage = deal?.stage || 'prospecting';
    const { data: knowledge } = await supabase
      .from('sales_knowledge')
      .select('title, content, stage, category')
      .or(`stage.eq.${stage},category.eq.general`)
      .eq('is_active', true)
      .limit(10);

    const knowledgeContext = knowledge?.length 
      ? `\n\nSALES METHODOLOGY & KNOWLEDGE:\n${knowledge.map(k => `### ${k.title}\n${k.content}`).join('\n\n')}`
      : '';

    // Build deal context
    const dealContext = deal ? `
CURRENT DEAL:
- Name: ${deal.deal_name || 'Unknown'}
- Company: ${deal.sales_companies?.name || 'Unknown'}
- Stage: ${deal.stage || 'prospecting'}
- Value: $${deal.value?.toLocaleString() || 'Not specified'}
- Expected Close: ${deal.expected_close_date || 'Not set'}
- Priority: ${deal.priority || 3}/5
- Probability: ${deal.probability || 50}%
- Notes: ${deal.notes || 'None'}
` : '';

    const systemPrompt = `You are Jericho, an expert agricultural sales coach specializing in helping ag salespeople close more deals. You understand:
- Agricultural products and services (fertilizer, seed, equipment, chemicals, precision ag)
- Farm operations and grower decision-making cycles
- Seasonal buying patterns and budget timing
- Building long-term relationships with farmers and cooperatives

Your coaching style:
- Direct and practical - farmers don't have time for fluff
- Use specific examples and scripts when helpful
- Ask probing questions to understand the real situation
- Challenge assumptions and push for action
- Celebrate wins and learn from losses

SALES STAGES:
1. PROSPECTING: Identifying and qualifying potential customers
2. DISCOVERY: Understanding their operation, needs, challenges, budget
3. PROPOSAL: Presenting solutions tailored to their specific needs
4. CLOSING: Asking for the business and handling objections
5. FOLLOW-UP: Post-sale relationship building and expansion

${dealContext}
${knowledgeContext}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Provide specific, actionable advice. When analyzing a deal, give 3-4 concrete next steps. Be encouraging but honest.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact your administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'I couldn\'t generate a response.';

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sales coach error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
