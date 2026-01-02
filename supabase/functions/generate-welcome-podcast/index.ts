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
- Aspirational - you speak to who they are BECOMING, not just who they are today

CRITICAL FORMATTING RULES:
- Write natural spoken language - NO bullet points, headers, or markdown
- Use "..." for brief pauses
- Keep sentences conversational and flowing
- This will be converted to speech, so write how you would naturally speak`;

    const userPrompt = `Create a 3-minute welcome podcast episode (approximately 450 words) for ${userName}.

ABOUT THE LISTENER:
- Name: ${userName}
- Focus areas they selected: ${capabilitiesText}
- ${goalText}

EPISODE STRUCTURE (follow this order):

1. WARM WELCOME (30 seconds)
   - Greet them by name with genuine warmth
   - Express excitement that they're here
   - Set the tone: "This is the beginning of something meaningful"

2. INTRODUCE JERICHO (45 seconds)
   - Explain who you are: "I'm Jericho, your personal AI growth coach"
   - What Jericho does: "I'm here to help you grow into the leader and professional you're meant to become"
   - How it works: "Every day, I'll create personalized content just for you... podcasts, resources, and insights tailored to YOUR goals and YOUR journey"
   - The difference: "This isn't generic training. This is YOUR growth plan, built around what matters to YOU"

3. SPEAK TO WHO THEY'RE BECOMING - THIS IS THE HEART OF THE EPISODE (60 seconds)
   - This section must be DEEPLY PERSONALIZED to their specific capabilities: ${capabilitiesText}
   - For EACH capability they selected, paint a vivid picture of who they become when they master it
   - Use specific, concrete examples: "When you master [capability], you'll be the person who [specific scenario]..."
   - Make it aspirational but believable - speak to the transformation, not just the skill
   - Connect the capabilities together into a unified vision of their future self
   - This should feel like you REALLY SEE them and their potential

4. ACKNOWLEDGE THEIR GOAL (30 seconds)
   - ${goalText}
   - Connect their goal to their potential
   - Show them you see their vision

5. QUICK ORIENTATION (30 seconds)
   - "Here's how to get the most out of Jericho..."
   - Mention the My Growth Plan page where they'll find daily podcasts and resources
   - Mention they can talk to me anytime using the chat button
   - Encourage completing their profile for more personalized content

6. DAY 1 CHALLENGE (20 seconds)
   - Give ONE specific, actionable challenge they can do TODAY
   - Make it small but meaningful, connected to their focus areas

7. ENCOURAGING CLOSE (15 seconds)
   - Remind them you're with them on this journey
   - "I'll see you tomorrow with your first daily episode"
   - End with energy and belief in them

TONE: Like a supportive friend who's genuinely invested in their success. Warm but not sappy. Confident but not arrogant. You believe in them more than they believe in themselves right now.

Remember: Write for audio. Natural speech patterns. No formatting. Make them feel seen and excited about what's ahead.`;

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
