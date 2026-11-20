import { describe, expect, it } from 'vitest'
import {
  canDecide,
  findUserByEmail,
  isAlreadyRegistered,
  isValidEmail,
  MAX_REQUESTS_PER_CALL,
  parseDecision,
} from './decision.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('canDecide', () => {
  it('allows admins and managers only', () => {
    expect(canDecide(['admin'])).toBe(true)
    expect(canDecide(['manager'])).toBe(true)
    expect(canDecide(['club'])).toBe(false)
    expect(canDecide(['archer'])).toBe(false)
    expect(canDecide([])).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts an address and ignores surrounding spaces', () => {
    expect(isValidEmail(' archer@example.test ')).toBe(true)
  })

  it('rejects empty and malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('archer@')).toBe(false)
    expect(isValidEmail('two words@example.test')).toBe(false)
  })
})

describe('parseDecision', () => {
  it('accepts approve and reject with request ids', () => {
    expect(parseDecision({ action: 'approve', requestIds: [id(1), id(2)] })).toEqual({
      action: 'approve',
      requestIds: [id(1), id(2)],
    })
    expect(parseDecision({ action: 'reject', requestIds: [id(1)] })).toEqual({
      action: 'reject',
      requestIds: [id(1)],
    })
  })

  it('removes repeated ids', () => {
    expect(parseDecision({ action: 'approve', requestIds: [id(1), id(1)] })).toEqual({
      action: 'approve',
      requestIds: [id(1)],
    })
  })

  it('rejects an unknown action or a missing body', () => {
    expect(parseDecision({ action: 'delete', requestIds: [id(1)] })).toHaveProperty('error')
    expect(parseDecision(null)).toHaveProperty('error')
    expect(parseDecision(undefined)).toHaveProperty('error')
  })

  it('rejects empty, oversized, and malformed id lists', () => {
    expect(parseDecision({ action: 'approve', requestIds: [] })).toHaveProperty('error')
    expect(parseDecision({ action: 'approve', requestIds: 'abc' })).toHaveProperty('error')
    expect(parseDecision({ action: 'approve', requestIds: ['not-an-id'] })).toHaveProperty('error')
    expect(parseDecision({ action: 'approve', requestIds: [42] })).toHaveProperty('error')
    const tooMany = Array.from({ length: MAX_REQUESTS_PER_CALL + 1 }, (_, n) => id(n))
    expect(parseDecision({ action: 'approve', requestIds: tooMany })).toHaveProperty('error')
  })
})

describe('isAlreadyRegistered', () => {
  it('recognizes the error code and the message wording', () => {
    expect(isAlreadyRegistered({ code: 'email_exists' })).toBe(true)
    expect(isAlreadyRegistered({ message: 'A user with this email address has already been registered' })).toBe(true)
  })

  it('does not treat other failures as an existing login', () => {
    expect(isAlreadyRegistered(null)).toBe(false)
    expect(isAlreadyRegistered({ code: 'over_email_send_rate_limit', message: 'Rate limit' })).toBe(false)
    expect(isAlreadyRegistered({})).toBe(false)
  })
})

describe('findUserByEmail', () => {
  const users = [{ id: 'a', email: 'Archer@Example.test' }, { id: 'b', email: null }, { id: 'c' }]

  it('matches ignoring case and spaces', () => {
    expect(findUserByEmail(users, ' archer@example.TEST ')?.id).toBe('a')
  })

  it('returns null when nobody matches or users have no email', () => {
    expect(findUserByEmail(users, 'other@example.test')).toBeNull()
    expect(findUserByEmail([], 'archer@example.test')).toBeNull()
  })
})
