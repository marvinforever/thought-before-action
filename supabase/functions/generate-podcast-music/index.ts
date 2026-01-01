import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type MusicType = 'intro' | 'outro';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, profileId } = await req.json() as { type: MusicType; profileId?: string };

    if (!type || !['intro', 'outro'].includes(type)) {
      throw new Error('type must be "intro" or "outro"');
    }

    console.log(`Generating ${type} music for profile: ${profileId}`);

    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenlabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we already have this music cached
    const fileName = `music/${type}.mp3`;
    const { data: existingFile } = await supabase.storage
      .from('podcasts')
      .list('music', { search: `${type}.mp3` });

    if (existingFile && existingFile.length > 0) {
      const { data: urlData } = supabase.storage
        .from('podcasts')
        .getPublicUrl(fileName);
      
      console.log(`Using cached ${type} music: ${urlData.publicUrl}`);
      return new Response(
        JSON.stringify({ success: true, audioUrl: urlData.publicUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate music using ElevenLabs Sound Effects API
    // Warm, inviting music that feels like a trusted friend
    const prompts = {
      intro: "Warm smooth podcast intro, gentle piano with soft Rhodes keys, subtle acoustic guitar, cozy morning coffee vibes, inviting and calm but focused, builds warmth not intensity, 8 seconds",
      outro: "Gentle reflective podcast outro, soft piano resolution, warm ambient pads, peaceful and satisfying close, like a good conversation ending, 6 seconds"
    };

    const durations = {
      intro: 8,
      outro: 6
    };

    console.log(`Generating new ${type} music with prompt: ${prompts[type]}`);

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompts[type],
        duration_seconds: durations[type],
        prompt_influence: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs music generation error:', errorText);
      throw new Error(`Music generation failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`${type} music generated, size: ${audioBuffer.byteLength} bytes`);

    // Store the music for reuse
    const { error: uploadError } = await supabase.storage
      .from('podcasts')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Return the audio anyway, just won't be cached
      const base64Audio = base64Encode(audioBuffer);
      return new Response(
        JSON.stringify({ success: true, audioContent: base64Audio }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: urlData } = supabase.storage
      .from('podcasts')
      .getPublicUrl(fileName);

    console.log(`${type} music stored at: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ success: true, audioUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating podcast music:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});