import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerRepository, readLegacyWorkspace } from './workspace.js'

describe('legacy workspace', () => {
  beforeEach(() => localStorage.clear())

  it('reads the previous key and fills missing tournament and participant fields', () => {
    localStorage.setItem(
      'archery-manager-workspace-v1',
      JSON.stringify({
        participants: [{ id: 'archer' }],
        tournaments: [{ id: 'event' }],
      }),
    )

    const workspace = readLegacyWorkspace()
    expect(workspace.participants).toEqual([{ id: 'archer', clubId: '' }])
    expect(workspace.tournaments).toEqual([
      {
        id: 'event',
        rounds: ['Qualification'],
        participantIds: [],
        categoryIds: [],
        categoryAssignments: {},
      },
    ])
    expect(workspace.clubs).toEqual([])
  })

  it('uses the current key in preference to the old key', () => {
    localStorage.setItem('shooting-line-workspace-v1', JSON.stringify({ clubs: [{ id: 'current' }] }))
    localStorage.setItem('archery-manager-workspace-v1', JSON.stringify({ clubs: [{ id: 'old' }] }))
    expect(readLegacyWorkspace().clubs).toEqual([{ id: 'current' }])
  })

  it('reports malformed saved data rather than importing an empty workspace', () => {
    localStorage.setItem('shooting-line-workspace-v1', '{')
    expect(() => readLegacyWorkspace()).toThrow('Saved browser data could not be parsed')
  })
})

describe('manager repository', () => {
  it('loads rounds and uses their database IDs when saving or clearing scores', async () => {
    const save = vi.fn().mockResolvedValue({ error: null })
    const filters = { eq: vi.fn().mockReturnThis() }
    filters.eq.mockImplementationOnce(() => filters).mockResolvedValueOnce({ error: null })
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn((table) => ({
        select: vi.fn().mockResolvedValue({
          data:
            table === 'tournament_rounds'
              ? [{ id: 'round-1', tournament_id: 'event', name: 'Qualification', position: 0 }]
              : [],
          error: null,
        }),
        upsert: save,
        delete: () => filters,
      })),
    }
    const repository = createManagerRepository(client)
    await repository.load()
    await repository.saveScore({
      tournamentId: 'event',
      round: 'Qualification',
      participantId: 'archer',
      score: 100,
    })
    expect(save).toHaveBeenCalledWith({
      tournament_id: 'event',
      round_id: 'round-1',
      participant_id: 'archer',
      category_id: null,
      score: 100,
    })

    await repository.saveScore({
      tournamentId: 'event',
      round: 'Qualification',
      participantId: 'archer',
      score: null,
    })
    expect(filters.eq).toHaveBeenNthCalledWith(1, 'round_id', 'round-1')
    expect(filters.eq).toHaveBeenNthCalledWith(2, 'participant_id', 'archer')
  })

  it('deletes the newly created participant if tournament assignment fails', async () => {
    const assignmentError = new Error('Assignment failed')
    const cleanup = vi.fn().mockResolvedValue({ error: null })
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn((table) =>
        table === 'participants'
          ? { insert: vi.fn().mockResolvedValue({ error: null }), delete: () => ({ eq: cleanup }) }
          : { insert: vi.fn().mockResolvedValue({ error: assignmentError }) },
      ),
    }

    await expect(
      createManagerRepository(client).saveParticipant(
        {
          id: 'archer',
          firstName: 'Alex',
          lastName: 'Archer',
          waId: '',
          aetayId: '',
        },
        'event',
      ),
    ).rejects.toBe(assignmentError)
    expect(cleanup).toHaveBeenCalledWith('id', 'archer')
  })

  it('reports both assignment and cleanup failures', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn((table) =>
        table === 'participants'
          ? {
              insert: vi.fn().mockResolvedValue({ error: null }),
              delete: () => ({ eq: vi.fn().mockResolvedValue({ error: new Error('Cleanup failed') }) }),
            }
          : { insert: vi.fn().mockResolvedValue({ error: new Error('Assignment failed') }) },
      ),
    }

    await expect(
      createManagerRepository(client).saveParticipant(
        {
          id: 'archer',
          firstName: 'Alex',
          lastName: 'Archer',
          waId: '',
          aetayId: '',
        },
        'event',
      ),
    ).rejects.toThrow('Assignment failed; cleanup also failed: Cleanup failed')
  })

  it('rejects a score for a round that has not been loaded or created', async () => {
    const client = { from: vi.fn() }
    await expect(
      createManagerRepository(client).saveScore({
        tournamentId: 'event',
        round: 'Missing',
        participantId: 'archer',
        score: 100,
      }),
    ).rejects.toThrow('Could not find round "Missing" in the database.')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid match score side before updating the database', async () => {
    const client = { from: vi.fn() }
    await expect(createManagerRepository(client).setMatchScore('match', 'score3', '10')).rejects.toThrow(
      'Invalid match score side.',
    )
    expect(client.from).not.toHaveBeenCalled()
  })

  it('calls set_club_user_access when enabling or disabling a club user', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const client = { rpc }
    await createManagerRepository(client).setClubEnabled('club-1', true)

    expect(rpc).toHaveBeenCalledWith('set_club_user_access', {
      p_club_id: 'club-1',
      p_enabled: true,
    })
  })

  describe('saveClub', () => {
    const club = {
      id: 'club-1',
      name: 'North',
      representative: 'Rep',
      phone: '1',
      email: ' new@example.test ',
      website: 'w',
      address: 'a',
      mapUrl: 'm',
      logoUrl: '',
      userEnabled: true,
    }

    it('saves details and access in one RPC so a failure leaves both unchanged', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: null })
      const client = { rpc, from: vi.fn() }
      await createManagerRepository(client).saveClub(club, { syncUserAccess: true })

      expect(rpc).toHaveBeenCalledTimes(1)
      expect(rpc).toHaveBeenCalledWith('save_club_with_access', {
        p_id: 'club-1',
        p_name: 'North',
        p_representative: 'Rep',
        p_phone: '1',
        p_email: ' new@example.test ',
        p_website: 'w',
        p_address: 'a',
        p_map_url: 'm',
        p_logo_url: '',
        p_user_email: 'new@example.test',
        p_enabled: true,
        p_sync_access: true,
      })
      expect(client.from).not.toHaveBeenCalled()
    })

    it('asks to sync access when disabling a club that was enabled', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: null })
      await createManagerRepository({ rpc }).saveClub(
        { ...club, userEnabled: false },
        { syncUserAccess: true, hadUserEnabled: true },
      )

      expect(rpc.mock.calls[0][1]).toMatchObject({ p_enabled: false, p_sync_access: true })
    })

    it('skips the access sync when the club was and stays disabled', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: null })
      await createManagerRepository({ rpc }).saveClub({ ...club, userEnabled: false }, { syncUserAccess: true })

      expect(rpc.mock.calls[0][1]).toMatchObject({ p_enabled: false, p_sync_access: false })
    })

    it('throws the RPC error, for example for an account already used by another club', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: new Error('That account is already assigned to another club') })

      await expect(createManagerRepository({ rpc }).saveClub(club, { syncUserAccess: true })).rejects.toThrow(
        'That account is already assigned to another club',
      )
    })

    it('updates only the details when the user cannot manage access', async () => {
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn().mockReturnValue({ eq })
      const client = { from: vi.fn().mockReturnValue({ update }), rpc: vi.fn() }
      await createManagerRepository(client).saveClub(club)

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'North', logo_url: '' }))
      expect(eq).toHaveBeenCalledWith('id', 'club-1')
      expect(client.rpc).not.toHaveBeenCalled()
    })
  })

  describe('importLegacyWorkspace', () => {
    const emptyWorkspace = {
      clubs: [],
      participants: [],
      tournamentTypes: [],
      categories: [],
      tournaments: [],
      scores: [],
      matches: [],
    }

    it('sends no level order for older browser data so the database ranks the categories', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: null })
      await createManagerRepository({ rpc }).importLegacyWorkspace({
        ...emptyWorkspace,
        categories: [{ id: 'pro', name: 'Pro', minAge: 18, maxAge: '', bowType: 'Recurve' }],
      })

      const [category] = rpc.mock.calls[0][1].p_workspace.categories
      expect(category.sort_order).toBeUndefined()
      expect(category.level_exempt).toBe(false)
      expect(JSON.parse(JSON.stringify(category))).not.toHaveProperty('sort_order')
    })

    it('keeps a level order and exemption that the data already has', async () => {
      const rpc = vi.fn().mockResolvedValue({ error: null })
      await createManagerRepository({ rpc }).importLegacyWorkspace({
        ...emptyWorkspace,
        categories: [
          {
            id: 'masters',
            name: 'Masters',
            minAge: 50,
            maxAge: '',
            bowType: 'Recurve',
            sortOrder: 0,
            levelExempt: true,
          },
          { id: 'open', name: 'Open', minAge: '', maxAge: '', bowType: 'Recurve', sortOrder: 5, levelExempt: false },
        ],
      })

      const categories = rpc.mock.calls[0][1].p_workspace.categories
      expect(categories).toMatchObject([
        { name: 'Masters', sort_order: 0, level_exempt: true },
        { name: 'Open', sort_order: 5, level_exempt: false },
      ])
    })
  })

  it('updates an existing participant when editing', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const client = { from: vi.fn().mockReturnValue({ update }) }
    await createManagerRepository(client).saveParticipant(
      {
        id: 'archer-1',
        firstName: 'Alex',
        lastName: 'Archer',
        birthDate: '2000-01-01',
        waId: 'WA-1',
        aetayId: '',
        clubId: 'club-1',
      },
      '',
      true,
    )

    expect(update).toHaveBeenCalledWith({
      first_name: 'Alex',
      last_name: 'Archer',
      birth_date: '2000-01-01',
      wa_id: 'WA-1',
      aetay_id: '',
      club_id: 'club-1',
    })
    expect(eq).toHaveBeenCalledWith('id', 'archer-1')
  })
})

describe('plans repository', () => {
  function planClient(result = { error: null }) {
    const insert = vi.fn().mockResolvedValue(result)
    const upsert = vi.fn().mockResolvedValue(result)
    const eq = vi.fn().mockResolvedValue(result)
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn(() => ({
        insert,
        upsert,
        delete: () => ({ eq }),
        select: vi.fn().mockResolvedValue({
          data:
            {
              plans: [{ id: 'p1', name: 'Monthly', user_role: 'club', duration_kind: 'monthly', is_active: true }],
              plan_prices: [
                { id: 'pr1', plan_id: 'p1', amount: '12.50', currency: 'MXN', starts_at: '2026-01-01', ends_at: null },
              ],
              user_subscriptions: [
                {
                  id: 's1',
                  user_id: 'u1',
                  plan_id: 'p1',
                  starts_on: '2026-01-01',
                  ends_on: '2026-01-31',
                  price_paid: '10.00',
                  currency: 'MXN',
                },
              ],
            }[client.from.mock.lastCall[0]] || [],
          error: null,
        }),
      })),
    }
    return { client, insert, upsert, eq }
  }

  it('loads plans, prices, and subscriptions with numbers and empty end dates normalized', async () => {
    const { client } = planClient()
    const data = await createManagerRepository(client).load()

    expect(data.plans).toEqual([
      { id: 'p1', name: 'Monthly', userRole: 'club', durationKind: 'monthly', isActive: true },
    ])
    expect(data.planPrices[0]).toEqual(expect.objectContaining({ amount: 12.5, endsAt: '' }))
    expect(data.subscriptions[0]).toEqual(
      expect.objectContaining({ userId: 'u1', pricePaid: 10, endsOn: '2026-01-31' }),
    )
  })

  it('writes plans, prices, and subscriptions with database column names', async () => {
    const { client, insert, upsert, eq } = planClient()
    const repository = createManagerRepository(client)

    await repository.savePlan({ id: 'p1', name: 'Yearly', userRole: 'club', durationKind: 'yearly', isActive: false })
    expect(upsert).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Yearly',
      user_role: 'club',
      duration_kind: 'yearly',
      is_active: false,
    })

    await repository.savePlanPrice({
      id: 'pr',
      planId: 'p1',
      amount: 9,
      currency: 'MXN',
      startsAt: '2026-02-01',
      endsAt: '',
    })
    expect(insert).toHaveBeenLastCalledWith({
      id: 'pr',
      plan_id: 'p1',
      amount: 9,
      currency: 'MXN',
      starts_at: '2026-02-01',
      ends_at: null,
    })

    await repository.saveSubscription({
      id: 's',
      userId: 'u1',
      planId: 'p1',
      startsOn: '2026-02-01',
      endsOn: '2026-02-28',
      pricePaid: 9,
      currency: 'MXN',
    })
    expect(insert).toHaveBeenLastCalledWith({
      id: 's',
      user_id: 'u1',
      plan_id: 'p1',
      starts_on: '2026-02-01',
      ends_on: '2026-02-28',
      price_paid: 9,
      currency: 'MXN',
    })

    await repository.removeSubscription('s')
    expect(eq).toHaveBeenCalledWith('id', 's')
  })

  it('throws the database error when a write is rejected', async () => {
    const { client } = planClient({ error: new Error('row-level security') })
    const repository = createManagerRepository(client)

    await expect(
      repository.savePlan({ id: 'p', name: 'x', userRole: 'club', durationKind: 'custom', isActive: true }),
    ).rejects.toThrow('row-level security')
    await expect(repository.removeSubscription('s')).rejects.toThrow('row-level security')
  })
})

describe('tournament start lock', () => {
  it('loads started_at and writes or clears it', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn(() => ({
        update,
        select: vi.fn().mockResolvedValue({
          data: [{ id: 't1', name: 'Cup', date: '2026-05-05', club_id: null, started_at: '2026-05-05T10:00:00Z' }],
          error: null,
        }),
      })),
    }
    const repository = createManagerRepository(client)

    const data = await repository.load()
    expect(data.tournaments[0].startedAt).toBe('2026-05-05T10:00:00Z')

    await repository.setTournamentStarted('t1', '2026-05-06T00:00:00Z')
    expect(update).toHaveBeenLastCalledWith({ started_at: '2026-05-06T00:00:00Z' })
    await repository.setTournamentStarted('t1', '')
    expect(update).toHaveBeenLastCalledWith({ started_at: null })
    expect(eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws when the database refuses the change', async () => {
    const client = {
      from: () => ({ update: () => ({ eq: vi.fn().mockResolvedValue({ error: new Error('denied') }) }) }),
    }
    await expect(createManagerRepository(client).setTournamentStarted('t1', '')).rejects.toThrow('denied')
  })
})

describe('archers a club cannot read in full', () => {
  function clientWith({ participants = [], names = [], rpcResult } = {}) {
    return {
      rpc: vi.fn((name) =>
        Promise.resolve(name === 'visible_participant_names' ? { data: names, error: null } : rpcResult),
      ),
      from: vi.fn((table) => ({
        select: vi.fn().mockResolvedValue({ data: table === 'participants' ? participants : [], error: null }),
      })),
    }
  }

  it('adds name-only archers without birth dates or IDs, and lets full records win', async () => {
    const client = clientWith({
      participants: [
        {
          id: 'own',
          first_name: 'Alex',
          last_name: 'Archer',
          birth_date: '2000-01-01',
          wa_id: 'WA-1',
          aetay_id: '',
          club_id: 'club-1',
        },
      ],
      names: [
        { id: 'own', first_name: 'Alex', last_name: 'Archer', club_id: 'club-1' },
        { id: 'other', first_name: 'Sam', last_name: 'Shooter', club_id: 'club-2' },
      ],
    })
    const { participants } = await createManagerRepository(client).load()

    expect(participants).toHaveLength(2)
    expect(participants[0]).toEqual(expect.objectContaining({ id: 'own', birthDate: '2000-01-01', waId: 'WA-1' }))
    expect(participants[0].nameOnly).toBeUndefined()
    expect(participants[1]).toEqual({
      id: 'other',
      firstName: 'Sam',
      lastName: 'Shooter',
      birthDate: '',
      waId: '',
      aetayId: '',
      clubId: 'club-2',
      nameOnly: true,
    })
  })

  it('fails the load when the names cannot be read', async () => {
    const client = clientWith()
    client.rpc.mockResolvedValueOnce({ data: null, error: new Error('names denied') })
    await expect(createManagerRepository(client).load()).rejects.toThrow('names denied')
  })
})

describe('searching archers', () => {
  const row = { token: 'tok-1', first_name: 'Sam', last_name: 'Shooter', club_id: 'club-2' }

  it('sends the typed fields and returns only a token, names, and the club', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [row], error: null }) }
    const found = await createManagerRepository(client).searchArchers({ affiliationId: 'WA-5', lastName: 'Sho' })

    expect(client.rpc).toHaveBeenCalledWith('search_archers', {
      p_affiliation_id: 'WA-5',
      p_last_name: 'Sho',
      p_first_name: null,
      p_tournament_id: null,
    })
    expect(found).toEqual([{ token: 'tok-1', firstName: 'Sam', lastName: 'Shooter', clubId: 'club-2' }])
  })

  it('treats a club-less archer as an empty club and surfaces a refusal', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [{ ...row, club_id: null }], error: null }) }
    expect((await createManagerRepository(client).searchArchers({ lastName: 'Sho' }))[0].clubId).toBe('')

    client.rpc.mockResolvedValue({ data: null, error: new Error('An active plan is required to search archers') })
    await expect(createManagerRepository(client).searchArchers({ lastName: 'Sho' })).rejects.toThrow('active plan')
  })

  it('adds the archer behind a token, with no category when none is chosen', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ id: 'a1', first_name: 'Sam', last_name: 'Shooter', club_id: 'club-2' }],
        error: null,
      }),
    }
    const archer = await createManagerRepository(client).addArcherByToken('t1', 'tok-1')

    expect(client.rpc).toHaveBeenCalledWith('add_archer_by_token', {
      p_tournament_id: 't1',
      p_token: 'tok-1',
      p_category_id: null,
    })
    expect(archer).toEqual(expect.objectContaining({ id: 'a1', nameOnly: true, birthDate: '', waId: '' }))
  })

  it('throws when the token has expired or the add is refused', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('That search result has expired. Search again') }),
    }
    await expect(createManagerRepository(client).addArcherByToken('t1', 'old')).rejects.toThrow('expired')
  })
})
