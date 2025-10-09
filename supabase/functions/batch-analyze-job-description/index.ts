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
    const { jobDescription, jobTitle, employeeIds, companyId } = await req.json();
    console.log('Batch analyzing job description for employees:', employeeIds);

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

    // Analyze the job description ONCE to get consistent results
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
        model: 'google/gemini-2.5-flash',
        temperature: 0.1, // Lower temperature for more consistent results
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
                      capability_id: { type: 'string' },
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
    console.log('AI suggestions (will be applied to all employees):', suggestions);

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

    if (sanitized.length === 0) {
      throw new Error('No valid capability matches found');
    }

    console.log(`Applying ${sanitized.length} capabilities to ${employeeIds.length} employees`);

    // Now apply the SAME results to ALL employees
    let successCount = 0;
    let failedEmployees: string[] = [];

    for (const employeeId of employeeIds) {
      try {
        // Store job description for this employee
        const { data: jobDescData, error: jobDescError } = await supabase
          .from('job_descriptions')
          .insert({
            profile_id: employeeId,
            company_id: companyId,
            title: jobTitle || null,
            description: jobDescription,
            analysis_results: { suggestions: sanitized },
            capabilities_assigned: sanitized.map((s: any) => s.capability_id),
            is_current: true
          })
          .select()
          .single();

        if (jobDescError) {
          console.error(`Error storing job description for ${employeeId}:`, jobDescError);
          failedEmployees.push(employeeId);
          continue;
        }

        // Mark previous job descriptions as not current
        await supabase
          .from('job_descriptions')
          .update({ is_current: false })
          .eq('profile_id', employeeId)
          .neq('id', jobDescData.id);

        // Assign the capabilities to the employee
        const capabilitiesToInsert = sanitized.map((s: any) => ({
          profile_id: employeeId,
          capability_id: s.capability_id,
          current_level: s.current_level,
          target_level: s.target_level,
          priority: s.priority,
          ai_reasoning: s.reasoning,
          assigned_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('employee_capabilities')
          .insert(capabilitiesToInsert);

        if (insertError) {
          console.error(`Error inserting capabilities for ${employeeId}:`, insertError);
          failedEmployees.push(employeeId);
          continue;
        }

        successCount++;
        console.log(`Successfully assigned capabilities to employee ${employeeId}`);
      } catch (error) {
        console.error(`Failed to process employee ${employeeId}:`, error);
        failedEmployees.push(employeeId);
      }
    }

    // Track usage stats (do this once since it's the same capabilities for all)
    if (companyId) {
      for (const suggestion of sanitized) {
        await supabase
          .from('capability_usage_stats')
          .upsert({
            capability_id: suggestion.capability_id,
            company_id: companyId,
            usage_count: employeeIds.length, // Count all employees
            last_used_at: new Date().toISOString()
          }, {
            onConflict: 'capability_id,company_id',
            ignoreDuplicates: false
          });
      }
    }

    return new Response(JSON.stringify({ 
      suggestions: sanitized,
      successCount,
      totalCount: employeeIds.length,
      failedEmployees
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-analyze-job-description:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
