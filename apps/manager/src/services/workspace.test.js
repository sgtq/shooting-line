import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerRepository, readLegacyWorkspace } from './workspace.js'

describe('legacy workspace', () => {
  beforeEach(() => localStorage.clear())

  it('reads the previous key and fills missing tournament and participant fields', () => {
    localStorage.setItem('archery-manager-workspace-v1', JSON.stringify({
      participants: [{ id: 'archer' }],
      tournaments: [{ id: 'event' }],
    }))

    const workspace = readLegacyWorkspace()
    expect(workspace.participants).toEqual([{ id: 'archer', clubId: '' }])
    expect(workspace.tournaments).toEqual([{
      id: 'event',
      rounds: ['Qualification'],
      participantIds: [],
      categoryIds: [],
      categoryAssignments: {},
    }])
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
          data: table === 'tournament_rounds'
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
      tournamentId: 'event', round: 'Qualification', participantId: 'archer', score: 100,
    })
    expect(save).toHaveBeenCalledWith({
      tournament_id: 'event', round_id: 'round-1', participant_id: 'archer', category_id: null, score: 100,
    })

    await repository.saveScore({
      tournamentId: 'event', round: 'Qualification', participantId: 'archer', score: null,
    })
    expect(filters.eq).toHaveBeenNthCalledWith(1, 'round_id', 'round-1')
    expect(filters.eq).toHaveBeenNthCalledWith(2, 'participant_id', 'archer')
  })

  it('deletes the newly created participant if tournament assignment fails', async () => {
    const assignmentError = new Error('Assignment failed')
    const cleanup = vi.fn().mockResolvedValue({ error: null })
    const client = {
      from: vi.fn((table) => table === 'participants'
        ? { insert: vi.fn().mockResolvedValue({ error: null }), delete: () => ({ eq: cleanup }) }
        : { insert: vi.fn().mockResolvedValue({ error: assignmentError }) }),
    }

    await expect(createManagerRepository(client).saveParticipant({
      id: 'archer', firstName: 'Alex', lastName: 'Archer', waId: '', aetayId: '',
    }, 'event')).rejects.toBe(assignmentError)
    expect(cleanup).toHaveBeenCalledWith('id', 'archer')
  })

  it('reports both assignment and cleanup failures', async () => {
    const client = {
      from: vi.fn((table) => table === 'participants'
        ? {
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: () => ({ eq: vi.fn().mockResolvedValue({ error: new Error('Cleanup failed') }) }),
        }
        : { insert: vi.fn().mockResolvedValue({ error: new Error('Assignment failed') }) }),
    }

    await expect(createManagerRepository(client).saveParticipant({
      id: 'archer', firstName: 'Alex', lastName: 'Archer', waId: '', aetayId: '',
    }, 'event')).rejects.toThrow('Assignment failed; cleanup also failed: Cleanup failed')
  })

  it('rejects a score for a round that has not been loaded or created', async () => {
    const client = { from: vi.fn() }
    await expect(createManagerRepository(client).saveScore({
      tournamentId: 'event', round: 'Missing', participantId: 'archer', score: 100,
    })).rejects.toThrow('Could not find round "Missing" in the database.')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid match score side before updating the database', async () => {
    const client = { from: vi.fn() }
    await expect(createManagerRepository(client).setMatchScore('match', 'score3', '10'))
      .rejects.toThrow('Invalid match score side.')
    expect(client.from).not.toHaveBeenCalled()
  })
})
