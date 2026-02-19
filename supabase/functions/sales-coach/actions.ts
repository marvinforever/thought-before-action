// ============================================
// PIPELINE CRUD ACTIONS
// ============================================

export interface ActionResult {
  type: string;
  entityId: string;
  undoToken: string;
  success: boolean;
  details: any;
  message?: string;
}

export async function createCompany(
  client: any,
  userId: string,
  companyId: string,
  name: string,
  triggeredBy: string
): Promise<ActionResult> {
  try {
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

    const { data: newCompany, error } = await client
      .from("sales_companies")
      .insert({ profile_id: userId, name: name.trim() })
      .select("id")
      .single();

    if (error) throw error;

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
    return { type: "company_created", entityId: "", undoToken: "", success: false, details: { error: String(err) } };
  }
}

export async function createContact(
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
      .insert({ company_id: salesCompanyId, profile_id: userId, name: name.trim(), title: title || null })
      .select("id")
      .single();

    if (error) throw error;

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
    return { type: "contact_created", entityId: "", undoToken: "", success: false, details: { error: String(err) } };
  }
}

export async function createDeal(
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

    const { data: existingDeals } = await client
      .from("sales_deals")
      .select("id, deal_name, stage")
      .eq("profile_id", userId)
      .eq("company_id", salesCompanyId);

    if (existingDeals && existingDeals.length > 0) {
      const existingDeal = existingDeals[0];
      return {
        type: "deal_exists",
        entityId: existingDeal.id,
        undoToken: "",
        success: true,
        details: { dealName: existingDeal.deal_name, stage: existingDeal.stage, wasExisting: true },
        message: `Found existing deal "${existingDeal.deal_name}" (${existingDeal.stage})`,
      };
    }

    const normalizedName = dealName.toLowerCase().trim();
    const { data: fuzzyMatches } = await client
      .from("sales_deals")
      .select("id, deal_name, stage")
      .eq("profile_id", userId)
      .ilike("deal_name", `%${normalizedName}%`);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      const match = fuzzyMatches[0];
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
      .insert({ profile_id: userId, company_id: salesCompanyId, deal_name: dealName, stage, value, notes: signals.notes || null, priority: 3 })
      .select("id")
      .single();

    if (error) throw error;

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
    return { type: "deal_created", entityId: "", undoToken: "", success: false, details: { error: String(err) } };
  }
}

export async function handleUndo(client: any, undoToken: string, userId: string | null) {
  try {
    const { data: action, error } = await client
      .from("jericho_action_log")
      .select("*")
      .eq("id", undoToken)
      .single();

    if (error || !action) return { success: false, message: "Undo action not found" };
    if (!action.can_undo) return { success: false, message: "This action can no longer be undone" };

    let undoSuccess = false;
    let undoMessage = "";

    switch (action.entity_type) {
      case "company": {
        const { error: e } = await client.from("sales_companies").delete().eq("id", action.entity_id);
        undoSuccess = !e;
        undoMessage = undoSuccess ? "Company removed" : "Failed to remove company";
        break;
      }
      case "contact": {
        const { error: e } = await client.from("sales_contacts").delete().eq("id", action.entity_id);
        undoSuccess = !e;
        undoMessage = undoSuccess ? "Contact removed" : "Failed to remove contact";
        break;
      }
      case "deal": {
        const { error: e } = await client.from("sales_deals").delete().eq("id", action.entity_id);
        undoSuccess = !e;
        undoMessage = undoSuccess ? "Deal removed" : "Failed to remove deal";
        break;
      }
      default:
        undoMessage = "Unknown action type";
    }

    if (undoSuccess) {
      await client.from("jericho_action_log").update({ can_undo: false, undone_at: new Date().toISOString() }).eq("id", undoToken);
    }

    return { success: undoSuccess, message: undoMessage };
  } catch (err) {
    console.error("Undo error:", err);
    return { success: false, message: "Failed to undo action" };
  }
}

export async function handlePipelineActions(
  client: any,
  userId: string | null,
  message: string,
  deals: any[]
) {
  if (!userId) return [];

  const actions: any[] = [];
  const lowerMessage = message.toLowerCase();

  const moveMatch = lowerMessage.match(/move\s+["']?(.+?)["']?\s+to\s+(prospecting|discovery|proposal|closing|won|lost)/i);
  const updateMatch = lowerMessage.match(/update\s+["']?(.+?)["']?\s+(?:value|amount)\s+to\s+\$?(\d+)/i);
  const deleteMatch = lowerMessage.match(/(?:delete|remove)\s+["']?(.+?)["']?\s+(?:deal|from pipeline)/i);

  if (moveMatch) {
    const deal = deals.find((d) => d.deal_name.toLowerCase().includes(moveMatch[1].toLowerCase()));
    if (deal) {
      const { error } = await client.from("sales_deals").update({ stage: moveMatch[2].toLowerCase() }).eq("id", deal.id);
      actions.push({ action: "move_deal", success: !error, message: error ? "Failed to move deal" : `Moved "${deal.deal_name}" to ${moveMatch[2]}` });
    }
  }

  if (updateMatch) {
    const deal = deals.find((d) => d.deal_name.toLowerCase().includes(updateMatch[1].toLowerCase()));
    if (deal) {
      const { error } = await client.from("sales_deals").update({ value: parseInt(updateMatch[2]) }).eq("id", deal.id);
      actions.push({ action: "update_deal", success: !error, message: error ? "Failed to update deal" : `Updated "${deal.deal_name}" value to $${parseInt(updateMatch[2]).toLocaleString()}` });
    }
  }

  if (deleteMatch) {
    const deal = deals.find((d) => d.deal_name.toLowerCase().includes(deleteMatch[1].toLowerCase()));
    if (deal) {
      const { error } = await client.from("sales_deals").delete().eq("id", deal.id);
      actions.push({ action: "delete_deal", success: !error, message: error ? "Failed to delete deal" : `Removed "${deal.deal_name}" from pipeline` });
    }
  }

  return actions;
}
