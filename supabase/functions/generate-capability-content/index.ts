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

    let systemPrompt: string;
    let userPrompt: string;
    let messages: any[];
    
    if (description || fullDescription) {
      // When user provides descriptions, use a more constrained approach
      systemPrompt = `You are a capability framework expert. Your ONLY task is to generate four progression level descriptions.

CRITICAL RULES:
1. You MUST use the exact capability definition provided by the user
2. You MUST NOT create a different capability or reinterpret the user's meaning
3. You MUST preserve the user's terminology and concepts exactly as written
4. Your progression levels must directly build upon the user's definition

If you generate content that contradicts or ignores the user's definition, you have failed.`;

      const userDefinition = [
        description ? `SHORT DESCRIPTION (YOU MUST USE THIS EXACTLY):\n${description}` : '',
        fullDescription ? `FULL DESCRIPTION (YOU MUST REFERENCE THIS IN YOUR LEVELS):\n${fullDescription}` : ''
      ].filter(Boolean).join('\n\n');

      userPrompt = `CAPABILITY: "${capabilityName}"
CATEGORY: "${category}"

${userDefinition}

TASK: Generate ONLY four progression levels that teach someone how to develop mastery of the capability AS DEFINED ABOVE.

Your levels must:
- Reference the specific concepts from the user's definition
- Use the user's exact terminology (e.g., if they mention "Clarity, Certainty, Capacity", your levels must discuss these three elements)
- Build progressively from basic awareness to mastery
- NOT introduce new concepts or change the focus

Return ONLY JSON with this structure:
{
  "foundational": "Describes beginner level understanding and application of the concepts defined above",
  "advancing": "Describes developing skills with the concepts defined above",
  "independent": "Describes independent proficiency with the concepts defined above",
  "mastery": "Describes expert-level mastery and ability to teach the concepts defined above"
}`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    } else {
      // When no descriptions provided, generate everything
      systemPrompt = `You are an expert in organizational development and capability frameworks. Generate comprehensive capability definitions with four progression levels.`;
      
      userPrompt = `Generate a complete capability definition for "${capabilityName}" in the "${category}" category.

Provide a short description (1-2 sentences), full description (2-3 sentences), and four progression levels:
- Foundational (Awareness): Basic awareness and understanding
- Advancing (Working Knowledge): Developing practical skills with guidance  
- Independent (Skill): Can perform independently with quality
- Mastery: Expert level, can teach and innovate

Return JSON:
{
  "shortDescription": "1-2 sentence description",
  "fullDescription": "2-3 sentence explanation",
  "foundational": "2-4 sentences",
  "advancing": "2-4 sentences", 
  "independent": "2-4 sentences",
  "mastery": "2-4 sentences"
}`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
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
    
    // Log what we received vs what we expected
    if (description || fullDescription) {
      console.log('User provided descriptions - validating AI response...');
      if (description) console.log('Expected to preserve short description:', description.substring(0, 100));
      if (fullDescription) console.log('Expected to preserve full description:', fullDescription.substring(0, 100));
    }
    
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
