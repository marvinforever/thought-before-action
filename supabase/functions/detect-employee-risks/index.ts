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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting employee risk detection...');

    // Get all active employees with diagnostic data
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        company_id,
        diagnostic_responses (
          burnout_frequency,
          work_life_integration_score,
          confidence_score,
          role_clarity_score,
          sees_growth_path,
          would_stay_if_offered_similar,
          daily_energy_level,
          mental_drain_frequency,
          submitted_at
        )
      `)
      .not('company_id', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles.length} profiles to analyze`);

    const riskFlags = [];

    for (const profile of profiles) {
      if (!profile.diagnostic_responses || profile.diagnostic_responses.length === 0) {
        continue;
      }

      const diagnostic = profile.diagnostic_responses[0];
      const risks = [];

      // Check for BURNOUT
      const burnoutScore = calculateBurnoutScore(diagnostic);
      if (burnoutScore >= 70) {
        risks.push({
          profile_id: profile.id,
          company_id: profile.company_id,
          risk_type: 'burnout',
          risk_level: burnoutScore >= 85 ? 'critical' : 'moderate',
          risk_score: burnoutScore,
          notes: generateBurnoutNotes(diagnostic)
        });
      }

      // Check for FLIGHT RISK
      const flightRiskScore = calculateFlightRiskScore(diagnostic);
      if (flightRiskScore >= 60) {
        risks.push({
          profile_id: profile.id,
          company_id: profile.company_id,
          risk_type: 'flight_risk',
          risk_level: flightRiskScore >= 80 ? 'critical' : 'moderate',
          risk_score: flightRiskScore,
          notes: generateFlightRiskNotes(diagnostic)
        });
      }

      // Check for DISENGAGEMENT
      const disengagementScore = calculateDisengagementScore(diagnostic);
      if (disengagementScore >= 65) {
        risks.push({
          profile_id: profile.id,
          company_id: profile.company_id,
          risk_type: 'disengaged',
          risk_level: disengagementScore >= 80 ? 'critical' : 'moderate',
          risk_score: disengagementScore,
          notes: generateDisengagementNotes(diagnostic)
        });
      }

      // Check for UNCLEAR PATH
      const unclearPathScore = calculateUnclearPathScore(diagnostic);
      if (unclearPathScore >= 70) {
        risks.push({
          profile_id: profile.id,
          company_id: profile.company_id,
          risk_type: 'unclear_path',
          risk_level: unclearPathScore >= 85 ? 'critical' : 'moderate',
          risk_score: unclearPathScore,
          notes: generateUnclearPathNotes(diagnostic)
        });
      }

      riskFlags.push(...risks);
    }

    console.log(`Identified ${riskFlags.length} risk flags`);

    // Resolve old flags that no longer apply
    const { error: resolveError } = await supabase
      .from('employee_risk_flags')
      .update({ resolved_at: new Date().toISOString() })
      .is('resolved_at', null)
      .lt('detected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Insert new risk flags
    if (riskFlags.length > 0) {
      const { error: insertError } = await supabase
        .from('employee_risk_flags')
        .insert(riskFlags);

      if (insertError) {
        console.error('Error inserting risk flags:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        risksDetected: riskFlags.length,
        breakdown: {
          burnout: riskFlags.filter(r => r.risk_type === 'burnout').length,
          flight_risk: riskFlags.filter(r => r.risk_type === 'flight_risk').length,
          disengaged: riskFlags.filter(r => r.risk_type === 'disengaged').length,
          unclear_path: riskFlags.filter(r => r.risk_type === 'unclear_path').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in detect-employee-risks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Risk Calculation Functions
function calculateBurnoutScore(diagnostic: any): number {
  let score = 0;
  
  // Burnout frequency (0-40 points)
  const burnoutFreq = diagnostic.burnout_frequency?.toLowerCase() || '';
  if (burnoutFreq.includes('always') || burnoutFreq.includes('very often')) score += 40;
  else if (burnoutFreq.includes('often')) score += 30;
  else if (burnoutFreq.includes('sometimes')) score += 15;
  
  // Work-life integration (0-30 points) - inverse scoring
  const workLifeScore = diagnostic.work_life_integration_score || 5;
  score += (10 - workLifeScore) * 3;
  
  // Mental drain (0-20 points)
  const mentalDrain = diagnostic.mental_drain_frequency?.toLowerCase() || '';
  if (mentalDrain.includes('always') || mentalDrain.includes('daily')) score += 20;
  else if (mentalDrain.includes('often')) score += 15;
  else if (mentalDrain.includes('sometimes')) score += 10;
  
  // Energy level (0-10 points) - inverse scoring
  const energyLevel = diagnostic.daily_energy_level?.toLowerCase() || '';
  if (energyLevel.includes('very low') || energyLevel.includes('exhausted')) score += 10;
  else if (energyLevel.includes('low')) score += 5;
  
  return Math.min(score, 100);
}

function calculateFlightRiskScore(diagnostic: any): number {
  let score = 0;
  
  // Would stay if offered similar (0-50 points) - inverse scoring
  const wouldStay = diagnostic.would_stay_if_offered_similar?.toLowerCase() || '';
  if (wouldStay.includes('definitely not') || wouldStay.includes('no')) score += 50;
  else if (wouldStay.includes('probably not') || wouldStay.includes('unsure')) score += 35;
  else if (wouldStay.includes('maybe')) score += 20;
  
  // Sees growth path (0-30 points)
  if (diagnostic.sees_growth_path === false) score += 30;
  
  // Confidence score (0-20 points) - inverse scoring
  const confidenceScore = diagnostic.confidence_score || 5;
  score += (10 - confidenceScore) * 2;
  
  return Math.min(score, 100);
}

function calculateDisengagementScore(diagnostic: any): number {
  let score = 0;
  
  // Energy level (0-35 points) - inverse scoring
  const energyLevel = diagnostic.daily_energy_level?.toLowerCase() || '';
  if (energyLevel.includes('very low') || energyLevel.includes('exhausted')) score += 35;
  else if (energyLevel.includes('low')) score += 25;
  else if (energyLevel.includes('moderate') || energyLevel.includes('ok')) score += 15;
  
  // Confidence score (0-35 points) - inverse scoring
  const confidenceScore = diagnostic.confidence_score || 5;
  score += (10 - confidenceScore) * 3.5;
  
  // Role clarity (0-30 points) - inverse scoring
  const roleClarity = diagnostic.role_clarity_score || 5;
  score += (10 - roleClarity) * 3;
  
  return Math.min(score, 100);
}

function calculateUnclearPathScore(diagnostic: any): number {
  let score = 0;
  
  // Sees growth path (0-40 points)
  if (diagnostic.sees_growth_path === false) score += 40;
  
  // Role clarity (0-35 points) - inverse scoring
  const roleClarity = diagnostic.role_clarity_score || 5;
  score += (10 - roleClarity) * 3.5;
  
  // Confidence in company supporting goal (0-25 points)
  if (diagnostic.company_supporting_goal === false) score += 25;
  
  return Math.min(score, 100);
}

// Notes Generation Functions
function generateBurnoutNotes(diagnostic: any): string {
  const signals = [];
  
  if (diagnostic.burnout_frequency?.toLowerCase().includes('often') || 
      diagnostic.burnout_frequency?.toLowerCase().includes('always')) {
    signals.push('frequent burnout reported');
  }
  
  if (diagnostic.work_life_integration_score < 5) {
    signals.push('poor work-life balance');
  }
  
  if (diagnostic.mental_drain_frequency?.toLowerCase().includes('often') ||
      diagnostic.mental_drain_frequency?.toLowerCase().includes('daily')) {
    signals.push('high mental drain');
  }
  
  return `Burnout indicators: ${signals.join(', ')}. Immediate intervention recommended.`;
}

function generateFlightRiskNotes(diagnostic: any): string {
  const signals = [];
  
  if (!diagnostic.sees_growth_path) {
    signals.push('no clear growth path');
  }
  
  if (diagnostic.would_stay_if_offered_similar?.toLowerCase().includes('not')) {
    signals.push('open to leaving');
  }
  
  if (diagnostic.confidence_score < 5) {
    signals.push('low confidence');
  }
  
  return `Flight risk indicators: ${signals.join(', ')}. Build 3-year growth plan urgently.`;
}

function generateDisengagementNotes(diagnostic: any): string {
  const signals = [];
  
  if (diagnostic.daily_energy_level?.toLowerCase().includes('low')) {
    signals.push('low energy');
  }
  
  if (diagnostic.confidence_score < 5) {
    signals.push('low confidence');
  }
  
  if (diagnostic.role_clarity_score < 5) {
    signals.push('unclear role expectations');
  }
  
  return `Disengagement signals: ${signals.join(', ')}. Re-engage through capability development.`;
}

function generateUnclearPathNotes(diagnostic: any): string {
  const signals = [];
  
  if (!diagnostic.sees_growth_path) {
    signals.push('no visible growth path');
  }
  
  if (diagnostic.role_clarity_score < 5) {
    signals.push('unclear role expectations');
  }
  
  if (!diagnostic.company_supporting_goal) {
    signals.push('feels unsupported in goals');
  }
  
  return `Path clarity issues: ${signals.join(', ')}. Schedule career conversation ASAP.`;
}