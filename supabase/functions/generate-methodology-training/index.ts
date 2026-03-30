import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const METHODOLOGIES: Record<string, { name: string; shortDesc: string; researchQuery: string }> = {
  spin: {
    name: "SPIN Selling",
    shortDesc: "Situation, Problem, Implication, Need-Payoff questions",
    researchQuery: "SPIN Selling methodology Neil Rackham techniques questions examples"
  },
  challenger: {
    name: "The Challenger Sale",
    shortDesc: "Teach, Tailor, Take Control",
    researchQuery: "Challenger Sale methodology commercial teaching tailored messaging taking control techniques"
  },
  sandler: {
    name: "Sandler Selling System",
    shortDesc: "Qualification through pain discovery and upfront contracts",
    researchQuery: "Sandler Selling System pain funnel upfront contracts bonding rapport methodology"
  },
  meddic: {
    name: "MEDDIC",
    shortDesc: "Metrics, Economic Buyer, Decision Criteria/Process, Identify Pain, Champion",
    researchQuery: "MEDDIC sales methodology qualification framework metrics economic buyer champion"
  },
  gap: {
    name: "Gap Selling",
    shortDesc: "Current state vs future state — selling the gap",
    researchQuery: "Gap Selling Keenan methodology current state future state problem-centric selling"
  },
  miller_heiman: {
    name: "Miller Heiman Strategic Selling",
    shortDesc: "Stakeholder mapping and buying influence analysis",
    researchQuery: "Miller Heiman Strategic Selling buying influences blue sheet methodology"
  },
  consultative: {
    name: "Consultative Selling",
    shortDesc: "Solution-focused selling through deep customer understanding",
    researchQuery: "consultative selling methodology Mack Hanan solution selling needs-based approach"
  },
  value: {
    name: "Value Selling",
    shortDesc: "Quantify business value and ROI for every deal",
    researchQuery: "value selling framework ROI business case quantified value proposition methodology"
  },
  integrity: {
    name: "Integrity Selling",
    shortDesc: "Ethics-first selling — build trust before closing",
    researchQuery: "Integrity Selling Ron Willingham AID Inc trust-based selling ethics values"
  },
  fanatical_prospecting: {
    name: "Fanatical Prospecting",
    shortDesc: "High-activity prospecting with multi-channel outreach",
    researchQuery: "Fanatical Prospecting Jeb Blount techniques cold calling social selling email prospecting"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      methodologyId,
      chunkIndex = 0,
      dealContext,
      customerContext,
      productContext,
    } = await req.json();

    if (!methodologyId || !METHODOLOGIES[methodologyId]) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid methodology', 
          available: Object.entries(METHODOLOGIES).map(([id, m]) => ({ id, name: m.name, description: m.shortDesc }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const methodology = METHODOLOGIES[methodologyId];
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')!;

    console.log(`Generating ${methodology.name} training (chunk ${chunkIndex})`);

    // Step 1: Research the methodology using Perplexity
    let methodologyContent = '';
    
    if (perplexityApiKey) {
      console.log('Researching methodology via Perplexity...');
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a sales methodology expert. Provide detailed, practical, actionable information about sales methodologies. Focus on real techniques, specific question frameworks, step-by-step processes, and real-world examples. Be comprehensive but practical.'
            },
            {
              role: 'user',
              content: `Give me a comprehensive breakdown of ${methodology.name}: ${methodology.researchQuery}. Include: 1) Core principles and philosophy 2) Step-by-step technique breakdown 3) Specific questions/scripts to use at each stage 4) Common mistakes to avoid 5) How to apply it in agricultural/B2B sales contexts 6) Real-world examples of the methodology in action`
            }
          ],
          temperature: 0.3,
        }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();
        methodologyContent = perplexityData.choices?.[0]?.message?.content || '';
        const citations = perplexityData.citations || [];
        if (citations.length > 0) {
          methodologyContent += `\n\nSources: ${citations.slice(0, 3).join(', ')}`;
        }
        console.log(`Perplexity returned ${methodologyContent.length} chars`);
      } else {
        console.error('Perplexity API error:', await perplexityResponse.text());
      }
    }

    // Fallback if Perplexity unavailable or returned empty
    if (!methodologyContent) {
      methodologyContent = `${methodology.name}: ${methodology.shortDesc}. Research query: ${methodology.researchQuery}`;
    }

    // Build personalization context
    let personalizationBlock = '';
    if (dealContext) {
      personalizationBlock += `\nREP'S ACTIVE DEAL: ${dealContext.dealName} with ${dealContext.companyName || 'a prospect'} (Stage: ${dealContext.stage}). ${dealContext.notes ? `Notes: ${dealContext.notes}` : ''}`;
    }
    if (customerContext) {
      personalizationBlock += `\nREP'S CUSTOMER: ${customerContext.name} (${customerContext.location || 'location unknown'}). ${customerContext.operationDetails ? `Operation: ${JSON.stringify(customerContext.operationDetails)}` : ''} ${customerContext.growerHistory ? `History: ${customerContext.growerHistory.substring(0, 300)}` : ''}`;
    }
    if (productContext) {
      personalizationBlock += `\nREP'S PRODUCT FOCUS: ${productContext}`;
    }

    // Step 2: Generate chunked lessons using AI
    const chunkPrompt = `You are creating bite-sized sales training lessons on ${methodology.name}.

METHODOLOGY RESEARCH:
${methodologyContent.substring(0, 6000)}

${personalizationBlock ? `PERSONALIZATION - Use these real details in your examples:${personalizationBlock}` : ''}

Create 4-5 SHORT, focused lessons. Each lesson teaches ONE specific technique from ${methodology.name} that a sales rep can immediately use.

${personalizationBlock ? 'IMPORTANT: Weave the rep\'s real deals, customers, or products into each lesson as examples. Make it feel like coaching, not classroom theory.' : ''}

Return a JSON array:
[
  {"title": "Catchy 5-8 word title", "key_point": "One sentence takeaway", "content": "Teaching content (100-150 words max)"}
]

Make lessons ACTIONABLE — give specific questions to ask, phrases to use, scripts to try. Not theory.

Return ONLY the JSON array.`;

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
      throw new Error('Failed to generate lessons');
    }

    const chunkData = await chunkResponse.json();
    let chunks;
    try {
      const raw = chunkData.choices?.[0]?.message?.content || '[]';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      chunks = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse chunks:', e);
      throw new Error('Failed to parse lesson chunks');
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No lessons generated');
    }

    // Step 3: Generate podcast script for the specific chunk
    const chunk = chunks[Math.min(chunkIndex, chunks.length - 1)];
    console.log(`Generating episode ${chunkIndex + 1}/${chunks.length}: ${chunk.title}`);

    let personalizationPrompt = '';
    if (customerContext) {
      personalizationPrompt = `\nYou're coaching a rep who's about to meet with ${customerContext.name}. Weave in specific advice for this customer throughout.`;
    } else if (dealContext) {
      personalizationPrompt = `\nYou're coaching a rep working the "${dealContext.dealName}" deal (${dealContext.stage} stage). Make your advice specific to their situation.`;
    }

    const scriptPrompt = `You're recording a coaching moment on ${methodology.name} — warm, insightful, practical.

LESSON: ${chunk.title}
KEY POINT: ${chunk.key_point}
CONTENT: ${chunk.content}
${personalizationPrompt}

RULES:
1. Start with a thought-provoking question or observation
2. Teach the technique with a specific example or script they can use TODAY
3. Keep it conversational — like a mentor giving advice over coffee
4. Under 120 words (60-75 seconds spoken)
5. Use "you" and "your" — make it personal
6. NO stage directions, NO host names, NO intros
7. Just the spoken words
8. End with a reflection question or challenge to try

AVOID: "Listen up", "Here's the deal", commanding tone
USE: "Have you ever noticed...?", "What if you tried...?", "Here's what I've seen work..."

Write it now:`;

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

    // Step 4: Generate audio with ElevenLabs
    console.log('Synthesizing audio with ElevenLabs...');

    const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX?output_format=mp3_44100_128', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS failed:', errorText);
      throw new Error('Failed to generate audio');
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    // Step 5: Upload to storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `methodology-training/${methodologyId}-ep${chunkIndex + 1}-${Date.now()}.mp3`;

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

    // Step 6: Generate written coaching card
    const cardPrompt = `Create a concise coaching card for this ${methodology.name} lesson.

LESSON: ${chunk.title}
KEY POINT: ${chunk.key_point}
CONTENT: ${chunk.content}
${personalizationPrompt}

Return a JSON object with:
{
  "headline": "Bold action-oriented headline (5-8 words)",
  "technique": "The specific technique name from ${methodology.name}",
  "whatToSay": ["3-4 exact phrases or questions the rep can use verbatim"],
  "whatToAvoid": ["2-3 common mistakes when using this technique"],
  "tryThis": "One specific challenge to try on their next call (1 sentence)",
  "proTip": "One advanced insight for experienced reps (1 sentence)"
}

Return ONLY the JSON object.`;

    const cardResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: cardPrompt }],
        temperature: 0.5,
      }),
    });

    let coachingCard = null;
    if (cardResponse.ok) {
      const cardData = await cardResponse.json();
      try {
        const raw = cardData.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        coachingCard = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse coaching card:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        methodology: methodology.name,
        episodeTitle: chunk.title,
        episodeNumber: chunkIndex + 1,
        totalEpisodes: chunks.length,
        keyPoint: chunk.key_point,
        script,
        audioUrl,
        coachingCard,
        duration: Math.round(script.split(' ').length / 150 * 60),
        allEpisodes: chunks.map((c: any, i: number) => ({
          index: i,
          title: c.title,
          keyPoint: c.key_point,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate methodology training error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
