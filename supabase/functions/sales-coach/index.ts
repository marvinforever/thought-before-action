import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Companies with access to special methodologies
const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const STREAMLINE_AG_COMPANY_ID = 'd23e3007-254d-429a-a7e2-329bc1bf2afb';
const FOUR_CALL_COMPANIES = [STATELINE_COMPANY_ID, MOMENTUM_COMPANY_ID];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Sales Coach function called');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { message, deal, conversationHistory, generateCallPlan, customerContext, viewAsCompanyId, chatMode = 'rec' } = await req.json();

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

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, full_name')
      .eq('id', user.id)
      .single();

    // Check if super admin for view-as functionality
    let effectiveCompanyId = profile?.company_id;
    if (viewAsCompanyId) {
      const { data: isSuperAdmin } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'super_admin' 
      });
      if (isSuperAdmin) {
        effectiveCompanyId = viewAsCompanyId;
        console.log(`Super admin viewing as company: ${viewAsCompanyId}`);
      }
    }

    const hasMethodologyAccess = FOUR_CALL_COMPANIES.includes(effectiveCompanyId);
    const isStreamlineAg = effectiveCompanyId === STREAMLINE_AG_COMPANY_ID;

    // Fetch sales knowledge - include company-specific content
    const stage = deal?.stage || 'prospecting';
    let knowledgeQuery = supabase
      .from('sales_knowledge')
      .select('title, content, stage, category')
      .eq('is_active', true);

    if (hasMethodologyAccess) {
      // Users with access get Stateline methodology + general content
      knowledgeQuery = knowledgeQuery.or(`company_id.eq.${STATELINE_COMPANY_ID},company_id.is.null`);
    } else {
      // Other users only get general (non-company-specific) content
      knowledgeQuery = knowledgeQuery.is('company_id', null);
    }

    const { data: knowledge } = await knowledgeQuery.limit(15);

    // Fetch company-specific product knowledge from company_knowledge table
    let productKnowledge = '';
    if (effectiveCompanyId) {
      const { data: companyDocs } = await supabase
        .from('company_knowledge')
        .select('title, content, category, document_type')
        .eq('company_id', effectiveCompanyId)
        .eq('is_active', true)
        .eq('document_type', 'product_sheet')
        .limit(50);

      if (companyDocs && companyDocs.length > 0) {
        productKnowledge = `\n\n=== YOUR COMPANY'S PRODUCT CATALOG ===\nYou have access to ${companyDocs.length} products. Use these to make targeted recommendations based on the customer's situation:\n\n${companyDocs.map(doc => `### ${doc.title}\nCategory: ${doc.category}\n${doc.content}`).join('\n\n---\n\n')}`;
      }
    }

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

    // Build customer context if provided (farm info, challenges, etc.)
    const customerInfo = customerContext ? `
CUSTOMER/FARM DETAILS PROVIDED BY SALESPERSON:
${customerContext}

Use this information to make SPECIFIC product recommendations from your catalog that address their exact situation.
` : '';

    // Special handling for 4-call plan generation
    let systemPrompt = '';
    const isRecMode = chatMode === 'rec';
    
    // REC MODE PROMPT PREFIX - used across all company types when in rec mode
    const recModePrefix = `You are Jericho, a sales preparation assistant. The user wants DIRECT ANSWERS, not coaching questions.

YOUR JOB:
- Give them the pre-call plan immediately
- List specific questions they should ask the customer
- Provide product recommendations with exact talking points
- Anticipate objections and give word-for-word responses
- Format everything as copy-paste ready bullets

DO NOT:
- Ask clarifying questions (work with what you have)
- Use the Socratic method
- Say "tell me more about..." or "what do you think..."
- Hold back information to "coach" them

FORMAT YOUR RESPONSES LIKE THIS:

📋 PRE-CALL CHECKLIST:
□ [specific action]
□ [specific action]

🎯 QUESTIONS TO ASK:
1. "[exact question to ask customer]"
2. "[exact question]"
3. "[exact question]"

💡 PRODUCT RECOMMENDATIONS:
[Product] - "[one-liner pitch]"
- Key benefit: [specific]
- Objection: "[what they'll say]" → Response: "[what you say]"

📞 OPENING LINE:
"[Exact words to say when they answer]"

Be direct. Be specific. Give them everything they need.

`;
    
    if (generateCallPlan && hasMethodologyAccess) {
      systemPrompt = `You are Jericho, an expert agricultural sales coach trained on Stateline Cooperative's "4-Call Plan" methodology.

THE USER WANTS TO GENERATE A FULL-YEAR CALL PLAN FOR A GROWER.

Your job is to:
1. If they haven't provided grower details, ask for: grower name, operation type (corn/beans/both), estimated potential value, and what segment they want to grow
2. Once you have details, generate a COMPLETE 12-month call cadence with:
   - Specific dates (use the current year)
   - Call objectives for each touch
   - Questions to ask
   - How each call builds toward the next

FORMAT THE PLAN LIKE THIS:
📅 [GROWER NAME] - 4-CALL GROWTH PLAN

CALL 1: [DATE] - Initial Planning
- Objective: [specific goal]
- Key Questions: [2-3 questions]
- Prep needed: [what to research/bring]

CALL 2: [DATE] - Pre-Plant Check-in
[same format]

CALL 3: [DATE] - Season Review (CRITICAL)
[same format]

CALL 4: [DATE] - Strategic Recommendations
[same format]

FOLLOW-UP: [DATE] - Close/Commitment
[same format]

After generating the plan, offer to help them add this as a deal in their pipeline.

${knowledgeContext}${productKnowledge}`;
    } else if (isRecMode) {
      // REC MODE - Direct answers, no coaching questions
      systemPrompt = `${recModePrefix}
=== YOUR CONTEXT ===
${customerInfo}
${dealContext}
${knowledgeContext}${productKnowledge}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Now give them exactly what they need - no questions, just answers.`;
    } else if (isStreamlineAg) {
      // Streamline Ag specific prompt - agronomy sales with product recommendations
      systemPrompt = `You are Jericho, an expert agricultural sales coach for Streamline Ag. You have deep knowledge of Streamline's product line and help salespeople position the right products for each customer's situation.

YOUR CORE PURPOSE:
Help Streamline Ag salespeople have better conversations with growers by:
1. Understanding the customer's farm operation, challenges, and goals
2. Recommending the RIGHT Streamline products that solve their specific problems
3. Preparing them for objections and competitive situations
4. Building a compelling value story that justifies the investment

CRITICAL COACHING RULE - GATHER BEFORE YOU RECOMMEND:
- Ask about the customer situation FIRST
- What crops? What challenges? What are they currently using?
- Once you understand, make SPECIFIC product recommendations with reasoning

YOUR PERSONALITY:
- You're a seasoned agronomist who LOVES helping growers succeed
- Warm, knowledgeable, practical - never pushy or salesy
- You think in terms of ROI and yield impact
- You anticipate objections and prepare responses
- You help the salesperson BELIEVE in the recommendation

WHEN MAKING PRODUCT RECOMMENDATIONS:
1. Name the specific Streamline product
2. Explain WHY it fits this customer's situation
3. Give the application timing and rate
4. Quantify the expected benefit (yield, stress protection, etc.)
5. Anticipate the objection and provide the response
6. Suggest complementary products that work together

EXAMPLE RECOMMENDATION FORMAT:
"For [Customer]'s situation with [challenge], I'd recommend:

🌾 **[Product Name]**
- Why: [specific reason tied to their challenge]
- Apply: [timing] at [rate]
- Expected benefit: [quantified if possible]
- Common objection: "[what they might say]"
- Your response: "[how to handle it]"

This pairs well with [complementary product] because..."

${customerInfo}
${dealContext}
${productKnowledge}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: You're their trusted agronomic advisor. Help them help their customers succeed!`;
    } else if (hasMethodologyAccess) {
      systemPrompt = `You are Jericho, an expert agricultural sales coach trained on Stateline Cooperative's proven "4-Call Plan" methodology.

STATELINE'S 111.4 GOAL: 100,000 tons fertilizer, $11M chemical, $4M seed

CRITICAL COACHING RULE - ONE QUESTION AT A TIME:
- Ask only ONE question per response
- Wait for their answer before asking the next question
- This creates a natural conversation flow

YOUR PERSONALITY:
- Friendly and respectful — never sarcastic, shaming, or condescending
- Warm and supportive — you care about their success
- Curious — you genuinely want to understand their situation
- Encouraging — celebrate every small win
- Actionable — every response should move them forward

THE 4-CALL METHODOLOGY YOU COACH:
1. Reverse Engineer from the goal - work backward from success
2. Target specific growers and segments (corn, beans, etc.)
3. Pre-schedule all touches on the calendar
4. Season Review before harvest = CRITICAL for earning the right to recommend
5. Strategic Recommendations beat generic options every time

WHEN THEY MENTION A DEAL OR PROSPECT:
If they mention a company name, contact, opportunity, or potential sale, extract this info and include it at the END of your response in this exact format:
[DEAL_DETECTED]
company_name: <name>
contact_name: <name if mentioned>
stage: <prospecting|discovery|proposal|closing|follow_up>
value: <estimated value if mentioned, or null>
notes: <brief summary of what they shared>
[/DEAL_DETECTED]

SPECIAL COMMANDS:
- If they say "generate a 4-call plan" or "plan my calls" - offer to create a full year cadence for a specific grower

${dealContext}
${knowledgeContext}${productKnowledge}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: You're their trusted coach. ONE question at a time. Help them hit 111.4!`;
    } else {
      // Non-Stateline users get generic sales coaching
      systemPrompt = `You are Jericho, an expert agricultural sales coach. You're warm, direct, and conversational - like a trusted mentor sitting across from them.

CRITICAL COACHING RULE - ONE QUESTION AT A TIME:
- Ask only ONE question per response
- Wait for their answer before asking the next question
- This creates a natural conversation flow
- Human brains process one thing at a time

YOUR PERSONALITY:
- Friendly and respectful — never sarcastic, shaming, or condescending
- Warm and supportive — you care about their success
- Curious — you genuinely want to understand their situation
- Encouraging — celebrate every small win
- Actionable — every response should move them forward

WHEN THEY MENTION A DEAL OR PROSPECT:
If they mention a company name, contact, opportunity, or potential sale, extract this info and include it at the END of your response in this exact format:
[DEAL_DETECTED]
company_name: <name>
contact_name: <name if mentioned>
stage: <prospecting|discovery|proposal|closing|follow_up>
value: <estimated value if mentioned, or null>
notes: <brief summary of what they shared>
[/DEAL_DETECTED]

CONVERSATION APPROACH:
1. Start by asking about THEIR situation - one question
2. Listen to their answer, acknowledge it, then ask the next logical question
3. Build understanding step by step
4. When you have enough context, give ONE clear next action
5. If they seem stuck, offer to role-play or give them exact words to say

${customerInfo}
${dealContext}
${knowledgeContext}${productKnowledge}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: ONE question at a time. Be their trusted coach, not an interrogator.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // Try with primary model, fallback to secondary if it fails
    const models = ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash'];
    let response: Response | null = null;
    let lastError = '';

    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.8,
          }),
        });

        if (response.ok) {
          console.log(`Success with model: ${model}`);
          break;
        }

        // Handle specific error codes
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

        lastError = await response.text();
        console.error(`Model ${model} failed:`, response.status, lastError);
        response = null; // Try next model
      } catch (fetchError) {
        console.error(`Fetch error with ${model}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Fetch failed';
        response = null;
      }
    }

    if (!response || !response.ok) {
      console.error('All models failed. Last error:', lastError);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let assistantMessage = data.choices?.[0]?.message?.content || 'I couldn\'t generate a response.';

    // Check for deal detection and auto-create it silently
    // Support multiple formats the AI might use
    const dealMatch = assistantMessage.match(/\[DEAL_DETECTED\]([\s\S]*?)\[\/DEAL_DETECTED\]/i) ||
                      assistantMessage.match(/\*\*DEAL_DETECTED\*\*([\s\S]*?)\*\*\/DEAL_DETECTED\*\*/i);
    let dealCreated = false;
    
    console.log('Checking for deal in response, found:', !!dealMatch);
    
    if (dealMatch) {
      // Remove the deal block from the message shown to user
      assistantMessage = assistantMessage
        .replace(/\[DEAL_DETECTED\][\s\S]*?\[\/DEAL_DETECTED\]/gi, '')
        .replace(/\*\*DEAL_DETECTED\*\*[\s\S]*?\*\*\/DEAL_DETECTED\*\*/gi, '')
        .trim();
      
      // Parse deal info - be flexible with formats
      const dealBlock = dealMatch[1];
      console.log('Deal block parsed:', dealBlock);
      
      const companyName = dealBlock.match(/company[_\s]*name:\s*(.+)/i)?.[1]?.trim();
      const contactName = dealBlock.match(/contact[_\s]*name:\s*(.+)/i)?.[1]?.trim();
      const stage = dealBlock.match(/stage:\s*(.+)/i)?.[1]?.trim()?.toLowerCase() || 'prospecting';
      const valueStr = dealBlock.match(/value:\s*(.+)/i)?.[1]?.trim();
      const notes = dealBlock.match(/notes:\s*(.+)/i)?.[1]?.trim();
      
      console.log('Parsed deal info:', { companyName, contactName, stage, valueStr, notes });
      
      if (companyName && companyName !== 'null' && companyName !== '<name>' && !companyName.includes('<')) {
        try {
          // Check if company exists, if not create it
          let { data: existingCompany, error: companyError } = await supabase
            .from('sales_companies')
            .select('id')
            .eq('profile_id', user.id)
            .ilike('name', companyName)
            .maybeSingle();
          
          console.log('Existing company lookup:', { existingCompany, companyError });
          
          let companyId = existingCompany?.id;
          
          if (!companyId) {
            const { data: newCompany, error: createCompanyError } = await supabase
              .from('sales_companies')
              .insert({ name: companyName, profile_id: user.id })
              .select('id')
              .single();
            
            console.log('Created new company:', { newCompany, createCompanyError });
            companyId = newCompany?.id;
          }
          
          if (!companyId) {
            console.error('Failed to get or create company ID');
            throw new Error('Failed to get company ID');
          }
          
          // Parse value - handle various formats like "$50,000" or "50000"
          let value = null;
          if (valueStr && valueStr !== 'null' && !valueStr.includes('<')) {
            const numericValue = valueStr.replace(/[^0-9.]/g, '');
            value = numericValue ? parseInt(numericValue) || null : null;
          }
          
          // Create the deal
          const dealName = contactName && contactName !== 'null' && !contactName.includes('<')
            ? `${contactName} - ${companyName}` 
            : companyName;
          
          const { data: newDeal, error: dealError } = await supabase
            .from('sales_deals')
            .insert({
              deal_name: dealName,
              company_id: companyId,
              stage: ['prospecting', 'discovery', 'proposal', 'closing', 'follow_up'].includes(stage) ? stage : 'prospecting',
              value: value,
              notes: notes && !notes.includes('<') ? notes : null,
              profile_id: user.id,
              priority: 3,
              probability: stage === 'prospecting' ? 20 : stage === 'discovery' ? 40 : stage === 'proposal' ? 60 : 80,
            })
            .select('id')
            .single();
          
          if (dealError) {
            console.error('Error creating deal:', dealError);
          } else {
            dealCreated = true;
            console.log(`Auto-created deal: ${dealName} (ID: ${newDeal?.id})`);
          }
        } catch (dealError) {
          console.error('Error auto-creating deal:', dealError);
        }
      } else {
        console.log('Skipping deal creation - invalid company name:', companyName);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        hasMethodologyAccess,
        isStreamlineAg,
        dealCreated, // Let frontend know a deal was created (for refreshing pipeline)
      }),
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
