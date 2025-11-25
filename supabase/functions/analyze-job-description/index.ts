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
    const { jobDescription, jobTitle, employeeId, companyId } = await req.json();
    console.log('Analyzing job description for employee:', employeeId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all approved capabilities for AI context
    const { data: capabilities, error: capError } = await supabase
      .from('capabilities')
      .select('id, name, description, category, level')
      .eq('status', 'approved');

    if (capError) {
      console.error('Error fetching capabilities:', capError);
      throw capError;
    }

    const capabilityContext = capabilities?.map(c => 
      `ID: ${c.id} | Name: ${c.name} | Category: ${c.category} | Level: ${c.level} | Description: ${c.description}`
    ).join('\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Step 1: Match existing capabilities only (simplified - no custom capability creation)
    const matchSystemPrompt = `You are an expert HR analyst. Analyze the job description and match it to existing capabilities.

Available capabilities:
${capabilityContext}

CRITICAL: You MUST use the EXACT UUID from the "ID:" field for each capability. Do NOT generate or modify capability IDs.

Identify up to 25 relevant capabilities for this job description (only include truly relevant ones - quality over quantity).

IMPORTANT: Use a multi-pass analysis approach:
1. First identify CRITICAL capabilities (absolutely essential for the role)
2. Then identify IMPORTANT capabilities (needed for success)
3. Finally identify DEVELOPMENTAL capabilities (valuable for growth)

Try to cover multiple categories (Leadership, Communication, Technical, Strategic Thinking, etc.) where relevant.

For each capability, provide:
- Confidence score (0-100) indicating relevance
- Current proficiency level the person likely has
- Target proficiency level they should reach
- Priority (1-5, where 1 is HIGHEST priority and 5 is lowest)
- Reasoning for why this capability is relevant`;

    const matchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: matchSystemPrompt },
          { role: 'user', content: `Analyze this job description:\n\n${jobDescription}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_capabilities',
            description: 'Match existing capabilities to the job description',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      capability_id: { type: 'string', description: 'The UUID of the capability from the provided list' },
                      capability_name: { type: 'string', description: 'The name of the capability' },
                      current_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'], description: 'Current proficiency level' },
                      target_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'], description: 'Target proficiency level' },
                      priority: { type: 'integer', minimum: 1, maximum: 5, description: 'Priority from 1 (highest) to 5 (lowest)' },
                      reasoning: { type: 'string', description: 'Why this capability is relevant' }
                    },
                    required: ['capability_id', 'capability_name', 'current_level', 'target_level', 'priority', 'reasoning'],
                    additionalProperties: false
                  }
                }
              },
              required: ['suggestions'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_capabilities' } }
      }),
    });

    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      console.error('AI gateway error:', matchResponse.status, errorText);
      throw new Error(`AI gateway error: ${matchResponse.status}`);
    }

    const analysisData = await matchResponse.json();
    const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    console.log('AI suggestions:', suggestions);

    // Validate and sanitize suggestions
    const validCapabilityIds = new Set(capabilities?.map(c => c.id) || []);
    const nameToId = new Map((capabilities || []).map(c => [String(c.name).toLowerCase(), c.id]));
    
    const levelMap: Record<string, 'foundational' | 'advancing' | 'independent' | 'mastery'> = {
      'beginner': 'foundational',
      'intermediate': 'advancing',
      'advanced': 'independent',
      'expert': 'mastery'
    };

    const sanitized = suggestions.suggestions
      .map((s: any) => {
        let cid = s.capability_id;
        if (!validCapabilityIds.has(cid)) {
          const mapped = nameToId.get(String(s.capability_name).toLowerCase());
          if (mapped) cid = mapped;
        }
        return {
          ...s,
          capability_id: cid,
          current_level: levelMap[s.current_level] || 'foundational',
          target_level: levelMap[s.target_level] || 'advancing',
          priority: Math.min(5, Math.max(1, Math.round(Number(s.priority) || 3))),
        };
      })
      .filter((s: any) => validCapabilityIds.has(s.capability_id));

    // Deduplicate by capability_id - keep first occurrence
    const seen = new Set();
    const deduplicated = sanitized.filter((s: any) => {
      if (seen.has(s.capability_id)) {
        console.log(`Removing duplicate capability: ${s.capability_name} (${s.capability_id})`);
        return false;
      }
      seen.add(s.capability_id);
      return true;
    });

    if (deduplicated.length === 0) {
      throw new Error('No valid capability matches found');
    }

    // Store job description in database
    const { data: jobDescData, error: jobDescError } = await supabase
      .from('job_descriptions')
      .insert({
        profile_id: employeeId,
        company_id: companyId,
        title: jobTitle || null,
        description: jobDescription,
        analysis_results: { suggestions: deduplicated },
        capabilities_assigned: deduplicated.map((s: any) => s.capability_id),
        is_current: true
      })
      .select()
      .single();

    if (jobDescError) {
      console.error('Error storing job description:', jobDescError);
      // Don't fail the request if storage fails
    } else {
      console.log('Stored job description:', jobDescData.id);
      
      // Mark previous job descriptions as not current
      await supabase
        .from('job_descriptions')
        .update({ is_current: false })
        .eq('profile_id', employeeId)
        .neq('id', jobDescData.id);
    }

    // Track usage for existing capabilities
    for (const suggestion of deduplicated) {
      await supabase
        .from('capability_usage_stats')
        .upsert({
          capability_id: suggestion.capability_id,
          company_id: companyId,
          usage_count: 1,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'capability_id,company_id',
          ignoreDuplicates: false
        });
    }

    // Check for existing capabilities
    const { data: existingCaps } = await supabase
      .from('employee_capabilities')
      .select('capability_id')
      .eq('profile_id', employeeId);
    
    const existingCapIds = new Set(existingCaps?.map(c => c.capability_id) || []);
    
    // Separate new vs existing capabilities
    const newCaps = deduplicated.filter((s: any) => !existingCapIds.has(s.capability_id));
    const existingToUpdate = deduplicated.filter((s: any) => existingCapIds.has(s.capability_id));

    // Upsert capabilities (insert new, update existing)
    const capabilitiesToUpsert = deduplicated.map((s: any) => ({
      profile_id: employeeId,
      capability_id: s.capability_id,
      current_level: s.current_level,
      target_level: s.target_level,
      priority: s.priority,
      ai_reasoning: s.reasoning,
      last_updated: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('employee_capabilities')
      .upsert(capabilitiesToUpsert, {
        onConflict: 'profile_id,capability_id',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('Error upserting employee capabilities:', upsertError);
      throw new Error('Failed to assign capabilities to employee');
    }

    console.log(`Successfully processed ${deduplicated.length} capabilities: ${newCaps.length} new, ${existingToUpdate.length} updated`);

    return new Response(JSON.stringify({ suggestions: deduplicated }), {
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
