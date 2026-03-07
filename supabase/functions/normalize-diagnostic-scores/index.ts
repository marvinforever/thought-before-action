import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Spec-aligned scoring formulas (same as chat-with-jericho) ──────────────

/**
 * If the diagnostic was submitted via Jericho chat, `additional_responses.normalized_scores`
 * contains pre-normalized 0-100 values for every input. We use these with the spec formulas.
 * Otherwise we fall back to text-parsing heuristics for legacy data.
 */

// ── Helpers for text-based fallback ────────────────────────────────────────

const normalizeRoleClarity = (value: string | undefined): number | null => {
  switch (value) {
    case 'very_clear': return 100;
    case 'somewhat_clear': return 70;
    case 'not_clear': return 30;
    default: return null;
  }
};

const normalizeYesNo = (value: any): number | null => {
  if (value === true || value === 'yes') return 100;
  if (value === false || value === 'no') return 0;
  return null;
};

const normalizeFrequency = (value: string | undefined): number | null => {
  const text = (value || '').toLowerCase();
  if (text.includes('never')) return 95;
  if (text.includes('rarely') || text.includes('less than monthly')) return 80;
  if (text.includes('sometimes') || text.includes('occasionally') || text.includes('monthly')) return 55;
  if (text.includes('often') || text.includes('frequently') || text.includes('weekly')) return 30;
  if (text.includes('always') || text.includes('constantly')) return 10;
  return null;
};

const normalizeWorkload = (value: string | undefined): number | null => {
  const text = (value || '').toLowerCase().trim();
  if (text === 'very_manageable' || text === 'very manageable') return 90;
  if (text === 'manageable' || text === 'somewhat_manageable' || text === 'somewhat manageable') return 70;
  if (text === 'stretched') return 50;
  if (text === 'not_manageable' || text === 'not manageable' || text === 'overwhelmed') return 25;
  if (text === 'unsustainable') return 10;
  return null;
};

const normalizeEnergized = (value: string | undefined): number | null => {
  const text = (value || '').toLowerCase().trim();
  // Handle numeric values (1-10 scale stored as text)
  const num = parseFloat(text);
  if (!isNaN(num) && num >= 1 && num <= 10) {
    return Math.round(num * 10);
  }
  if (text.includes('very_energized') || text.includes('very energized') || text === 'high') return 90;
  if (text.includes('somewhat_energized') || text.includes('somewhat energized') || text === 'medium') return 60;
  if (text.includes('not_energized') || text.includes('not energized') || text.includes('drained') || text === 'low') return 30;
  if (text.includes('neutral')) return 50;
  return null;
};

const normalizeScale10 = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return null;
  return Math.round(num * 10);
};

const normalizeDevTime = (value: string | undefined): number | null => {
  switch (value) {
    case 'less_than_1_hour': return 20;
    case '1_to_3_hours': return 50;
    case '4_to_6_hours': return 75;
    case '7_plus_hours': return 90;
    default: return null;
  }
};

// ── Average helper that skips nulls ────────────────────────────────────────

const avg = (...values: (number | null)[]): number | null => {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
};

// ── Spec formula calculator ────────────────────────────────────────────────

interface NormalizedInputs {
  role_clarity: number | null;
  job_description: number | null;
  confidence: number | null;
  workload: number | null;
  mentally_drained: number | null;
  sacrifice: number | null;
  burned_out: number | null;
  development_time: number | null;
  clear_path: number | null;
  manager_support: number | null;
  feel_valued: number | null;
  energized: number | null;
  stay: number | null;
  org_helping: number | null;
}

function calculateFromSpec(inputs: NormalizedInputs) {
  return {
    clarity_score: inputs.role_clarity,
    skills_score: inputs.confidence,
    engagement_score: avg(inputs.energized, inputs.feel_valued),
    manager_score: inputs.manager_support,
    career_score: avg(inputs.clear_path, inputs.org_helping),
    retention_score: inputs.stay,
    burnout_score: avg(inputs.mentally_drained, inputs.sacrifice, inputs.burned_out, inputs.workload),
    learning_score: inputs.development_time,
  };
}

// ── Extract normalized inputs from raw Jericho-stored values ───────────────

function extractFromNormalizedScores(ns: any): NormalizedInputs {
  return {
    role_clarity: ns.role_clarity ?? null,
    job_description: ns.job_description ?? null,
    confidence: ns.confidence ?? null,
    workload: ns.workload ?? null,
    mentally_drained: ns.mentally_drained ?? null,
    sacrifice: ns.sacrifice ?? null,
    burned_out: ns.burned_out ?? null,
    development_time: ns.development_time ?? null,
    clear_path: ns.clear_path ?? null,
    manager_support: ns.manager_support ?? null,
    feel_valued: ns.feel_valued ?? null,
    energized: ns.energized ?? null,
    stay: ns.stay ?? null,
    org_helping: ns.org_helping ?? null,
  };
}

// ── Extract normalized inputs from legacy text-based diagnostic_responses ──

function extractFromTextFields(d: any): NormalizedInputs {
  // role_clarity_score is stored as 1-10 scale
  const roleClarityRaw = d.role_clarity_score;
  let roleClarity: number | null = null;
  if (typeof roleClarityRaw === 'string') {
    roleClarity = normalizeRoleClarity(roleClarityRaw);
  } else {
    roleClarity = normalizeScale10(roleClarityRaw);
  }

  return {
    role_clarity: roleClarity,
    job_description: normalizeYesNo(d.has_written_job_description),
    confidence: normalizeScale10(d.confidence_score),
    workload: d.workload_status ? normalizeWorkload(d.workload_status) : null,
    mentally_drained: normalizeFrequency(d.mental_drain_frequency),
    sacrifice: normalizeFrequency(d.work_life_sacrifice_frequency),
    burned_out: normalizeFrequency(d.burnout_frequency),
    development_time: d.weekly_development_hours !== null && d.weekly_development_hours !== undefined
      ? (d.weekly_development_hours <= 1 ? 20 : d.weekly_development_hours <= 3 ? 50 : d.weekly_development_hours <= 6 ? 75 : 90)
      : null,
    clear_path: d.sees_growth_path === true ? 80 : d.sees_growth_path === false ? 30 : normalizeScale10(d.clear_path_growth),
    manager_support: (() => {
      const raw = d.manager_support_quality;
      if (raw === null || raw === undefined) return null;
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!isNaN(num) && num >= 1 && num <= 10) return Math.round(num * 10);
      if (typeof raw === 'string') {
        if (raw.includes('very_supportive') || raw.includes('very supportive')) return 90;
        if (raw.includes('somewhat_supportive') || raw.includes('somewhat supportive')) return 65;
        if (raw.includes('not_supportive') || raw.includes('not supportive')) return 25;
      }
      return null;
    })(),
    feel_valued: d.feels_valued === true ? 80 : d.feels_valued === false ? 25 : normalizeScale10(d.feel_valued),
    energized: normalizeEnergized(d.daily_energy_level),
    stay: (() => {
      const raw = d.would_stay_if_offered_similar;
      if (raw === 'yes' || raw === 'definitely stay') return 90;
      if (raw === 'maybe' || raw === 'probably stay') return 60;
      if (raw === 'no' || raw === 'probably leave') return 25;
      // Handle numeric values (1-10 scale)
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!isNaN(num) && num >= 1 && num <= 10) return Math.round(num * 10);
      return normalizeScale10(d.retention_likelihood);
    })(),
    org_helping: normalizeYesNo(d.company_supporting_goal),
  };
}

// ── Main handler ───────────────────────────────────────────────────────────

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

    const { data: diagnostic, error: fetchError } = await supabase
      .from('diagnostic_responses')
      .select('*')
      .eq('id', diagnosticId)
      .single();

    if (fetchError || !diagnostic) {
      console.error('Error fetching diagnostic:', fetchError);
      throw new Error('Diagnostic not found');
    }

    // Prefer pre-normalized scores from Jericho chat, fall back to text fields
    const normalizedScores = diagnostic.additional_responses?.normalized_scores;
    let inputs: NormalizedInputs;

    if (normalizedScores && Object.keys(normalizedScores).length > 0) {
      console.log('Using pre-normalized scores from Jericho chat');
      inputs = extractFromNormalizedScores(normalizedScores);
    } else {
      console.log('Falling back to text-field extraction');
      inputs = extractFromTextFields(diagnostic);
    }

    const scores = calculateFromSpec(inputs);
    console.log('Calculated scores (spec-aligned):', scores);

    const { error: upsertError } = await supabase
      .from('diagnostic_scores')
      .upsert({
        profile_id: diagnostic.profile_id,
        company_id: diagnostic.company_id,
        ...scores,
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
