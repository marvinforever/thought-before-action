import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify super admin status
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Super admin ${user.email} initiating deletion of company ${companyId}`);

    // Get company details before deletion
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count employees before deletion
    const { count: employeeCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    // Delete all company-related data in order (respecting foreign keys)
    const deletionSteps = [
      { table: 'habit_completions', join: 'profile_id', via: 'profiles' },
      { table: 'leading_indicators', column: 'company_id' },
      { table: 'ninety_day_targets', column: 'company_id' },
      { table: 'personal_goals', column: 'company_id' },
      { table: 'achievements', column: 'company_id' },
      { table: 'growth_journal', column: 'company_id' },
      { table: 'conversation_messages', join: 'conversation_id', via: 'conversations' },
      { table: 'conversations', column: 'company_id' },
      { table: 'voice_sessions', join: 'conversation_id', via: 'conversations' },
      { table: 'roadmap_interest_indicators', column: 'company_id' },
      { table: 'employee_capabilities', join: 'profile_id', via: 'profiles' },
      { table: 'capability_level_requests', column: 'company_id' },
      { table: 'employee_risk_flags', column: 'company_id' },
      { table: 'diagnostic_responses', column: 'company_id' },
      { table: 'job_descriptions', column: 'company_id' },
      { table: 'one_on_one_notes', column: 'company_id' },
      { table: 'feedback_requests', join: 'employee_id', via: 'profiles' },
      { table: 'manager_assignments', column: 'company_id' },
      { table: 'email_deliveries', column: 'company_id' },
      { table: 'learning_roadmaps', column: 'company_id' },
      { table: 'strategic_learning_reports', column: 'company_id' },
      { table: 'user_data_completeness', join: 'profile_id', via: 'profiles' },
      { table: 'profile_company_changes', column: 'old_company_id' },
      { table: 'profile_company_changes', column: 'new_company_id' },
    ];

    const deletedCounts: Record<string, number> = {};

    for (const step of deletionSteps) {
      try {
        if (step.join && step.via) {
          // Get IDs from the via table first
          const { data: viaData } = await supabaseAdmin
            .from(step.via)
            .select('id')
            .eq('company_id', companyId);

          if (viaData && viaData.length > 0) {
            const ids = viaData.map((row: any) => row.id);
            const { count } = await supabaseAdmin
              .from(step.table)
              .delete({ count: 'exact' })
              .in(step.join, ids);
            deletedCounts[step.table] = count || 0;
          }
        } else if (step.column) {
          const { count } = await supabaseAdmin
            .from(step.table)
            .delete({ count: 'exact' })
            .eq(step.column, companyId);
          deletedCounts[step.table] = count || 0;
        }
      } catch (error) {
        console.error(`Error deleting from ${step.table}:`, error);
        // Continue with other deletions even if one fails
      }
    }

    // Delete auth users associated with this company
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId);

    if (profilesData && profilesData.length > 0) {
      for (const profile of profilesData) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(profile.id);
          console.log(`Deleted auth user ${profile.id}`);
        } catch (error) {
          console.error(`Error deleting auth user ${profile.id}:`, error);
        }
      }
    }

    // Delete profiles
    const { count: profilesDeleted } = await supabaseAdmin
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('company_id', companyId);
    deletedCounts['profiles'] = profilesDeleted || 0;

    // Finally, delete the company itself
    const { error: companyDeleteError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (companyDeleteError) {
      throw companyDeleteError;
    }

    console.log(`Successfully deleted company ${companyId} (${company.name})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted company "${company.name}"`,
        companyId,
        companyName: company.name,
        employeesDeleted: employeeCount || 0,
        deletedRecords: deletedCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-company function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
