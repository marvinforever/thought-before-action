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

    // Handle research request - BUT ONLY if entity is NOT in pipeline
    if (extracted.researchRequest && effectiveUserId) {
      const requestedName = extracted.researchRequest.toLowerCase().trim();
      
      // Check if entity exists in pipeline before doing external research
      const existsInPipeline = context.existingCompanies.some((c: any) => {
        const existingName = c.name.toLowerCase().trim();
        // Exact match
        if (existingName.includes(requestedName) || requestedName.includes(existingName)) return true;
        // First name match (Randy → Randy Diekhoff)
        const requestParts = requestedName.split(/\s+/);
        const existingParts = existingName.split(/\s+/);
        if (requestParts[0] && existingParts[0] === requestParts[0]) return true;
        return false;
      }) || context.deals.some((d: any) => {
        const dealName = d.deal_name?.toLowerCase().trim() || '';
        return dealName.includes(requestedName) || requestedName.includes(dealName.split(' ')[0]);
      });

      if (!existsInPipeline) {
        console.log("Running external research for:", requestedName);
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
      } else {
        console.log("Skipping external research - entity found in pipeline:", requestedName);
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
  const systemPrompt = `You are an AI that extracts sales-relevant entities from the user's CURRENT message only.

CRITICAL RULES:
1. ONLY extract entities that are explicitly mentioned in the NEW MESSAGE below
2. The "Recent conversation" is for CONTEXT ONLY - do NOT extract entities from it
3. If someone asks about "Randy D" or "Randy Diekhoff", extract THAT person/company - not other entities from history
4. The conversation history helps you understand if a name might be new vs existing, but you MUST focus on the current message

CRITICAL CONTEXT RULES - PIPELINE FIRST:
- "where did we leave it", "what's the status", "last time we talked", "catch me up on", 
  "what do we know about", "update on", "where are we with" = INTERNAL LOOKUP (intentType: "data_lookup")
- These phrases mean the user is asking about EXISTING pipeline data - NOT a research request
- ONLY set researchRequest when user explicitly says "research", "look up online", "find out about", 
  "what can you find on" for a company that sounds like a BUSINESS (not a person/farm name)
- If the name sounds like a person (first name, or first + last), assume it's a PIPELINE customer first
- A person's name like "Randy" or "Randy D" or "Randy Diekhoff" is almost certainly an existing customer

WHAT TO EXTRACT FROM THE NEW MESSAGE:
- Company/farm names explicitly mentioned in the new message
- Contact names explicitly mentioned in the new message
- Deal signals (value, stage hints) from the new message
- Research requests from the new message (ONLY for explicit research commands about unknown businesses)
- Email requests from the new message

Return a JSON object with this structure:
{
  "companies": [{"name": "Company Name", "isNew": false, "confidence": 0.8}],
  "contacts": [{"name": "John Smith", "title": "Owner", "companyName": "Company Name"}],
  "dealSignals": {"value": 50000, "stage": "prospecting", "notes": "expanding operation"},
  "researchRequest": "company name to research" or null,
  "emailRequest": {"recipient": "John", "type": "follow_up", "company": "ABC Farms"} or null,
  "intentType": "coaching" | "data_lookup" | "create_entity" | "research" | "email" | "pipeline_action"
}

Interpretation rules:
- Mark isNew=true ONLY if the NEW MESSAGE implies they just met or are adding this company/grower
- Phrases like "I just talked to", "I met", "new prospect", "add", "load" suggest NEW entities
- Phrases like "show me", "what about", "tell me about", "precall plan for", "where did we leave it" suggest EXISTING lookups (isNew=false)
- If someone asks about a person like "Randy D", that IS the company/contact to extract (farms often go by owner name)
- Do NOT set researchRequest for person names - they are almost always existing customers
- Do NOT extract entities from previous messages - only the current one`;

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
          { role: "user", content: `Recent conversation (for context only, do NOT extract entities from this):\n${conversationHistory.slice(-3000)}\n\n---\n\nNEW MESSAGE TO ANALYZE (extract entities from THIS only):\n${message}` },
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
      .limit(30),
    
    // Fetch company-specific knowledge (product catalogs, etc.) - INCREASED LIMIT for product data
    companyId 
      ? client
          .from("sales_knowledge")
          .select("title, content, category")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .in("category", ["product_catalog", "product_knowledge", "product_sheet", "general", "training", "scripts"])
          .limit(50)
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
    const normalizedSearch = companyName.toLowerCase().trim();
    
    // Fuzzy match: check if first name + initial matches, or partial match
    const existingCompany = context.existingCompanies.find((c: any) => {
      const existingName = c.name.toLowerCase().trim();
      // Exact match
      if (existingName === normalizedSearch) return true;
      // Contains match (either direction)
      if (existingName.includes(normalizedSearch) || normalizedSearch.includes(existingName)) return true;
      // First name match (Randy D → Randy Diekhoff, or just Randy)
      const searchParts = normalizedSearch.split(/\s+/);
      const existingParts = existingName.split(/\s+/);
      if (searchParts[0] && existingParts[0] === searchParts[0]) {
        // Check if second part is initial or matches start, or no second part provided
        if (!searchParts[1]) return true; // Just first name provided
        if (existingParts[1]?.startsWith(searchParts[1])) return true;
        // Also check if search[1] is just an initial (single letter)
        if (searchParts[1].length === 1 && existingParts[1]?.startsWith(searchParts[1])) return true;
      }
      return false;
    });

    if (existingCompany) {
      // Mark as not new if we found it
      extracted.companies[0].isNew = false;
      console.log("Fuzzy matched company:", companyName, "->", existingCompany.name);

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

    // CRITICAL: Check for existing deals with fuzzy matching to prevent duplicates
    const { data: existingDeals } = await client
      .from("sales_deals")
      .select("id, deal_name, stage")
      .eq("profile_id", userId)
      .eq("company_id", salesCompanyId);

    if (existingDeals && existingDeals.length > 0) {
      // Deal already exists for this company - don't create duplicate
      const existingDeal = existingDeals[0];
      console.log("Deal already exists for company:", companyName, "->", existingDeal.deal_name);
      return {
        type: "deal_exists",
        entityId: existingDeal.id,
        undoToken: "",
        success: true,
        details: { dealName: existingDeal.deal_name, stage: existingDeal.stage, wasExisting: true },
        message: `Found existing deal "${existingDeal.deal_name}" (${existingDeal.stage})`,
      };
    }

    // Also check by deal name fuzzy match (in case company_id differs)
    const normalizedName = dealName.toLowerCase().trim();
    const { data: fuzzyMatches } = await client
      .from("sales_deals")
      .select("id, deal_name, stage")
      .eq("profile_id", userId)
      .ilike("deal_name", `%${normalizedName}%`);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      const match = fuzzyMatches[0];
      console.log("Fuzzy matched existing deal:", dealName, "->", match.deal_name);
      return {
        type: "deal_exists",
        entityId: match.id,
        undoToken: "",
        success: true,
        details: { dealName: match.deal_name, stage: match.stage, wasExisting: true },
        message: `Found existing deal "${match.deal_name}" (${match.stage})`,
      };
    }

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
  // CRITICAL: Product knowledge is essential for accurate recommendations - include more content
  let knowledgeContext = "";
  if (context.salesKnowledge && context.salesKnowledge.length > 0) {
    const methodologyItems = context.salesKnowledge.filter((k: any) => 
      ['mindset', 'process', 'objections', 'closing', 'questions', 'scripts', 'general', 'training'].includes(k.category)
    );
    const productItems = context.salesKnowledge.filter((k: any) => 
      ['product_catalog', 'product_knowledge', 'product_sheet'].includes(k.category)
    );
    
    if (methodologyItems.length > 0) {
      knowledgeContext += "\n\nSALES METHODOLOGY & TRAINING:\n";
      knowledgeContext += methodologyItems.map((k: any) => 
        `**${k.title}**: ${k.content?.slice(0, 500)}...`
      ).join("\n\n");
    }
    
    // CRITICAL: Include FULL product knowledge to prevent hallucination
    if (productItems.length > 0) {
      knowledgeContext += "\n\n## PRODUCT KNOWLEDGE (Use ONLY these products in recommendations - DO NOT make up product codes):\n";
      knowledgeContext += productItems.map((k: any) => 
        // Include more content for product catalogs to ensure accurate recommendations
        `### ${k.title}:\n${k.content?.slice(0, 3000)}`
      ).join("\n\n");
    } else {
      // Explicit notice when no product data is available
      knowledgeContext += "\n\n## PRODUCT KNOWLEDGE: **NO PRODUCT CATALOG LOADED** - Do not recommend specific products by code.\n";
    }
  } else {
    knowledgeContext += "\n\n## PRODUCT KNOWLEDGE: **NO KNOWLEDGE BASE AVAILABLE** - Do not recommend specific products.\n";
  }

  // Build focus instruction for customer-specific queries
  const focusInstruction = customerFocused
    ? `\n\nIMPORTANT: The user is asking specifically about "${mentionedCompany || mentionedContact}". Focus ONLY on this customer. Do NOT list or discuss other deals or customers unless directly asked.`
    : "";

  // Build system prompt based on mode
  // Build methodology reference for system prompt
  const methodologyReference = `
## YOUR CONSULTATIVE SELLING METHODOLOGY (Thrive Today):

**5-Step Sales Process:**
1. PROSPECTING - Get meetings using the appointment setting script
2. DISCOVERY - The MOST important step. Ask the "Magic Questions"
3. PROPOSAL - Present solutions based on what you learned in discovery  
4. CLOSING - If discovery was done right, closing is natural. Always ASK.
5. FOLLOW-UP - The thread that weaves everything together

**Magic Questions for Discovery:**
- "What are the two to three things you're looking to accomplish this season?"
- "What else?" (keep asking - the LAST thing is often most important)
- "Tell me more about [that last thing]..."

**The 3 Motivators:** Pain (strongest), Fear, Opportunity (weakest)

**Tension vs Trust:** Everything we do should DECREASE tension and INCREASE trust.

**ACAVE for Objections:**
- A = Acknowledge (normalize the concern)
- C = Clarify (ask questions to understand)
- A = Answer (share your perspective)
- V = Verify (confirm understanding)
- E = End/Close (move forward)

**Appointment Setting Script:**
"Hey [Customer], this is [Your Name]. I've been meaning to put a face with a name. Going to be in your area next week. I've got [Day 1 at Time 1] and [Day 2 at Time 2] available. Which one works best?"
`;

  // CRITICAL: Product recommendation rules to prevent hallucination
  const productValidationRules = `
## CRITICAL PRODUCT RECOMMENDATION RULES - READ CAREFULLY:

1. **NEVER MAKE UP PRODUCT CODES OR NUMBERS** - Only recommend products that appear EXACTLY in the PRODUCT KNOWLEDGE section below.
2. If you don't have specific product data in your knowledge base, say: "I don't have the specific product catalog loaded for [company]. Let me help you with the sales approach instead."
3. When recommending seeds/hybrids: ONLY use product codes that appear verbatim in your PRODUCT KNOWLEDGE section.
4. If no PRODUCT KNOWLEDGE section exists below, DO NOT recommend specific products by code - instead help with sales strategy.
5. If asked for a seed recommendation and you don't have the data, say: "I don't have the product guide loaded yet. Can you upload the seed guide, or would you like me to help with discovery questions instead?"
6. NEVER fabricate hybrid numbers like "7300 DG" - if you can't find it in your knowledge, you don't know it.
`;

  const systemPrompt = chatMode === "rec"
    ? `You are Jericho, an AI sales agent assistant using the Thrive Today Consultative Selling methodology.
${methodologyReference}

${productValidationRules}

You help sales reps:
- Coach on specific deals using the methodology above
- Product recommendations ONLY using products from the PRODUCT KNOWLEDGE section below (never make up product codes)
- Call preparation with discovery questions and objection handling
- Pipeline management

Use the sales methodology and product knowledge provided. Reference specific techniques (Magic Questions, ACAVE, Tension vs Trust) when coaching.
ALWAYS remember what we discussed about specific customers - use the customer memory below.

Be direct, actionable, and focused on results.${focusInstruction}
${knowledgeContext}

${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}`
    : `You are Jericho, a seasoned sales coach using the Thrive Today Consultative Selling methodology.
${methodologyReference}

${productValidationRules}

Your coaching style:
- Conversational and warm, like a trusted mentor
- Ask follow-up questions to understand context
- Give specific, actionable advice using the methodology above
- When they ask about objections, teach ACAVE
- When they ask about discovery, teach the Magic Questions
- When they're stuck, remind them: Decrease tension, Increase trust
- Celebrate wins, help with challenges
- Reference ONLY products that appear in your PRODUCT KNOWLEDGE section (never make up product codes)
- ALWAYS remember what we discussed about specific customers${focusInstruction}
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
// INSIGHT EXTRACTION (Post-Response Learning) - ENHANCED MEMORY PERSISTENCE
// ============================================

async function extractAndSaveInsights(
  client: any,
  userId: string,
  companyId: string,
  userMessage: string,
  assistantResponse: string,
  mentionedCustomer?: string,
  apiKey?: string
) {
  // Enhanced insight extraction - linked to specific customers
  const combinedText = `${userMessage} ${assistantResponse}`;
  
  // Detect customer name from conversation if not provided
  let customerName = mentionedCustomer;
  if (!customerName) {
    // Try to extract customer/grower name from message
    const namePatterns = [
      /(?:talking (?:to|with|about)|met with|call with|meeting with|visited)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:Farm|Farms|Inc|LLC|Co|Company)?)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|told me|mentioned|wants|needs|is interested)/i,
      /(?:grower|farmer|customer|prospect)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:at|with|from)\s+([A-Z][a-z]+(?:\s+(?:Farm|Farms))?)/i,
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
    { type: "relationship", regex: /years|long time|loyal|always|history|relationship/i },
    { type: "acreage", regex: /\d+\s*(?:acres?|k\s*acres?)/i },
    { type: "crops", regex: /corn|soybeans?|wheat|cotton|rice|barley|oats|canola/i },
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
          source_conversation_id: null,
          is_active: true,
          created_at: new Date().toISOString(),
        });
    } catch (err) {
      console.error("Error saving insight:", err);
    }
  }

  // ALWAYS save to intelligence if we have a customer - don't require insights
  if (customerName) {
    try {
      // Find ALL sales_companies that match this customer name for this user
      const { data: salesCompanies } = await client
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .or(`name.ilike.%${customerName}%,name.ilike.${customerName}%`);

      for (const salesCompany of (salesCompanies || [])) {
        // Update relationship notes in sales_company_intelligence
        const { data: existingIntel } = await client
          .from("sales_company_intelligence")
          .select("id, relationship_notes, personal_details, buying_signals, preferences")
          .eq("company_id", salesCompany.id)
          .eq("profile_id", userId)
          .maybeSingle();

        const dateStr = new Date().toLocaleDateString();
        const newNote = `[${dateStr}] ${userMessage.slice(0, 400)}`;
        
        let updatedNotes = existingIntel?.relationship_notes || "";
        // Avoid duplicate entries for same day
        if (!updatedNotes.includes(`[${dateStr}]`) || !updatedNotes.includes(userMessage.slice(0, 50))) {
          updatedNotes = updatedNotes 
            ? `${updatedNotes}\n\n${newNote}`
            : newNote;
        }

        // Extract and merge structured data
        const buyingSignals = existingIntel?.buying_signals || [];
        const personalDetails = existingIntel?.personal_details || {};
        const preferences = existingIntel?.preferences || {};

        // Add new insights to structured fields
        for (const insight of detectedInsights) {
          if (insight.type === "buying_signal" && Array.isArray(buyingSignals)) {
            const signalText = insight.text.slice(0, 150);
            if (!buyingSignals.some((s: any) => s?.text === signalText)) {
              buyingSignals.push({ text: signalText, date: dateStr });
            }
          }
          if (insight.type === "personal") {
            personalDetails[dateStr] = insight.text.slice(0, 200);
          }
          if (insight.type === "preference") {
            preferences[dateStr] = insight.text.slice(0, 200);
          }
        }

        await client
          .from("sales_company_intelligence")
          .upsert({
            company_id: salesCompany.id,
            profile_id: userId,
            relationship_notes: updatedNotes.slice(-8000), // Keep more history
            buying_signals: Array.isArray(buyingSignals) ? buyingSignals.slice(-20) : [],
            personal_details: personalDetails,
            preferences: preferences,
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id,profile_id" });

        console.log(`Saved intelligence for ${salesCompany.name}`);
      }
    } catch (err) {
      console.error("Error updating customer intelligence:", err);
    }
  }

  // ALWAYS log the raw conversation to a general log as backup
  try {
    await client
      .from("jericho_action_log")
      .insert({
        profile_id: userId,
        company_id: companyId,
        action_type: "conversation_backup",
        entity_type: customerName ? "customer_mention" : "general_chat",
        entity_id: null,
        entity_name: customerName || "general",
        action_data: {
          user_message: userMessage.slice(0, 1000),
          assistant_response: assistantResponse.slice(0, 500),
          insights_detected: detectedInsights.map(i => i.type),
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error("Error saving conversation backup:", err);
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
    // Find the sales company with fuzzy matching for partial names (Randy -> Randy Diekhoff)
    const namePatterns = customerName.trim().split(/\s+/);
    const firstName = namePatterns[0];
    
    // Try multiple matching strategies
    let salesCompany = null;
    
    // First try exact ilike match
    const { data: exactMatch } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .ilike("name", `%${customerName}%`)
      .maybeSingle();
    
    if (exactMatch) {
      salesCompany = exactMatch;
    } else if (firstName) {
      // Try first name match (for cases like "Randy" -> "Randy Diekhoff")
      const { data: firstNameMatch } = await client
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .ilike("name", `${firstName}%`)
        .maybeSingle();
      
      if (firstNameMatch) {
        salesCompany = firstNameMatch;
        console.log("Fuzzy matched customer by first name:", customerName, "->", firstNameMatch.name);
      }
    }

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
