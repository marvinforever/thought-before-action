import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";
import {
  getOrCreateBackboardThread,
  createBackboardClient,
  loadBackboardMemory,
  formatBackboardMemoryForPrompt,
} from "../_shared/backboard-client.ts";
import { handleParetoAnalysis, handlePurchaseHistoryQuery, handleRepCustomerListQuery } from "./analytics.ts";
import {
  ActionResult,
  createCompany,
  createContact,
  createDeal,
  handleUndo,
  handlePipelineActions,
} from "./actions.ts";
import { loadCustomerMemory, extractAndSaveInsights } from "./memory.ts";

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
  activeCustomerId?: string;
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = authHeader
      ? createClient(supabaseUrl, supabaseServiceKey, { global: { headers: { Authorization: authHeader } } })
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
      activeCustomerId,
    } = body;

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

        if (profile?.is_super_admin && viewAsUserId) {
          userId = viewAsUserId;
          const { data: imp } = await adminClient.from("profiles").select("company_id").eq("id", viewAsUserId).single();
          companyId = viewAsCompanyId || imp?.company_id || companyId;
        } else if (viewAsCompanyId) {
          companyId = viewAsCompanyId;
        }
      }
    }

    const effectiveUserId = userId;
    const effectiveCompanyId = companyId;

    if (undoAction) {
      const result = await handleUndo(adminClient, undoAction, effectiveUserId);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Intent Detection
    let extracted = await detectIntentAndExtract(message, conversationHistory, lovableApiKey);

    if (extracted.companies.length === 0) {
      const fallbackCompany = extractCompanyFallback(message);
      if (fallbackCompany) {
        extracted = { ...extracted, companies: [{ name: fallbackCompany, isNew: true, confidence: 0.7 }], intentType: "pipeline_action" };
      }
    }

    // Step 2: Deterministic Intercepts
    const paretoResult = await handleParetoAnalysis(message, adminClient, effectiveUserId, effectiveCompanyId);
    if (paretoResult) {
      return new Response(
        JSON.stringify({ message: paretoResult, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repCustomerListResult = await handleRepCustomerListQuery(message, adminClient, effectiveUserId, effectiveCompanyId);
    if (repCustomerListResult) {
      return new Response(
        JSON.stringify({ message: repCustomerListResult, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const purchaseHistoryResult = await handlePurchaseHistoryQuery(message, adminClient, effectiveUserId, effectiveCompanyId);
    if (purchaseHistoryResult) {
      return new Response(
        JSON.stringify({ message: purchaseHistoryResult.response, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [], inferredCustomerId: purchaseHistoryResult.customerId, inferredCustomerName: purchaseHistoryResult.customerName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Backboard Memory
    let backboardMemory = "";
    let backboardThreadId: string | null = null;
    let inferredCustomerId: string | null = activeCustomerId || null;
    let inferredCustomerName: string | null = null;

    if (!activeCustomerId && extracted.companies.length > 0) {
      const { data: matchedCustomer } = await adminClient
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", effectiveUserId)
        .ilike("name", `%${extracted.companies[0].name}%`)
        .maybeSingle();

      if (matchedCustomer) {
        inferredCustomerId = matchedCustomer.id;
        inferredCustomerName = matchedCustomer.name;
      }
    }

    if (effectiveUserId) {
      try {
        const backboardThread = await getOrCreateBackboardThread(adminClient, effectiveUserId, "sales", inferredCustomerId);
        if (backboardThread) {
          backboardThreadId = backboardThread.threadId;
          const messages = await loadBackboardMemory(backboardThread.threadId, 50);
          backboardMemory = formatBackboardMemoryForPrompt(messages);
        }
      } catch (err) {
        console.warn("Failed to load Backboard memory:", err);
      }
    }

    // Step 4: Gather Context
    const context = await gatherContext(adminClient, effectiveUserId, effectiveCompanyId, extracted, userContext);
    context.backboardMemory = backboardMemory;

    // Step 5: Execute Actions
    const actions: ActionResult[] = [];
    let dealCreated = false;
    let companyCreated: { id: string; name: string } | null = null;
    let contactsCreated: { id: string; name: string }[] = [];
    let emailDrafted: { id: string; subject: string; preview: string } | null = null;
    let researchCompleted: { company: string; summary: string } | null = null;

    if (extracted.companies.length > 0 && effectiveUserId && effectiveCompanyId) {
      const hasDealSignals = !!(extracted.dealSignals && Object.keys(extracted.dealSignals).length > 0);
      const forcePipelineCreate = /\b(add|put|log|start|create)\b[\s\S]{0,25}\b(deal|pipeline|opportunity)\b/i.test(message);

      for (const company of extracted.companies) {
        const shouldEnsurePipelineEntry = company.isNew || hasDealSignals || forcePipelineCreate;
        if (!shouldEnsurePipelineEntry) continue;

        const companyResult = await createCompany(adminClient, effectiveUserId, effectiveCompanyId, company.name, message);
        if (!companyResult.success || !companyResult.entityId) continue;

        if (companyResult.type === "company_created") {
          actions.push(companyResult);
          companyCreated = { id: companyResult.entityId, name: company.name };
        } else {
          actions.push(companyResult);
        }

        const companyContacts = extracted.contacts.filter(
          (c) => !c.companyName || c.companyName.toLowerCase() === company.name.toLowerCase()
        );
        for (const contact of companyContacts) {
          const contactResult = await createContact(adminClient, effectiveUserId, effectiveCompanyId, companyResult.entityId, contact.name, contact.title, message);
          if (contactResult.success) {
            actions.push(contactResult);
            contactsCreated.push({ id: contactResult.entityId, name: contact.name });
          }
        }

        const dealResult = await createDeal(adminClient, effectiveUserId, effectiveCompanyId, companyResult.entityId, company.name, extracted.dealSignals || { stage: "prospecting" }, message);
        if (dealResult.success) {
          actions.push(dealResult);
          if (dealResult.type === "deal_created") dealCreated = true;
        }
      }
    }

    // Research
    if (extracted.researchRequest && effectiveUserId) {
      const requestedName = extracted.researchRequest.toLowerCase().trim();
      const researchBlocklist = ["jericho", "momentum", "the momentum company", "momentum company"];
      const isBlocked = researchBlocklist.some((b) => requestedName.includes(b) || b.includes(requestedName));

      if (!isBlocked) {
        const existsInPipeline =
          context.existingCompanies.some((c: any) => {
            const en = c.name.toLowerCase().trim();
            if (en.includes(requestedName) || requestedName.includes(en)) return true;
            const rp = requestedName.split(/\s+/);
            const ep = en.split(/\s+/);
            return rp[0] && ep[0] === rp[0];
          }) ||
          context.deals.some((d: any) => {
            const dn = d.deal_name?.toLowerCase().trim() || "";
            return dn.includes(requestedName) || requestedName.includes(dn.split(" ")[0]);
          });

        if (!existsInPipeline) {
          researchCompleted = await handleResearch(adminClient, effectiveUserId, effectiveCompanyId, extracted.researchRequest, lovableApiKey);
        }
      }
    }

    // Email
    if (extracted.emailRequest && effectiveUserId && effectiveCompanyId) {
      emailDrafted = await handleEmailDraft(adminClient, effectiveUserId, effectiveCompanyId, extracted.emailRequest, context, lovableApiKey);
    }

    const pipelineActions = await handlePipelineActions(adminClient, effectiveUserId, message, context.deals);

    // Step 6: Generate Response
    const responseMessage = await generateResponse(
      message, conversationHistory, context, actions, extracted, chatMode, deal,
      generateCallPlan, dealsCount, researchCompleted, emailDrafted, lovableApiKey,
      effectiveUserId || "", effectiveCompanyId || ""
    );

    // Step 7: Post-response learning (fire and forget)
    if (effectiveUserId && effectiveCompanyId) {
      const mentionedCustomer = extracted.contacts[0]?.name || extracted.companies[0]?.name || undefined;
      extractAndSaveInsights(adminClient, effectiveUserId, effectiveCompanyId, message, responseMessage, mentionedCustomer)
        .catch((err) => console.error("Error saving insights:", err));
    }

    // Step 8: Sync to Backboard
    if (effectiveUserId && backboardThreadId) {
      try {
        const backboard = createBackboardClient();
        if (backboard) {
          await backboard.syncMessage(backboardThreadId, "user", message);
          await backboard.syncMessage(backboardThreadId, "assistant", responseMessage);
        }
      } catch (err) {
        console.warn("Backboard sync failed:", err);
      }
    }

    return new Response(
      JSON.stringify({ message: responseMessage, actions, dealCreated, companyCreated, contactsCreated, emailDrafted, researchCompleted, pipelineActions, inferredCustomerId, inferredCustomerName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sales coach error:", error);
    return new Response(
      JSON.stringify({ message: "I'm having a moment - let me gather my thoughts. Try again?", error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// INTENT DETECTION
// ============================================

async function detectIntentAndExtract(message: string, conversationHistory: string, apiKey: string): Promise<ExtractedEntities> {
  const systemPrompt = `You are an AI that extracts sales-relevant entities from the user's CURRENT message only.

CRITICAL RULES:
1. ONLY extract entities explicitly mentioned in the NEW MESSAGE
2. "Recent conversation" is CONTEXT ONLY - do NOT extract entities from it
3. NEVER extract these: "Jericho" (AI name), "Momentum" (user's company)

RESEARCH IS EXPLICIT-ONLY - only set researchRequest if user says "research [company]", "look up [company] online", "find out about [company]".

Return JSON:
{
  "companies": [{"name": "...", "isNew": false, "confidence": 0.8}],
  "contacts": [{"name": "...", "title": "...", "companyName": "..."}],
  "dealSignals": {"value": null, "stage": "prospecting", "notes": "..."},
  "researchRequest": null,
  "emailRequest": null,
  "intentType": "coaching" | "data_lookup" | "create_entity" | "research" | "email" | "pipeline_action"
}

Rules: isNew=true only if NEW MESSAGE implies just met. "show me", "what about", "tell me about" = isNew=false.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Recent conversation (context only):\n${conversationHistory.slice(-3000)}\n\n---\n\nNEW MESSAGE:\n${message}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) return getDefaultExtraction();

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
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
  return { companies: [], contacts: [], dealSignals: {}, intentType: "coaching" };
}

function extractCompanyFallback(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  const hasPipelineContext = lowerMsg.includes("pipeline") || lowerMsg.includes("deal") || lowerMsg.includes("prospect") || lowerMsg.includes("track") || lowerMsg.includes("add") || lowerMsg.includes("opportunity");
  if (!hasPipelineContext) return null;

  const addPatterns = [
    /\badd\s+([A-Z][a-zA-Z\s']+?)\s+to\s+(my\s+)?pipeline/i,
    /\bput\s+([A-Z][a-zA-Z\s']+?)\s+in\s+(the\s+)?pipeline/i,
    /\bcreate\s+(a\s+)?deal\s+for\s+([A-Z][a-zA-Z\s']+)/i,
    /\blog\s+([A-Z][a-zA-Z\s']+?)\s+as\s+(a\s+)?prospect/i,
    /\bnew\s+(prospect|deal)[:\s]+([A-Z][a-zA-Z\s']+)/i,
    /\btrack\s+([A-Z][a-zA-Z\s']+?)(?:\s|$|\.)/i,
    /\bjust\s+(met|talked|spoke)\s+(with|to)\s+([A-Z][a-zA-Z\s']+?)(?:\s+and|\s+about|\.|\s*$)/i,
    /\bmet\s+with\s+([A-Z][a-zA-Z\s']+?)\s+(today|yesterday|this\s+week)/i,
    /\badd\s+([A-Z][a-zA-Z\s']+?)(?:\s*$|\.|\s+to)/i,
  ];

  for (const pattern of addPatterns) {
    const match = message.match(pattern);
    if (match) {
      let name = match[1] || match[2] || match[3];
      if (name) {
        name = name.trim().replace(/\s+/g, " ").replace(/[.,!?]$/, "");
        if (name.length >= 2 && !/^(him|her|them|it|this|that|my|the|a|an)$/i.test(name)) return name;
      }
    }
  }

  return null;
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
  const context: any = { userContext, deals: [], existingCompanies: [], intelligence: null, purchaseHistory: null, salesKnowledge: [] };
  if (!userId) return context;

  const [dealsResult, companiesResult, globalKnowledgeResult, companyKnowledgeResult] = await Promise.all([
    client.from("sales_deals").select(`id, deal_name, stage, value, expected_close_date, priority, notes, last_activity_at, sales_companies(id, name), sales_contacts(id, name, title)`).eq("profile_id", userId).order("priority").limit(50),
    client.from("sales_companies").select("id, name").eq("profile_id", userId).order("name").limit(500),
    client.from("sales_knowledge").select("title, content, category").is("company_id", null).eq("is_active", true).limit(30),
    companyId
      ? client.from("sales_knowledge").select("title, content, category").eq("company_id", companyId).eq("is_active", true).limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  context.deals = dealsResult.data || [];
  context.existingCompanies = companiesResult.data || [];
  context.salesKnowledge = [...(globalKnowledgeResult.data || []), ...(companyKnowledgeResult.data || [])];

  if (extracted.companies.length > 0) {
    const companyName = extracted.companies[0].name;
    const normalizedSearch = companyName.toLowerCase().trim();

    const existingCompany = context.existingCompanies.find((c: any) => {
      const en = c.name.toLowerCase().trim();
      if (en === normalizedSearch || en.includes(normalizedSearch) || normalizedSearch.includes(en)) return true;
      const sp = normalizedSearch.split(/\s+/);
      const ep = en.split(/\s+/);
      if (sp[0] && ep[0] === sp[0]) {
        if (!sp[1]) return true;
        if (ep[1]?.startsWith(sp[1])) return true;
        if (sp[1].length === 1 && ep[1]?.startsWith(sp[1])) return true;
      }
      return false;
    });

    const searchName = existingCompany ? existingCompany.name : companyName;
    const nameParts = searchName.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];

    if (existingCompany) {
      extracted.companies[0].isNew = false;
    }

    const [intelResult, historyResult] = await Promise.all([
      existingCompany
        ? client.from("sales_company_intelligence").select("*").eq("company_id", existingCompany.id).eq("profile_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      client
        .from("customer_purchase_history")
        .select("customer_name, year, season, amount, product_description, quantity, sale_date, rep_name")
        .eq("company_id", companyId)
        .or(`customer_name.ilike.%${lastName}%,customer_name.ilike.%${firstName}%`)
        .order("sale_date", { ascending: false })
        .limit(500),
    ]);

    context.intelligence = intelResult.data;

    const rawHistory = historyResult.data || [];
    if (rawHistory.length > 0) {
      const yearMap = new Map<string, { total: number; count: number }>();
      const productMap = new Map<string, number>();
      let totalRevenue = 0;
      for (const row of rawHistory) {
        const yr = row.year || (row.sale_date ? row.sale_date.substring(0, 4) : "Unknown");
        const amt = Number(row.amount) || 0;
        const prod = row.product_description || "Unknown";
        yearMap.set(yr, { total: (yearMap.get(yr)?.total || 0) + amt, count: (yearMap.get(yr)?.count || 0) + 1 });
        productMap.set(prod, (productMap.get(prod) || 0) + amt);
        totalRevenue += amt;
      }
      const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
      const yearSummary = Array.from(yearMap.entries()).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 5).map(([yr, d]) => `  - ${yr}: ${fmt(d.total)} (${d.count} transactions)`).join("\n");
      const topProducts = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, amt]) => `  - ${p}: ${fmt(amt)}`).join("\n");
      context.purchaseHistory = rawHistory;
      context.purchaseHistorySummary = `PURCHASE HISTORY for ${searchName} (${rawHistory.length} transactions):\nTotal: ${fmt(totalRevenue)}\nBy Year:\n${yearSummary}\nTop Products:\n${topProducts}`;
    } else {
      context.purchaseHistory = [];
      context.purchaseHistorySummary = null;
    }
  }

  if (extracted.contacts.length > 0 || extracted.companies.length > 0) {
    const customerName = extracted.contacts[0]?.name || extracted.companies[0]?.name;
    if (customerName && userId && companyId) {
      context.customerMemory = await loadCustomerMemory(client, userId, companyId, customerName);
    }
  }

  return context;
}

// ============================================
// RESEARCH
// ============================================

async function handleResearch(
  client: any,
  userId: string,
  companyId: string | null,
  companyName: string,
  apiKey: string
): Promise<{ company: string; summary: string } | null> {
  try {
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    let researchResult = "";

    if (perplexityKey) {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: `Research this company for a sales call: "${companyName}". Provide: 1. Business overview 2. Recent news 3. Key decision makers 4. Sales approach tips. Keep concise.` }],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        researchResult = data.choices?.[0]?.message?.content || "";
      }
    }

    if (!researchResult) researchResult = `Research on "${companyName}" is limited. Try searching manually or asking specific questions.`;

    if (companyId) {
      const { data: salesCompany } = await client.from("sales_companies").select("id").eq("company_id", companyId).ilike("name", companyName).maybeSingle();
      if (salesCompany) {
        await client.from("sales_company_intelligence").upsert({ company_id: salesCompany.id, profile_id: userId, research_data: { summary: researchResult, researched_at: new Date().toISOString() }, last_research_at: new Date().toISOString() }, { onConflict: "company_id,profile_id" });
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
    let personalizationContext = "";
    if (context.intelligence?.personal_details) personalizationContext += `Personal details: ${JSON.stringify(context.intelligence.personal_details)}\n`;
    if (context.intelligence?.preferences) personalizationContext += `Preferences: ${JSON.stringify(context.intelligence.preferences)}\n`;
    if (context.purchaseHistory?.length > 0) personalizationContext += `Purchase history available\n`;

    const emailType = emailRequest.type || "follow_up";
    const recipientName = emailRequest.recipient || "there";
    const companyName = emailRequest.company || "";

    const prompt = `Draft a ${emailType} sales email for an agricultural sales rep.
Recipient: ${recipientName}
Company: ${companyName}
${personalizationContext}
Write a short, conversational email that: has a compelling subject line, opens personally, gets to the point, has a clear CTA, feels human.
Return format:
SUBJECT: [subject line]
BODY:
[email body]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    });

    if (!response.ok) throw new Error("Email generation failed");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const subject = content.match(/SUBJECT:\s*(.+)/i)?.[1]?.trim() || "Following up";
    const bodyText = content.match(/BODY:\s*([\s\S]+)/i)?.[1]?.trim() || content;

    let salesCompanyId = null;
    if (companyName) {
      const { data: sc } = await client.from("sales_companies").select("id").eq("company_id", companyId).ilike("name", `%${companyName}%`).maybeSingle();
      salesCompanyId = sc?.id;
    }

    const { data: draft, error } = await client
      .from("email_drafts")
      .insert({ profile_id: userId, company_id: companyId, sales_company_id: salesCompanyId, recipient_name: recipientName, subject, body_text: bodyText, personalization_context: personalizationContext || null, email_type: emailType, status: "draft" })
      .select("id")
      .single();

    if (error) throw error;
    return { id: draft.id, subject, preview: bodyText.slice(0, 150) + (bodyText.length > 150 ? "..." : "") };
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
  apiKey: string,
  userId: string,
  companyId: string
): Promise<string> {
  const sanitizePricingIfNeeded = (text: string) => {
    if (!text) return text;
    const hasPricingSignals = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/m.test(text) || /\b(?:per\s+acre|\/acre|acre\s+price|priced\s+at|price\s+is|cost\s+is|costs\s+\$|\$\s*\/\s*unit)\b/i.test(text);
    if (!hasPricingSignals) return text;
    const hasAllowedAttribution = /\bPer your product catalog\b/i.test(text) || /\bBased on the \$\d[\s\S]{0,40}you mentioned\b/i.test(text) || /\bCurrent public market data shows\b/i.test(text);
    if (hasAllowedAttribution) return text;
    const stripped = text.split("\n").filter((line) => !/\$\s?\d/.test(line)).join("\n").trim();
    const disclaimer = "\n\n**Pricing note:** I don't have your price sheet loaded and won't guess pricing. Share your price sheet and I'll use it.";
    return (stripped.length ? stripped : "") + disclaimer;
  };

  let actionSummary = "";
  const successfulActions = actions.filter((a) => a.success && a.type !== "company_exists");
  if (successfulActions.length > 0) {
    const companyActions = successfulActions.filter((a) => a.type === "company_created");
    const contactActions = successfulActions.filter((a) => a.type === "contact_created");
    const dealActions = successfulActions.filter((a) => a.type === "deal_created");
    if (companyActions.length > 0) actionSummary += `✅ Added **${companyActions[0].details.name}** to your companies. `;
    if (contactActions.length > 0) actionSummary += `Added ${contactActions.length} contact${contactActions.length > 1 ? "s" : ""}. `;
    if (dealActions.length > 0) actionSummary += `Created a prospecting deal. `;
    actionSummary += "\n\n";
  }
  if (researchCompleted) actionSummary += `**Research on ${researchCompleted.company}:**\n${researchCompleted.summary}\n\n`;
  if (emailDrafted) actionSummary += `**📧 Email Draft - "${emailDrafted.subject}":**\n\n${emailDrafted.preview}\n\n*[Full email saved]*\n\n`;

  const mentionedCompany = extracted.companies.length > 0 ? extracted.companies[0].name.toLowerCase() : null;
  const mentionedContact = extracted.contacts.length > 0 ? extracted.contacts[0].name.toLowerCase() : null;

  let relevantDeals = context.deals || [];
  let customerFocused = false;

  if (mentionedCompany || mentionedContact) {
    customerFocused = true;
    relevantDeals = context.deals.filter((d: any) => {
      const cn = d.sales_companies?.name?.toLowerCase() || "";
      const dn = d.deal_name?.toLowerCase() || "";
      const cc = d.sales_contacts?.name?.toLowerCase() || "";
      if (mentionedCompany && (cn.includes(mentionedCompany) || dn.includes(mentionedCompany))) return true;
      if (mentionedContact && (cc.includes(mentionedContact) || dn.includes(mentionedContact))) return true;
      return false;
    });
  }

  let pipelineContext = "";
  if (customerFocused && relevantDeals.length === 0) {
    pipelineContext = `No deals found for ${mentionedCompany || mentionedContact || "this customer"} in your pipeline.`;
  } else if (customerFocused) {
    pipelineContext = relevantDeals.map((d: any) => `- ${d.deal_name} (${d.stage}): $${d.value || 0}`).join("\n");
  } else if (context.deals.length > 0) {
    pipelineContext = context.deals.slice(0, 10).map((d: any) => `- ${d.deal_name} (${d.stage}): $${d.value || 0} at ${d.sales_companies?.name || "Unknown"}`).join("\n");
  } else {
    pipelineContext = "No deals in pipeline yet.";
  }

  let knowledgeContext = "";
  if (context.salesKnowledge?.length > 0) {
    const methodologyItems = context.salesKnowledge.filter((k: any) => ["mindset", "process", "objections", "closing", "questions", "scripts", "general", "training"].includes(k.category));
    const productItems = context.salesKnowledge.filter((k: any) => {
      const cat = k.category?.toLowerCase() || "";
      const title = k.title?.toLowerCase() || "";
      return ["product_catalog", "product_knowledge", "product_sheet", "catalog"].includes(cat) || title.includes("seed") || title.includes("product") || title.includes("catalog") || title.includes("guide") || title.includes("hybrid");
    });
    if (methodologyItems.length > 0) knowledgeContext += `\n\nSALES METHODOLOGY:\n${methodologyItems.map((k: any) => `**${k.title}**: ${k.content?.slice(0, 500)}...`).join("\n\n")}`;
    if (productItems.length > 0) knowledgeContext += `\n\n## PRODUCT KNOWLEDGE (Use ONLY these):\n${productItems.map((k: any) => `### ${k.title}:\n${k.content?.slice(0, 3000)}`).join("\n\n")}`;
    else knowledgeContext += `\n\n## PRODUCT KNOWLEDGE: **NO PRODUCT CATALOG LOADED** - Do not recommend specific products by code.`;
  } else {
    knowledgeContext += `\n\n## PRODUCT KNOWLEDGE: **NO KNOWLEDGE BASE AVAILABLE** - Do not recommend specific products.`;
  }

  const focusInstruction = customerFocused
    ? `\n\nIMPORTANT: The user is asking specifically about "${mentionedCompany || mentionedContact}". Focus ONLY on this customer.`
    : "";

  const productValidationRules = `
## CRITICAL PRODUCT & PRICING RULES:
1. NEVER FABRICATE PRODUCT CODES - only use products from PRODUCT KNOWLEDGE below.
2. If product data exists, USE IT for recommendations.
3. NEVER make up prices - cite your source or say you don't have pricing data.
4. COMMODITY PRICES are OK with public market data citation and approximate date.`;

  const methodologyReference = `
## YOUR CONSULTATIVE SELLING METHODOLOGY (Thrive Today):
**5-Step Process:** Prospecting → Discovery → Proposal → Closing → Follow-Up
**Magic Questions:** "What are 2-3 things you're looking to accomplish this season?" + "What else?" (keep asking)
**3 Motivators:** Pain (strongest), Fear, Opportunity (weakest)
**ACAVE Objections:** Acknowledge → Clarify → Answer → Verify → End/Close
**Appointment Script:** "Hey [Name], going to be in your area next week. I've got [Day1] and [Day2]. Which works best?"`;

  const systemPrompt =
    chatMode === "rec"
      ? `You are Jericho, a fast-moving AI sales partner IN THE FIELD. Be direct, data-first, short (2-3 sentences max), action-oriented. No teaching moments. No "Great question!". Speak peer-to-peer.
${productValidationRules}
${knowledgeContext}
${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.purchaseHistorySummary ? `\n## CUSTOMER PURCHASE HISTORY:\n${context.purchaseHistorySummary}` : ""}
${context.backboardMemory || ""}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}${focusInstruction}`
      : `You are Jericho, a seasoned sales coach using the Thrive Today Consultative Selling methodology.
${methodologyReference}
${productValidationRules}
Your style: Conversational, warm, trusted mentor. Ask follow-up questions. Give specific actionable advice. Celebrate wins.${focusInstruction}
${knowledgeContext}
${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.purchaseHistorySummary ? `\n## CUSTOMER PURCHASE HISTORY:\n${context.purchaseHistorySummary}` : ""}
${context.backboardMemory || ""}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}`;

  try {
    const result = await callAI(
      { taskType: "sales-coaching-main", companyId, profileId: userId, functionName: "sales-coach" },
      [{ role: "user", content: `${conversationHistory ? `Previous conversation:\n${conversationHistory.slice(-8000)}\n\n` : ""}User says: ${message}` }],
      { systemPrompt, temperature: 0.7, maxTokens: 4096 }
    );
    return actionSummary + sanitizePricingIfNeeded(result.content);
  } catch (error) {
    console.error("Response generation failed:", error);
    return actionSummary + "I'm here to help! What would you like to work on?";
  }
}
