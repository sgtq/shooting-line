import { describe, expect, it, vi } from 'vitest'
import { hasAppAccess, listAppAccess } from './index.js'

function accessClient(result) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return { client: { from: vi.fn().mockReturnValue(query) }, query }
}

describe('app access queries', () => {
  it('lists only the requested user’s granted app IDs', async () => {
    const { client, query } = accessClient({
      data: [{ app_id: 'manager' }, { app_id: 'scorecard' }],
      error: null,
    })

    await expect(listAppAccess(client, 'user-1')).resolves.toEqual({
      data: ['manager', 'scorecard'],
      error: null,
    })
    expect(client.from).toHaveBeenCalledWith('app_access')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('surfaces a failed grant lookup', async () => {
    const error = new Error('Access query failed')
    const { client } = accessClient({ data: null, error })

    await expect(listAppAccess(client, 'user-1')).resolves.toEqual({ data: [], error })
    await expect(hasAppAccess(client, 'user-1', 'manager')).resolves.toEqual({ allowed: false, error })
  })

  it.each([
    [{ app_id: 'manager' }, true],
    [null, false],
  ])('checks a specific grant without granting missing access', async (data, allowed) => {
    const { client, query } = accessClient({ data, error: null })

    await expect(hasAppAccess(client, 'user-1', 'manager')).resolves.toEqual({ allowed, error: null })
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'app_id', 'manager')
  })
})
