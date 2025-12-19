import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSMSRequest {
  profileId?: string;
  phoneNumber?: string;
  message: string;
  messageType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { profileId, phoneNumber, message, messageType = 'general' }: SendSMSRequest = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phone number from profile if not provided directly
    let targetPhone = phoneNumber;
    let targetProfileId = profileId;
    let companyId: string | null = null;

    if (!targetPhone && profileId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, company_id, sms_opted_in')
        .eq('id', profileId)
        .single();

      if (profileError || !profile) {
        console.error('Profile not found:', profileError);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile.sms_opted_in) {
        console.log('User has not opted in to SMS:', profileId);
        return new Response(
          JSON.stringify({ error: 'User has not opted in to SMS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetPhone = profile.phone;
      companyId = profile.company_id;
    }

    if (!targetPhone) {
      return new Response(
        JSON.stringify({ error: 'No phone number available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number format
    const normalizedPhone = targetPhone.startsWith('+') ? targetPhone : `+1${targetPhone.replace(/\D/g, '')}`;

    console.log(`Sending SMS to ${normalizedPhone}: ${message.substring(0, 50)}...`);

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      
      // Log failed attempt
      await supabase.from('sms_messages').insert({
        profile_id: targetProfileId,
        company_id: companyId,
        direction: 'outbound',
        phone_number: normalizedPhone,
        message: message,
        message_type: messageType,
        status: 'failed',
        error_message: twilioData.message || 'Twilio error',
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: twilioData.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful send
    const { data: smsLog, error: logError } = await supabase.from('sms_messages').insert({
      profile_id: targetProfileId,
      company_id: companyId,
      direction: 'outbound',
      phone_number: normalizedPhone,
      message: message,
      message_type: messageType,
      twilio_sid: twilioData.sid,
      status: 'sent',
    }).select().single();

    if (logError) {
      console.error('Failed to log SMS:', logError);
    }

    console.log(`SMS sent successfully. SID: ${twilioData.sid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        logId: smsLog?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sms:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
