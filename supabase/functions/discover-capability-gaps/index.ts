import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Discovering capability gaps for company:', company_id);

    // Get all job descriptions for the company
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('job_descriptions')
      .select('id, title, description, is_current')
      .eq('company_id', company_id)
      .eq('is_current', true);

    if (jdError) throw jdError;

    console.log('Found job descriptions:', jobDescriptions?.length || 0);

    if (!jobDescriptions || jobDescriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          potential_capabilities: [],
          message: 'No job descriptions found to analyze'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all existing capabilities
    const { data: existingCapabilities, error: capError } = await supabase
      .from('capabilities')
      .select('id, name, category, description')
      .eq('status', 'approved');

    if (capError) throw capError;

    console.log('Existing capabilities:', existingCapabilities?.length || 0);

    // Build context for AI
    const existingCapsList = (existingCapabilities || [])
      .map(c => `- ${c.name} (${c.category})`)
      .join('\n');

    const jdSummaries = jobDescriptions.slice(0, 20).map((jd, i) => 
      `JD ${i + 1} [${jd.title}]:\n${jd.description}`
    ).join('\n\n---\n\n');

    const prompt = `You are analyzing job descriptions to find skills and capabilities that are NOT covered by existing capabilities.

EXISTING CAPABILITIES (DO NOT suggest these):
${existingCapsList}

JOB DESCRIPTIONS TO ANALYZE:
${jdSummaries}

Task: Find skills, competencies, or capabilities mentioned in the job descriptions that do NOT match any existing capability. Look for:
- Technical skills not listed
- Domain-specific knowledge areas
- Specialized competencies
- Soft skills not covered
- Tools or methodologies mentioned

For each NEW capability you identify, provide:
1. A clear capability name (2-5 words)
2. A suggested category
3. Brief justification (why it's different from existing capabilities)
4. Sample quotes from the JD(s) that mention it
5. How many JDs mention it

Return ONLY valid JSON (no markdown formatting) in this exact format:
{
  "potential_capabilities": [
    {
      "name": "Capability Name",
      "category": "Category",
      "justification": "Why this is needed",
      "sample_quotes": ["quote 1", "quote 2"],
      "jd_count": 3
    }
  ]
}

If no new capabilities are needed, return: {"potential_capabilities": []}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling AI to analyze job descriptions...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';
    
    console.log('AI response:', aiContent.substring(0, 500));

    // Parse AI response - handle both plain JSON and markdown-wrapped JSON
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(aiContent);
    } catch (e) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding any JSON object
        const objectMatch = aiContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not extract JSON from AI response');
        }
      }
    }

    const potentialCapabilities = parsed.potential_capabilities || [];

    console.log('Discovered potential capabilities:', potentialCapabilities.length);

    return new Response(
      JSON.stringify({
        success: true,
        total_jds_analyzed: jobDescriptions.length,
        existing_capabilities_count: existingCapabilities?.length || 0,
        potential_capabilities: potentialCapabilities
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in discover-capability-gaps:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
