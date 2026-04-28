// ============================================================================
// Sales Email Intent — classifier + handlers for forward / query / note
//
// Hooked into process-email-reply BEFORE the existing growth/coaching intent
// classifier. If this returns a non-null SalesRoute, the main handler should
// short-circuit and use the sales response instead of the generic Jericho one.
//
// Sender identity = data ownership. Every read/write is scoped to the
// `profile_id` matched from the From: address.
// ============================================================================

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export type SalesIntent = "forward" | "query" | "note" | "none";

export interface SalesClassification {
  intent: SalesIntent;
  confidence: number;
  reason?: string;
}

export interface SalesRoute {
  matched: boolean;
  intent: SalesIntent;
  confidence: number;
  replyText: string;
  replyHtml?: string;
  actions: Array<{ type: string; success: boolean; message: string; entityId?: string; undoToken?: string }>;
  forwardLogId?: string;
}

// ---------------------------------------------------------------------------
// Heuristic pre-check — fast & free, catches obvious cases before LLM call.
// ---------------------------------------------------------------------------
const FORWARD_MARKERS = [
  /^[-_]{2,}\s*forwarded message\s*[-_]{2,}/im,
  /begin forwarded message:/i,
  /\bfwd:\s/i,
  /\bfw:\s/i,
  /^\s*from:\s.+\n\s*sent:\s/im,
  /^\s*from:\s.+\n\s*date:\s/im,
];

function looksLikeForward(body: string): boolean {
  return FORWARD_MARKERS.some((rx) => rx.test(body));
}

// ---------------------------------------------------------------------------
// Step 1: classify intent
// ---------------------------------------------------------------------------
export async function classifySalesIntent(
  emailBody: string,
  emailSubject: string
): Promise<SalesClassification> {
  // Fast path: clear forward markers
  if (looksLikeForward(emailBody)) {
    return { intent: "forward", confidence: 0.95, reason: "forward_markers_present" };
  }

  // Use Gemini Flash for cheap/fast classification
  const prompt = `Classify this inbound email to a sales coach AI named Jericho.

Subject: ${emailSubject || "(none)"}
Body:
"""
${emailBody.slice(0, 3000)}
"""

Decide one of:
- "forward" — the user is forwarding a customer/prospect email thread for Jericho to file under their pipeline.
- "query" — the user is ASKING Jericho a question about their sales pipeline, customers, deals, or revenue (e.g. "what's the status on Prairie Vista?", "show me my top accounts", "who haven't I talked to in 30 days?").
- "note" — the user is logging a NEW interaction or update about a specific grower/customer in narrative form (e.g. "had a call with Tom Henderson today, he's interested in 2027 seed", "met with Prairie Vista — they want a quote").
- "none" — none of the above (it's a coaching reflection, habit check-in, goal update, recognition, or general question — leave for the existing growth handler).

Respond with ONLY this JSON, no markdown:
{"intent":"forward|query|note|none","confidence":0.0-1.0,"reason":"brief"}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) return { intent: "none", confidence: 0 };
    const json = await res.json();
    const raw = (json.choices?.[0]?.message?.content || "").replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (!["forward", "query", "note", "none"].includes(parsed.intent)) {
      return { intent: "none", confidence: 0 };
    }
    return {
      intent: parsed.intent,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reason: parsed.reason,
    };
  } catch (err) {
    console.error("[sales-intent] classify failed:", err);
    return { intent: "none", confidence: 0 };
  }
}

// ---------------------------------------------------------------------------
// Step 2a: extract entities for FORWARD intent
// ---------------------------------------------------------------------------
export interface ExtractedEntities {
  growerName?: string;
  contactName?: string;
  contactTitle?: string;
  dealValue?: number;
  dealStage?: "prospecting" | "discovery" | "proposal" | "closing" | "won" | "lost";
  notes?: string;
  actionItems?: string[];
  questionInsteadOfData?: string; // if extraction reveals the "forward" was actually a question
}

export async function extractForwardEntities(emailBody: string, emailSubject: string): Promise<ExtractedEntities> {
  const prompt = `Extract structured sales information from this forwarded email.

Subject: ${emailSubject || ""}
Body:
"""
${emailBody.slice(0, 6000)}
"""

Return ONLY this JSON (no markdown, no commentary):
{
  "growerName": "<the customer/grower/farm name — the BUSINESS or INDIVIDUAL the email is about, never the rep's company>",
  "contactName": "<full name of the primary contact>",
  "contactTitle": "<title if mentioned>",
  "dealValue": <number in dollars, no currency symbol, only if explicitly mentioned>,
  "dealStage": "<prospecting|discovery|proposal|closing|won|lost — only if obvious from content>",
  "notes": "<2-3 sentence summary of the substance of the email thread>",
  "actionItems": ["<short imperative phrases, e.g. 'send quote by Friday'>"]
}

Rules:
- DO NOT INVENT product codes, hybrid numbers, or prices. If not in the email, omit.
- If growerName is unclear, set it to null.
- Use the GROWER (customer) name, never the salesperson's company.
- All fields are optional; omit any you can't extract confidently.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return {};
    const json = await res.json();
    const raw = (json.choices?.[0]?.message?.content || "").replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error("[sales-intent] extract failed:", err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Step 2b: handle FORWARD — file in pipeline, reuse sales-coach actions
// ---------------------------------------------------------------------------
export async function handleForward(
  supabase: any,
  profileId: string,
  companyId: string | null,
  senderName: string,
  emailBody: string,
  emailSubject: string
): Promise<{ replyText: string; actions: any[]; entities: ExtractedEntities }> {
  const entities = await extractForwardEntities(emailBody, emailSubject);
  const actions: any[] = [];

  if (!entities.growerName) {
    return {
      replyText:
        `Got your forward — but I couldn't pin down which grower this is about.\n\n` +
        `Reply with the grower name (e.g. "this is Prairie Vista") and I'll file it.\n\n` +
        `— Jericho`,
      actions: [],
      entities,
    };
  }

  // Reuse sales-coach action helpers (fuzzy-match company by name)
  const triggeredBy = `email forward: ${emailSubject || "(no subject)"}`.slice(0, 500);

  // 1) Company / grower
  const companyResult = await createCompanyInline(supabase, profileId, entities.growerName, triggeredBy);
  if (companyResult) actions.push(companyResult);
  const salesCompanyId = companyResult?.entityId;

  // 2) Contact (optional)
  if (entities.contactName && salesCompanyId) {
    const contactResult = await createContactInline(
      supabase,
      profileId,
      salesCompanyId,
      entities.contactName,
      entities.contactTitle,
      triggeredBy
    );
    if (contactResult) actions.push(contactResult);
  }

  // 3) Deal (only if value or stage signal — don't auto-create empty deals)
  if (salesCompanyId && (entities.dealValue || entities.dealStage)) {
    const dealResult = await createDealInline(
      supabase,
      profileId,
      salesCompanyId,
      entities.growerName,
      { value: entities.dealValue, stage: entities.dealStage, notes: entities.notes },
      triggeredBy
    );
    if (dealResult) actions.push(dealResult);
  }

  // 4) Always log the raw forward as an activity note attached to the company
  if (salesCompanyId) {
    try {
      await supabase.from("sales_activities").insert({
        profile_id: profileId,
        activity_type: "email",
        subject: emailSubject || `Forwarded email about ${entities.growerName}`,
        notes: `${entities.notes || ""}\n\n--- ORIGINAL EMAIL ---\n${emailBody}`.slice(0, 8000),
        completed_at: new Date().toISOString(),
      });
      actions.push({ type: "activity_logged", success: true, message: "Logged email as activity" });
    } catch (err) {
      console.error("[sales-intent] activity log failed:", err);
    }
  }

  // Build the reply
  const lines: string[] = [];
  lines.push(`Filed under **${entities.growerName}**.`);
  lines.push("");
  const filed: string[] = [];
  for (const a of actions) {
    if (a.success && a.message) filed.push(`• ${a.message}`);
  }
  if (filed.length) {
    lines.push("Here's what I did:");
    lines.push(...filed);
    lines.push("");
  }
  if (entities.actionItems?.length) {
    lines.push("Action items I picked up:");
    for (const item of entities.actionItems) lines.push(`• ${item}`);
    lines.push("");
  }
  lines.push("Reply UNDO to roll this back, or just keep going.");
  lines.push("");
  lines.push("— Jericho");

  return { replyText: lines.join("\n"), actions, entities };
}

// ---------------------------------------------------------------------------
// Inline action helpers (copies of sales-coach/actions.ts logic, scoped to
// this function so we don't cross-import between edge functions).
// ---------------------------------------------------------------------------

async function createCompanyInline(supabase: any, userId: string, name: string, triggeredBy: string) {
  const trimmedName = name.trim();
  const { data: existing } = await supabase
    .from("sales_companies")
    .select("id, name")
    .eq("profile_id", userId)
    .ilike("name", `%${trimmedName}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      type: "company_matched",
      entityId: existing[0].id,
      success: true,
      message: `Matched existing grower "${existing[0].name}"`,
    };
  }

  const { data: newCompany, error } = await supabase
    .from("sales_companies")
    .insert({ profile_id: userId, name: trimmedName })
    .select("id")
    .single();
  if (error || !newCompany) return null;

  await supabase.from("jericho_action_log").insert({
    profile_id: userId,
    action_type: "company_created",
    entity_type: "company",
    entity_id: newCompany.id,
    action_data: { name: trimmedName, source: "email_forward" },
    triggered_by: triggeredBy,
    can_undo: true,
  });

  return {
    type: "company_created",
    entityId: newCompany.id,
    success: true,
    message: `Added new grower "${trimmedName}"`,
  };
}

async function createContactInline(
  supabase: any,
  userId: string,
  salesCompanyId: string,
  name: string,
  title: string | undefined,
  triggeredBy: string
) {
  const trimmedName = name.trim();
  const { data: existing } = await supabase
    .from("sales_contacts")
    .select("id, name")
    .eq("profile_id", userId)
    .eq("company_id", salesCompanyId)
    .ilike("name", `%${trimmedName}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      type: "contact_matched",
      entityId: existing[0].id,
      success: true,
      message: `Matched existing contact "${existing[0].name}"`,
    };
  }

  const { data: newContact, error } = await supabase
    .from("sales_contacts")
    .insert({ profile_id: userId, company_id: salesCompanyId, name: trimmedName, title: title || null })
    .select("id")
    .single();
  if (error || !newContact) return null;

  await supabase.from("jericho_action_log").insert({
    profile_id: userId,
    action_type: "contact_created",
    entity_type: "contact",
    entity_id: newContact.id,
    action_data: { name: trimmedName, title, source: "email_forward" },
    triggered_by: triggeredBy,
    can_undo: true,
  });

  return {
    type: "contact_created",
    entityId: newContact.id,
    success: true,
    message: `Added contact "${trimmedName}"${title ? ` (${title})` : ""}`,
  };
}

async function createDealInline(
  supabase: any,
  userId: string,
  salesCompanyId: string,
  dealName: string,
  signals: { value?: number; stage?: string; notes?: string },
  triggeredBy: string
) {
  const { data: existing } = await supabase
    .from("sales_deals")
    .select("id, deal_name, stage")
    .eq("profile_id", userId)
    .eq("company_id", salesCompanyId)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      type: "deal_matched",
      entityId: existing[0].id,
      success: true,
      message: `Matched existing deal "${existing[0].deal_name}" (${existing[0].stage})`,
    };
  }

  const { data: newDeal, error } = await supabase
    .from("sales_deals")
    .insert({
      profile_id: userId,
      company_id: salesCompanyId,
      deal_name: dealName,
      stage: signals.stage || "prospecting",
      value: signals.value || 0,
      notes: signals.notes || null,
      priority: 3,
    })
    .select("id")
    .single();
  if (error || !newDeal) return null;

  await supabase.from("jericho_action_log").insert({
    profile_id: userId,
    action_type: "deal_created",
    entity_type: "deal",
    entity_id: newDeal.id,
    action_data: { dealName, ...signals, source: "email_forward" },
    triggered_by: triggeredBy,
    can_undo: true,
  });

  return {
    type: "deal_created",
    entityId: newDeal.id,
    success: true,
    message: `Created deal "${dealName}"${signals.stage ? ` (${signals.stage})` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Step 2c: handle QUERY — answer pipeline questions, scoped to sender
// ---------------------------------------------------------------------------
export async function handleQuery(
  supabase: any,
  profileId: string,
  question: string,
  senderName: string
): Promise<{ replyText: string; pipelineSnapshot: any }> {
  // Pull the sender's pipeline snapshot — strict profile_id isolation
  const [companiesRes, dealsRes, contactsRes, recentActsRes] = await Promise.all([
    supabase.from("sales_companies").select("id, name").eq("profile_id", profileId).limit(200),
    supabase
      .from("sales_deals")
      .select("id, deal_name, stage, value, last_activity_at, notes, company_id")
      .eq("profile_id", profileId)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("sales_contacts").select("id, name, title, company_id").eq("profile_id", profileId).limit(200),
    supabase
      .from("sales_activities")
      .select("activity_type, subject, notes, completed_at, deal_id, contact_id")
      .eq("profile_id", profileId)
      .order("completed_at", { ascending: false })
      .limit(30),
  ]);

  const snapshot = {
    companies: companiesRes.data || [],
    deals: dealsRes.data || [],
    contacts: contactsRes.data || [],
    recentActivities: recentActsRes.data || [],
  };

  const prompt = `You are Jericho, a direct, sharp sales coach. The user (${senderName}) emailed you this question about THEIR pipeline:

"${question}"

Here is THEIR pipeline data (this is the only data you may use — never invent grower names, deals, or numbers):
${JSON.stringify(snapshot).slice(0, 12000)}

Rules:
- Refer to accounts by GROWER NAME first.
- If the data doesn't contain the answer, say so plainly. Don't fabricate.
- Skip preambles. No "Great question!" — get to the answer.
- Keep it under 200 words. Use short paragraphs and bullets where helpful.
- End with a single coaching nudge or next-step question if it fits.
- Sign off "— Jericho".`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      return { replyText: "I hit a snag pulling your pipeline. Try again in a minute.\n\n— Jericho", pipelineSnapshot: snapshot };
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "I don't have an answer for that right now.\n\n— Jericho";
    return { replyText: text.trim(), pipelineSnapshot: snapshot };
  } catch (err) {
    console.error("[sales-intent] query failed:", err);
    return { replyText: "I hit a snag pulling your pipeline. Try again in a minute.\n\n— Jericho", pipelineSnapshot: snapshot };
  }
}

// ---------------------------------------------------------------------------
// Step 2d: handle NOTE — log activity against best-matched grower
// ---------------------------------------------------------------------------
export async function handleNote(
  supabase: any,
  profileId: string,
  emailBody: string,
  emailSubject: string
): Promise<{ replyText: string; actions: any[]; entities: ExtractedEntities }> {
  // Re-use the forward extractor — same shape, just lighter expectations
  const entities = await extractForwardEntities(emailBody, emailSubject);
  const actions: any[] = [];

  if (!entities.growerName) {
    return {
      replyText:
        `Got your note — which grower is this about?\n\n` +
        `Reply with the name and I'll log it.\n\n` +
        `— Jericho`,
      actions: [],
      entities,
    };
  }

  // Match (don't create) — notes shouldn't silently spawn new grower records
  const { data: matched } = await supabase
    .from("sales_companies")
    .select("id, name")
    .eq("profile_id", profileId)
    .ilike("name", `%${entities.growerName}%`)
    .limit(1);

  if (!matched || matched.length === 0) {
    return {
      replyText:
        `I don't have **${entities.growerName}** in your pipeline yet.\n\n` +
        `Reply ADD to create them and log this note, or send a forwarded email so I can pull more context.\n\n` +
        `— Jericho`,
      actions: [],
      entities,
    };
  }

  const grower = matched[0];

  // Log activity
  const noteText = `${entities.notes || emailBody}`.slice(0, 4000);
  await supabase.from("sales_activities").insert({
    profile_id: profileId,
    activity_type: "note",
    subject: emailSubject || `Note about ${grower.name}`,
    notes: noteText,
    completed_at: new Date().toISOString(),
  });
  actions.push({ type: "note_logged", success: true, message: `Logged note against ${grower.name}` });

  const lines: string[] = [];
  lines.push(`Logged against **${grower.name}**.`);
  if (entities.actionItems?.length) {
    lines.push("");
    lines.push("Action items I picked up:");
    for (const item of entities.actionItems) lines.push(`• ${item}`);
  }
  lines.push("");
  lines.push("— Jericho");

  return { replyText: lines.join("\n"), actions, entities };
}

// ---------------------------------------------------------------------------
// Top-level dispatcher used by process-email-reply
// ---------------------------------------------------------------------------
export async function routeSalesEmail(
  supabase: any,
  profile: { id: string; full_name: string | null; company_id: string | null; email: string },
  emailBody: string,
  emailSubject: string,
  emailReplyLogId: string
): Promise<SalesRoute | null> {
  const classification = await classifySalesIntent(emailBody, emailSubject);
  console.log("[sales-intent] classification:", classification);

  if (classification.intent === "none" || classification.confidence < 0.55) {
    return null;
  }

  const senderName = profile.full_name || profile.email.split("@")[0];
  let replyText = "";
  let actions: any[] = [];
  let entities: ExtractedEntities = {};

  if (classification.intent === "forward") {
    const result = await handleForward(supabase, profile.id, profile.company_id, senderName, emailBody, emailSubject);
    replyText = result.replyText;
    actions = result.actions;
    entities = result.entities;
  } else if (classification.intent === "query") {
    const result = await handleQuery(supabase, profile.id, emailBody, senderName);
    replyText = result.replyText;
  } else if (classification.intent === "note") {
    const result = await handleNote(supabase, profile.id, emailBody, emailSubject);
    replyText = result.replyText;
    actions = result.actions;
    entities = result.entities;
  }

  // Audit row
  let forwardLogId: string | undefined;
  try {
    const { data: log } = await supabase
      .from("sales_email_forwards")
      .insert({
        email_reply_log_id: emailReplyLogId,
        profile_id: profile.id,
        company_id: profile.company_id,
        sender_email: profile.email,
        email_subject: emailSubject,
        raw_body: emailBody.slice(0, 20000),
        classified_intent: classification.intent,
        intent_confidence: classification.confidence,
        extracted_entities: entities,
        actions_performed: actions,
        reply_sent: replyText,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    forwardLogId = log?.id;
  } catch (err) {
    console.error("[sales-intent] failed to log forward:", err);
  }

  return {
    matched: true,
    intent: classification.intent,
    confidence: classification.confidence,
    replyText,
    actions,
    forwardLogId,
  };
}