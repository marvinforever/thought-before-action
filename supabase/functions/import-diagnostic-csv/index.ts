import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVRow {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  roleClarity: string;
  hasJobDescription: string;
  mostImportantJob: string;
  confidence: string;
  naturalStrength: string;
  biggestDifficulty: string;
  skillToMaster: string;
  workload: string;
  mentalDrain: string;
  focus: string;
  workLifeSacrifice: string;
  energyDrain: string;
  burnout: string;
  learningPreference: string;
  weeklyDevHours: string;
  learningMotivation: string;
  neededTraining: string;
  growthBarrier: string;
  listens_podcasts: string;
  watches_youtube: string;
  reads_books: string;
  seesGrowthPath: string;
  managerSupport: string;
  feelsValued: string;
  energyLevel: string;
  wouldStay: string;
  retentionImprovement: string;
  seesLeadership: string;
  threeYearGoal: string;
  companySupportingGoal: string;
  workObstacle: string;
  biggestFrustration: string;
  whyPeopleLeave: string;
  whatEnjoyMost: string;
  leadershipShouldUnderstand: string;
  additionalFeedback: string;
  recentAccomplishment: string;
  recentChallenge: string;
  neededTrainingEffectiveness: string;
  twelveMonthGoal: string;
  supportFromLeadership: string;
  oneYearVision: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { csvData } = await req.json();

    if (!csvData || !Array.isArray(csvData)) {
      throw new Error('Invalid CSV data format');
    }

    const results = [];

    for (const row of csvData) {
      try {
        // Find or create profile
        let profile = await supabase
          .from('profiles')
          .select('id, company_id')
          .ilike('email', row.email.trim())
          .single();

        if (profile.error || !profile.data) {
          console.log(`Profile not found for ${row.email}, skipping...`);
          results.push({ email: row.email, status: 'skipped', reason: 'Profile not found' });
          continue;
        }

        const profileId = profile.data.id;
        const companyId = profile.data.company_id;

        // Map workload status
        const workloadMap: Record<string, string> = {
          'Very manageable': 'light',
          'Somewhat manageable': 'moderate',
          'Overwhelming': 'heavy'
        };

        // Map learning preference
        const learningMap: Record<string, string> = {
          'Reading': 'reading',
          'Videos': 'videos',
          'Online courses': 'online',
          'In-person training': 'in_person',
          'Other': 'other'
        };

        // Parse hours
        const hoursMap: Record<string, number> = {
          'Less than 1 hour': 0.5,
          '1-3 hours': 2,
          '3-5 hours': 4,
          'More than 5 hours': 6
        };

        // Convert clarity to score (1-10)
        const clarityMap: Record<string, number> = {
          'Very clear': 10,
          'Somewhat clear': 7,
          'Not clear': 3
        };

        // Insert diagnostic response
        const { error: insertError } = await supabase
          .from('diagnostic_responses')
          .insert({
            profile_id: profileId,
            company_id: companyId,
            role_clarity_score: clarityMap[row.roleClarity] || 5,
            has_written_job_description: row.hasJobDescription === '1',
            most_important_job_aspect: row.mostImportantJob,
            confidence_score: parseInt(row.confidence) || null,
            natural_strength: row.naturalStrength,
            biggest_difficulty: row.biggestDifficulty,
            skill_to_master: row.skillToMaster,
            workload_status: workloadMap[row.workload] || 'moderate',
            mental_drain_frequency: row.mentalDrain,
            focus_quality: row.focus,
            work_life_sacrifice_frequency: row.workLifeSacrifice,
            energy_drain_area: row.energyDrain,
            burnout_frequency: row.burnout,
            learning_preference: learningMap[row.learningPreference] || 'reading',
            weekly_development_hours: hoursMap[row.weeklyDevHours] || 2,
            learning_motivation: row.learningMotivation,
            needed_training: row.neededTraining,
            growth_barrier: row.growthBarrier,
            listens_to_podcasts: row.listens_podcasts === '1',
            watches_youtube: row.watches_youtube === '1',
            reads_books_articles: row.reads_books === '1',
            sees_growth_path: parseInt(row.seesGrowthPath) >= 7,
            feels_valued: parseInt(row.feelsValued) >= 7,
            sees_leadership_path: row.seesLeadership === 'Yes',
            company_supporting_goal: row.companySupportingGoal === 'Yes',
            work_life_integration_score: parseInt(row.energyLevel) || null,
            would_stay_if_offered_similar: row.wouldStay,
            retention_improvement_suggestion: row.retentionImprovement,
            three_year_goal: row.threeYearGoal,
            biggest_work_obstacle: row.workObstacle,
            biggest_frustration: row.biggestFrustration,
            why_people_leave_opinion: row.whyPeopleLeave,
            what_enjoy_most: row.whatEnjoyMost,
            leadership_should_understand: row.leadershipShouldUnderstand,
            additional_feedback: row.additionalFeedback,
            recent_accomplishment: row.recentAccomplishment,
            recent_challenge: row.recentChallenge,
            needed_training_for_effectiveness: row.neededTrainingEffectiveness,
            twelve_month_growth_goal: row.twelveMonthGoal,
            support_needed_from_leadership: row.supportFromLeadership,
            one_year_vision: row.oneYearVision,
            submitted_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Error inserting diagnostic for ${row.email}:`, insertError);
          results.push({ email: row.email, status: 'error', error: insertError.message });
        } else {
          results.push({ email: row.email, status: 'success' });
        }
      } catch (rowError) {
        console.error(`Error processing row for ${row.email}:`, rowError);
        results.push({ email: row.email, status: 'error', error: String(rowError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error importing diagnostic data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
