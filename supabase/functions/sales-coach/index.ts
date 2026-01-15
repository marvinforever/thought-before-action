import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Companies with access to proprietary Stateline methodologies
const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const STREAMLINE_AG_COMPANY_ID = 'd23e3007-254d-429a-a7e2-329bc1bf2afb';

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

    const hasMethodologyAccess = effectiveCompanyId === STATELINE_COMPANY_ID;
    const isStreamlineAg = effectiveCompanyId === STREAMLINE_AG_COMPANY_ID;

    // Fetch company name dynamically for personalized prompts
    let companyName = 'your company';
    if (effectiveCompanyId) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', effectiveCompanyId)
        .single();
      companyName = companyData?.name || 'your company';
      console.log(`Using company name: ${companyName}`);
    }

    // Fetch sales knowledge - include company-specific content
    const stage = deal?.stage || 'prospecting';
    let knowledgeQuery = supabase
      .from('sales_knowledge')
      .select('title, content, stage, category')
      .eq('is_active', true);

    if (hasMethodologyAccess) {
      // Stateline users get Stateline-only methodology knowledge + general content
      knowledgeQuery = knowledgeQuery.or(`company_id.eq.${STATELINE_COMPANY_ID},company_id.is.null`);
    } else if (effectiveCompanyId) {
      // Non-Stateline users get their own company knowledge + general content
      knowledgeQuery = knowledgeQuery.or(`company_id.eq.${effectiveCompanyId},company_id.is.null`);
    } else {
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

    // Fetch CRM customers (sales_companies) for context
    let crmCustomerContext = '';
    const { data: crmCustomers } = await supabase
      .from('sales_companies')
      .select('id, name, location, grower_history, operation_details, customer_since, notes')
      .eq('profile_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (crmCustomers && crmCustomers.length > 0) {
      crmCustomerContext = `\n\n=== YOUR CRM CUSTOMERS (${crmCustomers.length} total) ===
You have access to detailed customer records. When asked about a customer, provide their full context.

${crmCustomers.map(c => {
        let customerInfo = `### ${c.name}`;
        if (c.location) customerInfo += `\nLocation: ${c.location}`;
        if (c.customer_since) customerInfo += `\nCustomer Since: ${c.customer_since}`;
        if (c.notes) customerInfo += `\nNotes: ${c.notes}`;
        if (c.operation_details && typeof c.operation_details === 'object') {
          const details = c.operation_details as Record<string, any>;
          if (details.total_acres) customerInfo += `\nOperation Size: ${details.total_acres}`;
          if (details.key_quote) customerInfo += `\nKey Quote: "${details.key_quote}"`;
        }
        if (c.grower_history) customerInfo += `\nRelationship History:\n${c.grower_history.substring(0, 1000)}${c.grower_history.length > 1000 ? '...' : ''}`;
        return customerInfo;
      }).join('\n\n---\n\n')}`;
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
    
    // Detect if this is a clarification/follow-up question vs a new rec request
    // Look at conversation history to see if we already gave a recommendation
    const hasExistingRec = conversationHistory && (
      conversationHistory.includes('PRE-CALL CHECKLIST') ||
      conversationHistory.includes('PRODUCT RECOMMENDATIONS') ||
      conversationHistory.includes('QUESTIONS TO ASK') ||
      conversationHistory.includes('OPENING LINE')
    );
    
    // Detect clarification patterns in the user's message
    const clarificationPatterns = [
      /^(what|why|how|can you|could you|tell me more|explain|clarify)/i,
      /\?$/,  // Ends with question mark
      /^(is |are |do |does |will |would |should )/i,
      /(about that|about this|you mentioned|regarding|what do you mean)/i,
      /(more detail|more info|elaborate|expand on)/i,
    ];
    const looksLikeClarification = clarificationPatterns.some(pattern => pattern.test(message.trim()));
    
    // If we have an existing rec AND the message looks like a clarification, don't regenerate the full plan
    const isClarificationQuestion = hasExistingRec && looksLikeClarification;
    
    // THRIVE TODAY CONSULTATIVE SELLING METHODOLOGY - Universal for all companies
    const consultativeSellingMethodology = `
=== THRIVE TODAY CONSULTATIVE SELLING METHODOLOGY ===

You are trained on the Thrive Today consultative selling framework. This is the foundation of how you coach salespeople.

THE 5-STEP SALES PROCESS:
1. PROSPECTING - Get appointments using either/or options, never yes/no questions
2. DISCOVERY - The most critical step. Ask questions to uncover pain, fear, and opportunity
3. PROPOSAL - Present solutions that address their specific pains discovered
4. CLOSE - If discovery was done right, closing comes naturally
5. FOLLOW-UP - The thread that weaves everything together

THE THREE MOTIVATORS (in order of power):
1. PAIN (strongest) - What hurts today or will hurt soon
2. FEAR - What they're worried about
3. OPPORTUNITY (weakest) - What they aspire to achieve

TWO TYPES OF PAIN:
- ACTIVE PAIN: Hurts right now, they feel it, they're ready to act
- LATENT PAIN: Coming in the future, they may not see it yet. Ask "blind window" questions to surface it: "Something I've seen customers run into is [issue]. Did you know about that? What would that cost you?"

TENSION VS TRUST:
- When tension is HIGH, trust is LOW
- Your job is always to DECREASE tension and INCREASE trust
- Everything in this process is designed to build trust

THE MOST IMPORTANT DISCOVERY QUESTION:
"Mr./Mrs. Customer, I've been talking to a fair number of people in your position. Everybody seems to have two or three priorities when it comes to [your area]. What are those two to three things for you?"
- This opens every conversation
- Follow with "What else?" and "Tell me more"

KEY DISCOVERY QUESTIONS:
1. "What are the top 2-3 priorities/challenges for you right now?"
2. "What else?" (keep asking until they say "that's it")
3. "Tell me more about that..."
4. "What's the cost to you if that doesn't get solved?"
5. "When you're choosing vendors, what criteria do you consider?"
6. "If you were me, trying to build relationships with people like you, what advice would you give me?"

GOLDEN RULE: Don't tell them anything you can ask them.

THE ACAVE MODEL FOR OBJECTION HANDLING:
When a customer raises an objection, use ACAVE to decrease tension and increase trust:

A = ACKNOWLEDGE
- Validate their concern. It's natural to have questions.
- "I hear you." / "I understand." / "I can see why you'd feel that way."
- You're NOT agreeing, just acknowledging they're human with valid concerns.

C = CLARIFY  
- Ask questions to understand the root cause.
- "Tell me more about that." / "What is that really about?"
- This decreases tension because you're not being confrontational.

A = ANSWER
- Once you've clarified, you've EARNED THE RIGHT to give your perspective.
- Now provide your response with your vantage point.

V = VERIFY
- Confirm they understood your response.
- "Does that make sense?" / "How does that land with you?"

E = END/CLOSE
- Move toward commitment.
- "Can we move forward?" / "What would you like to do next?"

VALUE OVER PRICE:
- Never talk price, always talk value
- "There's no such thing as a product that's too expensive - only the wrong customer"
- When they mention price, shift the anchor to value: "What's it worth to you to solve [their pain]?"

THE ENERGY OF SALES ACTIVITY:
- Value given = Value received
- Focus on what you PUT INTO the market, not what you extract
- Send value (articles, memes, check-ins) without asking for anything
- When you're in the energy of giving, you attract business

APPOINTMENT SETTING SCRIPT:
Never ask yes/no: "Would it be okay if I stopped by?" (Answer: NO)
Instead use either/or: "I'm going to be in your area next week. I have 2pm Wednesday or 11:30am Thursday. Which works better for you?"
`;

    // REC MODE PROMPT PREFIX - used when generating NEW recommendations
    const recModePrefix = `You are Jericho, a sales preparation assistant trained on consultative selling. The user wants DIRECT ANSWERS, not coaching questions.

${consultativeSellingMethodology}

YOUR JOB:
- Give them the pre-call plan immediately
- List specific questions they should ask (use the discovery questions above)
- Provide product recommendations with exact talking points
- Anticipate objections and give ACAVE-formatted responses
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

🎯 DISCOVERY QUESTIONS TO ASK:
1. "[Use the 2-3 things question]"
2. "[Follow-up: What else?]"
3. "[Tell me more about...]"
4. "[Cost question: What's the cost if...]"

💡 PRODUCT RECOMMENDATIONS:
[Product] - "[one-liner pitch]"
- Key benefit: [specific]
- If they object: Use ACAVE:
  • Acknowledge: "[I understand / I hear you]"
  • Clarify: "[What's really behind that concern?]"
  • Answer: "[Your response with value focus]"
  • Verify: "Does that make sense?"
  • End: "Can we move forward with [specific next step]?"

📞 OPENING LINE:
"[Exact words to say when they answer]"

Be direct. Be specific. Give them everything they need.

`;

    // CLARIFICATION MODE PREFIX - used when answering follow-up questions
    const clarificationPrefix = `You are Jericho, a sales preparation assistant. The user is asking a FOLLOW-UP QUESTION about a recommendation you already gave them.

YOUR JOB:
- Answer their specific question directly
- Reference the recommendation you already provided
- Give additional detail, clarification, or explanation
- Keep it focused on what they asked

DO NOT:
- Regenerate a whole new pre-call plan
- Repeat all the checklists and formats from before
- Give them a completely new set of recommendations
- Ignore their actual question

Just answer what they asked, clearly and directly. If they want a different product recommendation or a new scenario, they'll tell you.

`;
    
    if (generateCallPlan && hasMethodologyAccess) {
      systemPrompt = `You are Jericho, an expert agricultural sales coach trained on ${companyName}'s "4-Call Plan" methodology.

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
    } else if (isRecMode && isClarificationQuestion) {
      // REC MODE - CLARIFICATION: User is asking a follow-up question
      console.log('Detected clarification question in REC mode');
      systemPrompt = `${clarificationPrefix}
=== YOUR CONTEXT ===
${customerInfo}
${dealContext}
${knowledgeContext}${productKnowledge}${crmCustomerContext}

CONVERSATION SO FAR (includes your previous recommendation):
${conversationHistory}

USER'S FOLLOW-UP QUESTION: "${message}"

Answer their question directly without regenerating the full pre-call plan.`;
    } else if (isRecMode) {
      // REC MODE - NEW REQUEST: Generate fresh recommendation
      console.log('New recommendation request in REC mode');
      systemPrompt = `${recModePrefix}
=== YOUR CONTEXT ===
${customerInfo}
${dealContext}
${knowledgeContext}${productKnowledge}${crmCustomerContext}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Now give them exactly what they need - no questions, just answers.`;
    } else if (isStreamlineAg) {
      // Streamline Ag specific prompt - agronomy sales with product recommendations
      systemPrompt = `You are Jericho, an expert agricultural sales coach for Streamline Ag, trained on consultative selling. You have deep knowledge of Streamline's product line and help salespeople position the right products for each customer's situation.

${consultativeSellingMethodology}

YOUR CORE PURPOSE:
Help Streamline Ag salespeople have better conversations with growers by:
1. Understanding the customer's farm operation, challenges, and goals using the "2-3 things" question
2. Uncovering PAIN (both active and latent) before recommending
3. Recommending the RIGHT Streamline products that solve their specific problems
4. Preparing them for objections using ACAVE
5. Building a compelling value story that justifies the investment

CRITICAL COACHING RULE - GATHER BEFORE YOU RECOMMEND:
- Ask about the customer situation FIRST using discovery questions
- What crops? What challenges? What are they currently using?
- Uncover the PAIN before you prescribe the solution
- Once you understand, make SPECIFIC product recommendations with reasoning

YOUR PERSONALITY:
- You're a seasoned agronomist who LOVES helping growers succeed
- Warm, knowledgeable, practical - never pushy or salesy
- You think in terms of ROI and yield impact
- You anticipate objections and prepare ACAVE responses
- You help the salesperson BELIEVE in the recommendation

WHEN MAKING PRODUCT RECOMMENDATIONS:
1. Name the specific Streamline product
2. Explain WHY it fits this customer's PAIN (not just opportunity)
3. Give the application timing and rate
4. Quantify the expected benefit (yield, stress protection, etc.)
5. Prepare ACAVE objection handling:
   - Acknowledge: How to validate their concern
   - Clarify: Question to understand root cause
   - Answer: Your value-focused response
   - Verify: Confirm understanding
   - End: Move to next step
6. Suggest complementary products that work together

EXAMPLE RECOMMENDATION FORMAT:
"For [Customer]'s situation with [PAIN], I'd recommend:

🌾 **[Product Name]**
- Why: [specific reason tied to their PAIN]
- Apply: [timing] at [rate]
- Expected benefit: [quantified if possible]
- If they object to price, use ACAVE:
  • Acknowledge: "I hear you - it's a real investment."
  • Clarify: "What's your biggest concern - the upfront cost or the ROI?"
  • Answer: "Based on what you told me about [their pain], this typically pays back [X] in [timeframe]..."
  • Verify: "Does that math work for your operation?"
  • End: "Should we pencil out the numbers for your specific acres?"

This pairs well with [complementary product] because..."

${customerInfo}
${dealContext}
${productKnowledge}${crmCustomerContext}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: You're their trusted agronomic advisor. Help them help their customers succeed!`;
    } else if (hasMethodologyAccess) {
      systemPrompt = `You are Jericho, an expert agricultural sales coach for ${companyName}, trained on the proven "4-Call Plan" methodology.

YOUR APPROACH: Help salespeople reverse-engineer from their goals, whether that's volume targets, revenue goals, or customer count objectives.

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

PIPELINE MANAGEMENT COMMANDS - You can execute these actions for the user:
When the user asks you to manage their pipeline, use these action blocks at the END of your response:

1. To MOVE a deal to a different stage:
[PIPELINE_ACTION]
action: move_deal
deal_name: <partial or full name to match>
new_stage: <prospecting|discovery|proposal|closing|follow_up|won|lost>
[/PIPELINE_ACTION]

2. To UPDATE a deal's value or details:
[PIPELINE_ACTION]
action: update_deal
deal_name: <partial or full name to match>
value: <new value in dollars, or null to keep>
notes: <new notes, or null to keep>
priority: <1-5, or null to keep>
[/PIPELINE_ACTION]

3. To DELETE a deal:
[PIPELINE_ACTION]
action: delete_deal
deal_name: <partial or full name to match>
[/PIPELINE_ACTION]

4. To LIST/SHOW the pipeline:
[PIPELINE_ACTION]
action: list_pipeline
stage: <optional stage filter, or "all">
[/PIPELINE_ACTION]

When the user says things like:
- "move X to proposal" → use move_deal
- "update the value on X to $50k" → use update_deal
- "delete the X deal" → use delete_deal  
- "show my pipeline" or "what deals do I have" → use list_pipeline
- "remove the old deals" → confirm which ones, then use delete_deal

Always confirm what you're doing in your response, then include the action block.

SPECIAL COMMANDS:
- If they say "generate a 4-call plan" or "plan my calls" - offer to create a full year cadence for a specific grower

${dealContext}
${knowledgeContext}${productKnowledge}${crmCustomerContext}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: You're their trusted coach. ONE question at a time. Help them hit their goals!`;
    } else {
      // All other companies get consultative selling coaching
      systemPrompt = `You are Jericho, an AI sales coach for ${companyName}, trained on the Thrive Today consultative selling methodology. You're like having a sharp, supportive colleague who helps them sell better AND keeps track of everything.

${consultativeSellingMethodology}

YOUR ROLE:
- You're a conversational sales coach and pipeline partner
- When they mention opportunities, prospects, or updates - you track it automatically
- Coach them using the consultative selling framework above
- Be proactive about surfacing relevant context from their pipeline

YOUR PERSONALITY:
- Warm, direct, and conversational - like a trusted colleague
- You remember everything about their deals and bring up relevant context
- You're genuinely curious about their wins and challenges
- You celebrate progress and provide encouragement
- You make managing their pipeline feel effortless

COACHING APPROACH:
- Ask ONE question at a time
- Guide them to uncover customer PAIN (active or latent)
- Help them prepare discovery questions using the "2-3 things" framework
- When they face objections, coach them through ACAVE
- Always focus on DECREASING TENSION and INCREASING TRUST

PROACTIVE PIPELINE MANAGEMENT:
When they mention ANYTHING about an opportunity, customer, or deal:
- Automatically track it without making them "log" anything
- Say something natural like "I'll keep track of that" or "Got it, I've added them to your pipeline"
- If they mention progress, update the deal naturally
- If they mention losing a deal, move it to lost with empathy

Examples of natural tracking:
- "I talked to Mike at Johnson Farms today" → Add deal + say "Nice! I've got Johnson Farms tracked for you. How did the conversation go?"
- "The Smith deal is looking good, probably $50k" → Update value + say "Love it - I've updated Smith to $50k. When do you think you'll close?"
- "We lost the Anderson account" → Move to lost + say "Ah, that's tough. I've noted that. What happened?"
- "I need to follow up with Martinez" → Move to follow_up + say "I'll flag Martinez for follow-up. What's your next step with them?"

When creating/updating deals, include the block at END of response:
[DEAL_DETECTED]
company_name: <name>
contact_name: <name if mentioned>
stage: <prospecting|discovery|proposal|closing|follow_up|won|lost>
value: <estimated value if mentioned, or null>
notes: <brief summary of what they shared>
[/DEAL_DETECTED]

For pipeline actions (moving, updating, deleting):
[PIPELINE_ACTION]
action: <move_deal|update_deal|delete_deal|list_pipeline>
deal_name: <name to match>
new_stage: <stage if moving>
value: <new value if updating>
notes: <new notes if updating>
[/PIPELINE_ACTION]

WHEN THEY ASK ABOUT THEIR PIPELINE:
- Pull from the context and give them a conversational summary
- Highlight what needs attention (stale deals, high-value opportunities, upcoming closes)
- Suggest next steps for specific deals using the consultative framework

WHEN THEY ASK WHAT TO FOCUS ON:
- Look at their pipeline and identify priorities
- Consider deal values, stages, and how long deals have been sitting
- Give them 2-3 specific actions with exact language to use

WHEN THEY NEED HELP WITH A CUSTOMER:
- Help them prepare discovery questions
- Coach them on uncovering pain (active and latent)
- Prepare them for objections using ACAVE
- Give them exact words to say

${customerInfo}
${dealContext}
${knowledgeContext}${productKnowledge}${crmCustomerContext}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}` : ''}

Remember: You're their sales coach AND pipeline partner. Help them sell better while handling the admin.`;
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

    // Check for pipeline actions and execute them
    const pipelineActionMatches = assistantMessage.matchAll(/\[PIPELINE_ACTION\]([\s\S]*?)\[\/PIPELINE_ACTION\]/gi);
    const pipelineActions: { action: string; success: boolean; message: string }[] = [];
    
    for (const actionMatch of pipelineActionMatches) {
      const actionBlock = actionMatch[1];
      const action = actionBlock.match(/action:\s*(.+)/i)?.[1]?.trim()?.toLowerCase();
      const dealName = actionBlock.match(/deal_name:\s*(.+)/i)?.[1]?.trim();
      const newStage = actionBlock.match(/new_stage:\s*(.+)/i)?.[1]?.trim()?.toLowerCase();
      const valueStr = actionBlock.match(/value:\s*(.+)/i)?.[1]?.trim();
      const notes = actionBlock.match(/notes:\s*(.+)/i)?.[1]?.trim();
      const priorityStr = actionBlock.match(/priority:\s*(.+)/i)?.[1]?.trim();
      const stageFilter = actionBlock.match(/stage:\s*(.+)/i)?.[1]?.trim()?.toLowerCase();
      
      console.log('Processing pipeline action:', { action, dealName, newStage, valueStr, notes, priorityStr, stageFilter });
      
      try {
        if (action === 'move_deal' && dealName && newStage) {
          // Find the deal by partial name match
          const { data: deals } = await supabase
            .from('sales_deals')
            .select('id, deal_name, stage')
            .eq('profile_id', user.id);
          
          const matchingDeal = deals?.find(d => 
            d.deal_name.toLowerCase().includes(dealName.toLowerCase()) ||
            dealName.toLowerCase().includes(d.deal_name.toLowerCase())
          );
          
          if (matchingDeal) {
            const validStages = ['prospecting', 'discovery', 'proposal', 'closing', 'follow_up', 'won', 'lost'];
            if (validStages.includes(newStage)) {
              const { error } = await supabase
                .from('sales_deals')
                .update({ stage: newStage as any })
                .eq('id', matchingDeal.id);
              
              if (!error) {
                pipelineActions.push({ action: 'move_deal', success: true, message: `Moved "${matchingDeal.deal_name}" to ${newStage}` });
              } else {
                pipelineActions.push({ action: 'move_deal', success: false, message: `Failed to move deal: ${error.message}` });
              }
            }
          } else {
            pipelineActions.push({ action: 'move_deal', success: false, message: `Could not find deal matching "${dealName}"` });
          }
        }
        
        if (action === 'update_deal' && dealName) {
          const { data: deals } = await supabase
            .from('sales_deals')
            .select('id, deal_name')
            .eq('profile_id', user.id);
          
          const matchingDeal = deals?.find(d => 
            d.deal_name.toLowerCase().includes(dealName.toLowerCase()) ||
            dealName.toLowerCase().includes(d.deal_name.toLowerCase())
          );
          
          if (matchingDeal) {
            const updateData: any = {};
            if (valueStr && valueStr !== 'null') {
              const numericValue = valueStr.replace(/[^0-9.]/g, '');
              if (numericValue) updateData.value = parseInt(numericValue);
            }
            if (notes && notes !== 'null') updateData.notes = notes;
            if (priorityStr && priorityStr !== 'null') {
              const priority = parseInt(priorityStr);
              if (priority >= 1 && priority <= 5) updateData.priority = priority;
            }
            
            if (Object.keys(updateData).length > 0) {
              const { error } = await supabase
                .from('sales_deals')
                .update(updateData)
                .eq('id', matchingDeal.id);
              
              if (!error) {
                pipelineActions.push({ action: 'update_deal', success: true, message: `Updated "${matchingDeal.deal_name}"` });
              } else {
                pipelineActions.push({ action: 'update_deal', success: false, message: `Failed to update: ${error.message}` });
              }
            }
          } else {
            pipelineActions.push({ action: 'update_deal', success: false, message: `Could not find deal matching "${dealName}"` });
          }
        }
        
        if (action === 'delete_deal' && dealName) {
          const { data: deals } = await supabase
            .from('sales_deals')
            .select('id, deal_name')
            .eq('profile_id', user.id);
          
          const matchingDeal = deals?.find(d => 
            d.deal_name.toLowerCase().includes(dealName.toLowerCase()) ||
            dealName.toLowerCase().includes(d.deal_name.toLowerCase())
          );
          
          if (matchingDeal) {
            const { error } = await supabase
              .from('sales_deals')
              .delete()
              .eq('id', matchingDeal.id);
            
            if (!error) {
              pipelineActions.push({ action: 'delete_deal', success: true, message: `Deleted "${matchingDeal.deal_name}"` });
            } else {
              pipelineActions.push({ action: 'delete_deal', success: false, message: `Failed to delete: ${error.message}` });
            }
          } else {
            pipelineActions.push({ action: 'delete_deal', success: false, message: `Could not find deal matching "${dealName}"` });
          }
        }
        
        if (action === 'list_pipeline') {
          let query = supabase
            .from('sales_deals')
            .select(`
              deal_name, stage, value, expected_close_date, priority, notes,
              sales_companies(name)
            `)
            .eq('profile_id', user.id)
            .order('priority');
          
          if (stageFilter && stageFilter !== 'all') {
            query = query.eq('stage', stageFilter);
          }
          
          const { data: pipelineDeals } = await query.limit(30);
          
          if (pipelineDeals && pipelineDeals.length > 0) {
            pipelineActions.push({ 
              action: 'list_pipeline', 
              success: true, 
              message: `Found ${pipelineDeals.length} deals` 
            });
          } else {
            pipelineActions.push({ action: 'list_pipeline', success: true, message: 'No deals found' });
          }
        }
      } catch (actionError) {
        console.error('Error executing pipeline action:', actionError);
        pipelineActions.push({ action: action || 'unknown', success: false, message: 'Action failed' });
      }
    }
    
    // Remove pipeline action blocks from message shown to user
    assistantMessage = assistantMessage
      .replace(/\[PIPELINE_ACTION\][\s\S]*?\[\/PIPELINE_ACTION\]/gi, '')
      .trim();

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        hasMethodologyAccess,
        isStreamlineAg,
        dealCreated, // Let frontend know a deal was created (for refreshing pipeline)
        pipelineActions, // Let frontend know what pipeline actions were executed
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
