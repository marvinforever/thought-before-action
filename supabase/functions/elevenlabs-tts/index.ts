import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ElevenLabs voice IDs - using dynamic, engaging voices
const VOICES = {
  // Primary voice
  jericho: '1fz2mW1imKTf5Ryjk5su', // Custom selected voice
  // More energetic, engaging voices
  callum: 'N2lVS1w4EtoT3dr4eOWO', // Callum - charismatic, warm, energetic male
  george: 'JBFqnCBsd6RMkjVDRZzb', // George - confident, authoritative British male  
  charlie: 'IKne3meq5aSn9XLyUdCD', // Charlie - friendly, approachable Australian male
  matilda: 'XrExE9yKIg1WjnnlVkGX', // Matilda - warm, expressive female
  jessica: 'cgSgspJ2msm6clMCkdW9', // Jessica - energetic, professional female
  // Legacy voices (kept for backward compatibility)
  eric: '3svOJAOhuPHXwQC2H5eq', // Custom Eric voice
  brian: 'nPczCjzI2devNBz1zQrb', // Brian - warm male voice
  sarah: 'EXAVITQu4vr4xnSDxMaL', // Sarah - professional female voice
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, profileId, episodeDate, voice = 'jericho', storeAudio = true } = await req.json();

    if (!script) {
      throw new Error('script is required');
    }

    console.log(`Generating TTS for profile: ${profileId}, voice: ${voice}`);
    console.log(`Script length: ${script.length} characters`);

    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenlabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Clean script for TTS - remove [pause] markers and convert to natural pauses
    const cleanedScript = script
      .replace(/\[pause\]/gi, '...')  // Convert pause markers to ellipsis (natural pause)
      .replace(/\n\n/g, '\n')         // Reduce double line breaks
      .trim();

    const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.eric;

    // Call ElevenLabs TTS API
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanedScript,
          model_id: 'eleven_turbo_v2_5', // Fast, high-quality model
          voice_settings: {
            stability: 0.5,        // Balance between consistent and expressive
            similarity_boost: 0.75, // High similarity to voice profile
            style: 0.3,            // Some expressiveness
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs TTS failed: ${ttsResponse.status} - ${errorText}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(`Audio generated, size: ${audioBuffer.byteLength} bytes`);

    // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
    const wordCount = cleanedScript.split(/\s+/).length;
    const estimatedDurationSeconds = Math.round((wordCount / 150) * 60);
    console.log(`Estimated duration: ${estimatedDurationSeconds} seconds for ${wordCount} words`);

    let audioUrl = null;

    if (storeAudio && profileId && episodeDate) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Generate unique filename
      const fileName = `${profileId}/${episodeDate}.mp3`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('podcasts')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true, // Replace if exists (regenerating)
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload audio: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase
        .storage
        .from('podcasts')
        .getPublicUrl(fileName);

      audioUrl = urlData.publicUrl;
      console.log(`Audio stored at: ${audioUrl}`);
    }

    // Return response
    if (storeAudio) {
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl,
          durationSeconds: estimatedDurationSeconds,
          wordCount,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Return audio directly as base64
      const base64Audio = base64Encode(audioBuffer);
      return new Response(
        JSON.stringify({
          success: true,
          audioContent: base64Audio,
          durationSeconds: estimatedDurationSeconds,
          wordCount,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in TTS generation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
