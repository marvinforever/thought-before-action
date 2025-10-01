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

    // Decode JWT from Authorization header (function has verify_jwt enabled)
    const jwt = authHeader.replace('Bearer ', '')
    const payloadBase64 = jwt.split('.')[1]
    if (!payloadBase64) {
      throw new Error('Invalid authorization token')
    }
    let userId: string | undefined
    try {
      const claims = JSON.parse(atob(payloadBase64))
      userId = claims.sub as string | undefined
    } catch (e) {
      console.error('JWT decode error:', e)
      throw new Error('Invalid authorization token')
    }

    if (!userId) {
      throw new Error('Not authenticated')
    }

    // Verify the user is an admin or super admin
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, is_admin, is_super_admin')
      .eq('id', userId)
      .single()

    if (profileFetchError) {
      console.error('Profile fetch error:', profileFetchError)
      throw new Error('Failed to load profile')
    }

    if (!profile?.is_admin && !profile?.is_super_admin) {
      throw new Error('Not authorized - admin access required')
    }

    const { email, full_name, role, phone, company_id } = await req.json()

    if (!email || !full_name) {
      throw new Error('Email and full name are required')
    }

    console.log('Creating employee:', { email, full_name, company_id })

    // Determine which company to use
    let targetCompanyId: string
    
    if (profile.is_super_admin && company_id) {
      // Super admin can specify any company
      targetCompanyId = company_id
    } else if (profile.is_admin) {
      // Regular admin uses their own company
      targetCompanyId = profile.company_id
    } else {
      throw new Error('Not authorized - admin access required')
    }

    if (!targetCompanyId) {
      throw new Error('Company ID not found')
    }

    // Create the auth user with admin client (generates a random password)
    const randomPassword = crypto.randomUUID()
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    console.log('Auth user created:', authUser.user.id)

    // Create the profile
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email: email.toLowerCase().trim(),
        full_name: full_name,
        role: role || null,
        phone: phone || null,
        company_id: targetCompanyId,
        is_admin: false
      })

    if (profileInsertError) {
      console.error('Profile error:', profileInsertError)
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw profileInsertError
    }

    console.log('Profile created successfully')

    return new Response(
      JSON.stringify({ id: authUser.user.id }),
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
