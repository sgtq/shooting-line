import {
  BASIC_ARCHER_PLAN_NAME,
  SEED_ACCOUNTS,
  SEED_CLUBS,
  SEED_EMAIL_DOMAIN,
  SEED_PLANS,
  emailFor,
  subscriptionFor,
} from './cases.js'

const USERS_PER_PAGE = 1000

/**
 * @template T
 * @param {{ data?: T, error: { message: string } | null }} result
 * @param {string} step
 * @returns {T} The data of a successful query. A failed one stops the run with the step named.
 */
function must(result, step) {
  if (result.error) {
    throw new Error(`${step}: ${result.error.message}`)
  }
  return result.data
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<Array<{ id: string, email?: string }>>} Every auth user, read page by page.
 */
async function listAllUsers(client) {
  const users = []
  for (let page = 1; ; page += 1) {
    const { users: batch } = must(await client.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE }), 'List users')
    users.push(...batch)
    if (batch.length < USERS_PER_PAGE) {
      return users
    }
  }
}

/**
 * Creates the account, or resets the password of an existing one so a repeat run keeps sign-in working.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Array<{ id: string, email?: string }>} existingUsers
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} The auth user id.
 */
async function ensureAuthUser(client, existingUsers, email, password) {
  const existing = existingUsers.find((user) => user.email === email)
  if (existing) {
    must(await client.auth.admin.updateUserById(existing.id, { password, email_confirm: true }), `Update ${email}`)
    return existing.id
  }
  const { user } = must(await client.auth.admin.createUser({ email, password, email_confirm: true }), `Create ${email}`)
  return user.id
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<Record<string, string>>} Plan ids by catalogue key, including the free 'basic' plan.
 */
async function ensurePlans(client) {
  const planIds = {}
  for (const plan of SEED_PLANS) {
    must(
      await client.from('plans').upsert({
        id: plan.id,
        name: plan.name,
        user_role: plan.userRole,
        duration_kind: plan.durationKind,
      }),
      `Save plan ${plan.name}`,
    )
    must(await client.from('plan_prices').delete().eq('plan_id', plan.id), `Clear prices of ${plan.name}`)
    must(await client.from('plan_prices').insert({ plan_id: plan.id, amount: plan.price }), `Price ${plan.name}`)
    planIds[plan.key] = plan.id
  }

  const basic = must(
    await client.from('plans').select('id').eq('name', BASIC_ARCHER_PLAN_NAME).eq('user_role', 'archer').maybeSingle(),
    'Find the free archer plan',
  )
  if (!basic) {
    throw new Error(`The "${BASIC_ARCHER_PLAN_NAME}" plan is missing. Apply the migrations first.`)
  }
  planIds.basic = basic.id
  return planIds
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ localPart: string, name: string, roles: string[], club?: string, participantId?: string }} account
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function saveRoles(client, account, userId) {
  const email = emailFor(account)
  const clubId = SEED_CLUBS.find((club) => club.key === account.club)?.id ?? null
  for (const role of account.roles) {
    must(
      await client.from('user_roles').upsert(
        {
          user_id: userId,
          email,
          role,
          club_id: role === 'club' ? clubId : null,
          participant_id: role === 'archer' ? account.participantId : null,
        },
        { onConflict: 'user_id,role' },
      ),
      `Save role ${role} of ${email}`,
    )
  }
  must(
    await client.from('app_access').upsert({ user_id: userId, app_id: 'manager' }, { onConflict: 'user_id,app_id' }),
    `Grant manager access to ${email}`,
  )
  must(
    await client.from('user_profiles').upsert({ user_id: userId, display_name: account.name }),
    `Save profile of ${email}`,
  )
  if (account.roles.includes('club')) {
    must(
      await client.from('clubs').update({ user_email: email, user_enabled: true }).eq('id', clubId),
      `Enable club account for ${email}`,
    )
  }
}

/**
 * Replaces the account's subscriptions so the dates always count from today.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ localPart: string, subscription: string | null }} account
 * @param {string} userId
 * @param {Record<string, string>} planIds
 * @param {Date} today
 * @returns {Promise<void>}
 */
async function saveSubscription(client, account, userId, planIds, today) {
  must(await client.from('user_subscriptions').delete().eq('user_id', userId), `Clear plans of ${account.localPart}`)
  const subscription = subscriptionFor(account.subscription, today)
  if (!subscription) {
    return
  }
  must(
    await client.from('user_subscriptions').insert({
      user_id: userId,
      plan_id: planIds[subscription.plan],
      starts_on: subscription.startsOn,
      ends_on: subscription.endsOn,
      price_paid: subscription.pricePaid,
      assigned_by: null,
    }),
    `Assign plan to ${account.localPart}`,
  )
}

/**
 * Creates or refreshes every seed account with the clubs, archers, and plans it needs.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ password: string, today?: Date }} options
 * @returns {Promise<string[]>} The emails of the seed accounts.
 */
export async function seedDevData(client, { password, today = new Date() }) {
  const planIds = await ensurePlans(client)

  must(await client.from('clubs').upsert(SEED_CLUBS.map((club) => ({ id: club.id, name: club.name }))), 'Save clubs')
  const archers = SEED_ACCOUNTS.filter((account) => account.participantId)
  must(
    await client.from('participants').upsert(
      archers.map((account) => ({
        id: account.participantId,
        first_name: 'Seed',
        last_name: account.name,
        club_id: SEED_CLUBS.find((club) => club.key === account.club)?.id ?? null,
      })),
    ),
    'Save archers',
  )

  const existingUsers = await listAllUsers(client)
  for (const account of SEED_ACCOUNTS) {
    const userId = await ensureAuthUser(client, existingUsers, emailFor(account), password)
    await saveRoles(client, account, userId)
    await saveSubscription(client, account, userId, planIds, today)
  }
  return SEED_ACCOUNTS.map(emailFor)
}

/**
 * Deletes only seed data. Deleting a user also removes their roles, profile, access, and plans.
 * The shared "Archer basic" plan is never touched.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<number>} How many seed accounts were deleted.
 */
export async function removeDevData(client) {
  const seedUsers = (await listAllUsers(client)).filter((user) => user.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`))
  for (const user of seedUsers) {
    must(await client.auth.admin.deleteUser(user.id), `Delete ${user.email}`)
  }

  const participantIds = SEED_ACCOUNTS.filter((account) => account.participantId).map(
    (account) => account.participantId,
  )
  must(await client.from('participants').delete().in('id', participantIds), 'Delete archers')
  must(
    await client
      .from('clubs')
      .delete()
      .in(
        'id',
        SEED_CLUBS.map((club) => club.id),
      ),
    'Delete clubs',
  )
  must(
    await client
      .from('plans')
      .delete()
      .in(
        'id',
        SEED_PLANS.map((plan) => plan.id),
      ),
    'Delete plans',
  )
  return seedUsers.length
}
