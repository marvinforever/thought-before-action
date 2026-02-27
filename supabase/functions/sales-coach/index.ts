import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";
import { JERICHO_PERSONALITY, SALES_INTELLIGENCE_FRAMEWORK, AGRICULTURE_INTELLIGENCE } from "../_shared/jericho-config.ts";
import {
  getOrCreateBackboardThread,
  createBackboardClient,
  loadBackboardMemory,
  formatBackboardMemoryForPrompt,
} from "../_shared/backboard-client.ts";
import { handleParetoAnalysis, handlePurchaseHistoryQuery, handleRepCustomerListQuery, handleMyCustomerListQuery } from "./analytics.ts";
import {
  ActionResult,
  createCompany,
  createContact,
  createDeal,
  handleUndo,
  handlePipelineActions,
} from "./actions.ts";
import { loadCustomerMemory, extractAndSaveInsights } from "./memory.ts";
import { queryCache, customerSummaryKey, withTimeout, QueryTimeoutError, TIMEOUT_USER_MESSAGE } from "./cache.ts";

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
  // Auto-deal detection
  conversationDealDetected?: boolean;
  detectedProduct?: string;
  detectedTopic?: string;
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
          .select("company_id, is_super_admin, industry")
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

    // Internal service call detection (e.g., from telegram-webhook)
    // If auth yielded no user but viewAsUserId is provided and token is the service role key,
    // trust the provided IDs directly. Only server-side code has the service role key.
    if (!userId && viewAsUserId) {
      const token = authHeader?.replace("Bearer ", "");
      if (token === supabaseServiceKey) {
        userId = viewAsUserId;
        const { data: imp } = await adminClient
          .from("profiles").select("company_id").eq("id", viewAsUserId).single();
        companyId = viewAsCompanyId || imp?.company_id || null;
        console.log(`[SalesCoach] Internal call for user ${userId}, company ${companyId}`);
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
      const fallbackResult = extractCompanyFallback(message);
      if (fallbackResult) {
        extracted = {
          ...extracted,
          companies: [{ name: fallbackResult.name, isNew: true, confidence: 0.7 }],
          intentType: "pipeline_action",
          conversationDealDetected: fallbackResult.isConversation,
        };
      }
    }

    // Step 2: Deterministic Intercepts (each wrapped in try/catch for timeout)

    // 2a. "My customers" — rep asking about their own territory/list
    try {
      const myListResult = await handleMyCustomerListQuery(message, adminClient, effectiveUserId, effectiveCompanyId);
      if (myListResult) {
        return new Response(
          JSON.stringify({ message: myListResult, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) {
        console.warn(`[Timeout] My customer list: ${err.message}`);
        return new Response(
          JSON.stringify({ message: TIMEOUT_USER_MESSAGE, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    try {
      const paretoResult = await handleParetoAnalysis(message, adminClient, effectiveUserId, effectiveCompanyId);
      if (paretoResult) {
        return new Response(
          JSON.stringify({ message: paretoResult, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) {
        console.warn(`[Timeout] Pareto analysis: ${err.message}`);
        return new Response(
          JSON.stringify({ message: TIMEOUT_USER_MESSAGE, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    try {
      const repCustomerListResult = await handleRepCustomerListQuery(message, adminClient, effectiveUserId, effectiveCompanyId);
      if (repCustomerListResult) {
        return new Response(
          JSON.stringify({ message: repCustomerListResult, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) {
        console.warn(`[Timeout] Rep customer list: ${err.message}`);
        return new Response(
          JSON.stringify({ message: TIMEOUT_USER_MESSAGE, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    try {
      const purchaseHistoryResult = await handlePurchaseHistoryQuery(message, adminClient, effectiveUserId, effectiveCompanyId);
      if (purchaseHistoryResult) {
        return new Response(
          JSON.stringify({ message: purchaseHistoryResult.response, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [], inferredCustomerId: purchaseHistoryResult.customerId, inferredCustomerName: purchaseHistoryResult.customerName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) {
        console.warn(`[Timeout] Purchase history: ${err.message}`);
        return new Response(
          JSON.stringify({ message: TIMEOUT_USER_MESSAGE, actions: [], dealCreated: false, companyCreated: null, contactsCreated: [], emailDrafted: null, researchCompleted: null, pipelineActions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // Steps 3 + 4: Backboard init, customer-match, and context gathering — all in parallel
    let backboardMemory = "";
    let backboardThreadId: string | null = null;
    let inferredCustomerId: string | null = activeCustomerId || null;
    let inferredCustomerName: string | null = null;

    // Resolve the customer company name hint from extracted entities (needed for backboard + context)
    const firstExtractedCompany = extracted.companies[0]?.name ?? null;

    // Fire backboard thread lookup + context gather simultaneously
    const [backboardResult, context] = await Promise.allSettled([
      // ── Backboard: customer match → thread → memory ──────────────────────
      (async () => {
        let customerId = activeCustomerId || null;
        let customerName: string | null = null;

        if (!activeCustomerId && firstExtractedCompany && effectiveUserId) {
          const { data: matchedCustomer } = await adminClient
            .from("sales_companies")
            .select("id, name")
            .eq("profile_id", effectiveUserId)
            .ilike("name", `%${firstExtractedCompany}%`)
            .maybeSingle();
          if (matchedCustomer) {
            customerId = matchedCustomer.id;
            customerName = matchedCustomer.name;
          }
        }

        let memory = "";
        let threadId: string | null = null;

        if (effectiveUserId) {
          const backboardThread = await getOrCreateBackboardThread(adminClient, effectiveUserId, "sales", customerId);
          if (backboardThread) {
            threadId = backboardThread.threadId;
            const msgs = await loadBackboardMemory(backboardThread.threadId, 50);
            memory = formatBackboardMemoryForPrompt(msgs);
          }
        }

        return { customerId, customerName, memory, threadId };
      })(),

      // ── Context: deals, companies, knowledge, intel, purchase history ────
      gatherContext(adminClient, effectiveUserId, effectiveCompanyId, extracted, userContext, message),
    ]);

    // Merge backboard results
    if (backboardResult.status === "fulfilled") {
      const bb = backboardResult.value;
      if (!inferredCustomerId && bb.customerId) {
        inferredCustomerId = bb.customerId;
        inferredCustomerName = bb.customerName;
      }
      backboardMemory = bb.memory;
      backboardThreadId = bb.threadId;
    } else {
      console.warn("Backboard init failed:", backboardResult.reason);
    }

    const resolvedContext = context.status === "fulfilled" ? context.value : { userContext, deals: [], existingCompanies: [], intelligence: null, purchaseHistory: null, salesKnowledge: [] };
    resolvedContext.backboardMemory = backboardMemory;


    // Step 5: Execute Actions
    const actions: ActionResult[] = [];
    let dealCreated = false;
    let companyCreated: { id: string; name: string } | null = null;
    let contactsCreated: { id: string; name: string }[] = [];
    let emailDrafted: { id: string; subject: string; preview: string } | null = null;
    let researchCompleted: { company: string; summary: string } | null = null;
    let newCustomerPrompt: { name: string } | null = null;

    if (extracted.companies.length > 0 && effectiveUserId && effectiveCompanyId) {
      const hasDealSignals = !!(extracted.dealSignals && Object.keys(extracted.dealSignals).length > 0);
      const forcePipelineCreate = /\b(add|put|log|start|create)\b[\s\S]{0,25}\b(deal|pipeline|opportunity)\b/i.test(message);
      const isConversationDetected = extracted.conversationDealDetected === true;

      for (const company of extracted.companies) {
        const shouldEnsurePipelineEntry = company.isNew || hasDealSignals || forcePipelineCreate || isConversationDetected;
        if (!shouldEnsurePipelineEntry) continue;

        const companyResult = await createCompany(adminClient, effectiveUserId, effectiveCompanyId, company.name, message);
        if (!companyResult.success || !companyResult.entityId) continue;

        // If the company was brand new AND the detection came from a conversation pattern,
        // surface a prompt asking the rep to complete the customer profile.
        if (companyResult.type === "company_created" && isConversationDetected) {
          newCustomerPrompt = { name: company.name };
        }

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

        const dealSignals = extracted.dealSignals || { stage: "prospecting" };
        const dealResult = await createDeal(adminClient, effectiveUserId, effectiveCompanyId, companyResult.entityId, company.name, dealSignals, message);
        if (dealResult.success) {
          actions.push(dealResult);
          if (dealResult.type === "deal_created") {
            dealCreated = true;

            // Fire-and-forget email confirmation to the rep when deal is auto-detected from a conversation
            if (isConversationDetected && effectiveUserId) {
              const dealStage = dealSignals.stage || "prospecting";
              sendDealDetectionEmail(
                adminClient,
                effectiveUserId,
                company.name,
                dealResult.entityId,
                dealStage,
                extracted.detectedProduct,
                extracted.detectedTopic
              ).catch((err) => console.error("Deal detection email failed:", err));
            }
          }
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
          resolvedContext.existingCompanies.some((c: any) => {
            const en = c.name.toLowerCase().trim();
            if (en.includes(requestedName) || requestedName.includes(en)) return true;
            const rp = requestedName.split(/\s+/);
            const ep = en.split(/\s+/);
            return rp[0] && ep[0] === rp[0];
          }) ||
          resolvedContext.deals.some((d: any) => {
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
      emailDrafted = await handleEmailDraft(adminClient, effectiveUserId, effectiveCompanyId, extracted.emailRequest, resolvedContext, lovableApiKey);
    }

    const pipelineActions = await handlePipelineActions(adminClient, effectiveUserId, message, resolvedContext.deals);

    // Step 6: Generate Response
    const responseMessage = await generateResponse(
      message, conversationHistory, resolvedContext, actions, extracted, chatMode, deal,
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
      JSON.stringify({ message: responseMessage, actions, dealCreated, companyCreated, contactsCreated, emailDrafted, researchCompleted, pipelineActions, inferredCustomerId, inferredCustomerName, newCustomerPrompt }),
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

// ============================================
// EMAIL NOTIFICATION FOR AUTO-DETECTED DEALS
// ============================================

async function sendDealDetectionEmail(
  client: any,
  userId: string,
  customerName: string,
  dealId: string,
  stage: string,
  detectedProduct?: string,
  detectedTopic?: string
): Promise<void> {
  try {
    const { data: profile } = await client
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (!profile?.email) return;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return;

    const repName = profile.full_name?.split(" ")[0] || "there";
    const now = new Date();
    const loggedAt = now.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const appBaseUrl = "https://thought-before-action.lovable.app";
    const dealLink = `${appBaseUrl}/sales`;

    const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);

    const detailRows = [
      `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Customer</td><td style="padding:8px 12px;font-weight:600;font-size:14px;">${customerName}</td></tr>`,
      `<tr style="background:#f9fafb;"><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Stage</td><td style="padding:8px 12px;font-size:14px;">${stageLabel}</td></tr>`,
      `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Logged at</td><td style="padding:8px 12px;font-size:14px;">${loggedAt}</td></tr>`,
      detectedProduct ? `<tr style="background:#f9fafb;"><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Product / Interest</td><td style="padding:8px 12px;font-size:14px;">${detectedProduct}</td></tr>` : "",
      detectedTopic ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Topic discussed</td><td style="padding:8px 12px;font-size:14px;">${detectedTopic}</td></tr>` : "",
    ].join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1a56db 100%);padding:32px 40px;">
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Jericho · Sales Agent</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">Pipeline Entry Created</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;font-size:16px;color:#111827;">Hey ${repName} 👋</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Jericho detected a customer interaction in your conversation and automatically logged a new deal in your pipeline.
            </p>

            <!-- Deal details table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                <td colspan="2" style="padding:10px 12px;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;">Deal Details</td>
              </tr>
              ${detailRows}
            </table>

            <!-- Suggestion -->
            <div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <p style="margin:0;font-size:14px;color:#1e3a5f;line-height:1.6;">
                <strong>💡 Next step:</strong> Add more details to this pipeline entry — estimated value, next meeting date, or key notes from your conversation — to keep your pipeline accurate.
              </p>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#1a56db;">
                  <a href="${dealLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                    View &amp; Edit in Sales Agent →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This entry was created automatically by Jericho when it detected a customer mention in your conversation. You can undo this action directly in the Sales Agent chat.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: profile.email,
        subject: `📋 New pipeline entry: ${customerName}`,
        html,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`Deal detection email send failed [${res.status}]:`, txt);
    } else {
      console.log(`Deal detection email sent to ${profile.email} for customer "${customerName}" (deal ${dealId})`);
    }
  } catch (err) {
    console.error("Failed to send deal detection email:", err);
  }
}

// ============================================
// INTENT DETECTION
// ============================================

async function detectIntentAndExtract(message: string, conversationHistory: string, apiKey: string): Promise<ExtractedEntities> {
  // ── Regex-based fast-path for conversation deal detection ──────────────────
  const conversationPatterns = [
    /(?:i\s+(?:talked|spoke|chatted)\s+(?:to|with)|had\s+a\s+(?:call|conversation|chat)\s+with|just\s+(?:got\s+off\s+the\s+phone|finished\s+a\s+call)\s+with)\s+([A-Z][a-zA-Z\s'&.-]{1,40}?)(?:\s+(?:today|yesterday|this\s+(?:morning|afternoon|week))|[.,!]|$)/i,
    /(?:met\s+with|visited|stopped\s+by|swung\s+by)\s+([A-Z][a-zA-Z\s'&.-]{1,40}?)(?:\s+(?:today|yesterday|this\s+(?:morning|afternoon|week))|[.,!]|$)/i,
    /([A-Z][a-zA-Z\s'&.-]{1,40}?)\s+(?:is\s+interested\s+in|wants\s+to|said\s+they|mentioned\s+(?:they\s+want|interest\s+in))\s/i,
    /(?:quick\s+call|good\s+call|great\s+call|solid\s+call)\s+with\s+([A-Z][a-zA-Z\s'&.-]{1,40?})(?:[.,!]|$)/i,
  ];

  let conversationDetectedName: string | null = null;
  let detectedProduct: string | null = null;
  let detectedTopic: string | null = null;

  for (const pattern of conversationPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/\s+/g, " ").replace(/[.,!?]$/, "");
      const isStopped = /^(him|her|them|it|this|that|my|the|a|an|me|us|our|their|his)$/i.test(candidate);
      if (candidate.length >= 2 && !isStopped) {
        conversationDetectedName = candidate;
        break;
      }
    }
  }

  // Detect product/interest from message if conversation pattern matched
  if (conversationDetectedName) {
    const productMatch = message.match(/(?:interested\s+in|looking\s+at|asking\s+about|wants)\s+([a-zA-Z\s]{3,40}?)(?:[.,!]|$)/i);
    const topicMatch = message.match(/(?:about|regarding|on)\s+([a-zA-Z\s]{3,40}?)(?:[.,!]|$)/i);
    if (productMatch?.[1]) detectedProduct = productMatch[1].trim();
    if (topicMatch?.[1]) detectedTopic = topicMatch[1].trim();
  }

  const systemPrompt = `You are an AI that extracts sales-relevant entities from the user's CURRENT message only.

CRITICAL RULES:
1. ONLY extract entities explicitly mentioned in the NEW MESSAGE
2. "Recent conversation" is CONTEXT ONLY - do NOT extract entities from it
3. NEVER extract these: "Jericho" (AI name), "Momentum" (user's company)

DEAL AUTO-DETECTION: Set "conversationDealDetected": true if the message describes a real interaction with a customer such as:
- "I talked to [Name]", "Had a call with [Name]", "Met with [Name]"
- "[Name] is interested in [product/service]"
- "Just got off the phone with [Name]"
- "Visited [Name] today/yesterday"
In these cases, set isNew=true for the company and include the customer as a company entity.

If conversationDealDetected is true, also extract:
- "detectedProduct": the product or service they're interested in (or null)
- "detectedTopic": the main topic discussed (or null)

RESEARCH IS EXPLICIT-ONLY - only set researchRequest if user says "research [company]", "look up [company] online", "find out about [company]".

Return JSON:
{
  "companies": [{"name": "...", "isNew": false, "confidence": 0.8}],
  "contacts": [{"name": "...", "title": "...", "companyName": "..."}],
  "dealSignals": {"value": null, "stage": "prospecting", "notes": "..."},
  "researchRequest": null,
  "emailRequest": null,
  "intentType": "coaching" | "data_lookup" | "create_entity" | "research" | "email" | "pipeline_action",
  "conversationDealDetected": false,
  "detectedProduct": null,
  "detectedTopic": null
}

Rules: isNew=true only if NEW MESSAGE implies just met or had a call. "show me", "what about", "tell me about" = isNew=false.`;

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

    if (!response.ok) {
      // If AI fails but regex detected a conversation, return that
      if (conversationDetectedName) {
        return {
          companies: [{ name: conversationDetectedName, isNew: true, confidence: 0.75 }],
          contacts: [],
          dealSignals: { stage: "prospecting" },
          intentType: "create_entity",
          conversationDealDetected: true,
          detectedProduct: detectedProduct || undefined,
          detectedTopic: detectedTopic || undefined,
        };
      }
      return getDefaultExtraction();
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Merge AI result with regex detection: regex wins if AI missed it
      const aiConversationDetected = parsed.conversationDealDetected === true;
      const finalConversationDetected = aiConversationDetected || (conversationDetectedName !== null && parsed.companies?.length === 0);

      let companies = parsed.companies || [];
      if (!aiConversationDetected && conversationDetectedName && companies.length === 0) {
        companies = [{ name: conversationDetectedName, isNew: true, confidence: 0.75 }];
      }

      return {
        companies,
        contacts: parsed.contacts || [],
        dealSignals: parsed.dealSignals || {},
        researchRequest: parsed.researchRequest || null,
        emailRequest: parsed.emailRequest || null,
        intentType: parsed.intentType || "coaching",
        conversationDealDetected: finalConversationDetected,
        detectedProduct: parsed.detectedProduct || detectedProduct || undefined,
        detectedTopic: parsed.detectedTopic || detectedTopic || undefined,
      };
    }
  } catch (err) {
    console.error("Entity extraction error:", err);
    // Regex fallback
    if (conversationDetectedName) {
      return {
        companies: [{ name: conversationDetectedName, isNew: true, confidence: 0.75 }],
        contacts: [],
        dealSignals: { stage: "prospecting" },
        intentType: "create_entity",
        conversationDealDetected: true,
        detectedProduct: detectedProduct || undefined,
        detectedTopic: detectedTopic || undefined,
      };
    }
  }

  return getDefaultExtraction();
}

function getDefaultExtraction(): ExtractedEntities {
  return { companies: [], contacts: [], dealSignals: {}, intentType: "coaching" };
}

function extractCompanyFallback(message: string): { name: string; isConversation: boolean } | null {
  const lowerMsg = message.toLowerCase();

  // Check for conversation patterns first (no pipeline keywords needed)
  const conversationFallbackPatterns = [
    { pattern: /\bjust\s+(met|talked|spoke|chatted)\s+(with|to)\s+([A-Z][a-zA-Z\s'&.-]{1,40}?)(?:\s+and|\s+about|[.,!]|\s*$)/i, group: 3 },
    { pattern: /\bmet\s+with\s+([A-Z][a-zA-Z\s'&.-]{1,40}?)\s+(?:today|yesterday|this\s+(?:morning|afternoon|week))/i, group: 1 },
    { pattern: /\bhad\s+a\s+(?:call|meeting|conversation|chat)\s+with\s+([A-Z][a-zA-Z\s'&.-]{1,40}?)(?:[.,!]|\s*$)/i, group: 1 },
  ];

  for (const { pattern, group } of conversationFallbackPatterns) {
    const match = message.match(pattern);
    const raw = match?.[group];
    if (raw) {
      const name = raw.trim().replace(/\s+/g, " ").replace(/[.,!?]$/, "");
      if (name.length >= 2 && !/^(him|her|them|it|this|that|my|the|a|an)$/i.test(name)) {
        return { name, isConversation: true };
      }
    }
  }

  // Standard pipeline-keyword patterns
  const hasPipelineContext = lowerMsg.includes("pipeline") || lowerMsg.includes("deal") || lowerMsg.includes("prospect") || lowerMsg.includes("track") || lowerMsg.includes("add") || lowerMsg.includes("opportunity");
  if (!hasPipelineContext) return null;

  const addPatterns = [
    /\badd\s+([A-Z][a-zA-Z\s']+?)\s+to\s+(my\s+)?pipeline/i,
    /\bput\s+([A-Z][a-zA-Z\s']+?)\s+in\s+(the\s+)?pipeline/i,
    /\bcreate\s+(a\s+)?deal\s+for\s+([A-Z][a-zA-Z\s']+)/i,
    /\blog\s+([A-Z][a-zA-Z\s']+?)\s+as\s+(a\s+)?prospect/i,
    /\bnew\s+(prospect|deal)[:\s]+([A-Z][a-zA-Z\s']+)/i,
    /\btrack\s+([A-Z][a-zA-Z\s']+?)(?:\s|$|\.)/i,
    /\badd\s+([A-Z][a-zA-Z\s']+?)(?:\s*$|\.|\s+to)/i,
  ];

  for (const pattern of addPatterns) {
    const match = message.match(pattern);
    if (match) {
      let name = match[1] || match[2] || match[3];
      if (name) {
        name = name.trim().replace(/\s+/g, " ").replace(/[.,!?]$/, "");
        if (name.length >= 2 && !/^(him|her|them|it|this|that|my|the|a|an)$/i.test(name)) {
          return { name, isConversation: false };
        }
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
  userContext: string,
  userMessage: string = ""
) {
  const context: any = { userContext, deals: [], existingCompanies: [], intelligence: null, purchaseHistory: null, salesKnowledge: [], industry: null };
  if (!userId) return context;

  // Fetch industry from profile for conditional intelligence injection
  const { data: userProfile } = await client.from("profiles").select("industry").eq("id", userId).maybeSingle();
  context.industry = userProfile?.industry || null;

  const [dealsResult, companiesResult, globalKnowledgeResult, companyKnowledgeResult] = await withTimeout(
    Promise.all([
      client.from("sales_deals").select(`id, deal_name, stage, value, expected_close_date, priority, notes, last_activity_at, sales_companies(id, name), sales_contacts(id, name, title)`).eq("profile_id", userId).order("priority").limit(50),
      client.from("sales_companies").select("id, name").eq("profile_id", userId).order("name").limit(500),
      client.from("sales_knowledge").select("title, content, category").is("company_id", null).eq("is_active", true).limit(30),
      companyId
        ? client.from("sales_knowledge").select("title, content, category").eq("company_id", companyId).eq("is_active", true).limit(50)
        : Promise.resolve({ data: [] }),
    ]),
    10_000,
    "gatherContext:base-queries"
  );

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

    const [intelResult, purchaseSummaryRaw] = await withTimeout(
      Promise.all([
        existingCompany
          ? client.from("sales_company_intelligence").select("*").eq("company_id", existingCompany.id).eq("profile_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        companyId
          ? queryCache.getOrFetch(
              customerSummaryKey(companyId, `%${lastName}%`),
              async () => {
                const { data, error } = await client.rpc("get_customer_purchase_summary_v2", {
                  p_company_id: companyId,
                  p_customer_name_pattern: `%${lastName}%`,
                });
                if (error) {
                  console.error("[gatherContext] purchase summary RPC error:", error);
                  return null;
                }
                console.log(`[gatherContext] purchase summary for %${lastName}%: ${data?.length ?? 0} rows, revenue=${data?.[0]?.total_revenue}`);
                return data;
              },
            )
          : Promise.resolve(null),
      ]),
      10_000,
      "gatherContext:intel-and-purchase-summary"
    );

    context.intelligence = intelResult.data;

    // purchaseSummaryRaw is the cached array directly (not wrapped in {data})
    const purchaseSummary = Array.isArray(purchaseSummaryRaw) ? purchaseSummaryRaw[0] : null;
    if (purchaseSummary && Number(purchaseSummary.total_revenue) > 0) {
      const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
      const totalRevenue = Number(purchaseSummary.total_revenue) || 0;
      const txnCount = Number(purchaseSummary.transaction_count) || 0;

      const yearSummary = purchaseSummary.yearly_totals
        ? Object.entries(purchaseSummary.yearly_totals as Record<string, number>)
            .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
            .slice(0, 5)
            .map(([yr, total]) => `  - ${yr}: ${fmt(Number(total))}`)
            .join("\n")
        : "  - No yearly data";

      const topProducts = purchaseSummary.top_products
        ? (purchaseSummary.top_products as Array<{ name: string; revenue: number }>)
            .slice(0, 10)
            .map((p) => `  - ${p.name}: ${fmt(Number(p.revenue))}`)
            .join("\n")
        : "  - No product data";

      context.purchaseHistorySummary = `PURCHASE HISTORY for ${searchName} (${txnCount} transactions):\nTotal: ${fmt(totalRevenue)}\nBy Year:\n${yearSummary}\nTop Products:\n${topProducts}`;
    } else {
    context.purchaseHistorySummary = null;
    }
  }
  
  // ALWAYS load the rep's top-level summary so the LLM can answer general data questions
  // even when no specific customer is mentioned
  if (companyId && userId && !context.repDataSummary) {
    try {
      const { data: userProfile } = await client
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      
      const repName = userProfile?.full_name?.toUpperCase() || null;
      if (repName) {
        const repFirstName = repName.split(" ")[0];
        const { data: repData } = await client.rpc("get_rep_customer_summary", {
          p_company_id: companyId,
          p_rep_first_name: repFirstName,
        });
        
        if (repData && repData.length > 0) {
          const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
          const totalRevenue = repData.reduce((sum: number, row: any) => sum + (Number(row.total_revenue) || 0), 0);
          const totalCustomers = repData.length;
          const actualRepName = repData[0].rep_name;
          
          // Build a concise summary with top 20 customers
          let summary = `REP DATA SUMMARY for ${actualRepName}: ${totalCustomers} customers, ${fmt(totalRevenue)} total all-time revenue.\n`;
          summary += `Top customers by all-time revenue:\n`;
          repData.slice(0, 20).forEach((row: any, idx: number) => {
            summary += `  ${idx + 1}. ${row.customer_name}: ${fmt(Number(row.total_revenue) || 0)} (${row.transaction_count} txns)\n`;
          });
          if (totalCustomers > 20) {
            summary += `  ...and ${totalCustomers - 20} more customers.\n`;
          }
          
          context.repDataSummary = summary;
          console.log(`[gatherContext] Loaded rep summary: ${actualRepName}, ${totalCustomers} customers, ${fmt(totalRevenue)} revenue`);
        }

        // ── Load ALL available years of data so LLM can answer any year question ──
        // First, find which seasons exist for this rep
        const { data: seasonRows } = await client
          .from("customer_purchase_history")
          .select("season")
          .eq("company_id", companyId)
          .ilike("rep_name", `${repFirstName}%`)
          .not("season", "is", null);

        if (seasonRows && seasonRows.length > 0) {
          const uniqueSeasons = [...new Set(seasonRows.map((r: any) => String(r.season)))].sort().reverse();
          console.log(`[gatherContext] Found seasons: ${uniqueSeasons.join(", ")}`);

          for (const season of uniqueSeasons) {
            const { data: yearRows } = await client
              .from("customer_purchase_history")
              .select("customer_name, amount")
              .eq("company_id", companyId)
              .ilike("rep_name", `${repFirstName}%`)
              .eq("season", season);

            if (yearRows && yearRows.length > 0) {
              const yearMap = new Map<string, number>();
              for (const row of yearRows) {
                yearMap.set(row.customer_name, (yearMap.get(row.customer_name) || 0) + (Number(row.amount) || 0));
              }
              const yearSorted = Array.from(yearMap.entries())
                .map(([name, revenue]) => ({ name, revenue }))
                .sort((a, b) => b.revenue - a.revenue);
              const yearTotal = yearSorted.reduce((s, c) => s + c.revenue, 0);

              let yearSummary = `\n${season} DATA: ${yearSorted.length} customers, ${fmt(yearTotal)} total revenue.\n`;
              yearSorted.slice(0, 20).forEach((c, idx) => {
                const pct = yearTotal > 0 ? ((c.revenue / yearTotal) * 100).toFixed(1) : "0";
                yearSummary += `  ${idx + 1}. ${c.name}: ${fmt(c.revenue)} (${pct}%)\n`;
              });
              if (yearSorted.length > 20) {
                yearSummary += `  ...and ${yearSorted.length - 20} more.\n`;
              }

              context.repDataSummary = (context.repDataSummary || "") + yearSummary;
              console.log(`[gatherContext] Loaded ${season} data: ${yearSorted.length} customers, ${fmt(yearTotal)} revenue`);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[gatherContext] Failed to load rep summary:", err);
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

  // methodologyReference removed — replaced by SALES_INTELLIGENCE_FRAMEWORK
  const repDataBlock = context.repDataSummary ? `\n## YOUR SALES DATA (from imported purchase history):\n${context.repDataSummary}\nIMPORTANT: You HAVE year-by-year revenue data above. You CAN break down revenue by year, compare years, show top customers per year, etc. NEVER say "I only have all-time data" or "I can't break it down by year" — the year data IS provided above. Use it. NEVER say "check your CRM" when this data is available.` : "";

  const formattingRules = `
## RESPONSE FORMATTING RULES (ALWAYS follow these):
- When listing customers/accounts, use numbered lists: "1. **Customer Name** — $Amount (X%)"
- Always format currency with $ and commas (e.g. $27,756 not 27756)
- When showing ranked data, include rank number, name in bold, dollar amount, and percentage of total
- Keep responses scannable: use bold for key numbers, short paragraphs, bullet points
- End data answers with a brief actionable follow-up question (e.g. "Want to dig into any of these?")
- If they ask for "top N" and you have fewer than N, show what you have and say so
- NEVER dump raw data — always organize and summarize it clearly
- Use line breaks between list items for readability`;


  // Industry-conditional intelligence
  const industryIntelligence = context.industry === 'agriculture' ? `\n${AGRICULTURE_INTELLIGENCE}` : '';

  const systemPrompt =
    chatMode === "rec"
      ? `${JERICHO_PERSONALITY}

REC MODE OVERRIDE: Be direct, data-first, 2-3 sentences max. No teaching moments. Peer-to-peer energy. Skip coaching frameworks — just answer fast.

${SALES_INTELLIGENCE_FRAMEWORK}${industryIntelligence}
${formattingRules}
${productValidationRules}
${knowledgeContext}
${repDataBlock}
${customerFocused ? `Customer context for ${mentionedCompany || mentionedContact}:` : "Current pipeline:"}
${pipelineContext}
${context.purchaseHistorySummary ? `\n## CUSTOMER PURCHASE HISTORY:\n${context.purchaseHistorySummary}` : ""}
${context.backboardMemory || ""}
${context.customerMemory ? `\n${context.customerMemory}` : ""}
${context.userContext ? `User context:\n${context.userContext}` : ""}${focusInstruction}`
      : `${JERICHO_PERSONALITY}

${SALES_INTELLIGENCE_FRAMEWORK}${industryIntelligence}
${formattingRules}
${productValidationRules}

AGENTIC BEHAVIOR: After surfacing data or insights, suggest 2-3 contextual actions using → format. These must be specific to what the data shows, not generic. Examples:
→ Draft a pre-call plan for their upcoming meeting
→ Pull last year's purchase comparison
→ Create a deal to track this opportunity
${focusInstruction}
${knowledgeContext}
${repDataBlock}
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
    console.log(`[Sales Coach] Response generated by model: ${result.modelUsed}`);
    return actionSummary + sanitizePricingIfNeeded(result.content);
  } catch (error) {
    console.error("Response generation failed:", error);
    return actionSummary + "I'm here to help! What would you like to work on?";
  }
}
