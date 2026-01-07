import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { knowledgeId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the knowledge article
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('sales_knowledge')
      .select('*')
      .eq('id', knowledgeId)
      .single();

    if (knowledgeError || !knowledge) {
      throw new Error('Knowledge article not found');
    }

    console.log(`Generating podcast for: ${knowledge.title}`);

    // Generate podcast script using AI
    const scriptPrompt = `You are creating a short, engaging audio training podcast episode (2-3 minutes when spoken). 

TRAINING CONTENT:
Title: ${knowledge.title}
Category: ${knowledge.category || 'General Sales'}
Stage: ${knowledge.stage || 'All Stages'}

Content:
${knowledge.content}

INSTRUCTIONS:
1. Write a conversational, spoken-word script for a solo host named "Coach Mark"
2. Start with a punchy hook that grabs attention
3. Teach the key concepts in a memorable, story-driven way
4. Include ONE specific example or scenario
5. End with ONE clear action item the listener can do TODAY
6. Keep it under 400 words (about 2-3 minutes spoken)
7. Use natural speech patterns - contractions, short sentences, occasional pauses marked with "..."
8. Do NOT include stage directions, just the words to be spoken
9. Sound like a real coach talking to a salesperson, not a lecture

Write the script now:`;

    const scriptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: scriptPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error('AI script generation failed:', errorText);
      throw new Error('Failed to generate podcast script');
    }

    const scriptData = await scriptResponse.json();
    const script = scriptData.choices?.[0]?.message?.content || '';

    console.log('Generated script, now synthesizing audio...');

    // Generate audio using ElevenLabs TTS
    // Using "Brian" voice - professional male voice good for coaching
    const voiceId = 'nPczCjzI2devNBz1zQrb'; // Brian
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS failed:', errorText);
      throw new Error('Failed to generate audio');
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    console.log('Audio generated, storing...');

    // Upload to storage
    const fileName = `sales-podcasts/${knowledgeId}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('podcast-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Continue without storage - return base64 directly
    }

    // Get public URL if upload succeeded
    let audioUrl = null;
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('podcast-audio')
        .getPublicUrl(fileName);
      audioUrl = urlData?.publicUrl;
    }

    // Update the knowledge record with podcast info
    await supabase
      .from('sales_knowledge')
      .update({
        tags: [...(knowledge.tags || []), 'has_podcast'],
      })
      .eq('id', knowledgeId);

    return new Response(
      JSON.stringify({
        success: true,
        title: knowledge.title,
        script,
        audioUrl,
        audioBase64: audioUrl ? null : audioBase64, // Only include base64 if no URL
        duration: Math.round(script.split(' ').length / 150 * 60), // Estimate duration in seconds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate sales podcast error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
