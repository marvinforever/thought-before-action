import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CapabilityInput {
  name: string;
  category: string;
  context?: string; // e.g. JD text or conversation context
  company_id?: string;
  source?: string; // 'jericho_chat' | 'jd_analysis' | 'gap_discovery'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // Support single or batch creation
    const capabilities: CapabilityInput[] = Array.isArray(body.capabilities)
      ? body.capabilities
      : [body];

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const results: any[] = [];

    for (const cap of capabilities) {
      if (!cap.name || !cap.category) {
        results.push({ name: cap.name, error: 'name and category required' });
        continue;
      }

      // Check if capability already exists
      const { data: existing } = await supabase
        .from('capabilities')
        .select('id, name')
        .ilike('name', cap.name)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Capability "${cap.name}" already exists (${existing[0].id}), skipping`);
        results.push({ name: cap.name, skipped: true, existing_id: existing[0].id });
        continue;
      }

      console.log(`Auto-creating capability: "${cap.name}" (${cap.category})`);

      // Step 1: Research with Perplexity (if available)
      let researchContext = '';
      if (PERPLEXITY_API_KEY) {
        try {
          const researchResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                {
                  role: 'system',
                  content: 'You are a professional development researcher. Provide concise, practical information about workplace capabilities and competencies.'
                },
                {
                  role: 'user',
                  content: `Research the professional capability "${cap.name}" in the context of "${cap.category}". What does this capability involve? What are the key competencies, behaviors, and skills at different proficiency levels? What does mastery look like? Keep response under 500 words.`
                }
              ],
            }),
          });

          if (researchResponse.ok) {
            const researchData = await researchResponse.json();
            researchContext = researchData.choices?.[0]?.message?.content || '';
            console.log(`Perplexity research complete for "${cap.name}" (${researchContext.length} chars)`);
          } else {
            console.warn(`Perplexity research failed for "${cap.name}": ${researchResponse.status}`);
          }
        } catch (e) {
          console.warn(`Perplexity research error for "${cap.name}":`, e);
        }
      }

      // Step 2: Generate descriptions and 4 levels with AI
      const aiPrompt = `You are a capability framework expert. Create a complete capability definition for "${cap.name}" in the "${cap.category}" category.

${researchContext ? `RESEARCH CONTEXT:\n${researchContext}\n` : ''}
${cap.context ? `ADDITIONAL CONTEXT:\n${cap.context}\n` : ''}

Generate:
1. A concise description (1-2 sentences)
2. A detailed full_description (2-3 sentences)  
3. Four progression level definitions, each 3-5 detailed sentences with specific behaviors and outcomes:
   - foundational (Level 1 - Awareness): Basic awareness, learning fundamentals
   - advancing (Level 2 - Working Knowledge): Developing practical skills with guidance
   - independent (Level 3 - Skill): Performs independently with quality
   - mastery (Level 4 - Expert): Expert level, can teach and innovate

Return ONLY valid JSON:
{
  "description": "...",
  "full_description": "...",
  "foundational": "...",
  "advancing": "...",
  "independent": "...",
  "mastery": "..."
}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.5,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI error for "${cap.name}":`, aiResponse.status, errText);
        results.push({ name: cap.name, error: `AI generation failed: ${aiResponse.status}` });
        continue;
      }

      const aiData = await aiResponse.json();
      let aiContent = aiData.choices?.[0]?.message?.content || '{}';

      // Strip markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) aiContent = jsonMatch[1];

      let generated;
      try {
        generated = JSON.parse(aiContent.trim());
      } catch (e) {
        console.error(`Failed to parse AI response for "${cap.name}":`, aiContent.substring(0, 200));
        results.push({ name: cap.name, error: 'Failed to parse AI response' });
        continue;
      }

      // Step 3: Insert capability
      const { data: newCap, error: insertError } = await supabase
        .from('capabilities')
        .insert({
          name: cap.name,
          category: cap.category,
          description: generated.description || `${cap.name} capability`,
          full_description: generated.full_description || null,
          status: 'approved',
          is_custom: false,
          created_by_company_id: cap.company_id || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`Insert error for "${cap.name}":`, insertError);
        results.push({ name: cap.name, error: insertError.message });
        continue;
      }

      // Step 4: Insert 4 level definitions
      const levels = ['foundational', 'advancing', 'independent', 'mastery'];
      const levelInserts = levels.map(level => ({
        capability_id: newCap.id,
        level,
        description: generated[level] || `${level} level of ${cap.name}`,
      }));

      const { error: levelsError } = await supabase
        .from('capability_levels')
        .insert(levelInserts);

      if (levelsError) {
        console.error(`Levels insert error for "${cap.name}":`, levelsError);
        // Capability was created but levels failed
        results.push({ name: cap.name, id: newCap.id, error: `Levels failed: ${levelsError.message}` });
        continue;
      }

      console.log(`✅ Auto-created capability "${cap.name}" (${newCap.id}) with 4 levels`);
      results.push({
        name: cap.name,
        id: newCap.id,
        created: true,
        source: cap.source || 'manual',
        had_research: !!researchContext,
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-create-capability:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
