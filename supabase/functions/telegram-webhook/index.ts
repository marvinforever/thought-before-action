import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-router.ts";

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
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error('[Telegram] sendMessage failed:', err);
  }
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

type MessageType = 'sales_coaching' | 'pre_call_prep' | 'pipeline_update' | 'product_question' |
  'growth_plan' | 'capabilities' | 'kudos' | 'sprint_check' | 'training' | 'general';

function classifyByRegex(text: string): { type: MessageType; confidence: number } | null {
  const lower = text.toLowerCase();

  if (/\b(kudos|shoutout|recognize|props)\b.*\b(to|for)\b/i.test(text))
    return { type: 'kudos', confidence: 0.9 };
  if (/\b(log|update|add)\b.*\b(call|meeting|visit|deal)\b/i.test(text))
    return { type: 'pipeline_update', confidence: 0.85 };
  if (/\b(prep|prepare|ready)\b.*\b(call|meeting|visit)\b/i.test(text))
    return { type: 'pre_call_prep', confidence: 0.85 };
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

Respond with ONLY valid JSON: {"type":"<type>","confidence":<number>}`,
        maxTokens: 100,
        temperature: 0.1,
      }
    );

    const parsed = JSON.parse(result.content.trim());
    return { type: parsed.type || 'general', confidence: parsed.confidence || 0.5 };
  } catch (e) {
    console.error('[Intent] AI classification failed:', e);
    return { type: 'general', confidence: 0.3 };
  }
}

// ============================================================================
// CONTEXT LOADING (mirrors chat-with-jericho patterns)
// ============================================================================

async function loadJerichoContext(supabase: any, userId: string) {
  const [profileRes, capsRes, goalsRes, targetsRes, achievementsRes, habitsRes] = await Promise.all([
    supabase.from('profiles').select('*, companies(name)').eq('id', userId).single(),
    supabase.from('employee_capabilities').select('*, capabilities(name, description, category)').eq('profile_id', userId),
    supabase.from('personal_goals').select('*').eq('profile_id', userId).single(),
    supabase.from('ninety_day_targets').select('*').eq('profile_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('achievements').select('*').eq('profile_id', userId).order('achieved_date', { ascending: false }).limit(5),
    supabase.from('leading_indicators').select('*').eq('profile_id', userId).eq('is_active', true),
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
      contextStr += `- ${t.target_text} (${t.category}, due: ${t.by_when || 'no date'})\n`;
    });
  }

  if (achievements.length > 0) {
    contextStr += `\nRecent Achievements:\n${achievements.map((a: any) => `- ${a.achievement_text}`).join('\n')}\n`;
  }

  if (habits.length > 0) {
    contextStr += `\nActive Habits:\n${habits.map((h: any) => `- ${h.habit_text} (${h.current_streak || 0} day streak)`).join('\n')}\n`;
  }

  return { context: contextStr, profile, companyId: profile?.company_id };
}

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

async function loadConversationMemory(supabase: any, chatId: number, limit = 10): Promise<string> {
  const { data } = await supabase
    .from('telegram_conversations')
    .select('message_text, response_text, created_at')
    .eq('telegram_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return '';

  return data
    .reverse()
    .map((m: any) => `User: ${m.message_text}\nJericho: ${m.response_text}`)
    .join('\n\n');
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
  // Look up valid, unused code
  const now = new Date().toISOString();
  const { data: linkCode } = await supabase
    .from('telegram_link_codes')
    .select('*')
    .eq('code', code.trim())
    .is('used_at', null)
    .gte('expires_at', now)
    .single();

  if (!linkCode) return false;

  // Link the account
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

  // Mark code as used
  await supabase
    .from('telegram_link_codes')
    .update({ used_at: now })
    .eq('id', linkCode.id);

  await sendTelegramMessage(chatId,
    "✅ *Account linked successfully!*\n\nYou're connected to Jericho. I can help you with:\n\n" +
    "📊 Sales coaching & call prep\n" +
    "🎯 Growth plan & 90-day targets\n" +
    "⭐ Send kudos to teammates\n" +
    "📈 Pipeline updates\n" +
    "📚 Training resources\n" +
    "💪 Capability assessments\n\n" +
    "Just ask me anything — I have your full context.",
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
    console.warn('[Telegram] Invalid secret token');
    return new Response('Unauthorized', { status: 401 });
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

    console.log(`[Telegram] Message from chat ${chatId}: ${text.substring(0, 100)}`);

    // Service role client for all DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user is linked
    const { data: link } = await supabase
      .from('telegram_links')
      .select('user_id, is_active')
      .eq('telegram_chat_id', chatId)
      .eq('is_active', true)
      .single();

    // ── UNLINKED USER FLOW ──
    if (!link) {
      // Check for /start deep link: /start CODE
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

      // Check if it's a raw 6-digit code
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

      // Welcome message for unlinked users
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

    // ── SEND "THINKING..." MESSAGE ──
    sendTelegramMessage(chatId, "🧠 Thinking...", botToken).catch(() => {});

    // ── LOAD CONTEXT IN PARALLEL ──
    const [conversationMemory, jerichoContext] = await Promise.all([
      loadConversationMemory(supabase, chatId),
      loadJerichoContext(supabase, userId),
    ]);

    // ── CLASSIFY INTENT ──
    let messageType: MessageType = 'general';
    const regexResult = classifyByRegex(text);
    if (regexResult && regexResult.confidence >= 0.7) {
      messageType = regexResult.type;
    } else {
      const aiResult = await classifyWithAI(text, conversationMemory);
      if (aiResult.confidence >= 0.6) {
        messageType = aiResult.type;
      }
      // If confidence < 0.6, falls through to 'general' which gets full AI routing
    }

    console.log(`[Telegram] Intent: ${messageType}`);

    // ── GENERATE RESPONSE ──
    let responseText: string;

    try {
      // Determine task type for AI router
      const isSalesRelated = ['sales_coaching', 'pre_call_prep', 'pipeline_update', 'product_question'].includes(messageType);
      const taskType = isSalesRelated ? 'sales-coaching' as const : 'chat' as const;

      const systemPrompt = `You are Jericho, an AI coach for ag retail professionals. You're responding via Telegram, so keep responses concise but helpful (2-4 short paragraphs max). Use emoji sparingly for readability.

${jerichoContext.context}

Recent conversation:
${conversationMemory || 'No previous messages.'}

The user's message was classified as: ${messageType}

Guidelines:
- Be direct and actionable — these are busy salespeople in the field
- Reference their specific data (targets, capabilities, accounts) when relevant
- For kudos requests, confirm the recognition with specific details
- For pipeline updates, confirm what was logged
- For sales coaching, reference their actual accounts and pipeline when possible
- Keep markdown simple (bold, italic only — no headers or tables, Telegram doesn't support them well)
- If you don't have enough context, ask a focused follow-up question`;

      const result = await callAI(
        {
          taskType,
          functionName: 'telegram-webhook',
          profileId: userId,
          companyId: jerichoContext.companyId,
        },
        [{ role: 'user', content: text }],
        {
          systemPrompt,
          maxTokens: 1024,
          temperature: 0.8,
        }
      );

      responseText = result.content;
    } catch (aiError) {
      console.error('[Telegram] AI error:', aiError);
      responseText = "Something went wrong on my end. Try again in a moment, or hop into the web app for now.";
    }

    // ── SEND RESPONSE ──
    await sendTelegramMessage(chatId, responseText, botToken);

    // ── LOG CONVERSATION ──
    await supabase.from('telegram_conversations').insert({
      user_id: userId,
      telegram_chat_id: chatId,
      message_text: text,
      response_text: responseText,
      message_type: messageType,
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[Telegram] Webhook error:', error);
    // Always return 200 to Telegram to prevent retries
    return new Response('OK', { status: 200 });
  }
});
