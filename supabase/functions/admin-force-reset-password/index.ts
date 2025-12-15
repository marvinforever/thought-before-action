import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
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

    const body = await req.json()
    const { user_id, new_password, email } = body

    // Allow reset by email for emergency access
    let targetUserId = user_id
    
    if (!targetUserId && email) {
      // Look up user by email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()
      if (userError) {
        console.error('Error listing users:', userError)
        throw new Error('Failed to look up user')
      }
      const user = userData.users.find(u => u.email === email)
      if (!user) {
        throw new Error('User not found with that email')
      }
      targetUserId = user.id
    }

    if (!targetUserId || !new_password) {
      throw new Error('User ID (or email) and new password are required')
    }

    if (new_password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    console.log('Force resetting password for user:', targetUserId)

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: new_password }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      throw updateError
    }

    console.log('Password reset successfully for:', targetUserId)

    return new Response(
      JSON.stringify({ success: true, user_id: targetUserId }),
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
