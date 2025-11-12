import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Employee {
  email: string;
  full_name: string;
  role: string;
  phone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin or super_admin role using the user_roles table
    const { data: hasAdminRole, error: adminRoleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    const { data: hasSuperAdminRole, error: superAdminRoleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (adminRoleError || superAdminRoleError) {
      throw new Error('Failed to verify user roles');
    }

    if (!hasAdminRole && !hasSuperAdminRole) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Still need to fetch company_id from profile for non-super admins
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const { employees, company_id } = await req.json();

    if (!Array.isArray(employees) || employees.length === 0) {
      throw new Error('Invalid employees array');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    const results = [];
    const errors = [];

    for (const emp of employees as Employee[]) {
      try {
        const password = Math.random().toString(36).slice(-12) + 'A1!';
        
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: emp.email.toLowerCase(),
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: emp.full_name,
          },
        });

        if (createError) {
          if (createError.message.includes('already registered')) {
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users.find(u => u.email === emp.email.toLowerCase());
            
            if (existingUser) {
              await supabaseAdmin
                .from('profiles')
                .upsert({
                  id: existingUser.id,
                  email: emp.email.toLowerCase(),
                  full_name: emp.full_name,
                  role: emp.role,
                  phone: emp.phone,
                  company_id: company_id,
                  is_active: true,
                });
              
              results.push({
                email: emp.email,
                success: true,
                message: 'Updated existing user',
              });
              continue;
            }
          }
          throw createError;
        }

        if (authUser.user) {
          await supabaseAdmin
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              email: emp.email.toLowerCase(),
              full_name: emp.full_name,
              role: emp.role,
              phone: emp.phone,
              company_id: company_id,
              is_active: true,
            });

          results.push({
            email: emp.email,
            success: true,
            password: password,
          });
        }
      } catch (err: any) {
        errors.push({
          email: emp.email,
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        errors,
        summary: {
          total: employees.length,
          successful: results.length,
          failed: errors.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
