import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const companyId = '971e5580-4c3f-4645-b25d-74d92ba7083a'
    const tempPass = 'TempPass123!'

    const employees = [
      { email: "tfloreydfc@bektel.com", full_name: "Tristan Florey", phone: "+17012090535" },
      { email: "cschmitzdfc@bektel.com", full_name: "Cordell Schmitz", phone: "+17014267520" },
      { email: "apeppledfc@bektel.com", full_name: "Aaron Pepple", phone: "+17015705882" },
      { email: "tstantondfc@bektel.com", full_name: "Travis Stanton", phone: "+12188495668" },
      { email: "andrewkreidt@gmail.com", full_name: "Andrew Kreidt", phone: "+17012265980" }
    ]

    const results = []
    
    for (const emp of employees) {
      try {
        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: emp.email.toLowerCase().trim(),
          password: tempPass,
          email_confirm: true,
          user_metadata: {
            full_name: emp.full_name
          }
        })

        let userId: string
        
        if (authError?.code === 'email_exists') {
          // Find existing user
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
          const existingUser = users.find(u => u.email?.toLowerCase() === emp.email.toLowerCase())
          if (!existingUser) throw new Error('User exists but not found')
          userId = existingUser.id
        } else if (authError) {
          throw authError
        } else {
          userId = authUser.user.id
        }

        // Upsert profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: emp.email.toLowerCase(),
            full_name: emp.full_name,
            phone: emp.phone,
            role: 'Manager',
            company_id: companyId,
            is_admin: false
          }, { onConflict: 'id' })

        if (profileError) throw profileError

        results.push({ email: emp.email, success: true, id: userId })
      } catch (error: any) {
        results.push({ email: emp.email, success: false, error: error.message })
      }
    }

    // Now insert diagnostics
    const diagnosticsInserted = await insertDiagnostics(supabaseAdmin, companyId)

    return new Response(
      JSON.stringify({ results, diagnosticsInserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function insertDiagnostics(supabase: any, companyId: string) {
  const diagnostics = [
    {
      email: "tfloreydfc@bektel.com",
      data: {
        role_clarity_score: 9, has_written_job_description: false,
        most_important_job_aspect: 'Growing the business and team building with my employees to make a more efficient and happy work place environment',
        confidence_score: 7, natural_strength: 'One on one talks with my customers. Problem solving',
        biggest_difficulty: 'Employee management at times.', skill_to_master: 'Being a better leader.',
        workload_status: 'manageable', burnout_frequency: 'Occasionally (monthly)',
        learning_preference: 'visual', weekly_development_hours: 2, learning_motivation: 'Skill improvement',
        needed_training: 'Time management. Team leading.', growth_barrier: 'Health.',
        listens_to_podcasts: true, watches_youtube: false, reads_books_articles: true,
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: 10,
        retention_improvement_suggestion: 'The company itself is doing a great job. Honestly I feel there is nothing they need to do to keep me long term.',
        sees_leadership_path: true, three_year_goal: 'To become a better manager and salesman.',
        company_supporting_goal: true, biggest_work_obstacle: 'My own self.',
        biggest_frustration: 'Unsure at this time.', why_people_leave_opinion: 'Burned out.',
        what_enjoy_most: 'The people, and the challenges',
        leadership_should_understand: 'I think my leaders understand my experience very well.',
        recent_accomplishment: 'The growth of the business as a whole.',
        recent_challenge: 'Influx of customers having more issues this year than previous years.',
        needed_training_for_effectiveness: 'Being a better leader',
        twelve_month_growth_goal: 'Health and leadership',
        support_needed_from_leadership: 'My leaders are doing a great job. The Momentum company is one of the resources they provided me with.',
        one_year_vision: 'Lost weight, became a better leader, grew the business.',
        typeform_response_id: 'b4uwqapqba2cb4uiscvx1mv9vxbhiscc',
        typeform_start_date: '2025-10-08 13:53:23', typeform_submit_date: '2025-10-08 14:26:18',
        mental_drain_frequency: 'Sometimes', focus_quality: 'Very well',
        work_life_sacrifice_frequency: 'Sometimes',
        energy_drain_area: 'Mainly it\'s during the busy times of the year. If I feel we are falling behind I will stay at work and try to get as much done in a day as possible.',
        daily_energy_level: 7, manager_support_quality: 'Excellent'
      }
    },
    // Add other 4 employees similarly...
  ]

  let count = 0
  for (const diag of diagnostics) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', diag.email)
      .eq('company_id', companyId)
      .single()

    if (profile) {
      await supabase.from('diagnostic_responses').insert({
        company_id: companyId,
        profile_id: profile.id,
        submitted_at: new Date().toISOString(),
        ...diag.data
      })
      count++
    }
  }
  
  return count
}
