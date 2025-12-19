import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intent patterns for parsing user responses
const intentPatterns = [
  { pattern: /^(yes|y|yeah|yep|sure|ok|okay|yup|confirm)$/i, intent: 'confirm' },
  { pattern: /^(no|n|nope|nah|cancel|stop)$/i, intent: 'decline' },
  { pattern: /^(done|complete|completed|finished|did it)$/i, intent: 'task_complete' },
  { pattern: /^(skip|later|not now|busy)$/i, intent: 'skip' },
  { pattern: /^(help|h|\?)$/i, intent: 'help' },
  { pattern: /^(stop|unsubscribe|quit)$/i, intent: 'unsubscribe' },
  { pattern: /^\d+$/i, intent: 'numeric_response' },
  { pattern: /^(1|2|3|4|5|a|b|c|d|e)$/i, intent: 'multiple_choice' },
];

function parseIntent(message: string): { intent: string; confidence: number; rawValue?: string } {
  const trimmed = message.trim().toLowerCase();
  
  for (const { pattern, intent } of intentPatterns) {
    if (pattern.test(trimmed)) {
      return { 
        intent, 
        confidence: 0.95,
        rawValue: trimmed 
      };
    }
  }
  
  // Default to free_text for anything else
  return { 
    intent: 'free_text', 
    confidence: 0.5,
    rawValue: message.trim() 
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Twilio sends form-urlencoded data
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log(`Received SMS from ${from}: ${body}`);

    if (!from || !body) {
      console.error('Missing From or Body in webhook');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Normalize phone number for lookup
    const normalizedPhone = from.startsWith('+') ? from : `+${from}`;

    // Find profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, sms_opted_in')
      .eq('phone', normalizedPhone)
      .single();

    if (profileError) {
      console.log('No profile found for phone:', normalizedPhone);
    }

    // Parse the intent
    const parsedIntent = parseIntent(body);
    console.log('Parsed intent:', parsedIntent);

    // Handle unsubscribe immediately
    if (parsedIntent.intent === 'unsubscribe' && profile) {
      await supabase
        .from('profiles')
        .update({ sms_opted_in: false })
        .eq('id', profile.id);
      
      console.log('User unsubscribed from SMS:', profile.id);
    }

    // Log the inbound message
    const { data: smsLog, error: logError } = await supabase.from('sms_messages').insert({
      profile_id: profile?.id || null,
      company_id: profile?.company_id || null,
      direction: 'inbound',
      phone_number: normalizedPhone,
      message: body,
      message_type: 'user_response',
      twilio_sid: messageSid,
      status: 'received',
      parsed_intent: parsedIntent.intent,
      parsed_data: parsedIntent,
      processed_at: new Date().toISOString(),
    }).select().single();

    if (logError) {
      console.error('Failed to log inbound SMS:', logError);
    }

    // Generate response based on intent
    let responseMessage = '';
    
    switch (parsedIntent.intent) {
      case 'unsubscribe':
        responseMessage = "You've been unsubscribed from Jericho SMS updates. Reply START to re-subscribe anytime.";
        break;
      case 'help':
        responseMessage = "Jericho SMS commands:\n• Reply YES/NO to prompts\n• Reply DONE when you complete a task\n• Reply STOP to unsubscribe";
        break;
      case 'confirm':
      case 'decline':
      case 'task_complete':
      case 'skip':
        // These will be handled by the process-sms-response function
        responseMessage = "Got it! I've noted your response.";
        break;
      default:
        responseMessage = "Thanks for your message! I'll pass this along to help with your growth journey.";
    }

    // Send response via TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage}</Message>
</Response>`;

    console.log('Responding with TwiML:', responseMessage.substring(0, 50));

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in receive-sms:', error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});
