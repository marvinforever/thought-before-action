import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capabilityName, category, description, fullDescription } = await req.json();

    if (!capabilityName || !category) {
      return new Response(
        JSON.stringify({ error: 'Capability name and category are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating capability content for: ${capabilityName} (${category})`);

    let systemPrompt = `You are an expert in organizational development and capability frameworks. Generate capability progression levels following a four-level model.

Your task is to ONLY generate the four progression level descriptions. You will receive descriptions from the user that define what this capability is about.`;

    let userPrompt = '';
    
    if (description || fullDescription) {
      userPrompt = `CRITICAL INSTRUCTION: The user has defined this capability. You must create progression levels that are faithful to THEIR definition, not your own interpretation.

==== USER'S CAPABILITY DEFINITION (DO NOT CHANGE THIS) ====
`;
      if (description) {
        userPrompt += `Short Description: ${description}\n\n`;
      }
      if (fullDescription) {
        userPrompt += `Full Description:\n${fullDescription}\n\n`;
      }
      userPrompt += `==== END OF USER'S DEFINITION ====

Your ONLY job is to create four progression levels (Foundational, Advancing, Independent, Mastery) that describe how someone would develop proficiency in THIS EXACT capability as the user has defined it above.

DO NOT:
- Create a different capability
- Change the meaning or focus
- Add concepts not mentioned by the user
- Reinterpret what the user wrote

DO:
- Use the user's exact terminology and concepts
- Build progression levels that reflect their definition
- Keep their short and full descriptions unchanged in your response

Generate levels for: "${capabilityName}" in category "${category}"`;
    } else {
      userPrompt = `Generate a complete capability definition for "${capabilityName}" in the "${category}" category.

Provide:
1. A concise short description (1-2 sentences)
2. A detailed full description (2-3 sentences explaining why this capability matters)
3. Four progression levels with detailed descriptions:
   - Foundational (Awareness): Basic awareness and understanding of core concepts
   - Advancing (Working Knowledge): Developing practical skills with guidance
   - Independent (Skill): Can perform independently with consistent quality
   - Mastery: Expert level, can teach and innovate`;
    }
    
    userPrompt += `\n\nProvide your response in this exact JSON format:
{
  "shortDescription": "${description || 'concise 1-2 sentence description'}",
  "fullDescription": "${fullDescription || 'detailed 2-3 sentence explanation of why this matters'}",
  "foundational": "2-4 sentences describing Foundational level behaviors and capabilities",
  "advancing": "2-4 sentences describing Advancing level behaviors and capabilities",
  "independent": "2-4 sentences describing Independent level behaviors and capabilities",
  "mastery": "2-4 sentences describing Mastery level behaviors and capabilities"
}`;

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
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate capability content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let contentText = data.choices[0].message.content;

    // Strip markdown code blocks if present
    if (contentText.includes('```')) {
      contentText = contentText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const content = JSON.parse(contentText);
    
    // Ensure we preserve user's descriptions if they provided them
    const finalContent = {
      shortDescription: description || content.shortDescription,
      fullDescription: fullDescription || content.fullDescription,
      foundational: content.foundational,
      advancing: content.advancing,
      independent: content.independent,
      mastery: content.mastery
    };

    console.log('Successfully generated capability content');

    return new Response(
      JSON.stringify(finalContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-capability-content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
