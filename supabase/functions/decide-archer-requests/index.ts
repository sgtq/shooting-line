import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { canDecide, findUserByEmail, isAlreadyRegistered, isValidEmail, parseDecision } from './decision.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FREE_ARCHER_PLAN = 'Archer basic'

type RequestResult = { id: string; ok: boolean; error?: string }
type Decider = { id: string }
type ClaimedRequest = {
  id: string
  participant: { id: string; first_name: string; last_name: string; email: string } | null
}

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function failure(id: string, error: string): RequestResult {
  return { id, ok: false, error }
}

// The row is claimed before any work, so two managers deciding at once cannot both create a login.
async function claimPendingRequest(
  admin: SupabaseClient,
  id: string,
  status: 'approved' | 'rejected',
  decider: Decider,
): Promise<ClaimedRequest | null> {
  const { data, error } = await admin
    .from('archer_requests')
    .update({ status, decided_by: decider.id, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, participant:participants(id, first_name, last_name, email)')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ClaimedRequest | null
}

async function releaseRequest(admin: SupabaseClient, id: string): Promise<void> {
  await admin.from('archer_requests').update({ status: 'pending', decided_by: null, decided_at: null }).eq('id', id)
}

async function findFreeArcherPlanId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('plans')
    .select('id')
    .eq('name', FREE_ARCHER_PLAN)
    .eq('user_role', 'archer')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`The ${FREE_ARCHER_PLAN} plan was not found`)
  return data.id as string
}

type ArcherLogin = { userId: string; created: boolean }

const USERS_PER_PAGE = 1000

async function findExistingUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw new Error(error.message)
    const match = findUserByEmail(data.users, email)
    if (match) return match.id
    if (data.users.length < USERS_PER_PAGE) return null
  }
}

// An account that already holds a role is never reused, so an archer approval cannot add a role to a club,
// manager, or admin login that happens to share the email.
async function reuseExistingLogin(admin: SupabaseClient, email: string): Promise<ArcherLogin> {
  const userId = await findExistingUserId(admin, email)
  if (!userId) throw new Error(`Unable to invite ${email}: the email is registered but no account was found`)
  const { data: roles, error } = await admin.from('user_roles').select('role').eq('user_id', userId)
  if (error) throw new Error(error.message)
  if (roles.length) throw new Error(`${email} already belongs to an account with the ${roles[0].role} role`)
  return { userId, created: false }
}

// A new login gets the invite email. An existing login with no role is linked as it is, with no email,
// because that person can already sign in.
async function getArcherLogin(admin: SupabaseClient, email: string): Promise<ArcherLogin> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (isAlreadyRegistered(error)) return reuseExistingLogin(admin, email)
  if (error || !data.user) throw new Error(`Unable to invite ${email}: ${error?.message ?? 'no user returned'}`)
  return { userId: data.user.id, created: true }
}

// Undoes a partial setup on a login this call did not create, which must not be deleted.
async function undoArcherSetup(admin: SupabaseClient, userId: string, planId: string): Promise<void> {
  await admin.from('user_subscriptions').delete().eq('user_id', userId).eq('plan_id', planId)
  await admin.from('user_roles').delete().eq('user_id', userId).eq('role', 'archer')
}

// Roles, access, profile, and plan are written as the service role because the archer cannot do it for themselves.
async function setUpArcherAccount(
  admin: SupabaseClient,
  userId: string,
  participant: NonNullable<ClaimedRequest['participant']>,
  planId: string,
  decider: Decider,
): Promise<void> {
  const email = participant.email.trim()
  const writes = [
    admin.from('user_roles').insert({ user_id: userId, email, role: 'archer', participant_id: participant.id }),
    admin.from('app_access').upsert({ user_id: userId, app_id: 'manager' }, { onConflict: 'user_id,app_id' }),
    admin.from('user_profiles').upsert({
      user_id: userId,
      display_name: `${participant.first_name} ${participant.last_name}`.trim(),
    }),
    // The free plan has no end date. A manager can set one later from the Plans screen.
    admin.from('user_subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      starts_on: new Date().toISOString().slice(0, 10),
      ends_on: null,
      price_paid: 0,
      assigned_by: decider.id,
    }),
  ]
  for (const result of await Promise.all(writes)) {
    if (result.error) throw new Error(result.error.message)
  }
}

async function approveRequest(admin: SupabaseClient, id: string, decider: Decider): Promise<RequestResult> {
  const claimed = await claimPendingRequest(admin, id, 'approved', decider)
  if (!claimed) return failure(id, 'The request is not pending')

  let login: ArcherLogin | null = null
  let planId = ''
  try {
    const participant = claimed.participant
    if (!participant || !isValidEmail(participant.email)) throw new Error('The archer needs a valid email')
    planId = await findFreeArcherPlanId(admin)
    login = await getArcherLogin(admin, participant.email.trim())
    await setUpArcherAccount(admin, login.userId, participant, planId, decider)
    return { id, ok: true }
  } catch (error) {
    // Deleting a login made here also removes its role, access, and plan rows, so a retry starts clean.
    if (login?.created) await admin.auth.admin.deleteUser(login.userId)
    else if (login) await undoArcherSetup(admin, login.userId, planId)
    await releaseRequest(admin, id)
    return failure(id, error instanceof Error ? error.message : 'Unable to approve the request')
  }
}

async function rejectRequest(admin: SupabaseClient, id: string, decider: Decider): Promise<RequestResult> {
  const claimed = await claimPendingRequest(admin, id, 'rejected', decider)
  return claimed ? { id, ok: true } : failure(id, 'The request is not pending')
}

async function decideAll(
  admin: SupabaseClient,
  action: 'approve' | 'reject',
  requestIds: string[],
  decider: Decider,
): Promise<RequestResult[]> {
  const results: RequestResult[] = []
  // One at a time keeps the invite emails within the mail provider's rate limit.
  for (const id of requestIds) {
    const decide = action === 'approve' ? approveRequest : rejectRequest
    results.push(await decide(admin, id, decider))
  }
  return results
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: 'The request service is not configured' }, 500)
  }

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return respond({ error: 'Sign in is required' }, 401)

  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userResult, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !userResult.user) return respond({ error: 'Sign in is required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: roles, error: roleError } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userResult.user.id)
  if (roleError) return respond({ error: `Unable to verify permissions: ${roleError.message}` }, 500)
  if (!canDecide(roles.map((record) => record.role as string))) {
    return respond({ error: 'Administrator or manager access is required' }, 403)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return respond({ error: 'A valid request body is required' }, 400)
  }
  const decision = parseDecision(payload)
  if ('error' in decision) return respond({ error: decision.error }, 400)

  const results = await decideAll(admin, decision.action, decision.requestIds, { id: userResult.user.id })
  return respond({ results })
})
