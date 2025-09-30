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

    // Create a client with the user's token to verify they're authenticated
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      throw new Error('Not authorized - admin access required')
    }

    const { email, full_name } = await req.json()

    if (!email || !full_name) {
      throw new Error('Email and full name are required')
    }

    console.log('Creating employee:', { email, full_name })

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
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email: email.toLowerCase().trim(),
        full_name: full_name,
        company_id: profile.company_id,
        is_admin: false
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw profileError
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
