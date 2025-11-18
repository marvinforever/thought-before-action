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

    const systemPrompt = `You are an expert in organizational development and capability frameworks. Generate comprehensive capability definitions following a four-level progression model.

CRITICAL: If the user has provided existing descriptions, you MUST use them as the foundation and build upon them. Do NOT create entirely new descriptions that ignore what the user wrote.

For each capability, you must provide:
1. A concise short description (1-2 sentences) - USE THE USER'S SHORT DESCRIPTION IF PROVIDED
2. A detailed full description (2-3 sentences explaining why this capability matters) - USE THE USER'S FULL DESCRIPTION IF PROVIDED
3. Four progression levels with detailed descriptions:
   - Foundational (Awareness): Basic awareness and understanding of core concepts
   - Advancing (Working Knowledge): Developing practical skills with guidance
   - Independent (Skill): Can perform independently with consistent quality
   - Mastery: Expert level, can teach and innovate

Each level description should be 2-4 sentences describing specific behaviors and capabilities at that level.`;

    let userPrompt = `Generate a complete capability definition for "${capabilityName}" in the "${category}" category.`;
    
    if (description || fullDescription) {
      userPrompt += `\n\nIMPORTANT - The user has already provided context that you MUST respect and incorporate:`;
      if (description) {
        userPrompt += `\n- Short description: "${description}"`;
      }
      if (fullDescription) {
        userPrompt += `\n- Full description: "${fullDescription}"`;
      }
      userPrompt += `\n\nYou should use these descriptions as your foundation. Only generate the four progression levels that align with and elaborate on what the user has described. DO NOT rewrite or ignore their descriptions.`;
    }
    
    userPrompt += `\n\nProvide your response in the following JSON format:
{
  "shortDescription": "${description ? 'Use the provided short description' : 'concise 1-2 sentence description'}",
  "fullDescription": "${fullDescription ? 'Use the provided full description' : 'detailed 2-3 sentence explanation of why this matters'}",
  "foundational": "2-4 sentences describing Foundational level",
  "advancing": "2-4 sentences describing Advancing level",
  "independent": "2-4 sentences describing Independent level",
  "mastery": "2-4 sentences describing Mastery level"
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

    console.log('Successfully generated capability content');

    return new Response(
      JSON.stringify(content),
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
