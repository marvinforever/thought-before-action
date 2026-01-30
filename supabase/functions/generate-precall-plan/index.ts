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
    const { customerName, selectedProducts, allProducts, totalRevenue, companyId } = await req.json();

    if (!customerName || !selectedProducts || selectedProducts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Customer name and at least one selected product are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch relevant sales training from knowledge base
    let trainingContext = '';
    
    if (companyId) {
      console.log(`Fetching sales training for company: ${companyId}`);
      
      // Fetch training materials relevant to pre-call planning
      // Categories: discovery, prospecting, objection_handling, sales_scripts, product_catalog
      const { data: trainingData, error: trainingError } = await supabase
        .from('sales_knowledge')
        .select('title, content, category, stage, tags')
        .eq('is_active', true)
        .or(`company_id.eq.${companyId},company_id.is.null,is_global.eq.true`)
        .in('category', ['discovery', 'objection_handling', 'sales_scripts', 'prospecting', 'methodology', 'training'])
        .limit(10);

      if (!trainingError && trainingData && trainingData.length > 0) {
        console.log(`Found ${trainingData.length} training materials`);
        
        // Organize by category for better context
        const byCategory: Record<string, string[]> = {};
        
        for (const item of trainingData) {
          const cat = item.category || 'general';
          if (!byCategory[cat]) byCategory[cat] = [];
          
          // Include title and truncated content
          const content = item.content.length > 800 
            ? item.content.substring(0, 800) + '...' 
            : item.content;
          byCategory[cat].push(`**${item.title}**:\n${content}`);
        }

        trainingContext = '\n\n## YOUR SALES TRAINING FRAMEWORKS:\n';
        
        if (byCategory['methodology']) {
          trainingContext += '\n### Sales Methodology:\n' + byCategory['methodology'].join('\n\n');
        }
        if (byCategory['discovery']) {
          trainingContext += '\n### Discovery Questions:\n' + byCategory['discovery'].join('\n\n');
        }
        if (byCategory['objection_handling']) {
          trainingContext += '\n### Objection Handling:\n' + byCategory['objection_handling'].join('\n\n');
        }
        if (byCategory['sales_scripts']) {
          trainingContext += '\n### Sales Scripts:\n' + byCategory['sales_scripts'].join('\n\n');
        }
        if (byCategory['prospecting']) {
          trainingContext += '\n### Prospecting Framework:\n' + byCategory['prospecting'].join('\n\n');
        }
        if (byCategory['training']) {
          trainingContext += '\n### Training Notes:\n' + byCategory['training'].join('\n\n');
        }
      } else {
        console.log('No training materials found, using defaults');
      }
    }

    // Format product lists for the prompt
    const selectedProductsText = selectedProducts
      .map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`)
      .join('\n');

    const allProductsText = allProducts
      .map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`)
      .join('\n');

    const systemPrompt = `You are Jericho, an expert agricultural sales coach. Generate a concise, actionable pre-call plan for an initial planning call with a grower customer.

${trainingContext ? `IMPORTANT: Use the sales training frameworks provided below to structure your recommendations. Reference specific techniques, questions, and approaches from the training.${trainingContext}` : ''}

Your response should be structured and practical, incorporating the training frameworks above:

1. **Call Objectives** (2-3 bullet points of what to accomplish - align with methodology if provided)
2. **Opening Approach** (how to start the conversation - use scripts/frameworks if provided)
3. **Key Discussion Points** (for each selected product, provide 1-2 talking points about value, timing, or application)
4. **Discovery Questions** (3-4 questions - MUST use discovery framework from training if available)
5. **Anticipated Objections & Responses** (2-3 likely objections with handling techniques from training)
6. **Cross-Sell Opportunities** (based on their 2025 purchases, suggest 1-2 related products they might need)
7. **Success Metrics** (how to know if the call was successful)

Keep it brief and actionable - this is a field reference, not a report. If training frameworks are provided, explicitly reference them (e.g., "Using the ACAVE model..." or "Following your 5-Step Process...").`;

    const userPrompt = `Create a pre-call plan for **${customerName}** (2025 Revenue: $${totalRevenue?.toLocaleString() || 0}).

**Products to focus on in this call:**
${selectedProductsText}

**Their complete 2025 purchase history:**
${allProductsText}

Generate a practical pre-call plan I can reference before and during the call. Make sure to incorporate my sales training frameworks and methodologies.`;

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
      JSON.stringify({ 
        plan,
        trainingUsed: trainingContext ? true : false 
      }),
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
