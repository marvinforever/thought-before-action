import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const elevenLabsAgentId = Deno.env.get('ELEVENLABS_AGENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!elevenLabsApiKey || !elevenLabsAgentId) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get signed URL for ElevenLabs conversation
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${elevenLabsAgentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      console.error('ElevenLabs error:', signedUrlResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize voice agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { signed_url } = await signedUrlResponse.json();

    // Create or get conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        profile_id: user.id,
        company_id: profile.company_id,
        title: 'Voice conversation with Jericho',
        source: 'voice',
      })
      .select()
      .single();

    if (convError) throw convError;

    // Create voice session record
    await supabase
      .from('voice_sessions')
      .insert({
        profile_id: user.id,
        conversation_id: conversation.id,
        started_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({
        signedUrl: signed_url,
        conversationId: conversation.id,
        userName: profile.full_name || 'there',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in elevenlabs-voice-agent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
