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
