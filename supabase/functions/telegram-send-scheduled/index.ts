import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: number, text: string, botToken: string): Promise<boolean> {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  return resp.ok;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();

    // Fetch pending messages that are due
    const { data: pending, error } = await supabase
      .from('telegram_scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No pending messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const msg of pending) {
      const success = await sendTelegramMessage(msg.telegram_chat_id, msg.message_text, botToken);

      await supabase
        .from('telegram_scheduled_messages')
        .update({
          status: success ? 'sent' : 'failed',
          sent_at: success ? new Date().toISOString() : null,
        })
        .eq('id', msg.id);

      if (success) sent++;
      else failed++;
    }

    return new Response(JSON.stringify({ sent, failed, total: pending.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Telegram Scheduled] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
