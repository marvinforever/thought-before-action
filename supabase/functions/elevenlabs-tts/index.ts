import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { TTS_VOICE_SETTINGS, TTS_VOICE_SETTINGS_SECONDARY, PODCAST_HOSTS } from "../_shared/jericho-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ElevenLabs voice IDs - using dynamic, engaging voices
const VOICES = {
  // Primary voice
  jericho: PODCAST_HOSTS.primary.voiceId,
  // Secondary co-host
  sam: PODCAST_HOSTS.secondary.voiceId,
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

interface ScriptSegment {
  speaker: 'JERICHO' | 'ALEX';
  text: string;
}

/**
 * Parse a conversational script into segments by speaker
 */
function parseConversationScript(script: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  
  // Split by speaker labels (JERICHO: or ALEX: or SAM: for backward compatibility)
  const lines = script.split('\n');
  let currentSpeaker: 'JERICHO' | 'ALEX' | null = null;
  let currentText = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for speaker label
    const jerichoMatch = trimmedLine.match(/^JERICHO:\s*(.*)/i);
    const alexMatch = trimmedLine.match(/^ALEX:\s*(.*)/i);
    const samMatch = trimmedLine.match(/^SAM:\s*(.*)/i); // Backward compatibility
    
    if (jerichoMatch) {
      // Save previous segment if exists
      if (currentSpeaker && currentText.trim()) {
        segments.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = 'JERICHO';
      currentText = jerichoMatch[1] || '';
    } else if (alexMatch || samMatch) {
      // Save previous segment if exists
      if (currentSpeaker && currentText.trim()) {
        segments.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = 'ALEX';
      currentText = (alexMatch?.[1] || samMatch?.[1]) || '';
    } else if (currentSpeaker && trimmedLine) {
      // Continue current speaker's text
      currentText += ' ' + trimmedLine;
    }
  }
  
  // Don't forget the last segment
  if (currentSpeaker && currentText.trim()) {
    segments.push({ speaker: currentSpeaker, text: currentText.trim() });
  }
  
  return segments;
}

/**
 * Check if script is in conversational format (has speaker labels)
 */
function isConversationalScript(script: string): boolean {
  return /^(JERICHO|ALEX|SAM):/im.test(script);
}

/**
 * Generate TTS for a single segment
 */
async function generateSegmentAudio(
  text: string,
  voiceId: string,
  voiceSettings: typeof TTS_VOICE_SETTINGS,
  apiKey: string,
  previousText?: string,
  nextText?: string
): Promise<ArrayBuffer> {
  // Clean text for TTS
  const cleanedText = text
    .replace(/\[pause\]/gi, '...')
    .replace(/\n\n/g, '\n')
    .trim();
  
  const body: any = {
    text: cleanedText,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: voiceSettings,
  };
  
  // Add context for request stitching (natural transitions)
  if (previousText) {
    body.previous_text = previousText.slice(-200); // Last ~200 chars of context
  }
  if (nextText) {
    body.next_text = nextText.slice(0, 200); // First ~200 chars of next
  }
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs API error:', errorText);
    throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
  }
  
  return await response.arrayBuffer();
}

/**
 * Concatenate multiple audio buffers into one
 */
function concatenateAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  
  return result.buffer;
}

/**
 * Generate multi-voice audio from conversational script
 */
async function generateMultiVoiceAudio(
  segments: ScriptSegment[],
  apiKey: string
): Promise<{ audioBuffer: ArrayBuffer; wordCount: number }> {
  console.log(`Generating multi-voice audio for ${segments.length} segments`);
  
  const audioBuffers: ArrayBuffer[] = [];
  let totalWordCount = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const previousSegment = segments[i - 1];
    const nextSegment = segments[i + 1];
    
    // Select voice and settings based on speaker
    const isJericho = segment.speaker === 'JERICHO';
    const voiceId = isJericho ? PODCAST_HOSTS.primary.voiceId : PODCAST_HOSTS.secondary.voiceId;
    const voiceSettings = isJericho ? TTS_VOICE_SETTINGS : TTS_VOICE_SETTINGS_SECONDARY;
    
    console.log(`Generating segment ${i + 1}/${segments.length}: ${segment.speaker} (${segment.text.slice(0, 50)}...)`);
    
    const audioBuffer = await generateSegmentAudio(
      segment.text,
      voiceId,
      voiceSettings,
      apiKey,
      previousSegment?.text,
      nextSegment?.text
    );
    
    audioBuffers.push(audioBuffer);
    totalWordCount += segment.text.split(/\s+/).length;
    
    // Small delay between requests to avoid rate limiting
    if (i < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Concatenate all audio
  const combinedBuffer = concatenateAudioBuffers(audioBuffers);
  console.log(`Combined audio size: ${combinedBuffer.byteLength} bytes`);
  
  return { audioBuffer: combinedBuffer, wordCount: totalWordCount };
}

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

    let audioBuffer: ArrayBuffer;
    let wordCount: number;

    // Check if this is a conversational (two-voice) script
    if (isConversationalScript(script)) {
      console.log('Detected conversational script - generating multi-voice audio');
      const segments = parseConversationScript(script);
      console.log(`Parsed ${segments.length} speaker segments`);
      
      if (segments.length > 0) {
        const result = await generateMultiVoiceAudio(segments, elevenlabsApiKey);
        audioBuffer = result.audioBuffer;
        wordCount = result.wordCount;
      } else {
        // Fallback to single voice if parsing fails
        console.log('Segment parsing failed, falling back to single voice');
        const cleanedScript = script
          .replace(/\[pause\]/gi, '...')
          .replace(/\n\n/g, '\n')
          .replace(/^(JERICHO|SAM):\s*/gim, '') // Remove speaker labels
          .trim();
        
        const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.jericho;
        audioBuffer = await generateSegmentAudio(cleanedScript, voiceId, TTS_VOICE_SETTINGS, elevenlabsApiKey);
        wordCount = cleanedScript.split(/\s+/).length;
      }
    } else {
      // Single voice mode (legacy)
      console.log('Single voice mode');
      const cleanedScript = script
        .replace(/\[pause\]/gi, '...')
        .replace(/\n\n/g, '\n')
        .trim();

      const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.jericho;
      audioBuffer = await generateSegmentAudio(cleanedScript, voiceId, TTS_VOICE_SETTINGS, elevenlabsApiKey);
      wordCount = cleanedScript.split(/\s+/).length;
    }

    console.log(`Audio generated, size: ${audioBuffer.byteLength} bytes`);

    // Estimate duration (rough: ~150 words per minute)
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
