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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing role consistency for company:', company_id);

    // Get all job descriptions with employee info
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('job_descriptions')
      .select(`
        id,
        title,
        profile_id,
        is_current,
        profiles!inner(full_name, email)
      `)
      .eq('company_id', company_id)
      .eq('is_current', true);

    if (jdError) throw jdError;

    console.log('Found job descriptions:', jobDescriptions?.length || 0);

    // Group by normalized job title
    const roleGroups: Record<string, any[]> = {};
    (jobDescriptions || []).forEach((jd: any) => {
      const normalizedTitle = jd.title?.trim().toLowerCase() || 'untitled';
      if (!roleGroups[normalizedTitle]) {
        roleGroups[normalizedTitle] = [];
      }
      roleGroups[normalizedTitle].push({
        profile_id: jd.profile_id,
        title: jd.title,
        full_name: jd.profiles?.full_name,
        email: jd.profiles?.email
      });
    });

    // Filter to roles with 2+ employees
    const rolesWithMultipleEmployees = Object.entries(roleGroups)
      .filter(([_, employees]) => employees.length >= 2)
      .map(([title, employees]) => ({ title, employees }));

    console.log('Roles with multiple employees:', rolesWithMultipleEmployees.length);

    // For each role group, compare capabilities
    const roleAnalyses = [];
    for (const role of rolesWithMultipleEmployees) {
      const employeeIds = role.employees.map(e => e.profile_id);

      // Get capabilities for all employees in this role
      const { data: capabilities, error: capError } = await supabase
        .from('employee_capabilities')
        .select(`
          profile_id,
          capability_id,
          current_level,
          target_level,
          capabilities!inner(name, category)
        `)
        .in('profile_id', employeeIds)
        .eq('marked_not_relevant', false);

      if (capError) throw capError;

      // Group capabilities by employee
      const employeeCapabilities: Record<string, any[]> = {};
      employeeIds.forEach(id => {
        employeeCapabilities[id] = [];
      });

      (capabilities || []).forEach((cap: any) => {
        if (employeeCapabilities[cap.profile_id]) {
          employeeCapabilities[cap.profile_id].push({
            capability_id: cap.capability_id,
            name: cap.capabilities?.name,
            category: cap.capabilities?.category,
            current_level: cap.current_level,
            target_level: cap.target_level
          });
        }
      });

      // Find all unique capabilities across this role
      const allCapabilityIds = new Set(
        (capabilities || []).map(c => c.capability_id)
      );

      // Calculate which capabilities each employee has
      const capabilityDistribution: Record<string, number> = {};
      allCapabilityIds.forEach(capId => {
        const count = employeeIds.filter(empId => 
          employeeCapabilities[empId]?.some(c => c.capability_id === capId)
        ).length;
        capabilityDistribution[capId] = count;
      });

      // Find discrepancies (capabilities not assigned to all employees)
      const discrepancies = [];
      for (const [capId, count] of Object.entries(capabilityDistribution)) {
        if (count < employeeIds.length && count > 0) {
          const cap: any = (capabilities || []).find((c: any) => c.capability_id === capId);
          const hasIt = employeeIds.filter(empId => 
            employeeCapabilities[empId]?.some(c => c.capability_id === capId)
          );
          const missingIt = employeeIds.filter(empId => 
            !employeeCapabilities[empId]?.some(c => c.capability_id === capId)
          );

          discrepancies.push({
            capability_id: capId,
            capability_name: cap?.capabilities?.name,
            capability_category: cap?.capabilities?.category,
            employees_with: hasIt.length,
            employees_without: missingIt.length,
            employees_with_names: role.employees
              .filter(e => hasIt.includes(e.profile_id))
              .map(e => e.full_name),
            employees_without_names: role.employees
              .filter(e => missingIt.includes(e.profile_id))
              .map(e => e.full_name)
          });
        }
      }

      // Calculate consistency score (% of capabilities that all employees have)
      const totalCapabilities = allCapabilityIds.size;
      const consistentCapabilities = Object.values(capabilityDistribution)
        .filter(count => count === employeeIds.length).length;
      const consistencyScore = totalCapabilities > 0 
        ? Math.round((consistentCapabilities / totalCapabilities) * 100)
        : 100;

      roleAnalyses.push({
        role_title: role.title,
        employee_count: role.employees.length,
        employees: role.employees,
        total_capabilities: totalCapabilities,
        consistent_capabilities: consistentCapabilities,
        consistency_score: consistencyScore,
        discrepancies: discrepancies,
        has_discrepancies: discrepancies.length > 0
      });
    }

    // Sort by lowest consistency score first
    roleAnalyses.sort((a, b) => a.consistency_score - b.consistency_score);

    return new Response(
      JSON.stringify({
        success: true,
        total_roles_analyzed: roleAnalyses.length,
        roles_with_discrepancies: roleAnalyses.filter(r => r.has_discrepancies).length,
        role_analyses: roleAnalyses
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in analyze-role-consistency:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
