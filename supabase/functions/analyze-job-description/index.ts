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
    const { jobDescription, employeeId, companyId } = await req.json();
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

    // Step 1: Try to match existing capabilities with confidence scoring
    const matchSystemPrompt = `You are an expert HR analyst. Analyze the job description and determine if existing capabilities are a good match.

Available capabilities:
${capabilityContext}

CRITICAL: You MUST use the EXACT UUID from the "ID:" field for each capability. Do NOT generate or modify capability IDs.

For each relevant capability, provide a confidence score (0-100) indicating how well it matches the job requirements.
Return confidence scores for the top 5 most relevant capabilities.

If ALL top matches have confidence < 80%, indicate that custom capabilities are needed.`;

    const matchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: matchSystemPrompt },
          { role: 'user', content: `Analyze this job description:\n\n${jobDescription}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'evaluate_capability_matches',
            description: 'Evaluate how well existing capabilities match the job description',
            parameters: {
              type: 'object',
              properties: {
                matches: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      capability_id: { type: 'string' },
                      capability_name: { type: 'string' },
                      confidence: { type: 'number', minimum: 0, maximum: 100 },
                      reasoning: { type: 'string' }
                    },
                    required: ['capability_id', 'capability_name', 'confidence', 'reasoning']
                  }
                },
                needs_custom_capability: { type: 'boolean', description: 'True if all matches have confidence < 80%' }
              },
              required: ['matches', 'needs_custom_capability']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'evaluate_capability_matches' } }
      }),
    });

    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      console.error('AI gateway error:', matchResponse.status, errorText);
      throw new Error(`AI gateway error: ${matchResponse.status}`);
    }

    const matchData = await matchResponse.json();
    const matchToolCall = matchData.choices?.[0]?.message?.tool_calls?.[0];
    if (!matchToolCall) {
      throw new Error('No tool call in AI match response');
    }

    const matchResult = JSON.parse(matchToolCall.function.arguments);
    console.log('Match evaluation:', matchResult);

    // Step 2: If custom capability needed, generate it
    if (matchResult.needs_custom_capability) {
      console.log('Creating custom capability...');
      
      const customCapPrompt = `You are an expert at defining professional capabilities. Create a comprehensive capability definition for this job description.

Generate:
1. Capability name (concise, professional)
2. Category (e.g., Technical, Leadership, Communication, Strategic Thinking, Adaptability)
3. Short description (1-2 sentences)
4. Full description (detailed explanation)
5. Four progression levels with descriptions:
   - Foundational: Basic understanding and application
   - Advancing: Growing proficiency and independence
   - Independent: Full autonomy and expertise
   - Mastery: Expert-level, teaching others, driving innovation`;

      const customResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: customCapPrompt },
            { role: 'user', content: `Create a custom capability for this job:\n\n${jobDescription}` }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'create_custom_capability',
              description: 'Generate a complete custom capability definition',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  full_description: { type: 'string' },
                  levels: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        level: { type: 'string', enum: ['foundational', 'advancing', 'independent', 'mastery'] },
                        description: { type: 'string' }
                      },
                      required: ['level', 'description']
                    }
                  }
                },
                required: ['name', 'category', 'description', 'full_description', 'levels']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'create_custom_capability' } }
        }),
      });

      if (!customResponse.ok) {
        throw new Error('Failed to generate custom capability');
      }

      const customData = await customResponse.json();
      const customToolCall = customData.choices?.[0]?.message?.tool_calls?.[0];
      if (!customToolCall) {
        throw new Error('No tool call in custom capability response');
      }

      const customCapability = JSON.parse(customToolCall.function.arguments);
      console.log('Generated custom capability:', customCapability);

      // Store in custom_capabilities table
      const { data: insertedCap, error: insertError } = await supabase
        .from('custom_capabilities')
        .insert({
          name: customCapability.name,
          category: customCapability.category,
          description: customCapability.description,
          full_description: customCapability.full_description,
          company_id: companyId,
          status: 'pending',
          created_by_job_description: jobDescription,
          ai_confidence_score: 0, // Custom capability since no good match
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting custom capability:', insertError);
        throw insertError;
      }

      // Store capability levels
      const levelsToInsert = customCapability.levels.map((level: any) => ({
        custom_capability_id: insertedCap.id,
        level: level.level,
        description: level.description,
      }));

      const { error: levelsError } = await supabase
        .from('capability_levels_pending')
        .insert(levelsToInsert);

      if (levelsError) {
        console.error('Error inserting capability levels:', levelsError);
        throw levelsError;
      }

      return new Response(JSON.stringify({ 
        needsApproval: true,
        message: 'Custom capability created and pending admin approval',
        customCapabilityId: insertedCap.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Use existing capabilities with high confidence
    const validCapabilityIds = new Set(capabilities?.map(c => c.id) || []);
    const nameToId = new Map((capabilities || []).map(c => [String(c.name).toLowerCase(), c.id]));
    
    const highConfidenceMatches = matchResult.matches
      .filter((m: any) => {
        const isValid = m.confidence >= 80 && validCapabilityIds.has(m.capability_id);
        if (!isValid && m.confidence >= 80) {
          // Attempt to map by name as a fallback if AI returned a slug instead of UUID
          const mapped = nameToId.get(String(m.capability_name).toLowerCase());
          if (mapped) {
            m.capability_id = mapped;
            return true;
          }
          console.warn(`Invalid capability_id from AI (no fallback by name): ${m.capability_id} (${m.capability_name})`);
        }
        return isValid;
      });

    if (highConfidenceMatches.length === 0) {
      console.error('No valid high-confidence matches. Available IDs:', Array.from(validCapabilityIds));
      console.error('AI returned matches:', matchResult.matches);
      throw new Error('No high-confidence capability matches found');
    }

    // Get detailed suggestions for high-confidence matches
    const suggestionPrompt = `For these capabilities, determine appropriate proficiency levels and priority for the job role.

CRITICAL INSTRUCTION: You MUST use the EXACT capability_id UUID values provided below. Do NOT modify or create new IDs.

Capabilities to evaluate:
${highConfidenceMatches.map((m: any) => `ID: ${m.capability_id} | Name: ${m.capability_name} | Why relevant: ${m.reasoning}`).join('\n')}

Job Description: ${jobDescription}`;

    const suggestionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an HR expert. Determine current and target proficiency levels.' },
          { role: 'user', content: suggestionPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_capabilities',
            description: 'Return capability suggestions with proficiency levels',
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

    if (!suggestionResponse.ok) {
      throw new Error('Failed to get capability suggestions');
    }

    const suggestionData = await suggestionResponse.json();
    const suggestionToolCall = suggestionData.choices?.[0]?.message?.tool_calls?.[0];
    if (!suggestionToolCall) {
      throw new Error('No tool call in suggestion response');
    }

    const suggestions = JSON.parse(suggestionToolCall.function.arguments);

    // Map AI levels to database enum values
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
          if (mapped) {
            cid = mapped;
          } else {
            console.error(`Suggestion has invalid capability_id and no name match: ${s.capability_id} (${s.capability_name})`);
          }
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
      throw new Error('All suggested capability IDs were invalid');
    }

    // Track usage for existing capabilities
    for (const suggestion of sanitized) {
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

    return new Response(JSON.stringify({ suggestions: sanitized }), {
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
