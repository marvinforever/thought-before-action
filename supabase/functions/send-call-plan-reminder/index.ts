import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATELINE_COMPANY_ID = "d32f9a18-aba5-4836-aa66-1834b8cb8edd";

const CALL_STAGE_NAMES: Record<number, string> = {
  1: "Initial Planning / Prepay Review",
  2: "Pre-Plant Check-in",
  3: "Season Review",
  4: "Strategic Recommendations",
};

const CALL_STAGE_PROMPTS: Record<number, string> = {
  1: `You're coaching a sales rep for their INITIAL PLANNING / PREPAY REVIEW meeting. Focus on:
- Reviewing last year's purchases and what worked well
- Prepay discount opportunities and programs available
- New products they should consider based on their purchase history
- Questions to ask about this year's plans and goals
- Building on any existing relationship notes`,

  2: `You're coaching a sales rep for their PRE-PLANT CHECK-IN meeting. Focus on:
- Confirming planting timing and any changes to plans
- Final input decisions and product confirmations
- Weather considerations affecting their decisions
- Application scheduling needs
- Following up on anything mentioned in the prepay review`,

  3: `You're coaching a sales rep for their MID-SEASON REVIEW meeting. Focus on:
- Checking on crop health and conditions
- In-season product opportunities (fungicides, foliar)
- Problem-solving any issues they're experiencing
- Yield potential assessment
- Building relationship value through genuine care`,

  4: `You're coaching a sales rep for their STRATEGIC RECOMMENDATIONS meeting. Focus on:
- Post-harvest recap of the season's results
- Building next year's plan together
- Loyalty programs and prepay advantages
- Long-term relationship building
- Setting up the next year's 4-call cycle`,
};

interface ReminderInput {
  profile_id: string;
  call_tracking_id: string;
  call_number: number;
  reminder_type: "7_day" | "1_day";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") || "Jericho <jericho@momentum4growth.com>";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { profile_id, call_tracking_id, call_number, reminder_type }: ReminderInput = await req.json();

    console.log(`Processing reminder: profile=${profile_id}, tracking=${call_tracking_id}, call=${call_number}, type=${reminder_type}`);

    // Step 1: Fetch the call plan tracking record
    const { data: trackingRecord, error: trackingError } = await supabase
      .from("call_plan_tracking")
      .select("*")
      .eq("id", call_tracking_id)
      .single();

    if (trackingError || !trackingRecord) {
      throw new Error(`Failed to fetch tracking record: ${trackingError?.message}`);
    }

    const customerName = trackingRecord.customer_name;
    const meetingDate = trackingRecord[`call_${call_number}_date`];

    // Step 2: Fetch profile info (for email and name)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, company_id")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile?.email) {
      throw new Error(`Failed to fetch profile: ${profileError?.message}`);
    }

    // Step 3: Aggregate customer intelligence
    const customerContext = await aggregateCustomerData(supabase, profile_id, customerName, trackingRecord);

    // Step 4: Generate AI coaching content
    const emailContent = await generateCoachingEmail(
      lovableApiKey,
      profile.full_name || "there",
      customerName,
      call_number,
      reminder_type,
      meetingDate,
      customerContext
    );

    // Step 5: Send email via Resend
    const daysUntil = reminder_type === "7_day" ? 7 : 1;
    const formattedDate = formatDate(meetingDate);
    const subject = `[${daysUntil === 7 ? "7-Day" : "Tomorrow"}] ${CALL_STAGE_NAMES[call_number]} with ${customerName} - ${formattedDate}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [profile.email],
        subject,
        html: emailContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    // Step 6: Log the reminder to prevent duplicates
    const { error: insertError } = await supabase
      .from("call_plan_reminders")
      .insert({
        profile_id,
        call_plan_tracking_id: call_tracking_id,
        call_number,
        reminder_type,
        customer_name: customerName,
        meeting_date: meetingDate,
        subject,
        company_id: profile.company_id,
      });

    if (insertError) {
      console.error("Failed to log reminder:", insertError);
      // Don't throw - email was sent successfully
    }

    console.log(`✅ Reminder sent successfully to ${profile.email} for ${customerName}`);

    return new Response(
      JSON.stringify({ success: true, email: profile.email, customer: customerName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending call plan reminder:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aggregateCustomerData(
  supabase: any,
  profileId: string,
  customerName: string,
  trackingRecord: any
): Promise<any> {
  const normalizedName = customerName.toUpperCase().replace(/[,\s]+/g, " ").trim();
  const nameParts = normalizedName.split(" ");
  const context: any = {
    trackingData: {
      precall_plan: trackingRecord.precall_plan,
      acreage: trackingRecord.acreage,
      crops: trackingRecord.crops,
      total_revenue: trackingRecord.total_revenue,
      call_1_notes: trackingRecord.call_1_notes,
      call_1_date: trackingRecord.call_1_date,
      call_1_completed: trackingRecord.call_1_completed,
      call_2_notes: trackingRecord.call_2_notes,
      call_2_date: trackingRecord.call_2_date,
      call_2_completed: trackingRecord.call_2_completed,
      call_3_notes: trackingRecord.call_3_notes,
      call_3_date: trackingRecord.call_3_date,
      call_3_completed: trackingRecord.call_3_completed,
      call_4_notes: trackingRecord.call_4_notes,
      call_4_date: trackingRecord.call_4_date,
      call_4_completed: trackingRecord.call_4_completed,
    },
    purchaseHistory: [],
    salesCompany: null,
    recentActivities: [],
    contacts: [],
    documents: [],
    deals: [],
  };

  // Fetch purchase history (2024 & 2025)
  const { data: purchaseData } = await supabase
    .from("customer_purchase_history")
    .select("*")
    .eq("profile_id", profileId)
    .ilike("customer_name", `%${nameParts[0]}%`)
    .order("sale_date", { ascending: false })
    .limit(100);

  if (purchaseData) {
    context.purchaseHistory = purchaseData;
  }

  // Try to find matching sales_company
  const { data: companies } = await supabase
    .from("sales_companies")
    .select("*")
    .eq("profile_id", profileId)
    .ilike("name", `%${nameParts[0]}%`)
    .limit(5);

  if (companies && companies.length > 0) {
    // Find best match
    const exactMatch = companies.find(
      (c: any) => c.name.toUpperCase() === normalizedName
    );
    context.salesCompany = exactMatch || companies[0];

    const companyId = context.salesCompany.id;

    // Fetch contacts for this company
    const { data: contacts } = await supabase
      .from("sales_contacts")
      .select("*")
      .eq("company_id", companyId)
      .limit(10);
    context.contacts = contacts || [];

    // Fetch documents for this company
    const { data: documents } = await supabase
      .from("customer_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10);
    context.documents = documents || [];
  }

  // Fetch deals matching customer name
  const { data: deals } = await supabase
    .from("sales_deals")
    .select("*")
    .eq("profile_id", profileId)
    .ilike("name", `%${nameParts[0]}%`)
    .limit(10);

  if (deals && deals.length > 0) {
    context.deals = deals;

    // Fetch recent activities for these deals
    const dealIds = deals.map((d: any) => d.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabase
      .from("sales_activities")
      .select("*")
      .in("deal_id", dealIds)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    context.recentActivities = activities || [];
  }

  return context;
}

async function generateCoachingEmail(
  apiKey: string,
  repName: string,
  customerName: string,
  callNumber: number,
  reminderType: "7_day" | "1_day",
  meetingDate: string,
  context: any
): Promise<string> {
  const daysUntil = reminderType === "7_day" ? "7 days" : "tomorrow";
  const stageName = CALL_STAGE_NAMES[callNumber];
  const stagePrompt = CALL_STAGE_PROMPTS[callNumber];

  // Build context summary for AI
  const contextSummary = buildContextSummary(context, callNumber);

  const systemPrompt = `You are Jericho, an expert agricultural sales coach. You're sending a coaching email to help a sales rep prepare for an upcoming customer meeting.

${stagePrompt}

Your email should be:
- Warm and encouraging, not robotic
- Data-driven, using the actual customer information provided
- Actionable with specific things to do and say
- Stage-appropriate for this specific call in the 4-call plan

Generate an HTML email (body content only, no <html>, <head>, or <body> tags). Use these styles:
- Use <h2> for section headers with emoji icons
- Use <p> for paragraphs
- Use <ul> and <li> for bullet lists
- Use <strong> for emphasis
- Keep sections visually separated with <hr> tags
- Use a friendly, professional tone

End with an encouraging sign-off from Jericho.`;

  const userPrompt = `Generate a coaching email for ${repName.split(" ")[0] || "the rep"}.

**Meeting Details:**
- Customer: ${customerName}
- Call Stage: ${stageName} (Call ${callNumber} of 4)
- Meeting Date: ${formatDate(meetingDate)} (${daysUntil} away)

**Available Customer Data:**
${contextSummary}

Create a personalized coaching email that references this specific data and provides actionable guidance for this ${stageName} meeting.`;

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
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI generation failed: ${errorText}`);
  }

  const result = await response.json();
  const emailBody = result.choices?.[0]?.message?.content || "";

  // Wrap in a styled container
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    h2 { color: #166534; margin-top: 24px; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #166534; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  ${emailBody}
  <div class="footer">
    <p>This email was automatically generated by Jericho, your AI sales coach, as part of your 4-Call Plan tracking.</p>
  </div>
</body>
</html>`;
}

function buildContextSummary(context: any, callNumber: number): string {
  const sections: string[] = [];

  // Tracking data (prior notes)
  const tracking = context.trackingData;
  if (tracking) {
    const trackingSections: string[] = [];
    
    if (tracking.precall_plan) {
      trackingSections.push(`**Your Pre-Call Plan:** ${tracking.precall_plan}`);
    }
    if (tracking.acreage) {
      trackingSections.push(`**Operation Size:** ${tracking.acreage.toLocaleString()} acres`);
    }
    if (tracking.crops) {
      trackingSections.push(`**Crops:** ${tracking.crops}`);
    }
    if (tracking.total_revenue) {
      trackingSections.push(`**2025 Revenue:** $${tracking.total_revenue.toLocaleString()}`);
    }

    // Include notes from prior calls
    for (let i = 1; i < callNumber; i++) {
      const notes = tracking[`call_${i}_notes`];
      const date = tracking[`call_${i}_date`];
      if (notes) {
        trackingSections.push(`**Call ${i} Notes (${formatDate(date)}):** ${notes}`);
      }
    }

    if (trackingSections.length > 0) {
      sections.push("=== FROM YOUR 4-CALL TRACKER ===\n" + trackingSections.join("\n"));
    }
  }

  // Purchase history summary
  if (context.purchaseHistory && context.purchaseHistory.length > 0) {
    const purchases = context.purchaseHistory;
    const year2025 = purchases.filter((p: any) => p.sale_date?.startsWith("2025"));
    const year2024 = purchases.filter((p: any) => p.sale_date?.startsWith("2024"));
    
    const total2025 = year2025.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const total2024 = year2024.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    
    // Get unique products
    const products2025 = [...new Set(year2025.map((p: any) => p.product_name).filter(Boolean))];
    const products2024 = [...new Set(year2024.map((p: any) => p.product_name).filter(Boolean))];
    
    const purchaseSection: string[] = [];
    if (total2025 > 0) purchaseSection.push(`2025 Revenue: $${total2025.toLocaleString()}`);
    if (total2024 > 0) purchaseSection.push(`2024 Revenue: $${total2024.toLocaleString()}`);
    if (products2025.length > 0) purchaseSection.push(`2025 Products: ${products2025.slice(0, 10).join(", ")}`);
    if (products2024.length > 0) purchaseSection.push(`2024 Products (for comparison): ${products2024.slice(0, 10).join(", ")}`);
    
    if (purchaseSection.length > 0) {
      sections.push("=== PURCHASE HISTORY ===\n" + purchaseSection.join("\n"));
    }
  }

  // CRM company info
  if (context.salesCompany) {
    const company = context.salesCompany;
    const companySection: string[] = [];
    
    if (company.grower_history) companySection.push(`**Grower History:** ${company.grower_history}`);
    if (company.operation_details) companySection.push(`**Operation Details:** ${company.operation_details}`);
    if (company.notes) companySection.push(`**CRM Notes:** ${company.notes}`);
    if (company.customer_since) companySection.push(`**Customer Since:** ${company.customer_since}`);
    
    if (companySection.length > 0) {
      sections.push("=== CRM PROFILE ===\n" + companySection.join("\n"));
    }
  }

  // Recent activities
  if (context.recentActivities && context.recentActivities.length > 0) {
    const activities = context.recentActivities.slice(0, 5).map((a: any) => {
      const date = formatDate(a.created_at);
      return `- ${date}: ${a.activity_type} - ${a.notes || a.outcome || "No notes"}`;
    });
    sections.push("=== RECENT ACTIVITY (Last 30 Days) ===\n" + activities.join("\n"));
  }

  // Contacts
  if (context.contacts && context.contacts.length > 0) {
    const contacts = context.contacts.map((c: any) => {
      const parts = [c.name || "Unknown"];
      if (c.title) parts.push(`(${c.title})`);
      if (c.notes) parts.push(`- ${c.notes}`);
      return `- ${parts.join(" ")}`;
    });
    sections.push("=== KEY CONTACTS ===\n" + contacts.join("\n"));
  }

  // Documents
  if (context.documents && context.documents.length > 0) {
    const docs = context.documents.slice(0, 3).map((d: any) => {
      const date = formatDate(d.created_at);
      return `- ${d.title || d.file_name} (uploaded ${date})${d.summary ? `: ${d.summary.slice(0, 100)}...` : ""}`;
    });
    sections.push("=== RECENT DOCUMENTS ===\n" + docs.join("\n"));
  }

  // Active deals
  if (context.deals && context.deals.length > 0) {
    const deals = context.deals.filter((d: any) => d.stage !== "closed_won" && d.stage !== "closed_lost");
    if (deals.length > 0) {
      const dealsList = deals.map((d: any) => {
        return `- ${d.name}: ${d.stage} stage, $${(d.value || 0).toLocaleString()}${d.notes ? ` - ${d.notes}` : ""}`;
      });
      sections.push("=== ACTIVE DEALS ===\n" + dealsList.join("\n"));
    }
  }

  if (sections.length === 0) {
    return "No additional customer data available. Focus on building the relationship and gathering information during this call.";
  }

  return sections.join("\n\n");
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "TBD";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      weekday: "long",
      month: "long", 
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}
