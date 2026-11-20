import {
  BASIC_ARCHER_PLAN_NAME,
  SEED_ACCOUNTS,
  SEED_CLUBS,
  SEED_CATEGORY,
  SEED_EMAIL_DOMAIN,
  SEED_PLANS,
  SEED_TOURNAMENT_TYPE,
  emailFor,
  seedTournaments,
  subscriptionFor,
} from './cases.js'

import { randomUUID } from 'node:crypto'

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
 * Writes one tournament with its dates, rounds, entries, scores, and matches. The rounds are replaced on every run,
 * so scores never double up.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {ReturnType<typeof seedTournaments>[number]} tournament
 * @param {Date} today
 * @returns {Promise<void>}
 */
async function saveTournament(client, tournament, today) {
  const name = tournament.name
  const clubId = SEED_CLUBS.find((club) => club.key === tournament.club).id
  must(
    await client.from('tournaments').upsert({
      id: tournament.id,
      name,
      discipline: 'Indoor',
      tournament_type_id: SEED_TOURNAMENT_TYPE.id,
      club_id: clubId,
      venue_mode: 'club',
      started_at: tournament.started ? today.toISOString() : null,
    }),
    `Save ${name}`,
  )
  must(await client.from('tournament_dates').delete().eq('tournament_id', tournament.id), `Clear dates of ${name}`)
  must(
    await client.from('tournament_dates').insert(tournament.days.map((day) => ({ tournament_id: tournament.id, day }))),
    `Save dates of ${name}`,
  )
  must(
    await client.from('tournament_categories').upsert({ tournament_id: tournament.id, category_id: SEED_CATEGORY.id }),
    `Save categories of ${name}`,
  )
  must(await client.from('tournament_rounds').delete().eq('tournament_id', tournament.id), `Clear rounds of ${name}`)
  must(await client.from('tournament_participants').delete().eq('tournament_id', tournament.id), `Clear entries`)

  const roundNames = [...new Set(['Qualification 1', ...tournament.scores.map((score) => score.round)])].sort()
  const rounds = roundNames.map((roundName, position) => ({
    id: randomUUID(),
    tournament_id: tournament.id,
    name: roundName,
    position,
  }))
  must(await client.from('tournament_rounds').insert(rounds), `Save rounds of ${name}`)

  if (tournament.entries.length) {
    must(
      await client.from('tournament_participants').insert(
        tournament.entries.map((participantId) => ({
          tournament_id: tournament.id,
          participant_id: participantId,
          category_id: SEED_CATEGORY.id,
        })),
      ),
      `Save entries of ${name}`,
    )
  }
  if (tournament.scores.length) {
    must(
      await client.from('round_scores').insert(
        tournament.scores.map((score) => ({
          tournament_id: tournament.id,
          round_id: rounds.find((round) => round.name === score.round).id,
          participant_id: score.participantId,
          category_id: SEED_CATEGORY.id,
          score: score.score,
        })),
      ),
      `Save scores of ${name}`,
    )
  }
  if (tournament.matches.length) {
    must(
      await client.from('matches').insert(
        tournament.matches.map((match, index) => ({
          tournament_id: tournament.id,
          source_round_id: rounds[rounds.length - 1].id,
          category_id: SEED_CATEGORY.id,
          round: match.round,
          seed1_id: match.seed1Id,
          seed2_id: match.seed2Id,
          seed1: index * 2 + 1,
          seed2: index * 2 + 2,
          score1: match.score1,
          score2: match.score2,
        })),
      ),
      `Save matches of ${name}`,
    )
  }
}

/**
 * Saves the tournament type and category, then every seed tournament. The archers and clubs must exist first.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Date} today
 * @returns {Promise<void>}
 */
async function saveTournaments(client, today) {
  const type = SEED_TOURNAMENT_TYPE
  must(
    await client.from('tournament_types').upsert({
      id: type.id,
      name: type.name,
      distance: type.distance,
      distance_unit: type.distanceUnit,
      target_type: type.targetType,
      ends: type.ends,
      arrows_per_end: type.arrowsPerEnd,
    }),
    'Save tournament type',
  )
  must(
    await client
      .from('categories')
      .upsert({ id: SEED_CATEGORY.id, name: SEED_CATEGORY.name, bow_type: SEED_CATEGORY.bowType }),
    'Save category',
  )
  for (const tournament of seedTournaments(today)) {
    await saveTournament(client, tournament, today)
  }
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

  await saveTournaments(client, today)

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

  // Tournaments go first: their entries, scores, and matches point at the archers, type, and category.
  const tournamentIds = seedTournaments(new Date()).map((tournament) => tournament.id)
  must(await client.from('tournaments').delete().in('id', tournamentIds), 'Delete tournaments')
  must(await client.from('tournament_types').delete().eq('id', SEED_TOURNAMENT_TYPE.id), 'Delete tournament type')
  must(await client.from('categories').delete().eq('id', SEED_CATEGORY.id), 'Delete category')

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
