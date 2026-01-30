import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SalesCoachRequest {
  message: string;
  conversationHistory?: string;
  userContext?: string;
  chatMode?: "coach" | "rec";
  deal?: any;
  viewAsCompanyId?: string;
  viewAsUserId?: string;
  undoAction?: string;
  generateCallPlan?: boolean;
  dealsCount?: number;
}

interface ActionResult {
  type: string;
  entityId: string;
  undoToken: string;
  success: boolean;
  details: any;
  message?: string;
}

interface ExtractedEntities {
  companies: { name: string; isNew: boolean; confidence: number }[];
  contacts: { name: string; title?: string; companyName?: string }[];
  dealSignals: { value?: number; stage?: string; notes?: string };
  researchRequest?: string;
  emailRequest?: { recipient?: string; type?: string; company?: string };
  intentType: "coaching" | "data_lookup" | "create_entity" | "research" | "email" | "pipeline_action";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Create both admin client (for service operations) and user client (for RLS-respecting operations)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = authHeader
      ? createClient(supabaseUrl, supabaseServiceKey, {
          global: { headers: { Authorization: authHeader } },
        })
      : adminClient;

    const body: SalesCoachRequest = await req.json();
    const {
      message,
      conversationHistory = "",
      userContext = "",
      chatMode = "coach",
      deal,
      viewAsCompanyId,
      viewAsUserId,
      undoAction,
      generateCallPlan,
      dealsCount = 0,
    } = body;

    // Get authenticated user
    let userId: string | null = null;
    let companyId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await adminClient.auth.getUser(token);
      userId = userData?.user?.id || null;

      if (userId) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("company_id, is_super_admin")
          .eq("id", userId)
          .single();
        companyId = profile?.company_id || null;

        // Super admin impersonation support
        if (profile?.is_super_admin && viewAsUserId) {
          userId = viewAsUserId;
          const { data: impersonatedProfile } = await adminClient
            .from("profiles")
            .select("company_id")
            .eq("id", viewAsUserId)
            .single();
          companyId = viewAsCompanyId || impersonatedProfile?.company_id || companyId;
        } else if (viewAsCompanyId) {
          companyId = viewAsCompanyId;
        }
      }
    }

    const effectiveUserId = userId;
    const effectiveCompanyId = companyId;

    // Handle undo action
    if (undoAction) {
      const result = await handleUndo(adminClient, undoAction, effectiveUserId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Fast Intent Detection & Entity Extraction
    const extracted = await detectIntentAndExtract(message, conversationHistory, lovableApiKey);
    console.log("Intent detected:", extracted.intentType, "| Companies:", extracted.companies.length, "| Contacts:", extracted.contacts.length);
    
    // Step 2: Gather Context
    const context = await gatherContext(
      adminClient,
      effectiveUserId,
      effectiveCompanyId,
      extracted,
      userContext
    );
    console.log("Context gathered | Deals:", context.deals?.length || 0, "| Existing companies:", context.existingCompanies?.length || 0);

    // Step 3: Execute Actions (parallel when possible)
    const actions: ActionResult[] = [];
    let dealCreated = false;
    let companyCreated: { id: string; name: string } | null = null;
    let contactsCreated: { id: string; name: string }[] = [];
    let emailDrafted: { id: string; subject: string; preview: string } | null = null;
    let researchCompleted: { company: string; summary: string } | null = null;

    // Create entities if detected
    if (extracted.companies.length > 0 && effectiveUserId && effectiveCompanyId) {
      console.log("Processing", extracted.companies.length, "companies for creation");
      
      for (const company of extracted.companies) {
        console.log("Company:", company.name, "| isNew:", company.isNew, "| confidence:", company.confidence);
        
        if (company.isNew) {
          const result = await createCompany(
            adminClient,
            effectiveUserId,
            effectiveCompanyId,
            company.name,
            message
          );
          console.log("Company creation result:", result.success, result.entityId || result.message);
          
          if (result.success) {
            actions.push(result);
            companyCreated = { id: result.entityId, name: company.name };
            
            // Create contacts for this company
            const companyContacts = extracted.contacts.filter(
              c => !c.companyName || c.companyName.toLowerCase() === company.name.toLowerCase()
            );
            for (const contact of companyContacts) {
              const contactResult = await createContact(
                adminClient,
                effectiveUserId,
                effectiveCompanyId,
                result.entityId,
                contact.name,
                contact.title,
                message
              );
              if (contactResult.success) {
                actions.push(contactResult);
                contactsCreated.push({ id: contactResult.entityId, name: contact.name });
              }
            }

            // Create deal if signals present OR if this is a new prospect/grower
            const shouldCreateDeal = (extracted.dealSignals && Object.keys(extracted.dealSignals).length > 0) 
              || company.isNew; // Always create a deal for new companies
            
            if (shouldCreateDeal) {
              const dealSignals = extracted.dealSignals || { stage: 'prospecting', notes: 'New prospect' };
              const dealResult = await createDeal(
                adminClient,
                effectiveUserId,
                effectiveCompanyId,
                result.entityId,
                company.name,
                dealSignals,
                message
              );
              console.log("Deal creation result:", dealResult.success, dealResult.entityId || dealResult.message);
              if (dealResult.success) {
                actions.push(dealResult);
                dealCreated = true;
              }
            }
          }
        }
      }
    }

    // Handle research request
    if (extracted.researchRequest && effectiveUserId) {
      const researchResult = await handleResearch(
        adminClient,
        effectiveUserId,
        effectiveCompanyId,
        extracted.researchRequest,
        lovableApiKey
      );
      if (researchResult) {
        researchCompleted = researchResult;
      }
    }

    // Handle email draft request
    if (extracted.emailRequest && effectiveUserId && effectiveCompanyId) {
      const emailResult = await handleEmailDraft(
        adminClient,
        effectiveUserId,
        effectiveCompanyId,
        extracted.emailRequest,
        context,
        lovableApiKey
      );
      if (emailResult) {
        emailDrafted = emailResult;
      }
    }

    // Handle pipeline actions (move, update, delete deals)
    const pipelineActions = await handlePipelineActions(
      adminClient,
      effectiveUserId,
      message,
      context.deals
    );

    // Step 4: Generate Response
    const responseMessage = await generateResponse(
      message,
      conversationHistory,
      context,
      actions,
      extracted,
      chatMode,
      deal,
      generateCallPlan,
      dealsCount,
      researchCompleted,
      emailDrafted,
      lovableApiKey
    );

    // Step 5: Post-Response Learning - Extract insights with customer context
    if (effectiveUserId && effectiveCompanyId) {
      // Determine mentioned customer for insight linkage
      const mentionedCustomer = extracted.contacts[0]?.name || extracted.companies[0]?.name || undefined;
      // Fire and forget - don't block response
      extractAndSaveInsights(adminClient, effectiveUserId, effectiveCompanyId, message, responseMessage, mentionedCustomer)
        .catch(err => console.error("Error saving insights:", err));
    }

    return new Response(
      JSON.stringify({
        message: responseMessage,
        actions,
        dealCreated,
        companyCreated,
        contactsCreated,
        emailDrafted,
        researchCompleted,
        pipelineActions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sales coach error:", error);
    return new Response(
      JSON.stringify({
        message: "I'm having a moment - let me gather my thoughts. Try again?",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// INTENT DETECTION & ENTITY EXTRACTION
// ============================================

async function detectIntentAndExtract(
  message: string,
  conversationHistory: string,
  apiKey: string
): Promise<ExtractedEntities> {
  const systemPrompt = `You are an AI that extracts sales-relevant entities and intents from messages.
Analyze the user's message and extract:
1. Company names mentioned (with confidence 0-1 if it's likely a NEW company vs existing reference)
2. Contact names with titles if mentioned
3. Deal signals (value, stage hints, notes)
4. Research requests
5. Email draft requests
6. Overall intent

Return a JSON object with this structure:
{
  "companies": [{"name": "Company Name", "isNew": true, "confidence": 0.8}],
  "contacts": [{"name": "John Smith", "title": "Owner", "companyName": "Company Name"}],
  "dealSignals": {"value": 50000, "stage": "prospecting", "notes": "expanding operation"},
  "researchRequest": "company name to research" or null,
  "emailRequest": {"recipient": "John", "type": "follow_up", "company": "ABC Farms"} or null,
  "intentType": "coaching" | "data_lookup" | "create_entity" | "research" | "email" | "pipeline_action"
}

Rules:
- CRITICAL: Extract ALL company/farm/grower names mentioned - if someone lists 5 growers, return 5 companies
- Mark isNew=true if the message implies they just met or are adding this company/grower
- Phrases like "I just talked to", "I met", "new prospect", "add", "load", "here are my" suggest new entities
- Phrases like "show me", "what about", "how is" suggest existing lookups
- Extract contact names even if only first name is given - for farms, the owner name IS the contact
- If a message lists multiple names (comma-separated or numbered), extract EACH one as a separate company
- Look for deal signals: value mentions, expansion, growth, interest in products
- Research triggers: "research", "find out about", "tell me about", "look up"
- Email triggers: "draft email", "follow up email", "write to", "thank you note"
- For bulk entity creation, ALWAYS extract every name mentioned`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Recent conversation:\n${conversationHistory.slice(-6000)}\n\nNew message: ${message}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("Intent detection failed:", await response.text());
      return getDefaultExtraction();
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        companies: parsed.companies || [],
        contacts: parsed.contacts || [],
        dealSignals: parsed.dealSignals || {},
        researchRequest: parsed.researchRequest || null,
        emailRequest: parsed.emailRequest || null,
        intentType: parsed.intentType || "coaching",
      };
    }
  } catch (err) {
    console.error("Entity extraction error:", err);
  }

  return getDefaultExtraction();
}

function getDefaultExtraction(): ExtractedEntities {
  return {
    companies: [],
    contacts: [],
    dealSignals: {},
    intentType: "coaching",
  };
}

// ============================================
// CONTEXT GATHERING
// ============================================

async function gatherContext(
  client: any,
  userId: string | null,
  companyId: string | null,
  extracted: ExtractedEntities,
  userContext: string
) {
  const context: any = {
    userContext,
    deals: [],
    existingCompanies: [],
    intelligence: null,
    purchaseHistory: null,
    salesKnowledge: [],
  };

  if (!userId) return context;

  // Fetch user's pipeline and sales knowledge in parallel
  const [dealsResult, companiesResult, globalKnowledgeResult, companyKnowledgeResult] = await Promise.all([
    // Fetch user's pipeline
    client
      .from("sales_deals")
      .select(`
        id, deal_name, stage, value, expected_close_date, priority, notes, last_activity_at,
        sales_companies(id, name),
        sales_contacts(id, name, title)
      `)
      .eq("profile_id", userId)
      .order("priority")
      .limit(50),
    
    // Fetch existing companies to prevent duplicates
    client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .order("name")
      .limit(500),
    
    // Fetch global sales training knowledge (methodology, scripts, objections, etc.)
    client
      .from("sales_knowledge")
      .select("title, content, category")
      .is("company_id", null)
      .eq("is_active", true)
      .limit(20),
    
    // Fetch company-specific knowledge (product catalogs, etc.)
    companyId 
      ? client
          .from("sales_knowledge")
          .select("title, content, category")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  context.deals = dealsResult.data || [];
  context.existingCompanies = companiesResult.data || [];
  
  // Combine global and company-specific knowledge
  const globalKnowledge = globalKnowledgeResult.data || [];
  const companyKnowledge = companyKnowledgeResult.data || [];
  context.salesKnowledge = [...globalKnowledge, ...companyKnowledge];

  // If specific company mentioned, fetch intelligence
  if (extracted.companies.length > 0) {
    const companyName = extracted.companies[0].name;
    const existingCompany = context.existingCompanies.find(
      (c: any) => c.name.toLowerCase().trim() === companyName.toLowerCase().trim()
    );

    if (existingCompany) {
      // Mark as not new if we found it
      extracted.companies[0].isNew = false;

      // Fetch intelligence and purchase history in parallel
      const [intelResult, historyResult] = await Promise.all([
        client
          .from("sales_company_intelligence")
          .select("*")
          .eq("company_id", existingCompany.id)
          .eq("profile_id", userId)
          .maybeSingle(),
        client
          .from("customer_purchase_history")
          .select("*")
          .eq("company_id", existingCompany.id)
          .order("year", { ascending: false })
          .limit(5),
      ]);

      context.intelligence = intelResult.data;
      context.purchaseHistory = historyResult.data;
    }
  }

  // Load persistent customer memory if a customer/contact is mentioned
  if (extracted.contacts.length > 0 || extracted.companies.length > 0) {
    const customerName = extracted.contacts[0]?.name || extracted.companies[0]?.name;
    if (customerName && userId && companyId) {
      context.customerMemory = await loadCustomerMemory(client, userId, companyId, customerName);
    }
  }

  return context;
}

// ============================================
// ENTITY CREATION
// ============================================

async function createCompany(
  client: any,
  userId: string,
  companyId: string,
  name: string,
  triggeredBy: string
): Promise<ActionResult> {
  try {
    // Check for existing (fuzzy match)
    const { data: existing } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .ilike("name", name.trim());

    if (existing && existing.length > 0) {
      return {
        type: "company_exists",
        entityId: existing[0].id,
        undoToken: "",
        success: true,
        details: { name: existing[0].name, wasExisting: true },
        message: `Found existing company "${existing[0].name}"`,
      };
    }

    // Create new company
    const { data: newCompany, error } = await client
      .from("sales_companies")
      .insert({
        profile_id: userId,
        name: name.trim(),
      })
      .select("id")
      .single();

    if (error) throw error;

    // Log action for undo
    const { data: actionLog } = await client
      .from("jericho_action_log")
      .insert({
        profile_id: userId,
        company_id: companyId,
        action_type: "company_created",
        entity_type: "company",
        entity_id: newCompany.id,
        action_data: { name: name.trim() },
        triggered_by: triggeredBy.slice(0, 500),
        can_undo: true,
      })
      .select("id")
      .single();

    return {
      type: "company_created",
      entityId: newCompany.id,
      undoToken: actionLog?.id || "",
      success: true,
      details: { name: name.trim() },
      message: `Added "${name.trim()}" to your companies`,
    };
  } catch (err) {
    console.error("Error creating company:", err);
    return {
      type: "company_created",
      entityId: "",
      undoToken: "",
      success: false,
      details: { error: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

async function createContact(
  client: any,
  userId: string,
  companyId: string,
  salesCompanyId: string,
  name: string,
  title: string | undefined,
  triggeredBy: string
): Promise<ActionResult> {
  try {
    const { data: newContact, error } = await client
      .from("sales_contacts")
      .insert({
        company_id: salesCompanyId,
        profile_id: userId,
        name: name.trim(),
        title: title || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Log action for undo
    const { data: actionLog } = await client
      .from("jericho_action_log")
      .insert({
        profile_id: userId,
        company_id: companyId,
        action_type: "contact_created",
        entity_type: "contact",
        entity_id: newContact.id,
        action_data: { name: name.trim(), title, salesCompanyId },
        triggered_by: triggeredBy.slice(0, 500),
        can_undo: true,
      })
      .select("id")
      .single();

    return {
      type: "contact_created",
      entityId: newContact.id,
      undoToken: actionLog?.id || "",
      success: true,
      details: { name: name.trim(), title },
      message: `Added contact "${name.trim()}"`,
    };
  } catch (err) {
    console.error("Error creating contact:", err);
    return {
      type: "contact_created",
      entityId: "",
      undoToken: "",
      success: false,
      details: { error: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

async function createDeal(
  client: any,
  userId: string,
  companyId: string,
  salesCompanyId: string,
  companyName: string,
  signals: { value?: number; stage?: string; notes?: string },
  triggeredBy: string
): Promise<ActionResult> {
  try {
    const dealName = companyName;
    const stage = signals.stage || "prospecting";
    const value = signals.value || 0;

    const { data: newDeal, error } = await client
      .from("sales_deals")
      .insert({
        profile_id: userId,
        company_id: salesCompanyId,
        deal_name: dealName,
        stage,
        value,
        notes: signals.notes || null,
        priority: 3,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Log action for undo
    const { data: actionLog } = await client
      .from("jericho_action_log")
      .insert({
        profile_id: userId,
        company_id: companyId,
        action_type: "deal_created",
        entity_type: "deal",
        entity_id: newDeal.id,
        action_data: { dealName, stage, value, salesCompanyId },
        triggered_by: triggeredBy.slice(0, 500),
        can_undo: true,
      })
      .select("id")
      .single();

    return {
      type: "deal_created",
      entityId: newDeal.id,
      undoToken: actionLog?.id || "",
      success: true,
      details: { dealName, stage, value },
      message: `Created deal for "${companyName}"`,
    };
  } catch (err) {
    console.error("Error creating deal:", err);
    return {
      type: "deal_created",
      entityId: "",
      undoToken: "",
      success: false,
      details: { error: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

// ============================================
// UNDO MECHANISM
// ============================================

async function handleUndo(client: any, undoToken: string, userId: string | null) {
  try {
    // Fetch the action log
    const { data: action, error } = await client
      .from("jericho_action_log")
      .select("*")
      .eq("id", undoToken)
      .single();

    if (error || !action) {
      return { success: false, message: "Undo action not found" };
    }

    if (!action.can_undo) {
      return { success: false, message: "This action can no longer be undone" };
    }

    // Perform the undo based on entity type
    let undoSuccess = false;
    let undoMessage = "";

    switch (action.entity_type) {
      case "company":
        // Delete the company (cascades to contacts, deals)
        const { error: deleteCompanyErr } = await client
          .from("sales_companies")
          .delete()
          .eq("id", action.entity_id);
        undoSuccess = !deleteCompanyErr;
        undoMessage = undoSuccess ? "Company removed" : "Failed to remove company";
        break;

      case "contact":
        const { error: deleteContactErr } = await client
          .from("sales_contacts")
          .delete()
          .eq("id", action.entity_id);
        undoSuccess = !deleteContactErr;
        undoMessage = undoSuccess ? "Contact removed" : "Failed to remove contact";
        break;

      case "deal":
        const { error: deleteDealErr } = await client
          .from("sales_deals")
          .delete()
          .eq("id", action.entity_id);
        undoSuccess = !deleteDealErr;
        undoMessage = undoSuccess ? "Deal removed" : "Failed to remove deal";
        break;

      default:
        undoMessage = "Unknown action type";
    }

    // Mark action as undone
    if (undoSuccess) {
      await client
        .from("jericho_action_log")
        .update({ can_undo: false, undone_at: new Date().toISOString() })
        .eq("id", undoToken);
    }

    return { success: undoSuccess, message: undoMessage };
  } catch (err) {
    console.error("Undo error:", err);
    return { success: false, message: "Failed to undo action" };
  }
}

// ============================================
// PIPELINE ACTIONS
// ============================================

async function handlePipelineActions(
  client: any,
  userId: string | null,
  message: string,
  deals: any[]
) {
  if (!userId) return [];

  const actions: any[] = [];
  const lowerMessage = message.toLowerCase();

  // Detect pipeline actions from message
  const moveMatch = lowerMessage.match(/move\s+["']?(.+?)["']?\s+to\s+(prospecting|discovery|proposal|closing|won|lost)/i);
  const updateMatch = lowerMessage.match(/update\s+["']?(.+?)["']?\s+(?:value|amount)\s+to\s+\$?(\d+)/i);
  const deleteMatch = lowerMessage.match(/(?:delete|remove)\s+["']?(.+?)["']?\s+(?:deal|from pipeline)/i);

  if (moveMatch) {
    const dealName = moveMatch[1];
    const newStage = moveMatch[2].toLowerCase();
    const deal = deals.find(d => d.deal_name.toLowerCase().includes(dealName.toLowerCase()));
    
    if (deal) {
      const { error } = await client
        .from("sales_deals")
        .update({ stage: newStage })
        .eq("id", deal.id);
      
      actions.push({
        action: "move_deal",
        success: !error,
        message: error ? "Failed to move deal" : `Moved "${deal.deal_name}" to ${newStage}`,
      });
    }
  }

  if (updateMatch) {
    const dealName = updateMatch[1];
    const newValue = parseInt(updateMatch[2]);
    const deal = deals.find(d => d.deal_name.toLowerCase().includes(dealName.toLowerCase()));
    
    if (deal) {
      const { error } = await client
        .from("sales_deals")
        .update({ value: newValue })
        .eq("id", deal.id);
      
      actions.push({
        action: "update_deal",
        success: !error,
        message: error ? "Failed to update deal" : `Updated "${deal.deal_name}" value to $${newValue.toLocaleString()}`,
      });
    }
  }

  if (deleteMatch) {
    const dealName = deleteMatch[1];
    const deal = deals.find(d => d.deal_name.toLowerCase().includes(dealName.toLowerCase()));
    
    if (deal) {
      const { error } = await client
        .from("sales_deals")
        .delete()
        .eq("id", deal.id);
      
      actions.push({
        action: "delete_deal",
        success: !error,
        message: error ? "Failed to delete deal" : `Removed "${deal.deal_name}" from pipeline`,
      });
    }
  }

  return actions;
}

// ============================================
// RESEARCH HANDLING
// ============================================

async function handleResearch(
  client: any,
  userId: string,
  companyId: string | null,
  companyName: string,
  apiKey: string
): Promise<{ company: string; summary: string } | null> {
  try {
    // Use Perplexity if available, otherwise use Gemini for basic info
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    
    let researchResult = "";
    
    if (perplexityKey) {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "user",
              content: `Research this company for a sales call: "${companyName}". 
              Provide:
              1. Business overview (what they do, size if known)
              2. Recent news or developments
              3. Key decision makers if findable
              4. Anything relevant for a sales approach
              Keep it concise and actionable.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        researchResult = data.choices?.[0]?.message?.content || "";
      }
    }

    if (!researchResult) {
      // Fallback to basic Gemini search
      researchResult = `Research on "${companyName}" is limited. Try searching manually or asking specific questions.`;
    }

    // Save to intelligence profile if we have a company ID
    if (companyId) {
      // Find the sales company
      const { data: salesCompany } = await client
        .from("sales_companies")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", companyName)
        .maybeSingle();

      if (salesCompany) {
        await client
          .from("sales_company_intelligence")
          .upsert({
            company_id: salesCompany.id,
            profile_id: userId,
            research_data: { summary: researchResult, researched_at: new Date().toISOString() },
            last_research_at: new Date().toISOString(),
          }, { onConflict: "company_id,profile_id" });
      }
    }

    return { company: companyName, summary: researchResult };
  } catch (err) {
    console.error("Research error:", err);
    return null;
  }
}

// ============================================
// EMAIL DRAFTING
// ============================================

async function handleEmailDraft(
  client: any,
  userId: string,
  companyId: string,
  emailRequest: { recipient?: string; type?: string; company?: string },
  context: any,
  apiKey: string
): Promise<{ id: string; subject: string; preview: string } | null> {
  try {
    // Gather personalization context
    let personalizationContext = "";
    
    if (context.intelligence) {
      if (context.intelligence.personal_details) {
        personalizationContext += `Personal details: ${JSON.stringify(context.intelligence.personal_details)}\n`;
      }
      if (context.intelligence.preferences) {
        personalizationContext += `Preferences: ${JSON.stringify(context.intelligence.preferences)}\n`;
      }
    }
    
    if (context.purchaseHistory && context.purchaseHistory.length > 0) {
      personalizationContext += `Purchase history available\n`;
    }

    const emailType = emailRequest.type || "follow_up";
    const recipientName = emailRequest.recipient || "there";
    const companyName = emailRequest.company || "";

    const prompt = `Draft a ${emailType} sales email for an agricultural sales rep.
    
Recipient: ${recipientName}
Company: ${companyName}
${personalizationContext}

Write a short, conversational email that:
1. Has a compelling subject line
2. Opens with something personal or current-event related if possible
3. Gets to the point quickly
4. Has a clear call to action
5. Feels like a real person wrote it, not AI

Return format:
SUBJECT: [subject line]
BODY:
[email body]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("Email generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse subject and body
    const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

    const subject = subjectMatch?.[1]?.trim() || "Following up";
    const bodyText = bodyMatch?.[1]?.trim() || content;

    // Find sales company ID
    let salesCompanyId = null;
    if (companyName) {
      const { data: salesCompany } = await client
        .from("sales_companies")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", `%${companyName}%`)
        .maybeSingle();
      salesCompanyId = salesCompany?.id;
    }

    // Save email draft
    const { data: draft, error } = await client
      .from("email_drafts")
      .insert({
        profile_id: userId,
        company_id: companyId,
        sales_company_id: salesCompanyId,
        recipient_name: recipientName,
        subject,
        body_text: bodyText,
        personalization_context: personalizationContext || null,
        email_type: emailType,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      id: draft.id,
      subject,
      preview: bodyText.slice(0, 150) + (bodyText.length > 150 ? "..." : ""),
    };
  } catch (err) {
    console.error("Email draft error:", err);
    return null;
  }
}

// ============================================
// RESPONSE GENERATION
// ============================================

async function generateResponse(
  message: string,
  conversationHistory: string,
  context: any,
  actions: ActionResult[],
  extracted: ExtractedEntities,
  chatMode: "coach" | "rec",
  deal: any,
  generateCallPlan: boolean | undefined,
  dealsCount: number,
  researchCompleted: { company: string; summary: string } | null,
  emailDrafted: { id: string; subject: string; preview: string } | null,
  apiKey: string
): Promise<string> {
  // Build action summary
  let actionSummary = "";
  const successfulActions = actions.filter(a => a.success && a.type !== "company_exists");
  
  if (successfulActions.length > 0) {
    const companyActions = successfulActions.filter(a => a.type === "company_created");
    const contactActions = successfulActions.filter(a => a.type === "contact_created");
    const dealActions = successfulActions.filter(a => a.type === "deal_created");

    if (companyActions.length > 0) {
      actionSummary += `✅ Added **${companyActions[0].details.name}** to your companies. `;
    }
    if (contactActions.length > 0) {
      actionSummary += `Added ${contactActions.length} contact${contactActions.length > 1 ? 's' : ''}. `;
    }
    if (dealActions.length > 0) {
      actionSummary += `Created a prospecting deal. `;
    }
    actionSummary += "\n\n";
  }

  // Add research results if any
  if (researchCompleted) {
    actionSummary += `**Research on ${researchCompleted.company}:**\n${researchCompleted.summary}\n\n`;
  }

  // Add email draft if any
  if (emailDrafted) {
    actionSummary += `**📧 Email Draft - "${emailDrafted.subject}":**\n\n${emailDrafted.preview}\n\n*[Full email saved - you can copy it from your drafts]*\n\n`;
  }

  // Check if user is asking about a SPECIFIC customer/company
  const mentionedCompany = extracted.companies.length > 0 ? extracted.companies[0].name.toLowerCase() : null;
  const mentionedContact = extracted.contacts.length > 0 ? extracted.contacts[0].name.toLowerCase() : null;
  
  // Filter pipeline to only relevant deals when asking about a specific customer
  let relevantDeals = context.deals || [];
  let customerFocused = false;
  
  if (mentionedCompany || mentionedContact) {
    customerFocused = true;
    relevantDeals = context.deals.filter((d: any) => {
      const companyName = d.sales_companies?.name?.toLowerCase() || "";
      const dealName = d.deal_name?.toLowerCase() || "";
      const contactName = d.sales_contacts?.name?.toLowerCase() || "";
      
      // Match by company name
      if (mentionedCompany && (companyName.includes(mentionedCompany) || dealName.includes(mentionedCompany))) {
        return true;
      }
      // Match by contact name
      if (mentionedContact && (contactName.includes(mentionedContact) || dealName.includes(mentionedContact))) {
        return true;
      }
      return false;
    });
  }

  // Build pipeline context - only show relevant deals when customer-focused, or limit to 10 otherwise
  let pipelineContext = "";
  if (customerFocused && relevantDeals.length === 0) {
    pipelineContext = `No deals found for ${mentionedCompany || mentionedContact || "this customer"} in your pipeline.`;
  } else if (customerFocused) {
    pipelineContext = relevantDeals.map((d: any) => 
      `- ${d.deal_name} (${d.stage}): $${d.value || 0}`
    ).join("\n");
  } else if (context.deals.length > 0) {
    pipelineContext = context.deals.slice(0, 10).map((d: any) => 
      `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || 'Unknown'}`
    ).join("\n");
  } else {
    pipelineContext = "No deals in pipeline yet.";
  }

  // Build sales knowledge context (methodology, objections, products)
  let knowledgeContext = "";
  if (context.salesKnowledge && context.salesKnowledge.length > 0) {
    const methodologyItems = context.salesKnowledge.filter((k: any) => 
      ['mindset', 'process', 'objections', 'closing', 'questions', 'scripts', 'general', 'training'].includes(k.category)
    );
    const productItems = context.salesKnowledge.filter((k: any) => 
      ['product_catalog', 'product_knowledge'].includes(k.category)
    );
    
    if (methodologyItems.length > 0) {
      knowledgeContext += "\n\nSALES METHODOLOGY & TRAINING:\n";
      knowledgeContext += methodologyItems.map((k: any) => 
        `**${k.title}**: ${k.content?.slice(0, 500)}...`
      ).join("\n\n");
    }
    
    if (productItems.length > 0) {
      knowledgeContext += "\n\nPRODUCT KNOWLEDGE:\n";
      knowledgeContext += productItems.map((k: any) => 
        `**${k.title}**: ${k.content?.slice(0, 800)}...`
      ).join("\n\n");
    }
  }

  // Build focus instruction for customer-specific queries
  const focusInstruction = customerFocused
    ? `\n\nIMPORTANT: The user is asking specifically about "${mentionedCompany || mentionedContact}". Focus ONLY on this customer. Do NOT list or discuss other deals or customers unless directly asked.`
    : "";

  // Build system prompt based on mode
  const systemPrompt = chatMode === "rec"
    ? `You are Jericho, an AI sales agent assistant. You help sales reps manage their pipeline and close deals.
You have access to the user's pipeline and can help with:
- Coaching on specific deals
- Product recommendations using the product knowledge below
- Call preparation
- Pipeline management

Use the sales methodology and product knowledge provided to give specific, actionable advice. Reference specific products and techniques when relevant.
ALWAYS remember what we discussed about specific customers - use the customer memory below.

Be direct, actionable, and focused on results. Keep responses concise.${focusInstruction}
${knowledgeContext}

${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}`
    : `You are Jericho, a friendly AI sales coach. You're like a seasoned sales mentor who genuinely wants to help.
    
Your style:
- Conversational and warm, not robotic
- Ask follow-up questions to understand context
- Give specific, actionable advice using the methodology and product knowledge below
- Celebrate wins, help with challenges
- Keep responses focused and not too long
- Reference specific products and sales techniques when relevant
- ALWAYS remember what we discussed about specific customers - use the customer memory below${focusInstruction}
${knowledgeContext}

${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}`;

  // Generate the coaching response
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${conversationHistory ? `Previous conversation:\n${conversationHistory.slice(-8000)}\n\n` : ""}User says: ${message}` },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    console.error("Response generation failed:", await response.text());
    return actionSummary + "I'm here to help! What would you like to work on?";
  }

  const data = await response.json();
  const coachingResponse = data.choices?.[0]?.message?.content || "Let me think about that...";

  return actionSummary + coachingResponse;
}

// ============================================
// INSIGHT EXTRACTION (Post-Response Learning)
// ============================================

async function extractAndSaveInsights(
  client: any,
  userId: string,
  companyId: string,
  userMessage: string,
  assistantResponse: string,
  mentionedCustomer?: string
) {
  // Enhanced insight extraction - linked to specific customers
  const combinedText = `${userMessage} ${assistantResponse}`;
  
  // Detect customer name from conversation if not provided
  let customerName = mentionedCustomer;
  if (!customerName) {
    // Try to extract customer/grower name from message
    const namePatterns = [
      /(?:talking (?:to|with|about)|met with|call with|meeting with|visited)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|told me|mentioned|wants|needs|is interested)/i,
      /(?:grower|farmer|customer|prospect)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        customerName = match[1].trim();
        break;
      }
    }
  }

  // Pattern-based insight detection
  const patterns = [
    { type: "buying_signal", regex: /expand|grow|invest|buy|purchase|upgrade|add more|increase acreage/i },
    { type: "objection", regex: /concern|worried|price|cost|expensive|budget|not sure|hesitant|pushback/i },
    { type: "preference", regex: /prefer|like|want|need|morning|afternoon|call|email|text/i },
    { type: "personal", regex: /family|kid|son|daughter|wife|husband|hobby|vacation|sport|birthday|anniversary/i },
    { type: "product_interest", regex: /seed|treatment|chemical|fertilizer|equipment|technology|biological|fungicide/i },
    { type: "competitive", regex: /competitor|other company|switching|currently using|been buying from/i },
    { type: "timing", regex: /spring|fall|harvest|planting|next season|this year|deadline/i },
    { type: "decision_maker", regex: /partner|brother|father|son runs|wife decides|family decision/i },
  ];

  const detectedInsights: { type: string; text: string }[] = [];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(combinedText)) {
      detectedInsights.push({
        type: pattern.type,
        text: userMessage.slice(0, 500),
      });
    }
  }

  // Save insights with customer linkage
  for (const insight of detectedInsights) {
    try {
      await client
        .from("customer_insights")
        .insert({
          profile_id: userId,
          company_id: companyId,
          customer_name: customerName || null,
          insight_type: insight.type,
          insight_text: insight.text,
          source_conversation_id: null, // Could link to conversation ID if passed
          is_active: true,
          created_at: new Date().toISOString(),
        });
    } catch (err) {
      console.error("Error saving insight:", err);
    }
  }

  // If we have a customer name and enough content, update/create a customer summary
  if (customerName && (detectedInsights.length > 0 || userMessage.length > 100)) {
    try {
      // Find the sales_company for this customer
      const { data: salesCompany } = await client
        .from("sales_companies")
        .select("id")
        .eq("profile_id", userId)
        .ilike("name", `%${customerName}%`)
        .maybeSingle();

      if (salesCompany) {
        // Update relationship notes in sales_company_intelligence
        const { data: existingIntel } = await client
          .from("sales_company_intelligence")
          .select("id, relationship_notes")
          .eq("company_id", salesCompany.id)
          .eq("profile_id", userId)
          .maybeSingle();

        const newNote = `[${new Date().toLocaleDateString()}] ${userMessage.slice(0, 300)}`;
        const updatedNotes = existingIntel?.relationship_notes 
          ? `${existingIntel.relationship_notes}\n\n${newNote}`
          : newNote;

        await client
          .from("sales_company_intelligence")
          .upsert({
            company_id: salesCompany.id,
            profile_id: userId,
            relationship_notes: updatedNotes.slice(-5000), // Keep last ~5000 chars
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id,profile_id" });
      }
    } catch (err) {
      console.error("Error updating customer intelligence:", err);
    }
  }
}

// ============================================
// LOAD CUSTOMER MEMORY
// ============================================

async function loadCustomerMemory(
  client: any,
  userId: string,
  companyId: string,
  customerName: string
): Promise<string> {
  let memory = "";

  try {
    // Find the sales company
    const { data: salesCompany } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .ilike("name", `%${customerName}%`)
      .maybeSingle();

    if (salesCompany) {
      // Load intelligence profile
      const { data: intel } = await client
        .from("sales_company_intelligence")
        .select("*")
        .eq("company_id", salesCompany.id)
        .maybeSingle();

      if (intel) {
        memory += `\n**CUSTOMER MEMORY for ${salesCompany.name}:**\n`;
        if (intel.relationship_notes) {
          memory += `Previous conversations:\n${intel.relationship_notes.slice(-2000)}\n`;
        }
        if (intel.personal_details) {
          memory += `Personal details: ${JSON.stringify(intel.personal_details)}\n`;
        }
        if (intel.preferences) {
          memory += `Preferences: ${JSON.stringify(intel.preferences)}\n`;
        }
        if (intel.buying_signals) {
          memory += `Buying signals: ${JSON.stringify(intel.buying_signals)}\n`;
        }
        if (intel.objections_history) {
          memory += `Past objections: ${JSON.stringify(intel.objections_history)}\n`;
        }
      }

      // Load recent insights
      const { data: insights } = await client
        .from("customer_insights")
        .select("insight_type, insight_text, created_at")
        .or(`customer_name.ilike.%${customerName}%,customer_id.eq.${salesCompany.id}`)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (insights && insights.length > 0) {
        memory += `\nRecent insights:\n`;
        memory += insights.map((i: any) => `- [${i.insight_type}] ${i.insight_text.slice(0, 200)}`).join("\n");
      }

      // Load purchase history
      const { data: history } = await client
        .from("customer_purchase_history")
        .select("year, amount, product_description")
        .eq("company_id", salesCompany.id)
        .order("year", { ascending: false })
        .limit(20);

      if (history && history.length > 0) {
        const totalByYear = history.reduce((acc: any, h: any) => {
          acc[h.year] = (acc[h.year] || 0) + (h.amount || 0);
          return acc;
        }, {});
        memory += `\nPurchase history: ${Object.entries(totalByYear).map(([y, v]) => `${y}: $${(v as number).toLocaleString()}`).join(", ")}\n`;
      }
    }

    // Also check company-wide insights (from other reps)
    if (companyId) {
      const { data: companyInsights } = await client
        .from("customer_insights")
        .select("insight_type, insight_text, created_at")
        .eq("company_id", companyId)
        .ilike("customer_name", `%${customerName}%`)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (companyInsights && companyInsights.length > 0) {
        memory += `\nCompany-wide notes on ${customerName}:\n`;
        memory += companyInsights.map((i: any) => `- ${i.insight_text.slice(0, 150)}`).join("\n");
      }
    }
  } catch (err) {
    console.error("Error loading customer memory:", err);
  }

  return memory;
}
