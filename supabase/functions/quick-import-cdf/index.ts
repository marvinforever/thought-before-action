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
      { email: "andrewkreidt@gmail.com", full_name: "Andrew Kreidt", phone: "+17012265980" },
      { email: "amuslanddfc@ndsupernet.com", full_name: "Austin Musland", phone: "+17018906223" }
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
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: '10',
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
        daily_energy_level: '7', manager_support_quality: 'Excellent'
      }
    },
    {
      email: "cschmitzdfc@bektel.com",
      data: {
        role_clarity_score: 7, has_written_job_description: false,
        most_important_job_aspect: 'Helping grow the business by assisting the managers to be more efficient, confident and effective. Also to help take things off my boss\'s plate to allow him to more effectively manage the company and look at bigger opportunities.',
        confidence_score: 8, natural_strength: 'Consulting with other peers and figuring out efficient ways to make their job/life easier.',
        biggest_difficulty: 'Learning the expectations of the role, without stepping over the line of what I was expected to do',
        skill_to_master: 'Efficiency/time management', workload_status: 'manageable', burnout_frequency: 'Rarely (less than monthly)',
        learning_preference: 'reading', weekly_development_hours: 2, learning_motivation: 'Skill improvement',
        needed_training: 'Time management', growth_barrier: 'Clarity on the professional side',
        listens_to_podcasts: false, watches_youtube: false, reads_books_articles: true,
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: '10',
        retention_improvement_suggestion: 'They have', sees_leadership_path: true,
        three_year_goal: 'Continue to grow effectively into the new role and expand my capabilities for the company',
        company_supporting_goal: true,
        biggest_frustration: 'Clarify or defined expectations and goals',
        why_people_leave_opinion: 'Previously I believe it was due to staffing limitations',
        what_enjoy_most: 'Excellent culture, treated like a person instead of a number, growth mindset',
        leadership_should_understand: 'Think they have done well here',
        recent_accomplishment: 'Expanded role',
        recent_challenge: 'Helping staff transition into their new roles or having new leadership',
        needed_training_for_effectiveness: 'Role transition, and how to provide clarity to staff on our expectations of them',
        twelve_month_growth_goal: 'To build the relationships with peers that I worked beside and am now their "boss". To have the relationship good enough they\'ll still communicate and be open with me.',
        support_needed_from_leadership: 'Clarity',
        one_year_vision: 'Grown into a great father and husband, while expanding my capabilities for the company',
        typeform_response_id: 'mf1e6eq5f2h8buibvc49mf1e6e3ykany',
        typeform_start_date: '2025-10-08 13:14:09', typeform_submit_date: '2025-10-08 14:04:56',
        mental_drain_frequency: 'Sometimes', focus_quality: 'Moderately well',
        work_life_sacrifice_frequency: 'Sometimes',
        energy_drain_area: 'Personnel management',
        daily_energy_level: '10', manager_support_quality: 'Excellent'
      }
    },
    {
      email: "apeppledfc@bektel.com",
      data: {
        role_clarity_score: 10, has_written_job_description: true,
        most_important_job_aspect: 'Leading the people on my team to help reach my goals',
        confidence_score: 9, natural_strength: 'Talking to customers',
        biggest_difficulty: 'Dealing with employees', skill_to_master: 'Being a better leader',
        workload_status: 'manageable', burnout_frequency: 'Frequently (weekly)',
        learning_preference: 'mixed', weekly_development_hours: 2, learning_motivation: 'Personal interest',
        needed_training: 'Patience', growth_barrier: 'Available time',
        listens_to_podcasts: true, watches_youtube: true, reads_books_articles: true,
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: '10',
        retention_improvement_suggestion: 'Find more help', sees_leadership_path: true,
        three_year_goal: 'I want to be the largest location within dfc',
        company_supporting_goal: true,
        biggest_work_obstacle: 'Being understaffed and not being able to spend time doing the things I should be doing',
        biggest_frustration: 'My biggest frustration is not having enough help',
        why_people_leave_opinion: 'The hours and schedule',
        what_enjoy_most: 'I love everything about agriculture and I enjoy helping my customers raise a crop and be successful',
        leadership_should_understand: 'I feel like they understand my experience very well but I would say just how overwhelming are days are with lack of help',
        recent_accomplishment: 'My sales numbers',
        recent_challenge: 'Lack of help, experienced help, or help that wants to be there and better themselves',
        needed_training_for_effectiveness: 'For me it would being able to be more patient and how to lead my team better',
        twelve_month_growth_goal: 'I would like to implement some of the things I learned in the in-person training event and become a better leader.',
        support_needed_from_leadership: 'I feel I have the resources and support I just need to take the time to work on the things I need to',
        one_year_vision: 'Professionally I would like to grow my business and personally learning to take the time to enjoy life',
        typeform_response_id: 'jltonuwk7wrck9ysv4jltonm5m62fx61',
        typeform_start_date: '2025-10-08 02:09:41', typeform_submit_date: '2025-10-08 02:30:02',
        mental_drain_frequency: 'Always', focus_quality: 'Very well',
        work_life_sacrifice_frequency: 'Often',
        energy_drain_area: 'Employees',
        daily_energy_level: '8', manager_support_quality: 'Good'
      }
    },
    {
      email: "tstantondfc@bektel.com",
      data: {
        role_clarity_score: 10, has_written_job_description: true,
        most_important_job_aspect: 'Managing and growing our business while keeping the customers best interests in mind.',
        confidence_score: 8, natural_strength: 'Agronomic advice',
        biggest_difficulty: 'Keeping track of the some of the numbers in the business',
        skill_to_master: 'Managing people and keeping the business growing',
        workload_status: 'very_manageable', burnout_frequency: 'Occasionally (monthly)',
        learning_preference: 'hands_on', weekly_development_hours: 2, learning_motivation: 'Skill improvement',
        needed_training: 'time management for myself and employees',
        growth_barrier: 'Time of year and my own distractions',
        listens_to_podcasts: true, watches_youtube: true, reads_books_articles: true,
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: '10',
        retention_improvement_suggestion: 'NA', sees_leadership_path: true,
        three_year_goal: 'Grow the business by 3 million dollars',
        company_supporting_goal: true,
        biggest_work_obstacle: 'Time management is',
        biggest_frustration: 'things that are out of my control',
        why_people_leave_opinion: 'career advancement',
        what_enjoy_most: 'the culture',
        leadership_should_understand: 'I am capable of certain tasks and would like to handle them',
        recent_accomplishment: 'growing the business and meeting goals i set for myself',
        recent_challenge: 'weather and prices',
        needed_training_for_effectiveness: 'not sure',
        twelve_month_growth_goal: 'keeping a healthy work life balance',
        support_needed_from_leadership: 'help training young staff',
        one_year_vision: 'id have been a more engaged husband and still managed to grow the business',
        typeform_response_id: 'o93i8ye22mzgex3mo93i89xfcfutl0ww',
        typeform_start_date: '2025-10-07 17:40:15', typeform_submit_date: '2025-10-07 17:52:36',
        mental_drain_frequency: 'Sometimes', focus_quality: 'Moderately well',
        work_life_sacrifice_frequency: 'Sometimes',
        energy_drain_area: 'Keeping the employees productive and occupied',
        daily_energy_level: '8', manager_support_quality: 'Good'
      }
    },
    {
      email: "andrewkreidt@gmail.com",
      data: {
        role_clarity_score: 7, has_written_job_description: false,
        most_important_job_aspect: 'Maintaining the day to day operations of my location. Making sure we deliver on our promises to our customers',
        confidence_score: 7, natural_strength: 'Working with and fixing equipment',
        biggest_difficulty: 'Making sure everyone is working on a task. Keeping a list of tasks that need to be done ready to assign to employees',
        skill_to_master: 'People Management',
        workload_status: 'very_manageable', burnout_frequency: 'Occasionally (monthly)',
        learning_preference: 'mixed', weekly_development_hours: 2, learning_motivation: 'Personal interest',
        needed_training: 'skills to better manage my team',
        growth_barrier: 'not being intentional and sticking with it',
        listens_to_podcasts: true, watches_youtube: true, reads_books_articles: false,
        sees_growth_path: true, feels_valued: true, would_stay_if_offered_similar: '10',
        retention_improvement_suggestion: 'At the moment just continue to keep focusing on people and making us feel appreciated and valued',
        sees_leadership_path: true,
        three_year_goal: 'Increasing our seed sales by $500,000',
        company_supporting_goal: true,
        biggest_work_obstacle: 'Doubting myself',
        biggest_frustration: 'Hard to deal with customers',
        why_people_leave_opinion: 'Don\'t like or can\'t handle the seasonal work hours.',
        what_enjoy_most: 'Seeing where we can take this company. The flexibility we have in the off season. Sales rewards. The people we get to work with',
        leadership_should_understand: 'Juggling the work/life balance',
        recent_accomplishment: 'Making it through the spring season with minimal issues. Just about making seed budget. Total sales being above what we budgeted',
        recent_challenge: 'Keeping my team on task and working with them to do the best we can',
        needed_training_for_effectiveness: 'Employee Mangement',
        twelve_month_growth_goal: 'Being a better manager',
        support_needed_from_leadership: 'Extra training',
        one_year_vision: 'Gaining new customers for the business. Having energy left at the end of the day to complete tasks at home',
        typeform_response_id: 'j6tx0jqx3xero66qvj6txfzprs8x987x',
        typeform_start_date: '2025-10-07 16:44:31', typeform_submit_date: '2025-10-07 17:13:44',
        mental_drain_frequency: 'Sometimes', focus_quality: 'Poorly',
        work_life_sacrifice_frequency: 'Sometimes',
        energy_drain_area: 'keeping everyone busy and sales calls',
        daily_energy_level: '8', manager_support_quality: 'Good'
      }
    }
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
