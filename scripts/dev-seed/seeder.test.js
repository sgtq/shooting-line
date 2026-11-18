// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { SEED_ACCOUNTS, SEED_CLUBS, SEED_EMAIL_DOMAIN, SEED_PLANS, emailFor, seedTournaments } from './cases.js'
import { removeDevData, seedDevData } from './seeder.js'

const TODAY = new Date(Date.UTC(2026, 10, 18))

// Records every table call and answers each with the configured result, so no database is needed.
function makeClient({ users = [], basicPlan = { id: 'basic-plan' }, failTable = null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      const call = { table, ops: [] }
      calls.push(call)
      const result = failTable === table ? { data: null, error: { message: 'boom' } } : { data: null, error: null }
      const builder = {
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        maybeSingle: () => Promise.resolve({ data: basicPlan, error: null }),
      }
      for (const op of ['upsert', 'insert', 'update', 'delete', 'select', 'eq', 'in']) {
        builder[op] = (...args) => {
          call.ops.push([op, ...args])
          return builder
        }
      }
      return builder
    },
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users }, error: null })),
        createUser: vi.fn(async ({ email }) => ({ data: { user: { id: `id-${email}` } }, error: null })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
        deleteUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  }
  return client
}

function upsertedRows(client, table) {
  return client.calls
    .filter((call) => call.table === table)
    .flatMap((call) => call.ops.filter(([op]) => op === 'upsert' || op === 'insert').map(([, rows]) => rows))
}

describe('seedDevData', () => {
  it('creates one account per case with the shared password', async () => {
    const client = makeClient()
    const emails = await seedDevData(client, { password: 'pw', today: TODAY })

    expect(emails).toEqual(SEED_ACCOUNTS.map(emailFor))
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(SEED_ACCOUNTS.length)
    expect(client.auth.admin.createUser).toHaveBeenCalledWith({
      email: emailFor(SEED_ACCOUNTS[0]),
      password: 'pw',
      email_confirm: true,
    })
  })

  it('saves the right roles, and the admin holds both admin and manager', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    const roles = upsertedRows(client, 'user_roles').map((row) => `${row.email}:${row.role}`)
    expect(roles).toContain(`${emailFor(SEED_ACCOUNTS[0])}:admin`)
    expect(roles).toContain(`${emailFor(SEED_ACCOUNTS[0])}:manager`)
    const club = upsertedRows(client, 'user_roles').find((row) => row.role === 'club' && row.email.includes('active'))
    expect(club).toMatchObject({ club_id: SEED_CLUBS[0].id, participant_id: null })
    const archer = upsertedRows(client, 'user_roles').find((row) => row.role === 'archer')
    expect(archer).toMatchObject({ club_id: null, participant_id: SEED_ACCOUNTS[4].participantId })
  })

  it('assigns a plan only to accounts that have one', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    const subscriptions = upsertedRows(client, 'user_subscriptions')
    expect(subscriptions).toHaveLength(SEED_ACCOUNTS.filter((account) => account.subscription).length)
    expect(subscriptions.filter((row) => row.plan_id === 'basic-plan')).toHaveLength(3)
  })

  it('creates the clubs and archers, with the disabled club left without an account', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    expect(upsertedRows(client, 'clubs')[0]).toHaveLength(SEED_CLUBS.length)
    expect(upsertedRows(client, 'participants')[0]).toHaveLength(5)
    const enabledClubs = client.calls
      .filter((call) => call.table === 'clubs' && call.ops.some(([op]) => op === 'update'))
      .map((call) => call.ops.find(([op]) => op === 'eq')[2])
    expect(enabledClubs).toEqual([SEED_CLUBS[0].id, SEED_CLUBS[1].id])
  })

  it('resets the password of an account that already exists instead of creating it again', async () => {
    const existing = { id: 'old-id', email: emailFor(SEED_ACCOUNTS[0]) }
    const client = makeClient({ users: [existing] })
    await seedDevData(client, { password: 'pw', today: TODAY })

    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith('old-id', { password: 'pw', email_confirm: true })
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(SEED_ACCOUNTS.length - 1)
  })

  it('stops with a clear message when the free archer plan is missing', async () => {
    const client = makeClient({ basicPlan: null })
    await expect(seedDevData(client, { password: 'pw', today: TODAY })).rejects.toThrow('Apply the migrations first')
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('stops and names the step when a write fails', async () => {
    const client = makeClient({ failTable: 'clubs' })
    await expect(seedDevData(client, { password: 'pw', today: TODAY })).rejects.toThrow('Save clubs: boom')
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })
})

describe('seed tournaments', () => {
  it('writes the type and category before the tournaments that use them', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    const tables = client.calls.map((call) => call.table)
    expect(tables.indexOf('tournament_types')).toBeLessThan(tables.indexOf('tournaments'))
    expect(tables.indexOf('categories')).toBeLessThan(tables.indexOf('tournament_categories'))
    expect(tables.indexOf('participants')).toBeLessThan(tables.indexOf('tournament_participants'))
  })

  it('saves every tournament with its dates, entries, and scores linked to a saved round', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    const planned = seedTournaments(TODAY)
    expect(upsertedRows(client, 'tournaments').map((row) => row.name)).toEqual(planned.map((item) => item.name))
    const rounds = upsertedRows(client, 'tournament_rounds')
    const scores = upsertedRows(client, 'round_scores').flat()
    expect(scores).toHaveLength(planned.reduce((sum, item) => sum + item.scores.length, 0))
    const roundIds = rounds.flat().map((round) => round.id)
    expect(scores.every((score) => roundIds.includes(score.round_id))).toBe(true)
    expect(upsertedRows(client, 'matches').flat()).toHaveLength(1)
  })

  it('stores a started tournament as started and a future one as not started', async () => {
    const client = makeClient()
    await seedDevData(client, { password: 'pw', today: TODAY })

    const rows = upsertedRows(client, 'tournaments')
    expect(rows.find((row) => row.name === 'Seed Winter Indoor').started_at).toBe(TODAY.toISOString())
    expect(rows.find((row) => row.name === 'Seed Spring Open').started_at).toBeNull()
  })

  it('stops and names the step when a tournament write fails', async () => {
    const client = makeClient({ failTable: 'tournaments' })
    await expect(seedDevData(client, { password: 'pw', today: TODAY })).rejects.toThrow('Save Seed Autumn Indoor: boom')
  })
})

describe('removeDevData', () => {
  it('deletes only the tagged accounts and the seed rows', async () => {
    const real = { id: 'real', email: 'someone@club.org' }
    const seeded = { id: 'seeded', email: `seed-admin@${SEED_EMAIL_DOMAIN}` }
    const client = makeClient({ users: [real, seeded] })

    expect(await removeDevData(client)).toBe(1)
    expect(client.auth.admin.deleteUser).toHaveBeenCalledTimes(1)
    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith('seeded')

    const deletedFrom = client.calls.map((call) => call.table)
    expect(deletedFrom).toEqual(['tournaments', 'tournament_types', 'categories', 'participants', 'clubs', 'plans'])
    const planIds = client.calls[5].ops.find(([op]) => op === 'in')[2]
    expect(planIds).toEqual(SEED_PLANS.map((plan) => plan.id))
  })

  it('stops when a delete fails', async () => {
    const client = makeClient({ failTable: 'participants' })
    await expect(removeDevData(client)).rejects.toThrow('Delete archers: boom')
  })
})
