import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deterministic scoring functions
const calculateRetentionScore = (d: any): number | null => {
  const scores: number[] = [];
  
  // would_stay_if_offered_similar (0-100)
  const stayText = d.would_stay_if_offered_similar?.toLowerCase() || '';
  if (stayText.includes('definitely stay')) scores.push(95);
  else if (stayText.includes('probably stay')) scores.push(78);
  else if (stayText.includes('unsure')) scores.push(50);
  else if (stayText.includes('probably leave')) scores.push(30);
  else if (stayText.includes('definitely leave')) scores.push(10);
  
  // daily_energy_level (0-100)
  const energyText = d.daily_energy_level?.toLowerCase() || '';
  if (energyText.includes('very energized') || energyText.includes('energized')) scores.push(95);
  else if (energyText.includes('somewhat energized')) scores.push(78);
  else if (energyText.includes('neutral')) scores.push(55);
  else if (energyText.includes('somewhat drained')) scores.push(40);
  else if (energyText.includes('very drained') || energyText.includes('drained')) scores.push(15);
  
  // work_life_integration_score (scale to 0-100)
  if (d.work_life_integration_score !== null && d.work_life_integration_score !== undefined) {
    scores.push(d.work_life_integration_score * 10);
  }
  
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
};

const calculateEngagementScore = (d: any): number | null => {
  const scores: number[] = [];
  
  // feels_valued (0-100)
  if (d.feels_valued === true) scores.push(90);
  else if (d.feels_valued === false) scores.push(20);
  
  // focus_quality (0-100)
  const focusText = d.focus_quality?.toLowerCase() || '';
  if (focusText.includes('excellent')) scores.push(95);
  else if (focusText.includes('good')) scores.push(78);
  else if (focusText.includes('fair')) scores.push(50);
  else if (focusText.includes('poor')) scores.push(20);
  
  // confidence_score (scale to 0-100)
  if (d.confidence_score !== null && d.confidence_score !== undefined) {
    scores.push(d.confidence_score * 10);
  }
  
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
};

const calculateBurnoutScore = (d: any): number | null => {
  const scores: number[] = [];
  
  // burnout_frequency (0-100, higher = less burnout)
  const burnoutText = d.burnout_frequency?.toLowerCase() || '';
  if (burnoutText.includes('never') || burnoutText.includes('rarely')) scores.push(95);
  else if (burnoutText.includes('sometimes') || burnoutText.includes('occasionally')) scores.push(68);
  else if (burnoutText.includes('often') || burnoutText.includes('frequently')) scores.push(40);
  else if (burnoutText.includes('always') || burnoutText.includes('constantly')) scores.push(15);
  
  // mental_drain_frequency (0-100, higher = less drain)
  const drainText = d.mental_drain_frequency?.toLowerCase() || '';
  if (drainText.includes('never') || drainText.includes('rarely')) scores.push(95);
  else if (drainText.includes('sometimes') || drainText.includes('occasionally')) scores.push(68);
  else if (drainText.includes('often') || drainText.includes('frequently')) scores.push(40);
  else if (drainText.includes('always') || drainText.includes('constantly')) scores.push(15);
  
  // work_life_sacrifice_frequency (0-100, higher = less sacrifice)
  const sacrificeText = d.work_life_sacrifice_frequency?.toLowerCase() || '';
  if (sacrificeText.includes('never') || sacrificeText.includes('rarely')) scores.push(95);
  else if (sacrificeText.includes('sometimes') || sacrificeText.includes('occasionally')) scores.push(68);
  else if (sacrificeText.includes('often') || sacrificeText.includes('frequently')) scores.push(40);
  else if (sacrificeText.includes('always') || sacrificeText.includes('constantly')) scores.push(15);
  
  // daily_energy_level contributes to burnout too
  const energyText = d.daily_energy_level?.toLowerCase() || '';
  if (energyText.includes('very energized') || energyText.includes('energized')) scores.push(95);
  else if (energyText.includes('somewhat energized')) scores.push(78);
  else if (energyText.includes('neutral')) scores.push(55);
  else if (energyText.includes('somewhat drained')) scores.push(40);
  else if (energyText.includes('very drained') || energyText.includes('drained')) scores.push(15);
  
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
};

const calculateManagerScore = (d: any): number | null => {
  // Handle both numeric (1-10) and text values
  if (typeof d.manager_support_quality === 'number') {
    return Math.round(d.manager_support_quality * 10);
  }
  
  const managerText = d.manager_support_quality?.toLowerCase() || '';
  if (managerText.includes('exceptional') || managerText.includes('very supportive')) return 95;
  else if (managerText.includes('good support') || managerText.includes('somewhat supportive')) return 78;
  else if (managerText.includes('adequate') || managerText.includes('neutral')) return 55;
  else if (managerText.includes('poor') || managerText.includes('not supportive')) return 20;
  
  return null;
};

const calculateCareerScore = (d: any): number | null => {
  let score = 0;
  let hasData = false;
  
  // Each boolean = 25 points
  if (d.sees_growth_path === true) { score += 25; hasData = true; }
  if (d.sees_leadership_path === true) { score += 25; hasData = true; }
  if (d.company_supporting_goal === true) { score += 25; hasData = true; }
  
  // Has written job description adds clarity
  if (d.has_written_job_description === true) { score += 25; hasData = true; }
  
  // Growth barrier penalty
  if (d.growth_barrier && d.growth_barrier.length > 0) {
    score -= 15;
    hasData = true;
  }
  
  return hasData ? Math.max(0, Math.min(100, score)) : null;
};

const calculateClarityScore = (d: any): number | null => {
  const scores: number[] = [];
  
  // role_clarity_score (scale to 0-100)
  if (d.role_clarity_score !== null && d.role_clarity_score !== undefined) {
    scores.push(d.role_clarity_score * 10);
  }
  
  // has_written_job_description bonus
  if (d.has_written_job_description === true) scores.push(100);
  else if (d.has_written_job_description === false) scores.push(0);
  
  // confidence_score contributes to clarity
  if (d.confidence_score !== null && d.confidence_score !== undefined) {
    scores.push(d.confidence_score * 10);
  }
  
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
};

const calculateLearningScore = (d: any): number | null => {
  let score = 0;
  let hasData = false;
  
  // Weekly development hours (0 = 0, 1-2 = 40, 3-5 = 70, 6+ = 100)
  if (d.weekly_development_hours !== null && d.weekly_development_hours !== undefined) {
    const hours = d.weekly_development_hours;
    if (hours === 0) score = 0;
    else if (hours <= 2) score = 40;
    else if (hours <= 5) score = 70;
    else score = 100;
    hasData = true;
  }
  
  // Learning motivation present (+15)
  if (d.learning_motivation && d.learning_motivation.length > 0) {
    score += 15;
    hasData = true;
  }
  
  // Each learning medium (+5)
  if (d.reads_books_articles === true) { score += 5; hasData = true; }
  if (d.listens_to_podcasts === true) { score += 5; hasData = true; }
  if (d.watches_youtube === true) { score += 5; hasData = true; }
  
  return hasData ? Math.min(100, score) : null;
};

const calculateSkillsScore = (d: any): number | null => {
  const scores: number[] = [];
  
  const scoreFrequency = (freq: string): number => {
    const text = freq?.toLowerCase() || '';
    if (text.includes('daily') || text.includes('very often')) return 20;
    if (text.includes('weekly') || text.includes('often')) return 15;
    if (text.includes('monthly') || text.includes('sometimes')) return 10;
    if (text.includes('rarely')) return 5;
    if (text.includes('never')) return 0;
    return 0;
  };
  
  // Score each skill frequency
  if (d.technical_application_frequency) scores.push(scoreFrequency(d.technical_application_frequency));
  if (d.leadership_application_frequency) scores.push(scoreFrequency(d.leadership_application_frequency));
  if (d.communication_application_frequency) scores.push(scoreFrequency(d.communication_application_frequency));
  if (d.strategic_thinking_application_frequency) scores.push(scoreFrequency(d.strategic_thinking_application_frequency));
  if (d.adaptability_application_frequency) scores.push(scoreFrequency(d.adaptability_application_frequency));
  
  // Convert to 0-100 scale (max possible is 5 skills * 20 = 100)
  return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 5) : null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
    
    // Calculate all scores deterministically
    const scores = {
      retention_score: calculateRetentionScore(diagnostic),
      engagement_score: calculateEngagementScore(diagnostic),
      burnout_score: calculateBurnoutScore(diagnostic),
      manager_score: calculateManagerScore(diagnostic),
      career_score: calculateCareerScore(diagnostic),
      clarity_score: calculateClarityScore(diagnostic),
      learning_score: calculateLearningScore(diagnostic),
      skills_score: calculateSkillsScore(diagnostic),
    };
    
    console.log('Calculated scores:', scores);
    
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
