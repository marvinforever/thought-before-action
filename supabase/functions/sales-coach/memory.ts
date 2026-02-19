// ============================================
// CUSTOMER MEMORY & INSIGHT PERSISTENCE
// ============================================

export async function loadCustomerMemory(
  client: any,
  userId: string,
  companyId: string,
  customerName: string
): Promise<string> {
  let memory = "";

  try {
    const normalizedCustomer = customerName.trim();

    const { data: transcriptMentions } = await client
      .from("sales_coach_messages")
      .select(`content, role, created_at, sales_coach_conversations!inner(company_id, profile_id)`)
      .eq("sales_coach_conversations.profile_id", userId)
      .eq("sales_coach_conversations.company_id", companyId)
      .ilike("content", `%${normalizedCustomer}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (transcriptMentions && transcriptMentions.length > 0) {
      memory += `\n**VERBATIM CHAT MEMORY (mentions of ${normalizedCustomer}):**\n`;
      const ordered = [...transcriptMentions].reverse();
      memory += ordered
        .map((m: any) => {
          const speaker = m.role === "assistant" ? "Jericho" : "User";
          const text = (m.content || "").replace(/\s+/g, " ").trim();
          return `- ${speaker}: ${text.slice(0, 240)}${text.length > 240 ? "…" : ""}`;
        })
        .join("\n") + "\n";
    }

    const { data: backups } = await client
      .from("jericho_action_log")
      .select("action_data, entity_name, created_at")
      .eq("profile_id", userId)
      .eq("company_id", companyId)
      .eq("action_type", "conversation_backup")
      .ilike("entity_name", `%${normalizedCustomer}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (backups && backups.length > 0) {
      memory += `\n**CONVERSATION BACKUPS (most recent):**\n`;
      memory += backups
        .map((b: any) => {
          const um = b.action_data?.user_message ? String(b.action_data.user_message) : "";
          const am = b.action_data?.assistant_response ? String(b.action_data.assistant_response) : "";
          const combined = [um, am].filter(Boolean).join(" | ").replace(/\s+/g, " ").trim();
          return `- ${combined.slice(0, 280)}${combined.length > 280 ? "…" : ""}`;
        })
        .join("\n") + "\n";
    }

    // Fuzzy match sales company
    const namePatterns = customerName.trim().split(/\s+/);
    const firstName = namePatterns[0];

    let salesCompany = null;
    const { data: exactMatch } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .ilike("name", `%${customerName}%`)
      .maybeSingle();

    if (exactMatch) {
      salesCompany = exactMatch;
    } else if (firstName) {
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
      const { data: intel } = await client
        .from("sales_company_intelligence")
        .select("*")
        .eq("company_id", salesCompany.id)
        .maybeSingle();

      if (intel) {
        memory += `\n**CUSTOMER MEMORY for ${salesCompany.name}:**\n`;
        if (intel.relationship_notes) memory += `Previous conversations:\n${intel.relationship_notes.slice(-2000)}\n`;
        if (intel.personal_details) memory += `Personal details: ${JSON.stringify(intel.personal_details)}\n`;
        if (intel.preferences) memory += `Preferences: ${JSON.stringify(intel.preferences)}\n`;
        if (intel.buying_signals) memory += `Buying signals: ${JSON.stringify(intel.buying_signals)}\n`;
        if (intel.objections_history) memory += `Past objections: ${JSON.stringify(intel.objections_history)}\n`;
      }

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
        memory += `\nPurchase history: ${Object.entries(totalByYear)
          .map(([y, v]) => `${y}: $${(v as number).toLocaleString()}`)
          .join(", ")}\n`;
      }
    }

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

export async function extractAndSaveInsights(
  client: any,
  userId: string,
  companyId: string,
  userMessage: string,
  assistantResponse: string,
  mentionedCustomer?: string
) {
  const combinedText = `${userMessage} ${assistantResponse}`;

  let customerName = mentionedCustomer;
  if (!customerName) {
    const namePatterns = [
      /(?:talking (?:to|with|about)|met with|call with|meeting with|visited)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:Farm|Farms|Inc|LLC|Co|Company)?)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|told me|mentioned|wants|needs|is interested)/i,
      /(?:grower|farmer|customer|prospect)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:at|with|from)\s+([A-Z][a-z]+(?:\s+(?:Farm|Farms))?)/i,
    ];
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) { customerName = match[1].trim(); break; }
    }
  }

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

  const detectedInsights = patterns
    .filter((p) => p.regex.test(combinedText))
    .map((p) => ({ type: p.type, text: userMessage.slice(0, 500) }));

  for (const insight of detectedInsights) {
    try {
      await client.from("customer_insights").insert({
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

  if (customerName) {
    try {
      const { data: salesCompanies } = await client
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .or(`name.ilike.%${customerName}%,name.ilike.${customerName}%`);

      for (const salesCompany of salesCompanies || []) {
        const { data: existingIntel } = await client
          .from("sales_company_intelligence")
          .select("id, relationship_notes, personal_details, buying_signals, preferences")
          .eq("company_id", salesCompany.id)
          .eq("profile_id", userId)
          .maybeSingle();

        const dateStr = new Date().toLocaleDateString();
        const newNote = `[${dateStr}] ${userMessage.slice(0, 400)}`;
        let updatedNotes = existingIntel?.relationship_notes || "";
        if (!updatedNotes.includes(`[${dateStr}]`) || !updatedNotes.includes(userMessage.slice(0, 50))) {
          updatedNotes = updatedNotes ? `${updatedNotes}\n\n${newNote}` : newNote;
        }

        const buyingSignals = existingIntel?.buying_signals || [];
        const personalDetails = existingIntel?.personal_details || {};
        const preferences = existingIntel?.preferences || {};

        for (const insight of detectedInsights) {
          if (insight.type === "buying_signal" && Array.isArray(buyingSignals)) {
            const signalText = insight.text.slice(0, 150);
            if (!buyingSignals.some((s: any) => s?.text === signalText)) {
              buyingSignals.push({ text: signalText, date: dateStr });
            }
          }
          if (insight.type === "personal") personalDetails[dateStr] = insight.text.slice(0, 200);
          if (insight.type === "preference") preferences[dateStr] = insight.text.slice(0, 200);
        }

        await client.from("sales_company_intelligence").upsert({
          company_id: salesCompany.id,
          profile_id: userId,
          relationship_notes: updatedNotes.slice(-8000),
          buying_signals: Array.isArray(buyingSignals) ? buyingSignals.slice(-20) : [],
          personal_details: personalDetails,
          preferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,profile_id" });

        console.log(`Saved intelligence for ${salesCompany.name}`);
      }
    } catch (err) {
      console.error("Error updating customer intelligence:", err);
    }
  }

  try {
    await client.from("jericho_action_log").insert({
      profile_id: userId,
      company_id: companyId,
      action_type: "conversation_backup",
      entity_type: customerName ? "customer_mention" : "general_chat",
      entity_id: null,
      entity_name: customerName || "general",
      action_data: {
        user_message: userMessage.slice(0, 1000),
        assistant_response: assistantResponse.slice(0, 500),
        insights_detected: detectedInsights.map((i) => i.type),
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error saving conversation backup:", err);
  }
}
