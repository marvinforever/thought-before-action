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
 * Split text into sentences for chunking
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence endings while preserving the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Chunk sentences into groups that stay under the character limit
 * This prevents voice quality degradation on long segments
 */
function chunkText(text: string, maxCharsPerChunk = 800): string[] {
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 > maxCharsPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Generate TTS for a single text chunk
 */
async function generateChunkAudio(
  text: string,
  voiceId: string,
  voiceSettings: typeof TTS_VOICE_SETTINGS,
  apiKey: string,
  previousText?: string,
  nextText?: string
): Promise<ArrayBuffer> {
  const body: any = {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: voiceSettings,
  };
  
  // Add context for request stitching (natural transitions)
  if (previousText) {
    body.previous_text = previousText.slice(-200);
  }
  if (nextText) {
    body.next_text = nextText.slice(0, 200);
  }
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
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
 * Generate TTS for a speaker segment, chunking long text to maintain voice quality
 */
async function generateSegmentAudio(
  text: string,
  voiceId: string,
  voiceSettings: typeof TTS_VOICE_SETTINGS,
  apiKey: string,
  previousText?: string,
  nextText?: string
): Promise<ArrayBuffer> {
  // Clean text for TTS - remove AI-sounding pauses and artifacts
  const cleanedText = text
    // Remove explicit pause markers
    .replace(/\[pause\]/gi, '')
    // Replace multiple periods with single pause (sounds more natural)
    .replace(/\.{2,}/g, '.')
    // Remove double dashes that create awkward pauses
    .replace(/\s*--\s*/g, ' ')
    .replace(/—/g, ', ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Remove newlines (cause unnatural breaks)
    .replace(/\n+/g, ' ')
    .trim();
  
  // If text is short enough, generate directly
  if (cleanedText.length <= 800) {
    return await generateChunkAudio(cleanedText, voiceId, voiceSettings, apiKey, previousText, nextText);
  }
  
  // For longer text, chunk it to prevent voice quality degradation
  console.log(`Chunking long segment (${cleanedText.length} chars) to maintain voice quality`);
  const chunks = chunkText(cleanedText, 800);
  console.log(`Split into ${chunks.length} chunks`);
  
  const audioBuffers: ArrayBuffer[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prevContext = i === 0 ? previousText : chunks[i - 1];
    const nextContext = i === chunks.length - 1 ? nextText : chunks[i + 1];
    
    const audioBuffer = await generateChunkAudio(chunk, voiceId, voiceSettings, apiKey, prevContext, nextContext);
    audioBuffers.push(audioBuffer);
    
    // Small delay between chunk requests
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Combine all chunk buffers
  return concatenateAudioBuffers(audioBuffers);
}

/**
 * Wrap raw PCM audio bytes in a WAV container.
 * ElevenLabs `pcm_44100` output is mono 16-bit PCM at 44.1kHz.
 */
function pcmToWav(pcmBuffer: ArrayBuffer, sampleRate = 44100, numChannels = 1, bitsPerSample = 16): ArrayBuffer {
  const pcmData = new Uint8Array(pcmBuffer);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.byteLength;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " chunk
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" chunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataSize, true);

  // concat header + pcm
  const out = new Uint8Array(44 + dataSize);
  out.set(new Uint8Array(header), 0);
  out.set(pcmData, 44);
  return out.buffer;
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
          .replace(/\[pause\]/gi, '')
          .replace(/\n+/g, ' ')
          .replace(/^(JERICHO|SAM):\s*/gim, '') // Remove speaker labels
          .replace(/\s+/g, ' ')
          .trim();

        const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.jericho;
        audioBuffer = await generateSegmentAudio(cleanedScript, voiceId, TTS_VOICE_SETTINGS, elevenlabsApiKey);
        wordCount = cleanedScript.split(/\s+/).length;
      }
    } else {
      // Single voice mode (legacy)
      console.log('Single voice mode');
      const cleanedScript = script
        .replace(/\[pause\]/gi, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.jericho;
      audioBuffer = await generateSegmentAudio(cleanedScript, voiceId, TTS_VOICE_SETTINGS, elevenlabsApiKey);
      wordCount = cleanedScript.split(/\s+/).length;
    }

    // Audio is already in MP3 format from ElevenLabs
    console.log(`Audio generated, mp3 size: ${audioBuffer.byteLength} bytes`);

    // Estimate duration (rough: ~150 words per minute)
    const estimatedDurationSeconds = Math.round((wordCount / 150) * 60);
    console.log(`Estimated duration: ${estimatedDurationSeconds} seconds for ${wordCount} words`);

    let audioUrl = null;

    if (storeAudio && profileId && episodeDate) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Generate unique filename
      const fileName = `${profileId}/${episodeDate}.mp3`;

      // Upload to Storage
      const { error: uploadError } = await supabase
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
      // Return audio directly as base64 (MP3)
      const base64Audio = base64Encode(audioBuffer);
      return new Response(
        JSON.stringify({
          success: true,
          audioContent: base64Audio,
          durationSeconds: estimatedDurationSeconds,
          wordCount,
          mimeType: 'audio/mpeg',
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
