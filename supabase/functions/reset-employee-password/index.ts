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

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Decode JWT from Authorization header
    const jwt = authHeader.replace('Bearer ', '')
    const payloadBase64 = jwt.split('.')[1]
    if (!payloadBase64) {
      throw new Error('Invalid authorization token')
    }
    let requestUserId: string | undefined
    try {
      const claims = JSON.parse(atob(payloadBase64))
      requestUserId = claims.sub as string | undefined
    } catch (e) {
      console.error('JWT decode error:', e)
      throw new Error('Invalid authorization token')
    }

    if (!requestUserId) {
      throw new Error('Not authenticated')
    }

    // Verify the user is an admin or super admin
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, is_admin, is_super_admin')
      .eq('id', requestUserId)
      .single()

    if (profileFetchError) {
      console.error('Profile fetch error:', profileFetchError)
      throw new Error('Failed to load profile')
    }

    if (!profile?.is_admin && !profile?.is_super_admin) {
      throw new Error('Not authorized - admin access required')
    }

    const { employee_id, new_password } = await req.json()

    if (!employee_id || !new_password) {
      throw new Error('Employee ID and new password are required')
    }

    if (new_password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    console.log('Resetting password for employee:', employee_id)

    // Verify the employee belongs to the same company (for regular admins)
    if (!profile.is_super_admin) {
      const { data: employeeProfile, error: employeeError } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', employee_id)
        .single()

      if (employeeError || !employeeProfile) {
        throw new Error('Employee not found')
      }

      if (employeeProfile.company_id !== profile.company_id) {
        throw new Error('Not authorized - employee not in your company')
      }
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      employee_id,
      { password: new_password }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      throw updateError
    }

    console.log('Password reset successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
