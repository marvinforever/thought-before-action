import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobDescription, employeeId } = await req.json();
    console.log('Analyzing job description for employee:', employeeId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all capabilities for AI context
    const { data: capabilities, error: capError } = await supabase
      .from('capabilities')
      .select('id, name, description, category, level');

    if (capError) {
      console.error('Error fetching capabilities:', capError);
      throw capError;
    }

    const capabilityContext = capabilities?.map(c => 
      `ID: ${c.id} | Name: ${c.name} | Category: ${c.category} | Level: ${c.level}`
    ).join('\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an expert HR analyst specializing in capability mapping. Analyze job descriptions and map them to specific capabilities.

Available capabilities (you MUST use the exact IDs provided):
${capabilityContext}

Your task: Given a job description, identify the top 3-5 most relevant capabilities this person needs. For each capability, determine:
- capability_id: MUST be one of the exact IDs listed above
- current_level: Their likely current proficiency (beginner, intermediate, advanced, expert)
- target_level: The level they should reach for this role (beginner, intermediate, advanced, expert)
- priority: How critical this capability is (1=highest, 5=lowest)
- reasoning: Brief explanation of why this capability matters for this role

CRITICAL: Only use capability IDs from the list above. Do not make up or generate new IDs.`;

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
          { role: 'user', content: `Analyze this job description and suggest capabilities:\n\n${jobDescription}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_capabilities',
            description: 'Return capability suggestions for a job role',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      capability_id: { type: 'string', description: 'UUID of the capability' },
                      capability_name: { type: 'string' },
                      current_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
                      target_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
                      priority: { type: 'number', minimum: 1, maximum: 5 },
                      reasoning: { type: 'string' }
                    },
                    required: ['capability_id', 'capability_name', 'current_level', 'target_level', 'priority', 'reasoning']
                  }
                }
              },
              required: ['suggestions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_capabilities' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    // Validate that all capability IDs exist in the database
    const validCapabilityIds = new Set(capabilities?.map(c => c.id) || []);
    const validatedSuggestions = suggestions.suggestions.filter((s: any) => {
      const isValid = validCapabilityIds.has(s.capability_id);
      if (!isValid) {
        console.error(`Invalid capability_id returned by AI: ${s.capability_id} for ${s.capability_name}`);
      }
      return isValid;
    });

    if (validatedSuggestions.length === 0) {
      throw new Error('AI returned no valid capability suggestions');
    }

    return new Response(JSON.stringify({ suggestions: validatedSuggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-job-description:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
