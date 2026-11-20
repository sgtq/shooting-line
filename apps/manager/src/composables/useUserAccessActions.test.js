import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useManagerStore } from '../stores/managerStore'
import { useUserAccessActions } from './useUserAccessActions'

let store
let repository
let notify
let actions

beforeEach(() => {
  setActivePinia(createPinia())
  store = useManagerStore()
  store.load({
    userRoles: [
      { userId: 'u1', role: 'manager', email: 'a@x.test' },
      { userId: 'u1', role: 'club', email: 'a@x.test' },
      { userId: 'u2', role: 'manager', email: 'b@x.test' },
    ],
  })
  repository = {
    removeUserRole: vi.fn().mockResolvedValue(),
    sendAdminPasswordReset: vi.fn().mockResolvedValue(),
  }
  notify = vi.fn()
  actions = useUserAccessActions({ repository, notify })
})

describe('removeUserRole', () => {
  it('removes only that role of that account', async () => {
    await actions.removeUserRole({ userId: 'u1', role: 'manager' })
    expect(repository.removeUserRole).toHaveBeenCalledWith('u1', 'manager')
    expect(store.data.userRoles.map((item) => `${item.userId}-${item.role}`)).toEqual(['u1-club', 'u2-manager'])
    expect(notify).toHaveBeenCalledWith('User role removed')
  })

  it('keeps the role and stays quiet when the database refuses', async () => {
    repository.removeUserRole.mockRejectedValue(new Error('denied'))
    await actions.removeUserRole({ userId: 'u1', role: 'manager' })
    expect(store.data.userRoles).toHaveLength(3)
    expect(store.databaseError).toBe('Save failed: denied')
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('sendRolePasswordReset', () => {
  it('asks for a reset email and does not reveal whether the account exists', async () => {
    await actions.sendRolePasswordReset({ email: 'a@x.test' })
    expect(repository.sendAdminPasswordReset).toHaveBeenCalledWith('a@x.test')
    expect(notify).toHaveBeenCalledWith('If the account exists, a password reset email will be sent')
  })

  it('shows the error on the page when the request fails', async () => {
    repository.sendAdminPasswordReset.mockRejectedValue(new Error('rate limit'))
    await actions.sendRolePasswordReset({ email: 'a@x.test' })
    expect(store.databaseError).toBe('Save failed: rate limit')
    expect(notify).not.toHaveBeenCalled()
  })
})
