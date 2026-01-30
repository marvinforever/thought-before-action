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
    const { customerName, selectedProducts, allProducts, totalRevenue, companyId, customerIntelligence } = await req.json();

    if (!customerName) {
      return new Response(
        JSON.stringify({ error: 'Customer name is required' }),
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

    // Fetch ALL relevant sales training from knowledge base - comprehensive pull
    let trainingFrameworks = {
      methodology: '',
      discoveryQuestions: '',
      objectionHandling: '',
      appointmentSetting: '',
      closingTechniques: '',
      fourCallFramework: '',
      mindset: '',
    };
    
    if (companyId) {
      console.log(`Fetching comprehensive sales training for company: ${companyId}`);
      
      // Fetch ALL training materials - don't limit
      const { data: trainingData, error: trainingError } = await supabase
        .from('sales_knowledge')
        .select('title, content, category, stage, tags')
        .eq('is_active', true)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .in('category', [
          'discovery', 'objection_handling', 'sales_scripts', 'prospecting', 
          'methodology', 'training', 'questions', 'scripts', 'objections', 
          'process', 'closing', 'mindset', 'general', '4-call'
        ])
        .order('category');

      if (!trainingError && trainingData && trainingData.length > 0) {
        console.log(`Found ${trainingData.length} training materials`);
        
        for (const item of trainingData) {
          const fullContent = `### ${item.title}\n${item.content}\n\n`;
          
          switch (item.category) {
            case 'questions':
            case 'discovery':
            case 'process':
              trainingFrameworks.discoveryQuestions += fullContent;
              break;
            case 'objections':
            case 'objection_handling':
              trainingFrameworks.objectionHandling += fullContent;
              break;
            case 'scripts':
            case 'prospecting':
              trainingFrameworks.appointmentSetting += fullContent;
              break;
            case 'closing':
              trainingFrameworks.closingTechniques += fullContent;
              break;
            case '4-call':
            case 'training':
              trainingFrameworks.fourCallFramework += fullContent;
              break;
            case 'mindset':
              trainingFrameworks.mindset += fullContent;
              break;
            case 'general':
            case 'methodology':
            default:
              trainingFrameworks.methodology += fullContent;
              break;
          }
        }
      } else {
        console.log('No training materials found or error:', trainingError);
      }

      // Also fetch product knowledge for recommendations
      const { data: productData } = await supabase
        .from('sales_knowledge')
        .select('title, content')
        .eq('is_active', true)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .in('category', ['product_catalog', 'product_knowledge', 'product_sheet'])
        .limit(5);

      if (productData && productData.length > 0) {
        trainingFrameworks.methodology += '\n\n## PRODUCT KNOWLEDGE:\n';
        for (const p of productData) {
          trainingFrameworks.methodology += `### ${p.title}\n${p.content.slice(0, 1500)}\n\n`;
        }
      }
    }

    // Format product lists for the prompt
    const selectedProductsText = selectedProducts && selectedProducts.length > 0
      ? selectedProducts.map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`).join('\n')
      : 'No specific products selected - general consultation call';

    const allProductsText = allProducts && allProducts.length > 0
      ? allProducts.map((p: any) => `- ${p.product_description}: ${p.quantity?.toLocaleString() || 0} units, $${(p.amount || 0).toLocaleString()}`).join('\n')
      : 'No purchase history available';

    // Build customer intelligence context
    let customerContext = '';
    if (customerIntelligence) {
      if (customerIntelligence.relationship_notes) {
        customerContext += `\n**Previous Conversations:**\n${customerIntelligence.relationship_notes.slice(-2000)}\n`;
      }
      if (customerIntelligence.personal_details) {
        customerContext += `\n**Personal Details:** ${JSON.stringify(customerIntelligence.personal_details)}\n`;
      }
      if (customerIntelligence.preferences) {
        customerContext += `\n**Known Preferences:** ${JSON.stringify(customerIntelligence.preferences)}\n`;
      }
      if (customerIntelligence.buying_signals) {
        customerContext += `\n**Buying Signals:** ${JSON.stringify(customerIntelligence.buying_signals)}\n`;
      }
    }

    // Build the comprehensive system prompt with all training
    const systemPrompt = `You are Jericho, an expert agricultural sales coach using the Thrive Today Consultative Selling methodology. Your job is to prepare the sales rep to be a COMPLETE CONSULTANT for their customer call.

## CRITICAL PRICING RULES:
- **NEVER FABRICATE PRICES** - Do NOT invent product prices, discounts, or dollar amounts unless they appear in the data provided below.
- **REVENUE ESTIMATES** - When estimating potential gains or ROI:
  - Clearly state these are ESTIMATES, not guarantees
  - Use phrases like: "Possible gain (not guaranteed):", "Estimated potential:", "If typical results are achieved, could range..."
  - NEVER present speculative revenue numbers as facts
- **COMMODITY PRICES** - You may reference publicly available commodity prices (corn, soybeans, wheat) as market context, labeled as: "Current market prices suggest..."

## YOUR SALES METHODOLOGY TRAINING:
${trainingFrameworks.methodology}

## DISCOVERY QUESTIONS FRAMEWORK:
${trainingFrameworks.discoveryQuestions || `The "Magic Questions" approach:
1. "What are the two to three things you're looking to accomplish this season?"
2. "What else?" (keep asking - the LAST thing they share is often most important)
3. "Tell me more about [the last thing they mentioned]..."
Remember: Pain is the strongest motivator, then Fear, then Opportunity.`}

## APPOINTMENT SETTING & OPENING SCRIPTS:
${trainingFrameworks.appointmentSetting || `THE SCRIPT: "Hey [Customer], this is [Your Name] from [Your Company]. I've been meaning to put a face with a name. Going to be in your area next week. I've got [Day 1 at Time 1] and [Day 2 at Time 2] available. Which one works best?"`}

## OBJECTION HANDLING (ACAVE Model):
${trainingFrameworks.objectionHandling || `A = Acknowledge (normalize the question/concern)
C = Clarify (ask questions to lower tension and increase trust)
A = Answer (earn the right to offer your perspective)
V = Verify (confirm understanding)
E = End/Close (transition forward)`}

## CLOSING TECHNIQUES:
${trainingFrameworks.closingTechniques || 'Get them to tell you HOW to close them by asking the right questions during discovery.'}

## 4-CALL FRAMEWORK:
${trainingFrameworks.fourCallFramework}

## MINDSET:
${trainingFrameworks.mindset || 'Decrease tension, increase trust. Be a professional with a dependable, repeatable process.'}

---

Generate a COMPREHENSIVE pre-call plan that prepares the rep to be a complete consultant. Your plan MUST include ALL of the following sections:

## 1. 🎯 PRE-CALL CHECKLIST
- What to review before the call
- Materials/data to have ready
- Mental preparation reminders

## 2. 📞 OPENING LINE / APPOINTMENT CONFIRMATION
- Use the appointment setting script from training
- Include a warm, assumptive opening
- Reference something personal if available from customer intel

## 3. ❓ DISCOVERY QUESTIONS (5-7 questions)
- Use the "Magic Questions" framework from training
- Start with "What are the two to three things..."
- Include probing questions: "What else?" and "Tell me more about..."
- Questions about Pain, Fear, AND Opportunity
- Questions specific to their purchase history and products

## 4. 💡 PRODUCT RECOMMENDATIONS
- Based on their purchase history, suggest complementary products
- Identify gaps or opportunities (what they're NOT buying that they should)
- Cross-sell and up-sell suggestions with clear value propositions

## 5. 🛡️ OBJECTION HANDLING SCRIPTS
- Anticipate 3-4 likely objections for this customer
- Provide word-for-word responses using ACAVE methodology
- Include price objections, competitor objections, timing objections

## 6. 🎬 CLOSING APPROACH
- How to ask for the sale naturally
- Suggested commitment/next step to gain
- Alternative close options

## 7. 📅 FOLLOW-UP PLAN
- When to follow up after this call
- What to send/share post-call
- Calendar the next touch point

## 8. ✅ SUCCESS METRICS
- What does a successful call look like?
- Minimum outcomes to achieve
- Stretch goals if the call goes well

Be SPECIFIC to this customer. Reference their actual purchase history. Use their name. Make this actionable and practical - something the rep can print and reference during the call.`;

    const userPrompt = `Create a COMPLETE pre-call plan for **${customerName}** (2025 Revenue: $${totalRevenue?.toLocaleString() || 0}).

**Products to focus on in this call:**
${selectedProductsText}

**Their complete 2025 purchase history:**
${allProductsText}

${customerContext ? `**Customer Intelligence:**${customerContext}` : ''}

Generate a comprehensive, consultative pre-call plan that will prepare me to be a trusted advisor on this call. Include specific discovery questions, product recommendations, and objection handling scripts based on their actual data.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
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

    // Log what training was used
    const trainingUsed = {
      methodology: trainingFrameworks.methodology.length > 100,
      discoveryQuestions: trainingFrameworks.discoveryQuestions.length > 100,
      objectionHandling: trainingFrameworks.objectionHandling.length > 100,
      appointmentSetting: trainingFrameworks.appointmentSetting.length > 100,
      closingTechniques: trainingFrameworks.closingTechniques.length > 100,
      fourCallFramework: trainingFrameworks.fourCallFramework.length > 100,
    };
    console.log('Training frameworks used:', trainingUsed);

    return new Response(
      JSON.stringify({ 
        plan,
        trainingUsed: Object.values(trainingUsed).some(v => v),
        trainingDetails: trainingUsed,
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
