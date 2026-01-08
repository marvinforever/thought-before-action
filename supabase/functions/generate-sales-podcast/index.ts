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
    const { knowledgeId, chunkIndex = 0, dealId, dealContext } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

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

    // Optional: Fetch deal info if dealId provided
    let dealInfo = dealContext || null;
    if (dealId && !dealInfo) {
      const { data: deal } = await supabase
        .from('sales_deals')
        .select('*, sales_companies(name), sales_contacts(name)')
        .eq('id', dealId)
        .single();
      
      if (deal) {
        dealInfo = {
          dealName: deal.deal_name,
          companyName: deal.sales_companies?.name,
          stage: deal.stage,
          value: deal.value,
          notes: deal.notes,
        };
      }
    }

    console.log(`Chunking content for: ${knowledge.title}${dealInfo ? ` (Deal: ${dealInfo.dealName})` : ''}`);

    // First, break content into bite-sized chunks using AI
    const chunkPrompt = `Break this sales training content into 3-5 SHORT, bite-sized lessons. Each lesson should be ONE focused concept that can be taught in 60-90 seconds.

CONTENT:
${knowledge.content}

Return a JSON array of lesson objects. Each lesson should have:
- title: A catchy, specific title (5-8 words)
- key_point: The ONE main takeaway (1 sentence)
- content: The teaching content for this specific lesson only (100-150 words max)

Example format:
[
  {"title": "Why Farmers Buy on Trust", "key_point": "Trust beats price every time in ag sales.", "content": "..."},
  {"title": "The 3-Second Opener", "key_point": "Your first words set the tone.", "content": "..."}
]

Return ONLY the JSON array, no other text.`;

    const chunkResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: chunkPrompt }],
        temperature: 0.7,
      }),
    });

    if (!chunkResponse.ok) {
      throw new Error('Failed to chunk content');
    }

    const chunkData = await chunkResponse.json();
    let chunks;
    try {
      const raw = chunkData.choices?.[0]?.message?.content || '[]';
      // Clean up any markdown code blocks
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      chunks = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse chunks:', e);
      throw new Error('Failed to parse lesson chunks');
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No lessons generated');
    }

    // Generate podcast for specific chunk (or first one)
    const chunk = chunks[Math.min(chunkIndex, chunks.length - 1)];
    
    console.log(`Generating episode ${chunkIndex + 1}/${chunks.length}: ${chunk.title}`);

    // Add deal context to the script prompt if available
    const dealContextText = dealInfo ? `
APPLY THIS TO THE USER'S REAL DEAL:
- Company: ${dealInfo.companyName || 'Unknown'}
- Deal: ${dealInfo.dealName}
- Stage: ${dealInfo.stage}
- Notes: ${dealInfo.notes || 'None'}

Customize your examples and advice to help with THIS specific deal. Mention the company name naturally. Make it feel like a personal coaching session for this exact situation.
` : '';

    const scriptPrompt = `You're recording a thoughtful sales insight - like a trusted advisor sharing something that might help them see their next opportunity differently.

LESSON: ${chunk.title}
KEY POINT: ${chunk.key_point}
CONTENT: ${chunk.content}
${dealContextText}
RULES:
1. Start with curiosity - a question or observation that makes them think
2. Keep it conversational and warm - like a mentor over coffee
3. ONE concept explored thoughtfully, with a real-world example
4. Ask questions that provoke reflection: "Have you thought about...?", "What if...?", "I wonder..."
5. Under 120 words (60-75 seconds spoken)
6. Use "you" and "your" - make it personal
7. Varied sentence length. Questions to engage. Moments to pause and think.
8. NO stage directions, NO "intro music", NO host names
9. Just write the words to speak - nothing else
10. Tone: Warm advisor, NOT drill sergeant. Curious, NOT commanding.
${dealInfo ? '11. Reference their specific deal/company naturally throughout!' : ''}

AVOID phrases like:
- "Listen up" / "Here's the deal" / "Let me tell you"
- "You need to..." / "You must..." / "Do this now"
- Anything that sounds like barking orders

INSTEAD use:
- "Have you ever noticed...?" / "What if you tried...?"
- "I'm curious..." / "Something worth considering..."
- "Here's what I've seen work..." / "One thing that might help..."

Write it now - thoughtful and inviting:`;


    const scriptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: scriptPrompt }],
        temperature: 0.85,
      }),
    });

    if (!scriptResponse.ok) {
      throw new Error('Failed to generate script');
    }

    const scriptData = await scriptResponse.json();
    const script = scriptData.choices?.[0]?.message?.content || '';

    console.log('Synthesizing audio with OpenAI TTS...');

    // Generate audio with OpenAI TTS - using "onyx" voice (warm, thoughtful male)
    // Other options: alloy, echo, fable, nova, shimmer
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd', // Higher quality model
        voice: 'nova', // Trying nova for comparison
        input: script,
        response_format: 'mp3',
        speed: 1.0, // Natural pace
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('OpenAI TTS failed:', errorText);
      throw new Error('Failed to generate audio');
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    // Upload to storage
    const fileName = `sales-podcasts/${knowledgeId}-ep${chunkIndex + 1}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('podcast-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    let audioUrl = null;
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('podcast-audio')
        .getPublicUrl(fileName);
      audioUrl = urlData?.publicUrl;
    }

    return new Response(
      JSON.stringify({
        success: true,
        parentTitle: knowledge.title,
        episodeTitle: chunk.title,
        episodeNumber: chunkIndex + 1,
        totalEpisodes: chunks.length,
        keyPoint: chunk.key_point,
        script,
        audioUrl,
        audioBase64: audioUrl ? null : audioBase64,
        duration: Math.round(script.split(' ').length / 150 * 60),
        // Return all chunk titles so UI can show episode list
        allEpisodes: chunks.map((c: any, i: number) => ({
          index: i,
          title: c.title,
          keyPoint: c.key_point,
        })),
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
