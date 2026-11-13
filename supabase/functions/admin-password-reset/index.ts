import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: 'Password reset service is not configured' }, 500)
  }

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return respond({ error: 'Sign in is required' }, 401)

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userResult, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !userResult.user) return respond({ error: 'Sign in is required' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: roles, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userResult.user.id)
    .in('role', ['admin', 'manager'])
    .limit(1)

  if (roleError) return respond({ error: `Unable to verify reset permissions: ${roleError.message}` }, 500)
  if (!roles.length) return respond({ error: 'Administrator or manager access is required' }, 403)

  let payload: { email?: unknown }
  try {
    payload = await request.json()
  } catch {
    return respond({ error: 'A valid account email is required' }, 400)
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'Enter a valid account email address' }, 400)
  }

  const recoveryClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: recoveryError } = await recoveryClient.auth.resetPasswordForEmail(email)
  if (recoveryError) {
    return respond({ error: `Unable to send the password reset email: ${recoveryError.message}` }, 502)
  }

  return respond({ message: 'If the account exists, a password reset email will be sent' })
})
