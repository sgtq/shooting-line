// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SEED_ACCOUNTS, SEED_CLUBS, SEED_EMAIL_DOMAIN, emailFor, shiftDate, subscriptionFor } from './cases.js'

const TODAY = new Date(Date.UTC(2026, 10, 18))

describe('seed cases', () => {
  it('covers each role and plan case from ticket 5a', () => {
    const kinds = SEED_ACCOUNTS.map(
      (account) => `${account.roles.join('+')}:${account.club ?? '-'}:${account.subscription}`,
    )
    expect(kinds).toEqual([
      'admin+manager:-:null',
      'manager:-:null',
      'club:active:club-active',
      'club:lapsed:club-lapsed',
      'archer:disabled:archer-paid',
      'archer:active:archer-free',
      'archer:disabled:archer-free',
      'archer:-:archer-free',
      'archer:-:null',
    ])
  })

  it('gives every account a unique tagged email', () => {
    const emails = SEED_ACCOUNTS.map(emailFor)
    expect(new Set(emails).size).toBe(emails.length)
    expect(emails.every((email) => email.endsWith(`@${SEED_EMAIL_DOMAIN}`))).toBe(true)
  })

  it('only refers to clubs that exist, and gives the disabled club no account', () => {
    const clubKeys = SEED_CLUBS.map((club) => club.key)
    for (const account of SEED_ACCOUNTS.filter((item) => item.club)) {
      expect(clubKeys).toContain(account.club)
    }
    const clubAccounts = SEED_ACCOUNTS.filter((account) => account.roles.includes('club')).map((a) => a.club)
    expect(clubAccounts).not.toContain('disabled')
  })
})

describe('shiftDate', () => {
  it('moves across month and year ends', () => {
    expect(shiftDate(new Date(Date.UTC(2026, 11, 31)), 1)).toBe('2027-01-01')
    expect(shiftDate(TODAY, -18)).toBe('2026-10-31')
  })
})

describe('subscriptionFor', () => {
  it('returns null for an account with no plan', () => {
    expect(subscriptionFor(null, TODAY)).toBeNull()
  })

  it('covers today for an active club', () => {
    const subscription = subscriptionFor('club-active', TODAY)
    expect(subscription.startsOn <= '2026-11-18' && '2026-11-18' <= subscription.endsOn).toBe(true)
  })

  it('ends before today for a lapsed club', () => {
    expect(subscriptionFor('club-lapsed', TODAY).endsOn < '2026-11-18').toBe(true)
  })

  it('makes the paid archer plan cost money and the free one cost nothing with no end date', () => {
    expect(subscriptionFor('archer-paid', TODAY).pricePaid).toBeGreaterThan(0)
    expect(subscriptionFor('archer-free', TODAY)).toMatchObject({ plan: 'basic', pricePaid: 0, endsOn: null })
  })
})
