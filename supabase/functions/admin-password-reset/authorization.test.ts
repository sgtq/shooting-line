import { describe, expect, it } from 'vitest'
import { canResetPassword } from './authorization.ts'

const privilegedEmails = ['Admin@Example.test', 'manager@example.test']

describe('canResetPassword', () => {
  it('lets an admin reset any account, including one with no role', () => {
    expect(canResetPassword(['admin'], 'club@example.test', privilegedEmails)).toBe(true)
    expect(canResetPassword(['admin', 'manager'], 'unknown@elsewhere.test', [])).toBe(true)
  })

  it('lets a manager reset admin and manager accounts, ignoring case and spaces', () => {
    expect(canResetPassword(['manager'], 'admin@example.test', privilegedEmails)).toBe(true)
    expect(canResetPassword(['manager'], '  MANAGER@example.test ', privilegedEmails)).toBe(true)
  })

  it('stops a manager from resetting club, archer, or unknown accounts', () => {
    expect(canResetPassword(['manager'], 'club@example.test', privilegedEmails)).toBe(false)
    expect(canResetPassword(['manager'], 'unknown@elsewhere.test', privilegedEmails)).toBe(false)
  })

  it('does not match a partial address or a different domain', () => {
    expect(canResetPassword(['manager'], 'manager@example.test.evil', privilegedEmails)).toBe(false)
    expect(canResetPassword(['manager'], 'anager@example.test', privilegedEmails)).toBe(false)
  })

  it('denies a manager when no privileged accounts exist', () => {
    expect(canResetPassword(['manager'], 'manager@example.test', [])).toBe(false)
  })
})
