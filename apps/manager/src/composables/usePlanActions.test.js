import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useManagerStore } from '../stores/managerStore'
import { usePlanActions } from './usePlanActions'

let store
let repository
let notify
let actions

beforeEach(() => {
  setActivePinia(createPinia())
  store = useManagerStore()
  store.load({ plans: [], planPrices: [], subscriptions: [] })
  repository = {
    savePlan: vi.fn().mockResolvedValue(),
    savePlanPrice: vi.fn().mockResolvedValue(),
    saveSubscription: vi.fn().mockResolvedValue(),
    updateSubscriptionEnd: vi.fn().mockResolvedValue(),
    removeSubscription: vi.fn().mockResolvedValue(),
  }
  notify = vi.fn()
  actions = usePlanActions({ repository, notify })
})

describe('savePlan', () => {
  it('gives a new plan an id and the defaults, then adds it', async () => {
    await actions.savePlan({ name: 'Club monthly' })
    const saved = repository.savePlan.mock.calls[0][0]
    expect(saved.id).toBeTruthy()
    expect(saved).toMatchObject({ name: 'Club monthly', userRole: 'club', isActive: true })
    expect(store.data.plans).toEqual([saved])
  })

  it('keeps the id, role, and active flag it is given and replaces the plan in the list', async () => {
    store.data.plans = [{ id: 'p1', name: 'Old', userRole: 'archer', isActive: true }]
    await actions.savePlan({ id: 'p1', name: 'New', userRole: 'archer', isActive: false })
    expect(store.data.plans).toEqual([{ id: 'p1', name: 'New', userRole: 'archer', isActive: false }])
  })

  it('keeps the list unchanged and shows the error when the save fails', async () => {
    repository.savePlan.mockRejectedValue(new Error('denied'))
    await actions.savePlan({ name: 'Nope' })
    expect(store.data.plans).toEqual([])
    expect(store.databaseError).toBe('Save failed: denied')
  })

  it('creates the list when the workspace has none', async () => {
    store.load({})
    await actions.savePlan({ name: 'First' })
    expect(store.data.plans).toHaveLength(1)
  })
})

describe('savePlanPrice', () => {
  it('adds a price with its own id and tells the user', async () => {
    await actions.savePlanPrice({ planId: 'p1', amount: 10 })
    expect(store.data.planPrices).toHaveLength(1)
    expect(store.data.planPrices[0]).toMatchObject({ planId: 'p1', amount: 10 })
    expect(store.data.planPrices[0].id).toBeTruthy()
    expect(notify).toHaveBeenCalledWith('Price saved')
  })

  it('says nothing when the save fails', async () => {
    repository.savePlanPrice.mockRejectedValue(new Error('denied'))
    await actions.savePlanPrice({ planId: 'p1', amount: 10 })
    expect(store.data.planPrices).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('saveSubscription', () => {
  const subscription = { userId: 'u1', planId: 'p1', startsOn: '2026-01-01', endsOn: '2026-01-31' }

  it('assigns a plan and tells the user', async () => {
    await actions.saveSubscription(subscription)
    expect(store.data.subscriptions).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith('Plan assigned')
  })

  it('refuses a plan that overlaps an existing one for the same account without calling the database', async () => {
    store.data.subscriptions = [{ id: 's0', userId: 'u1', startsOn: '2026-01-15', endsOn: '2026-02-15' }]
    await actions.saveSubscription(subscription)
    expect(repository.saveSubscription).not.toHaveBeenCalled()
    expect(store.data.subscriptions).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith('This account already has a plan during these dates')
  })

  it('allows the same dates for a different account', async () => {
    store.data.subscriptions = [{ id: 's0', userId: 'u2', startsOn: '2026-01-01', endsOn: '2026-01-31' }]
    await actions.saveSubscription(subscription)
    expect(store.data.subscriptions).toHaveLength(2)
  })
})

describe('setSubscriptionEnd', () => {
  it('sets the end date on the saved plan', async () => {
    store.data.subscriptions = [{ id: 's1', endsOn: '' }]
    await actions.setSubscriptionEnd({ subscription: { id: 's1' }, endsOn: '2026-12-31' })
    expect(repository.updateSubscriptionEnd).toHaveBeenCalledWith('s1', '2026-12-31')
    expect(store.data.subscriptions[0].endsOn).toBe('2026-12-31')
    expect(notify).toHaveBeenCalledWith('End date saved')
  })

  it('does not change the plan when the save fails', async () => {
    repository.updateSubscriptionEnd.mockRejectedValue(new Error('denied'))
    store.data.subscriptions = [{ id: 's1', endsOn: '' }]
    await actions.setSubscriptionEnd({ subscription: { id: 's1' }, endsOn: '2026-12-31' })
    expect(store.data.subscriptions[0].endsOn).toBe('')
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('removeSubscription', () => {
  it('removes only that plan', async () => {
    store.data.subscriptions = [{ id: 's1' }, { id: 's2' }]
    await actions.removeSubscription({ id: 's1' })
    expect(repository.removeSubscription).toHaveBeenCalledWith('s1')
    expect(store.data.subscriptions).toEqual([{ id: 's2' }])
  })

  it('keeps the plan when the database refuses', async () => {
    repository.removeSubscription.mockRejectedValue(new Error('denied'))
    store.data.subscriptions = [{ id: 's1' }]
    await actions.removeSubscription({ id: 's1' })
    expect(store.data.subscriptions).toHaveLength(1)
  })
})
