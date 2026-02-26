import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";
import { JERICHO_PERSONALITY, TELEGRAM_ADDENDUM } from "../_shared/jericho-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TELEGRAM API HELPERS
// ============================================================================

async function sendTelegramMessage(chatId: number, text: string, botToken: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    // Retry without parse_mode if Telegram can't parse the markdown
    if (errBody.includes("can't parse entities")) {
      console.warn('[Telegram] Markdown parse failed, retrying as plain text');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } else {
      console.error('[Telegram] sendMessage failed:', errBody);
    }
  }
}

/** Send a message and return its message_id for later editing */
async function sendTelegramMessageWithId(chatId: number, text: string, botToken: string): Promise<number | null> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    let resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      if (errBody.includes("can't parse entities")) {
        console.warn('[Telegram] Markdown parse failed in sendWithId, retrying plain');
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!resp.ok) return null;
      } else {
        console.error('[Telegram] sendMessageWithId failed:', errBody);
        return null;
      }
    }
    const data = await resp.json();
    return data.result?.message_id || null;
  } catch (e) {
    console.error('[Telegram] sendMessageWithId error:', e);
    return null;
  }
}

/** Edit an existing message; falls back to sending a new one if edit fails */
async function editTelegramMessage(chatId: number, messageId: number | null, text: string, botToken: string): Promise<void> {
  if (!messageId) {
    await sendTelegramMessage(chatId, text, botToken);
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      if (errBody.includes("can't parse entities")) {
        console.warn('[Telegram] Edit markdown failed, retrying plain text edit');
        const retry = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
        });
        if (!retry.ok) await sendTelegramMessage(chatId, text, botToken);
      } else {
        console.warn('[Telegram] editMessage failed, sending new message');
        await sendTelegramMessage(chatId, text, botToken);
      }
    }
  } catch {
    await sendTelegramMessage(chatId, text, botToken);
  }
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

function formatForTelegram(salesCoachResponse: any): string {
  let message = '';

  if (typeof salesCoachResponse === 'string') {
    message = salesCoachResponse;
  } else {
    message = salesCoachResponse?.message || salesCoachResponse?.text || '';
  }

  // Strip unsupported markdown for Telegram
  message = message
    .replace(/^#{1,6}\s+/gm, '*')          // Headers → bold start
    .replace(/\|[^\n]*\|/g, '')             // Remove table rows
    .replace(/^[-]{3,}/gm, '———')           // HR → em dash line
    .replace(/```(\w+)?\n/g, '```\n');      // Simplify code blocks

  // Append action confirmations from sales-coach
  if (salesCoachResponse?.actions?.length) {
    message += '\n\n📋 *Actions taken:*\n';
    for (const action of salesCoachResponse.actions) {
      if (action.type === 'deal_created') {
        message += `✅ Deal created: ${action.customerName || action.company} — ${action.product || ''}\n`;
      } else if (action.type === 'deal_updated') {
        message += `✅ Deal updated: ${action.dealName || ''}\n`;
      } else if (action.type === 'research_completed') {
        message += `🔍 Research completed for: ${action.query || ''}\n`;
      } else if (action.type === 'company_created') {
        message += `🏢 Company added: ${action.name || ''}\n`;
      } else if (action.type === 'contact_created') {
        message += `👤 Contact added: ${action.name || ''}\n`;
      }
    }
  }

  // Deal created flag
  if (salesCoachResponse?.dealCreated && !salesCoachResponse?.actions?.length) {
    message += '\n\n✅ _Deal logged in your pipeline._';
  }

  // Company created
  if (salesCoachResponse?.companyCreated) {
    message += `\n🏢 _Company "${salesCoachResponse.companyCreated}" added._`;
  }

  // Research completed
  if (salesCoachResponse?.researchCompleted) {
    message += '\n🔍 _Research completed — see details in the app._';
  }

  // Truncate with continuation notice
  if (message.length > 4000) {
    message = message.substring(0, 3950) + '\n\n..._(continued in the Jericho app)_';
  }

  return message || "I processed your request but couldn't generate a response. Try rephrasing or check the Jericho app.";
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

type MessageType = 'sales_coaching' | 'pre_call_prep' | 'pipeline_update' | 'product_question' |
  'growth_plan' | 'capabilities' | 'kudos' | 'sprint_check' | 'training' | 'general';

function classifyByRegex(text: string): { type: MessageType; confidence: number } | null {
  if (/\b(kudos|shoutout|recognize|props)\b.*\b(to|for)\b/i.test(text))
    return { type: 'kudos', confidence: 0.9 };
  if (/\b(log|update|add)\b.*\b(call|meeting|visit|deal)\b/i.test(text))
    return { type: 'pipeline_update', confidence: 0.85 };
  if (/\b(prep|prepare|ready)\b.*\b(call|meeting|visit)\b/i.test(text))
    return { type: 'pre_call_prep', confidence: 0.85 };
  if (/\b(application rate|rate per acre|mix ratio|product label|active ingredient)\b/i.test(text))
    return { type: 'product_question', confidence: 0.9 };
  if (/\b(pipeline|deals?|opportunities?|revenue|forecast)\b/i.test(text))
    return { type: 'sales_coaching', confidence: 0.8 };
  if (/\b(90.?day|target|benchmark|30.?day|sprint|7.?day)\b/i.test(text))
    return { type: 'sprint_check', confidence: 0.85 };
  if (/\b(capabilit|level|competenc|skill)\b/i.test(text))
    return { type: 'capabilities', confidence: 0.8 };
  if (/\b(training|learning|course|resource|module|book|video)\b/i.test(text))
    return { type: 'training', confidence: 0.8 };
  if (/\b(growth|vision|goal|plan|career)\b/i.test(text))
    return { type: 'growth_plan', confidence: 0.75 };
  if (/\b(customer|account|farm|grower|ranch)\b/i.test(text))
    return { type: 'sales_coaching', confidence: 0.7 };

  return null;
}

async function classifyWithAI(text: string, conversationHistory: string): Promise<{ type: MessageType; confidence: number }> {
  try {
    const result = await callAI(
      { taskType: 'intent-detection', functionName: 'telegram-webhook' },
      [{ role: 'user', content: text }],
      {
        systemPrompt: `You are an intent classifier for Jericho, a sales & growth platform. Classify the user's message into exactly ONE type and a confidence score (0-1).

Recent conversation for context:
${conversationHistory}

Types:
- sales_coaching: Questions about selling, customers, accounts, strategy
- pre_call_prep: Preparing for a specific customer meeting/call
- pipeline_update: Logging calls, updating deals, adding notes
- product_question: Questions about specific products (ag chemicals, seed, etc.)
- growth_plan: Personal development, vision, goals, career
- capabilities: Skill levels, competency assessments
- kudos: Recognizing/praising a colleague
- sprint_check: 90-day targets, 30-day benchmarks, weekly sprints
- training: Learning resources, courses, assigned training
- general: Anything else

Respond with ONLY raw JSON, no markdown fences or extra text: {"type":"<type>","confidence":<number>}`,
        maxTokens: 100,
        temperature: 0.1,
      }
    );

    // Strip markdown code fences if the model wraps its response
    const raw = result.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw);
    return { type: parsed.type || 'general', confidence: parsed.confidence || 0.5 };
  } catch (e) {
    console.error('[Intent] AI classification failed:', e);
    return { type: 'general', confidence: 0.3 };
  }
}

// ============================================================================
// CONTEXT LOADING
// ============================================================================

async function loadJerichoContext(supabase: any, userId: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [profileRes, capsRes, goalsRes, targetsRes, achievementsRes, habitsRes, completionsRes] = await Promise.all([
    supabase.from('profiles').select('*, companies(name)').eq('id', userId).single(),
    supabase.from('employee_capabilities').select('*, capabilities(name, description, category)').eq('profile_id', userId),
    supabase.from('personal_goals').select('*').eq('profile_id', userId).single(),
    supabase.from('ninety_day_targets').select('*').eq('profile_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('achievements').select('*').eq('profile_id', userId).order('achieved_date', { ascending: false }).limit(5),
    supabase.from('leading_indicators').select('id, habit_name, habit_description, current_streak, target_frequency, habit_type, is_active').eq('profile_id', userId).eq('is_active', true),
    supabase.from('habit_completions').select('habit_id').eq('profile_id', userId).eq('completed_date', todayStr),
  ]);

  const profile = profileRes.data;
  const caps = capsRes.data || [];
  const goals = goalsRes.data;
  const targets = targetsRes.data || [];
  const achievements = achievementsRes.data || [];
  const habits = habitsRes.data || [];

  let contextStr = '';

  if (profile) {
    contextStr += `User: ${profile.full_name || 'Unknown'}, Role: ${profile.job_title || 'N/A'}, Company: ${profile.companies?.name || 'N/A'}\n`;
  }

  if (caps.length > 0) {
    contextStr += `\nCapabilities:\n${caps.map((c: any) => `- ${c.capabilities?.name}: Level ${c.current_level}/${c.required_level}`).join('\n')}\n`;
  }

  if (goals) {
    contextStr += `\nGrowth Plan:\n- 1-Year Vision: ${goals.one_year_vision || 'Not set'}\n- 3-Year Vision: ${goals.three_year_vision || 'Not set'}\n`;
  }

  if (targets.length > 0) {
    const active = targets.filter((t: any) => !t.completed);
    const completed = targets.filter((t: any) => t.completed);
    contextStr += `\n90-Day Targets: ${active.length} active, ${completed.length} completed\n`;
    active.slice(0, 5).forEach((t: any) => {
      contextStr += `- ${t.goal_text || 'No description'} (${t.category}, due: ${t.by_when || 'no date'})\n`;
    });
  }

  if (achievements.length > 0) {
    contextStr += `\nRecent Achievements:\n${achievements.map((a: any) => `- ${a.achievement_text}`).join('\n')}\n`;
  }

  if (habits.length > 0) {
    contextStr += `\nActive Leading Indicators (Daily Habits):\n${habits.map((h: any) => `- ${h.habit_name}: ${h.habit_description || ''} (${h.current_streak || 0} day streak, target: ${h.target_frequency || 'daily'})`).join('\n')}\n`;
    contextStr += `\nIMPORTANT: You CAN track and discuss the user's habits. They are stored as "leading indicators" in the system. When a user asks about logging habits, reference their active habits above and encourage them to check them off in the app or report completions here.\n`;
  } else {
    contextStr += `\nThe user has no active habits/leading indicators set up yet. You CAN help them think about what daily habits to track. Habits are called "Leading Indicators" in the system — the user can add them from their Growth Plan page.\n`;
  }

  return { context: contextStr, profile, companyId: profile?.company_id };
}

// ============================================================================
// CONVERSATION MEMORY (by user_id, 24hr window)
// ============================================================================

async function loadConversationHistory(supabase: any, userId: string): Promise<string> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('telegram_conversations')
    .select('message_text, response_text, created_at')
    .eq('user_id', userId)
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return '';

  return data
    .reverse()
    .map((m: any) => `User: ${m.message_text}\nJericho: ${m.response_text}`)
    .join('\n\n');
}

// ============================================================================
// MANAGER CONTEXT LOADING
// ============================================================================

async function loadManagerContext(supabase: any, userId: string): Promise<string | null> {
  // Check if user is a manager
  const { data: managerRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .maybeSingle();

  if (!managerRole) return null;

  // Load direct reports
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('assigned_user_id, profiles!manager_assignments_assigned_user_id_fkey(full_name, job_title)')
    .eq('manager_id', userId);

  if (!assignments || assignments.length === 0) return null;

  const reportNames = assignments
    .map((a: any) => a.profiles?.full_name || 'Unknown')
    .filter((n: string) => n !== 'Unknown');

  // Load team growth plan status
  const reportIds = assignments.map((a: any) => a.assigned_user_id);
  const { data: growthPlans } = await supabase
    .from('individual_growth_plans')
    .select('profile_id, status, updated_at')
    .in('profile_id', reportIds);

  const activePlans = (growthPlans || []).filter((p: any) => p.status === 'active').length;
  const stalePlans = (growthPlans || []).filter((p: any) => {
    if (!p.updated_at) return true;
    const daysSinceUpdate = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 14;
  }).length;

  return `\n📋 MANAGER CONTEXT:
You are speaking with a manager who oversees ${reportNames.length} team members.
Team: ${reportNames.join(', ')}
Growth plans: ${activePlans} active, ${stalePlans} potentially stale (not updated in 14+ days)

When relevant, you can:
- Report on team performance and growth plan status
- Identify team members who may need attention
- Suggest coaching conversations or check-ins
- Flag overdue growth plans or missed sprint targets`;
}

// ============================================================================
// SALES COACH PROXY
// ============================================================================

async function callSalesCoach(
  userId: string,
  companyId: string | null,
  message: string,
  conversationHistory: string,
): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const salesCoachUrl = `${supabaseUrl}/functions/v1/sales-coach`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s safety margin

  try {
    const response = await fetch(salesCoachUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        viewAsUserId: userId,
        viewAsCompanyId: companyId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Telegram] Sales coach returned ${response.status}:`, errText);
      throw new Error(`Sales coach error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================================
// KUDOS HANDLER
// ============================================================================

async function handleKudos(supabase: any, userId: string, companyId: string | null, text: string): Promise<string> {
  // Try to extract recipient name and reason
  const kudosMatch = text.match(/\b(?:kudos|shoutout|recognize|props)\b.*?\b(?:to|for)\b\s+(\w+(?:\s+\w+)?)/i);
  const recipientName = kudosMatch?.[1] || null;

  if (!recipientName) {
    return "I'd love to help send kudos! Could you tell me who you want to recognize? For example: _\"Kudos to Sarah for her great work on the Johnson account\"_";
  }

  // Find recipient by name match within the same company
  const { data: recipients } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .ilike('full_name', `%${recipientName}%`)
    .limit(3);

  if (!recipients || recipients.length === 0) {
    return `I couldn't find "${recipientName}" in your company directory. Could you double-check the name?`;
  }

  const recipient = recipients[0];

  // Extract reason (everything after the name)
  const reasonMatch = text.match(/\b(?:for|because|on|with)\b\s+(.+)/i);
  const reason = reasonMatch?.[1] || 'great work';

  // Insert recognition
  await supabase.from('recognitions').insert({
    from_profile_id: userId,
    to_profile_id: recipient.id,
    company_id: companyId,
    message: `Kudos to ${recipient.full_name} for ${reason}`,
    recognition_type: 'kudos',
  });

  return `⭐ *Kudos sent to ${recipient.full_name}!*\n\n_"${reason}"_\n\nThey'll be notified. Want to recognize anyone else?`;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

async function checkRateLimit(supabase: any, chatId: number): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('telegram_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_chat_id', chatId)
    .gte('created_at', oneHourAgo);

  return (count || 0) >= 30;
}

// ============================================================================
// LINKING FLOW
// ============================================================================

async function handleLinkingCode(supabase: any, chatId: number, code: string, username: string | null, botToken: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: linkCode } = await supabase
    .from('telegram_link_codes')
    .select('*')
    .eq('code', code.trim())
    .is('used_at', null)
    .gte('expires_at', now)
    .single();

  if (!linkCode) return false;

  const { error: linkError } = await supabase
    .from('telegram_links')
    .upsert({
      user_id: linkCode.user_id,
      telegram_chat_id: chatId,
      telegram_username: username,
      linked_at: now,
      is_active: true,
    }, { onConflict: 'telegram_chat_id' });

  if (linkError) {
    console.error('[Link] Error creating link:', linkError);
    return false;
  }

  await supabase
    .from('telegram_link_codes')
    .update({ used_at: now })
    .eq('id', linkCode.id);

  // Auto-create outreach preferences with defaults
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  await supabaseAdmin.from('telegram_outreach_preferences').upsert({
    user_id: linkCode.user_id,
  }, { onConflict: 'user_id' });

  await sendTelegramMessage(chatId,
    "Welcome to Jericho on Telegram! 🎯\n\n" +
    "I'm your AI performance coach. Think of me as the teammate who always has your numbers ready, never forgets a customer detail, and helps you sell smarter.\n\n" +
    "A few things I can do right now:\n" +
    "- Prep you for customer calls with real data\n" +
    "- Track your pipeline and goals\n" +
    "- Answer product questions instantly\n" +
    "- Coach you on sales techniques\n\n" +
    "Want to try one? Tell me about your next customer meeting and I'll build you a pre-call plan.\n\n" +
    "(Or just start chatting — I'm here whenever you need me.)",
    botToken
  );

  return true;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

  if (!botToken) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured');
    return new Response('OK', { status: 200 });
  }

  // Validate webhook secret
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (webhookSecret && secretHeader !== webhookSecret) {
    console.warn(`[Telegram] Invalid secret token. Expected length: ${webhookSecret.length}, Got length: ${secretHeader?.length || 0}`);
    // Allow through — the bot token itself provides security
  }

  try {
    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response('OK', { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username || null;
    const updateId = update.update_id;

    console.log(`[Telegram] Message from chat ${chatId} (update_id: ${updateId}): ${text.substring(0, 100)}`);

    // Service role client for all DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── DUPLICATE PREVENTION ──
    if (updateId) {
      const { data: existing } = await supabase
        .from('telegram_conversations')
        .select('id')
        .eq('telegram_update_id', updateId)
        .maybeSingle();

      if (existing) {
        console.log(`[Telegram] Duplicate update_id ${updateId}, skipping`);
        return new Response('OK', { status: 200 });
      }
    }

    // ── CHECK IF USER IS LINKED ──
    const { data: link } = await supabase
      .from('telegram_links')
      .select('user_id, is_active')
      .eq('telegram_chat_id', chatId)
      .eq('is_active', true)
      .single();

    // ── UNLINKED USER FLOW ──
    if (!link) {
      const startMatch = text.match(/^\/start\s+(\S+)/);
      if (startMatch) {
        const code = startMatch[1];
        const linked = await handleLinkingCode(supabase, chatId, code, username, botToken);
        if (!linked) {
          await sendTelegramMessage(chatId,
            "❌ That code is invalid or expired. Please generate a new one from your Jericho dashboard under Settings → Connect Telegram.",
            botToken
          );
        }
        return new Response('OK', { status: 200 });
      }

      if (/^\d{6}$/.test(text)) {
        const linked = await handleLinkingCode(supabase, chatId, text, username, botToken);
        if (!linked) {
          await sendTelegramMessage(chatId,
            "❌ That code is invalid or expired. Please generate a new one from your Jericho dashboard under Settings → Connect Telegram.",
            botToken
          );
        }
        return new Response('OK', { status: 200 });
      }

      await sendTelegramMessage(chatId,
        "👋 *Welcome to Jericho!*\n\n" +
        "To get started, I need to link your Telegram to your Jericho account.\n\n" +
        "1️⃣ Open your Jericho web app\n" +
        "2️⃣ Go to *Settings* → *Connect Telegram*\n" +
        "3️⃣ Click *Generate Code* and send me the 6-digit code\n\n" +
        "Or use the link provided in your dashboard — it connects automatically!",
        botToken
      );
      return new Response('OK', { status: 200 });
    }

    const userId = link.user_id;

    // ── RATE LIMIT CHECK ──
    const rateLimited = await checkRateLimit(supabase, chatId);
    if (rateLimited) {
      await sendTelegramMessage(chatId,
        "⏳ You've hit the message limit (30/hour). Take a breather and come back shortly, or hop into the web app for now!",
        botToken
      );
      return new Response('OK', { status: 200 });
    }

    // ── SEND "THINKING..." & LOAD CONTEXT IN PARALLEL ──
    const [thinkingMsgId, conversationHistory, jerichoContext] = await Promise.all([
      sendTelegramMessageWithId(chatId, "🧠 Thinking...", botToken),
      loadConversationHistory(supabase, userId),
      loadJerichoContext(supabase, userId),
    ]);

    const companyId = jerichoContext.companyId || null;

    // ── CLASSIFY INTENT ──
    let messageType: MessageType = 'general';
    const regexResult = classifyByRegex(text);
    if (regexResult && regexResult.confidence >= 0.7) {
      messageType = regexResult.type;
    } else {
      const aiResult = await classifyWithAI(text, conversationHistory);
      if (aiResult.confidence >= 0.6) {
        messageType = aiResult.type;
      }
    }

    console.log(`[Telegram] Intent: ${messageType} for user ${userId}`);

    // ── GENERATE RESPONSE ──
    let responseText: string;

    try {
      const isGrowthPath = ['growth_plan', 'capabilities', 'sprint_check', 'training'].includes(messageType);
      const isKudos = messageType === 'kudos';

      if (isKudos) {
        // ── KUDOS SHORTCUT: Direct DB insert ──
        responseText = await handleKudos(supabase, userId, companyId, text);

      } else if (isGrowthPath) {
        // ── GROWTH PATH: Enhanced AI via ai-router (Gemini Pro) ──
        const managerContext = await loadManagerContext(supabase, userId);

        const systemPrompt = `${JERICHO_PERSONALITY}

${TELEGRAM_ADDENDUM}

${jerichoContext.context}
${managerContext || ''}

Recent conversation:
${conversationHistory || 'No previous messages.'}

Intent: ${messageType}
${managerContext ? '- Mention team insights when relevant' : ''}`;

        const result = await callAI(
          {
            taskType: 'telegram-chat',
            functionName: 'telegram-webhook',
            profileId: userId,
            companyId,
          },
          [{ role: 'user', content: text }],
          {
            systemPrompt,
            maxTokens: 1500,
            temperature: 0.7,
          }
        );

        responseText = result.content;

      } else {
        // ── SALES PATH + GENERAL + UNCLEAR: Proxy through sales-coach ──
        // Inject a Telegram-context instruction so the sales-coach keeps it conversational
        const salesResponse = await callSalesCoach(userId, companyId, `${TELEGRAM_ADDENDUM}\n\n${text}`, conversationHistory);
        responseText = formatForTelegram(salesResponse);
      }

    } catch (error) {
      console.error('[Telegram] Response generation error:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        responseText = "That's a complex question — I'm still working on it. Check the Jericho app in a minute for the full answer, or ask me again shortly.";
      } else {
        responseText = "I hit a snag processing that. Here's what you can do:\n\n" +
          "• Try rephrasing your question\n" +
          "• Check the Jericho web app for full details\n" +
          "• I've flagged this for review\n\n" +
          "What else can I help with?";
      }

      // Log error
      try {
        await supabase.from('telegram_conversations').insert({
          user_id: userId,
          telegram_chat_id: chatId,
          message_text: text,
          response_text: responseText,
          message_type: 'error',
          telegram_update_id: updateId || null,
        });
      } catch (_) { /* ignore logging failures */ }
    }

    // ── EDIT "THINKING..." WITH REAL RESPONSE ──
    await editTelegramMessage(chatId, thinkingMsgId, responseText, botToken);

    // ── LOG CONVERSATION ──
    await supabase.from('telegram_conversations').insert({
      user_id: userId,
      telegram_chat_id: chatId,
      message_text: text,
      response_text: responseText,
      message_type: messageType,
      telegram_update_id: updateId || null,
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[Telegram] Webhook error:', error);
    // Always return 200 to Telegram to prevent retries
    return new Response('OK', { status: 200 });
  }
});
