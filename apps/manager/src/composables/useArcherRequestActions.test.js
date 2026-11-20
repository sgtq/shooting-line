import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useManagerStore } from '../stores/managerStore'
import { useArcherRequestActions } from './useArcherRequestActions'

let store
let repository
let notify

function actionsFor(scope = { clubId: 'club-1' }) {
  return useArcherRequestActions({ repository, scope, notify })
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useManagerStore()
  store.load({ archerRequests: [] })
  repository = {
    createArcherRequest: vi.fn().mockResolvedValue(),
    decideArcherRequests: vi.fn(),
  }
  notify = vi.fn()
})

describe('createArcherRequest', () => {
  it('adds a pending request for the archer in the club of the user', async () => {
    await actionsFor().createArcherRequest('p1')
    const [request] = store.data.archerRequests
    expect(request).toMatchObject({ participantId: 'p1', clubId: 'club-1', status: 'pending' })
    expect(request.id).toBeTruthy()
    expect(Number.isNaN(Date.parse(request.createdAt))).toBe(false)
    expect(repository.createArcherRequest).toHaveBeenCalledWith(request)
    expect(notify).toHaveBeenCalledWith('Request sent')
  })

  it('uses an empty club id for a user with no club', async () => {
    await actionsFor({}).createArcherRequest('p1')
    expect(store.data.archerRequests[0].clubId).toBe('')
  })

  it('adds nothing and stays quiet when the save fails', async () => {
    repository.createArcherRequest.mockRejectedValue(new Error('denied'))
    await actionsFor().createArcherRequest('p1')
    expect(store.data.archerRequests).toEqual([])
    expect(store.databaseError).toBe('Save failed: denied')
    expect(notify).not.toHaveBeenCalled()
  })

  it('creates the list when the workspace has none', async () => {
    store.load({})
    await actionsFor().createArcherRequest('p1')
    expect(store.data.archerRequests).toHaveLength(1)
  })
})

describe('decideArcherRequests', () => {
  beforeEach(() => {
    store.data.archerRequests = [
      { id: 'r1', status: 'pending' },
      { id: 'r2', status: 'pending' },
    ]
  })

  it('marks approved requests and tells the user', async () => {
    repository.decideArcherRequests.mockResolvedValue([
      { id: 'r1', ok: true },
      { id: 'r2', ok: true },
    ])
    await actionsFor().decideArcherRequests({ action: 'approve', requestIds: ['r1', 'r2'] })
    expect(repository.decideArcherRequests).toHaveBeenCalledWith('approve', ['r1', 'r2'])
    expect(store.data.archerRequests.map((item) => item.status)).toEqual(['approved', 'approved'])
    expect(store.databaseError).toBe('')
    expect(notify).toHaveBeenCalledWith('Requests approved')
  })

  it('marks rejected requests', async () => {
    repository.decideArcherRequests.mockResolvedValue([{ id: 'r1', ok: true }])
    await actionsFor().decideArcherRequests({ action: 'reject', requestIds: ['r1'] })
    expect(store.data.archerRequests[0].status).toBe('rejected')
    expect(store.data.archerRequests[1].status).toBe('pending')
    expect(notify).toHaveBeenCalledWith('Requests rejected')
  })

  it('applies the ones that worked and lists the failures', async () => {
    repository.decideArcherRequests.mockResolvedValue([
      { id: 'r1', ok: true },
      { id: 'r2', ok: false, error: 'No email' },
    ])
    await actionsFor().decideArcherRequests({ action: 'approve', requestIds: ['r1', 'r2'] })
    expect(store.data.archerRequests.map((item) => item.status)).toEqual(['approved', 'pending'])
    expect(store.databaseError).toBe('Some requests could not be decided: No email')
    expect(notify).not.toHaveBeenCalled()
  })

  it('shows an unknown error text when a failure has none', async () => {
    repository.decideArcherRequests.mockResolvedValue([{ id: 'r1', ok: false }])
    await actionsFor().decideArcherRequests({ action: 'approve', requestIds: ['r1'] })
    expect(store.databaseError).toContain('Unknown error')
  })

  it('changes nothing when the whole call fails', async () => {
    repository.decideArcherRequests.mockRejectedValue(new Error('offline'))
    await actionsFor().decideArcherRequests({ action: 'approve', requestIds: ['r1'] })
    expect(store.data.archerRequests.map((item) => item.status)).toEqual(['pending', 'pending'])
    expect(store.databaseError).toBe('Save failed: offline')
    expect(notify).not.toHaveBeenCalled()
  })
})
