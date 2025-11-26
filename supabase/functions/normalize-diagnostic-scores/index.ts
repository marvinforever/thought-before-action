import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { diagnosticId, batchMode } = await req.json();
    
    console.log(`Processing diagnostic normalization - ID: ${diagnosticId}, Batch: ${batchMode}`);
    
    // Get diagnostic data
    const { data: diagnostic, error: fetchError } = await supabase
      .from('diagnostic_responses')
      .select('*')
      .eq('id', diagnosticId)
      .single();
      
    if (fetchError || !diagnostic) {
      console.error('Error fetching diagnostic:', fetchError);
      throw new Error('Diagnostic not found');
    }
    
    // Prepare data for LLM
    const prompt = `You are a data normalization expert. Given the following diagnostic survey response, calculate normalized scores (0-100) for 8 key organizational health domains.

DIAGNOSTIC DATA:
${JSON.stringify(diagnostic, null, 2)}

SCORING GUIDELINES:

1. RETENTION SCORE (0-100):
- Based on: would_stay_if_offered_similar, daily_energy_level, work_life_integration_score
- Text mappings: "Definitely stay" → 90-100, "Probably stay" → 70-85, "Unsure" → 40-60, "Probably leave" → 20-40, "Definitely leave" → 0-20
- Energy level: "Very energized" → 90-100, "Somewhat energized" → 70-85, "Neutral" → 50-60, "Somewhat drained" → 30-50, "Very drained" → 0-30
- Work-life: Higher is better (scale 1-10 if numeric)

2. ENGAGEMENT SCORE (0-100):
- Based on: feels_valued, what_enjoy_most, focus_quality, confidence_score
- feels_valued: true → 80-100, false → 0-40
- Focus quality: "Excellent" → 90-100, "Good" → 70-85, "Fair" → 40-60, "Poor" → 0-40
- Confidence: Scale 1-10 or similar

3. BURNOUT SCORE (0-100, where 100 = no burnout, 0 = severe burnout):
- Based on: burnout_frequency, mental_drain_frequency, work_life_sacrifice_frequency, daily_energy_level
- Burnout frequency: "Never/Rarely" → 90-100, "Sometimes" → 60-75, "Often" → 30-50, "Always" → 0-30
- Mental drain: Same mapping
- Work-life sacrifice: Less frequent = higher score

4. MANAGER SCORE (0-100):
- Based on: manager_support_quality
- Text mappings: "Exceptional support" / "Very supportive" → 90-100, "Good support" / "Somewhat supportive" → 70-85, "Adequate" / "Neutral" → 50-60, "Poor" / "Not supportive" → 0-40

5. CAREER SCORE (0-100):
- Based on: sees_growth_path, sees_leadership_path, company_supporting_goal, growth_barrier
- Each boolean true → +25 points, false → 0 points
- If growth_barrier exists (non-null text) → -10 to -20 points depending on severity

6. CLARITY SCORE (0-100):
- Based on: role_clarity_score, has_written_job_description, confidence_score
- role_clarity_score: Scale 1-10 or similar, normalize to 0-100
- has_written_job_description: true → +20 points, false → 0 points

7. LEARNING SCORE (0-100):
- Based on: weekly_development_hours, learning_motivation, learning_preference, reads_books_articles, listens_to_podcasts, watches_youtube
- Weekly hours: 0 → 0 points, 1-2 → 40, 3-5 → 70, 6+ → 100
- Learning motivation present (non-null) → +15 points
- Each learning medium true → +5 points

8. SKILLS SCORE (0-100):
- Based on: technical_application_frequency, leadership_application_frequency, communication_application_frequency, strategic_thinking_application_frequency, adaptability_application_frequency
- Frequency mappings: "Daily/Very often" → 20 points per skill, "Weekly/Often" → 15 points, "Monthly/Sometimes" → 10 points, "Rarely" → 5 points, "Never" → 0 points
- Average across all skills

IMPORTANT:
- Handle null/missing values gracefully - use only available data
- For text values, be flexible with exact wording (e.g., "very energized" = "Very energized")
- If insufficient data for a domain, set score to null
- Return ONLY valid JSON, no markdown, no explanations

OUTPUT FORMAT (return exactly this structure):
{
  "retention_score": <number 0-100 or null>,
  "engagement_score": <number 0-100 or null>,
  "burnout_score": <number 0-100 or null>,
  "manager_score": <number 0-100 or null>,
  "career_score": <number 0-100 or null>,
  "clarity_score": <number 0-100 or null>,
  "learning_score": <number 0-100 or null>,
  "skills_score": <number 0-100 or null>
}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a data normalization expert. Return ONLY valid JSON with no markdown formatting or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse AI response (handle potential markdown wrapping)
    let scores;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      scores = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }
    
    console.log('Normalized scores:', scores);
    
    // Store normalized scores
    const { error: upsertError } = await supabase
      .from('diagnostic_scores')
      .upsert({
        profile_id: diagnostic.profile_id,
        company_id: diagnostic.company_id,
        retention_score: scores.retention_score,
        engagement_score: scores.engagement_score,
        burnout_score: scores.burnout_score,
        manager_score: scores.manager_score,
        career_score: scores.career_score,
        clarity_score: scores.clarity_score,
        learning_score: scores.learning_score,
        skills_score: scores.skills_score,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'profile_id'
      });
      
    if (upsertError) {
      console.error('Error storing scores:', upsertError);
      throw upsertError;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        profile_id: diagnostic.profile_id,
        scores 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error normalizing scores:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});