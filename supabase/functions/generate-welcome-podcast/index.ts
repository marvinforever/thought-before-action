import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, companyId, userName, selectedCapabilities, personalGoal } = await req.json();

    if (!profileId || !userName) {
      throw new Error('Missing required parameters: profileId and userName');
    }

    console.log(`Generating welcome podcast for ${userName} (${profileId})`);
    console.log(`Selected capabilities: ${selectedCapabilities?.join(', ')}`);
    console.log(`Personal goal: ${personalGoal}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt for the welcome episode
    const capabilitiesText = selectedCapabilities?.length 
      ? selectedCapabilities.join(', ')
      : 'personal growth and professional development';

    const goalText = personalGoal 
      ? `Their 90-day goal is: "${personalGoal}"`
      : 'They haven\'t set a specific goal yet, so encourage them to think about what success looks like.';

    const systemPrompt = `You are Jericho, a warm, encouraging AI growth coach creating a personalized welcome podcast episode. 

Your voice is:
- Warm and genuine, like a trusted mentor
- Encouraging but not cheesy
- Conversational and natural
- Action-oriented with practical insights

CRITICAL FORMATTING RULES:
- Write natural spoken language - NO bullet points, headers, or markdown
- Use "..." for brief pauses
- Keep sentences conversational and flowing
- This will be converted to speech, so write how you would naturally speak`;

    const userPrompt = `Create a 2-minute welcome podcast episode (approximately 300 words) for ${userName}.

ABOUT THE LISTENER:
- Name: ${userName}
- Focus areas they selected: ${capabilitiesText}
- ${goalText}

EPISODE STRUCTURE:
1. Warm, personal welcome (mention their name)
2. Acknowledge their selected focus areas with brief insight on each
3. Connect to their goal if provided
4. Give them ONE specific "Day 1 Challenge" - a small action they can take today
5. Tease what's coming: "As you complete more of your profile, I'll create even more personalized content just for you"
6. Encouraging close

TONE: Like a supportive friend who happens to be a great coach. Not corporate, not preachy.

Remember: Write for audio. Natural speech patterns. No formatting.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const script = aiResponse.choices?.[0]?.message?.content;

    if (!script) {
      throw new Error('No script generated from AI');
    }

    // Extract a daily challenge from the script
    const challengeMatch = script.match(/day\s*1\s*challenge[:\s]*([^.!?]+[.!?])/i) ||
                          script.match(/challenge[:\s]*([^.!?]+[.!?])/i) ||
                          script.match(/today[,\s]+([^.!?]+[.!?])/i);
    const dailyChallenge = challengeMatch ? challengeMatch[1].trim() : null;

    console.log(`Generated welcome script for ${userName} (${script.length} chars)`);
    console.log(`Extracted challenge: ${dailyChallenge}`);

    return new Response(
      JSON.stringify({
        success: true,
        script,
        title: `Welcome, ${userName}!`,
        topicsCovered: selectedCapabilities || [],
        dailyChallenge,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating welcome podcast:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
