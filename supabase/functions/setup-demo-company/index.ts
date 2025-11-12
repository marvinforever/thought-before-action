import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DemoEmployee {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
}

const DEMO_EMPLOYEES = [
  { full_name: "Sarah Chen", role: "Marketing Manager", phone: "+15551234501" },
  { full_name: "Marcus Johnson", role: "Sales Lead", phone: "+15551234502" },
  { full_name: "Elena Rodriguez", role: "Product Designer", phone: "+15551234503" },
  { full_name: "David Kim", role: "Operations Coordinator", phone: "+15551234504" },
  { full_name: "Maria Santos", role: "Customer Success Manager", phone: "+15551234505" },
  { full_name: "James Wilson", role: "Sales Representative", phone: "+15551234506" },
  { full_name: "Aisha Patel", role: "HR Specialist", phone: "+15551234507" },
  { full_name: "Carlos Rivera", role: "Account Manager", phone: "+15551234508" },
  { full_name: "Emma Thompson", role: "Project Manager", phone: "+15551234509" },
  { full_name: "Ahmed Hassan", role: "Business Analyst", phone: "+15551234510" }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    // Check if user has super_admin role using the user_roles table
    const { data: hasSuperAdminRole, error: superAdminRoleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (superAdminRoleError) {
      throw new Error('Failed to verify user role');
    }

    if (!hasSuperAdminRole) {
      throw new Error('Super admin access required');
    }

    console.log('Starting demo company setup...');

    // Step 1: Create demo company
    const { data: demoCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name: 'Jericho Demo Company', created_at: new Date().toISOString() })
      .select()
      .single();

    if (companyError) throw companyError;
    console.log('Demo company created:', demoCompany.id);

    // Step 2: Create 10 fake employees
    const createdEmployees: DemoEmployee[] = [];
    const timestamp = Date.now();
    for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
      const emp = DEMO_EMPLOYEES[i];
      const email = `demo.employee${i + 1}.${timestamp}@jerichodemo.com`;
      const password = 'DemoPass2026!';

      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: emp.full_name },
      });

      if (createError) {
        console.error(`Failed to create employee ${emp.full_name}:`, createError);
        continue;
      }

      if (authUser.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: authUser.user.id,
          email: email,
          full_name: emp.full_name,
          role: emp.role,
          phone: emp.phone,
          company_id: demoCompany.id,
          is_active: true,
        });

        createdEmployees.push({
          id: authUser.user.id,
          email,
          full_name: emp.full_name,
          role: emp.role,
          phone: emp.phone,
        });
      }
    }
    console.log(`Created ${createdEmployees.length} employees`);

    // Step 3: Get existing capabilities
    const { data: capabilities } = await supabaseAdmin
      .from('capabilities')
      .select('id, name, category')
      .limit(50);

    if (!capabilities || capabilities.length === 0) {
      throw new Error('No capabilities found in system. Please ensure capabilities are seeded in the database first.');
    }

    console.log(`Found ${capabilities.length} capabilities`);

    // Step 4: Populate growth plans for each employee
    for (const employee of createdEmployees) {
      console.log(`Populating data for ${employee.full_name}...`);

      // Personal Goals
      await supabaseAdmin.from('personal_goals').insert({
        profile_id: employee.id,
        company_id: demoCompany.id,
        one_year_vision: `Lead ${employee.role} initiatives and mentor junior team members while developing expertise in strategic planning.`,
        three_year_vision: `Advance to senior leadership role, contributing to organizational strategy and building high-performing teams.`,
      });

      // 90-Day Targets
      const targets = [
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          goal_text: `Complete advanced training in ${employee.role.split(' ')[0]} skills`,
          category: 'Professional',
          by_when: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          support_needed: 'Access to training resources and 2 hours per week for learning',
          completed: Math.random() > 0.5,
        },
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          goal_text: 'Implement new process improvement initiative',
          category: 'Company',
          by_when: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          support_needed: 'Team collaboration and management approval',
          completed: false,
        },
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          goal_text: 'Develop public speaking skills through presentations',
          category: 'Personal',
          by_when: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          support_needed: 'Opportunities to present in team meetings',
          completed: Math.random() > 0.7,
        },
      ];
      await supabaseAdmin.from('ninety_day_targets').insert(targets);

      // Leading Indicators (Habits)
      const habits = [
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          habit_name: 'Review industry articles and trends',
          habit_description: 'Stay current with industry best practices',
          target_frequency: 'weekly',
          current_streak: Math.floor(Math.random() * 10),
          longest_streak: Math.floor(Math.random() * 20) + 5,
        },
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          habit_name: 'Daily reflection on key wins',
          habit_description: 'Document achievements and learning moments',
          target_frequency: 'daily',
          current_streak: Math.floor(Math.random() * 5),
          longest_streak: Math.floor(Math.random() * 15) + 3,
        },
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          habit_name: 'Practice new skills learned',
          habit_description: 'Apply learning through hands-on practice',
          target_frequency: 'weekly',
          current_streak: Math.floor(Math.random() * 7),
          longest_streak: Math.floor(Math.random() * 12) + 4,
        },
      ];
      await supabaseAdmin.from('leading_indicators').insert(habits);

      // Employee Capabilities - assign 10 random capabilities
      const selectedCapabilities = capabilities
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      const capabilityAssignments = selectedCapabilities.map((cap, idx) => ({
        profile_id: employee.id,
        capability_id: cap.id,
        current_level: ['foundational', 'advancing', 'proficient'][Math.floor(Math.random() * 3)],
        target_level: ['advancing', 'proficient', 'leading'][Math.floor(Math.random() * 3)],
        priority: idx + 1,
        self_assessed_level: ['foundational', 'advancing'][Math.floor(Math.random() * 2)],
        ai_reasoning: `${cap.name} is critical for ${employee.role} to deliver effective results and contribute to team success.`,
      }));
      await supabaseAdmin.from('employee_capabilities').insert(capabilityAssignments);

      // Achievements
      const achievements = [
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          title: `Successfully completed major project in ${employee.role}`,
          description: 'Led cross-functional initiative that improved team efficiency by 25%',
          achieved_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        {
          profile_id: employee.id,
          company_id: demoCompany.id,
          title: 'Received positive feedback from client',
          description: 'Client praised exceptional service and attention to detail',
          achieved_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      ];
      await supabaseAdmin.from('achievements').insert(achievements);

      // Diagnostic Response
      await supabaseAdmin.from('diagnostic_responses').insert({
        profile_id: employee.id,
        company_id: demoCompany.id,
        role_clarity_score: Math.floor(Math.random() * 3) + 7,
        confidence_score: Math.floor(Math.random() * 3) + 7,
        workload_status: ['manageable', 'stretched', 'overwhelmed'][Math.floor(Math.random() * 3)],
        learning_preference: ['self_paced', 'instructor_led', 'blended'][Math.floor(Math.random() * 3)],
        weekly_development_hours: Math.random() * 5 + 2,
        sees_growth_path: Math.random() > 0.3,
        feels_valued: Math.random() > 0.2,
        three_year_goal: `Advance to senior ${employee.role} position and take on leadership responsibilities`,
        needed_training: 'Advanced technical skills and leadership development',
        biggest_work_obstacle: 'Time management and balancing competing priorities',
      });
    }

    console.log('Growth plans populated for all employees');

    // Step 5: Create Strategic Learning Design Report
    const executiveSummary = {
      total_employees: createdEmployees.length,
      employees_needing_training: 8,
      total_cohorts: 5,
      top_priorities: ['Leadership Development', 'Communication Skills', 'Technical Excellence', 'Project Management', 'Strategic Thinking'],
      total_investment_conservative: 10000,
      total_investment_moderate: 35000,
      total_investment_aggressive: 65000,
      narrative: 'Strategic analysis reveals strong foundation with targeted development opportunities across leadership, technical, and communication domains.',
    };

    const budgetScenarios = {
      conservative: { total: 10000, per_employee: 1000, year1: 10000, year2: 0, year3: 0, description: 'Essential training only' },
      moderate: { total: 35000, per_employee: 3500, year1: 15000, year2: 12000, year3: 8000, description: 'Balanced development approach' },
      aggressive: { total: 65000, per_employee: 6500, year1: 30000, year2: 20000, year3: 15000, description: 'Comprehensive transformation' },
    };

    const roiProjections = {
      training_cost: 35000,
      retention_savings: 125000,
      productivity_gains: 85000,
      net_roi: 175000,
      roi_percentage: 500,
      break_even_months: 8,
      methodology: 'Based on industry research: 30% reduction in turnover and 15% productivity improvement',
      formulas: { retention: 'avg_salary * turnover_reduction * probability', productivity: 'avg_salary * productivity_gain * employees' },
      sources: ['Work Institute 2023', 'ATD Research', 'Gallup Workplace Studies'],
    };

    const { data: learningReport, error: reportError } = await supabaseAdmin
      .from('strategic_learning_reports')
      .insert({
        company_id: demoCompany.id,
        executive_summary: executiveSummary,
        budget_scenarios: budgetScenarios,
        roi_projections: roiProjections,
        narrative: 'This strategic learning design identifies key capability gaps across the organization and provides a comprehensive development roadmap. Investment in these areas will drive retention, productivity, and competitive advantage.',
        cohorts: [],
      })
      .select()
      .single();

    if (reportError) throw reportError;
    console.log('Strategic learning report created');

    // Step 6: Create Training Cohorts
    const cohortData = [
      {
        report_id: learningReport.id,
        company_id: demoCompany.id,
        cohort_name: 'Leadership Development Cohort',
        capability_name: 'Leadership',
        employee_ids: createdEmployees.slice(0, 4).map(e => e.id),
        employee_count: 4,
        priority: 1,
        current_level: 'foundational',
        target_level: 'advancing',
        gap_severity: 'high',
        recommended_solutions: [
          { type: 'course', provider: 'LinkedIn Learning', title: 'Leadership Foundations', cost: 1500 },
          { type: 'coaching', provider: 'Internal', title: 'Executive Coaching Program', cost: 3000 },
        ],
        estimated_cost_conservative: 2000,
        estimated_cost_moderate: 4500,
        estimated_cost_aggressive: 8000,
        delivery_quarter: 'Q2 2026',
      },
      {
        report_id: learningReport.id,
        company_id: demoCompany.id,
        cohort_name: 'Sales Excellence Cohort',
        capability_name: 'Sales & Negotiation',
        employee_ids: createdEmployees.slice(1, 4).map(e => e.id),
        employee_count: 3,
        priority: 2,
        current_level: 'advancing',
        target_level: 'proficient',
        gap_severity: 'medium',
        recommended_solutions: [
          { type: 'workshop', provider: 'Sales Training Co', title: 'Advanced Negotiation', cost: 2500 },
        ],
        estimated_cost_conservative: 1500,
        estimated_cost_moderate: 2500,
        estimated_cost_aggressive: 4500,
        delivery_quarter: 'Q2 2026',
      },
      {
        report_id: learningReport.id,
        company_id: demoCompany.id,
        cohort_name: 'Project Management Cohort',
        capability_name: 'Project Management',
        employee_ids: createdEmployees.slice(4, 7).map(e => e.id),
        employee_count: 3,
        priority: 3,
        current_level: 'foundational',
        target_level: 'advancing',
        gap_severity: 'high',
        recommended_solutions: [
          { type: 'certification', provider: 'PMI', title: 'PMP Certification Prep', cost: 3500 },
        ],
        estimated_cost_conservative: 2000,
        estimated_cost_moderate: 3500,
        estimated_cost_aggressive: 6000,
        delivery_quarter: 'Q3 2026',
      },
      {
        report_id: learningReport.id,
        company_id: demoCompany.id,
        cohort_name: 'Written Communication Cohort',
        capability_name: 'Written Communication',
        employee_ids: createdEmployees.slice(2, 6).map(e => e.id),
        employee_count: 4,
        priority: 4,
        current_level: 'advancing',
        target_level: 'proficient',
        gap_severity: 'medium',
        recommended_solutions: [
          { type: 'workshop', provider: 'Business Writing', title: 'Executive Writing Skills', cost: 1200 },
        ],
        estimated_cost_conservative: 800,
        estimated_cost_moderate: 1200,
        estimated_cost_aggressive: 2000,
        delivery_quarter: 'Q3 2026',
      },
      {
        report_id: learningReport.id,
        company_id: demoCompany.id,
        cohort_name: 'Data Analysis Cohort',
        capability_name: 'Data Analysis',
        employee_ids: createdEmployees.slice(6, 9).map(e => e.id),
        employee_count: 3,
        priority: 5,
        current_level: 'foundational',
        target_level: 'advancing',
        gap_severity: 'medium',
        recommended_solutions: [
          { type: 'course', provider: 'Coursera', title: 'Data Analytics Professional', cost: 2000 },
        ],
        estimated_cost_conservative: 1000,
        estimated_cost_moderate: 2000,
        estimated_cost_aggressive: 3500,
        delivery_quarter: 'Q4 2026',
      },
    ];

    await supabaseAdmin.from('training_cohorts').insert(cohortData);
    console.log('Training cohorts created');

    // Step 7: Create Demo Manager Accounts
    const demoManagers = [];
    for (let i = 1; i <= 2; i++) {
      const managerEmail = `demo${i}.${timestamp}@jerichodemo.com`;
      const managerPassword = 'DemoManager2026!';

      const { data: managerAuth, error: managerError } = await supabaseAdmin.auth.admin.createUser({
        email: managerEmail,
        password: managerPassword,
        email_confirm: true,
        user_metadata: { full_name: `Demo Manager ${i}` },
      });

      if (managerError) {
        console.error('Failed to create manager:', managerError);
        continue;
      }

      if (managerAuth.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: managerAuth.user.id,
          email: managerEmail,
          full_name: `Demo Manager ${i}`,
          role: 'Manager',
          company_id: demoCompany.id,
          is_active: true,
        });

        await supabaseAdmin.from('user_roles').insert({
          user_id: managerAuth.user.id,
          role: 'manager',
        });

        demoManagers.push({
          id: managerAuth.user.id,
          email: managerEmail,
          password: managerPassword,
        });

        // Assign manager to all employees
        const assignments = createdEmployees.map(emp => ({
          manager_id: managerAuth.user.id,
          employee_id: emp.id,
          company_id: demoCompany.id,
        }));
        await supabaseAdmin.from('manager_assignments').insert(assignments);
      }
    }

    console.log('Demo managers created and assigned');

    return new Response(
      JSON.stringify({
        success: true,
        demo_company_id: demoCompany.id,
        demo_company_name: demoCompany.name,
        employees_created: createdEmployees.length,
        employees: createdEmployees.map(e => ({ name: e.full_name, email: e.email, role: e.role })),
        demo_managers: demoManagers,
        strategic_report_id: learningReport.id,
        cohorts_created: cohortData.length,
        message: 'Demo company setup complete! Use demo manager credentials to log in.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in setup-demo-company:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
