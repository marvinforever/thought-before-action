import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured');
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
5. Each level description must be detailed and comprehensive (3-5 sentences)
6. Include specific behaviors, competencies, and outcomes for each level

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
- Be detailed and comprehensive (3-5 sentences each)
- Include specific behaviors, competencies, and expected outcomes

Return ONLY JSON with this structure:
{
  "foundational": "Detailed 3-5 sentence description of beginner level understanding and application of the concepts defined above",
  "advancing": "Detailed 3-5 sentence description of developing skills with the concepts defined above",
  "independent": "Detailed 3-5 sentence description of independent proficiency with the concepts defined above",
  "mastery": "Detailed 3-5 sentence description of expert-level mastery and ability to teach the concepts defined above"
}`;

      messages = [
        { role: 'user', content: systemPrompt + '\n\n' + userPrompt }
      ];
    } else {
      // When no descriptions provided, generate everything
      systemPrompt = `You are an expert in organizational development and capability frameworks. Generate comprehensive capability definitions with four progression levels. Each level description should be detailed and specific (3-5 sentences).`;
      
      userPrompt = `Generate a complete capability definition for "${capabilityName}" in the "${category}" category.

Provide a short description (1-2 sentences), full description (2-3 sentences), and four progression levels.

Each progression level must be detailed and comprehensive (3-5 sentences) including specific behaviors, competencies, and outcomes:
- Foundational (Awareness): Basic awareness and understanding - what does someone just learning this capability know and do?
- Advancing (Working Knowledge): Developing practical skills with guidance - what skills are they building and how do they apply them?
- Independent (Skill): Can perform independently with quality - what can they accomplish autonomously?
- Mastery: Expert level, can teach and innovate - how do they demonstrate mastery and help others?

Return JSON:
{
  "shortDescription": "1-2 sentence description",
  "fullDescription": "2-3 sentence explanation",
  "foundational": "3-5 detailed sentences",
  "advancing": "3-5 detailed sentences", 
  "independent": "3-5 detailed sentences",
  "mastery": "3-5 detailed sentences"
}`;

      messages = [
        { role: 'user', content: systemPrompt + '\n\n' + userPrompt }
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate capability content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let contentText = data.content[0].text;

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
