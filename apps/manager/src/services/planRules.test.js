import { describe, expect, it } from 'vitest'
import { activeSubscription, currentPrice, findOverlappingSubscription, suggestedEndDate } from './planRules'

describe('currentPrice', () => {
  const prices = [
    { planId: 'p1', amount: 20, startsAt: '2026-01-01', endsAt: '' },
    { planId: 'p1', amount: 15, startsAt: '2026-06-01', endsAt: '2026-06-30' },
    { planId: 'p2', amount: 99, startsAt: '2026-01-01', endsAt: '' },
  ]

  it('uses the base price outside a deal', () => {
    expect(currentPrice(prices, 'p1', '2026-05-31').amount).toBe(20)
    expect(currentPrice(prices, 'p1', '2026-07-01').amount).toBe(20)
  })

  it('lets a deal override the base price, including on its first and last day', () => {
    expect(currentPrice(prices, 'p1', '2026-06-01').amount).toBe(15)
    expect(currentPrice(prices, 'p1', '2026-06-30').amount).toBe(15)
  })

  it('only looks at the requested plan', () => {
    expect(currentPrice(prices, 'p2', '2026-06-15').amount).toBe(99)
  })

  it('returns null when no price covers the day', () => {
    expect(currentPrice(prices, 'p1', '2025-12-31')).toBeNull()
    expect(currentPrice(prices, 'missing', '2026-06-15')).toBeNull()
  })
})

describe('activeSubscription', () => {
  const subscriptions = [{ id: 's1', userId: 'u1', startsOn: '2026-03-01', endsOn: '2026-03-31' }]

  it('covers both end dates', () => {
    expect(activeSubscription(subscriptions, 'u1', '2026-03-01')?.id).toBe('s1')
    expect(activeSubscription(subscriptions, 'u1', '2026-03-31')?.id).toBe('s1')
  })

  it('is null before, after, or for another user', () => {
    expect(activeSubscription(subscriptions, 'u1', '2026-02-28')).toBeNull()
    expect(activeSubscription(subscriptions, 'u1', '2026-04-01')).toBeNull()
    expect(activeSubscription(subscriptions, 'u2', '2026-03-15')).toBeNull()
  })
})

describe('suggestedEndDate', () => {
  it('ends a monthly plan the day before the same date next month', () => {
    expect(suggestedEndDate('monthly', '2026-03-15')).toBe('2026-04-14')
  })

  it('ends a yearly plan the day before the same date next year', () => {
    expect(suggestedEndDate('yearly', '2026-03-15')).toBe('2027-03-14')
  })

  it('clamps to the last day of a shorter month', () => {
    expect(suggestedEndDate('monthly', '2026-01-31')).toBe('2026-02-27')
  })

  it('handles a leap day and the December rollover', () => {
    expect(suggestedEndDate('yearly', '2028-02-29')).toBe('2029-02-27')
    expect(suggestedEndDate('monthly', '2026-12-01')).toBe('2026-12-31')
  })

  it('gives no suggestion for custom plans', () => {
    expect(suggestedEndDate('custom', '2026-03-15')).toBe('')
  })
})

describe('findOverlappingSubscription', () => {
  const subscriptions = [{ id: 's1', userId: 'u1', startsOn: '2026-03-01', endsOn: '2026-03-31' }]
  const range = (startsOn, endsOn, userId = 'u1') => ({ userId, startsOn, endsOn })

  it('finds a range inside, around, or crossing either end of an existing one', () => {
    expect(findOverlappingSubscription(subscriptions, range('2026-03-10', '2026-03-20'))?.id).toBe('s1')
    expect(findOverlappingSubscription(subscriptions, range('2026-02-01', '2026-04-30'))?.id).toBe('s1')
    expect(findOverlappingSubscription(subscriptions, range('2026-02-15', '2026-03-01'))?.id).toBe('s1')
    expect(findOverlappingSubscription(subscriptions, range('2026-03-31', '2026-04-30'))?.id).toBe('s1')
  })

  it('allows a range that starts the day after, or ends the day before', () => {
    expect(findOverlappingSubscription(subscriptions, range('2026-04-01', '2026-04-30'))).toBeNull()
    expect(findOverlappingSubscription(subscriptions, range('2026-02-01', '2026-02-28'))).toBeNull()
  })

  it('ignores other users', () => {
    expect(findOverlappingSubscription(subscriptions, range('2026-03-10', '2026-03-20', 'u2'))).toBeNull()
  })
})

describe('subscriptions with no end date', () => {
  const open = [{ userId: 'u1', startsOn: '2026-01-01', endsOn: '' }]

  it('stays active on any day from its start', () => {
    expect(activeSubscription(open, 'u1', '2026-01-01')).not.toBeNull()
    expect(activeSubscription(open, 'u1', '2099-12-31')).not.toBeNull()
  })

  it('is not active before its start', () => {
    expect(activeSubscription(open, 'u1', '2025-12-31')).toBeNull()
  })

  it('overlaps any later range for the same user', () => {
    expect(
      findOverlappingSubscription(open, { userId: 'u1', startsOn: '2050-01-01', endsOn: '2050-01-31' }),
    ).not.toBeNull()
    expect(findOverlappingSubscription(open, { userId: 'u1', startsOn: '2025-01-01', endsOn: '2025-12-31' })).toBeNull()
  })

  it('overlaps another open-ended range', () => {
    expect(findOverlappingSubscription(open, { userId: 'u1', startsOn: '2030-01-01', endsOn: '' })).not.toBeNull()
  })

  it('is blocked by an existing range when the new one has no end date', () => {
    const dated = [{ userId: 'u1', startsOn: '2030-01-01', endsOn: '2030-01-31' }]
    expect(findOverlappingSubscription(dated, { userId: 'u1', startsOn: '2029-01-01', endsOn: '' })).not.toBeNull()
    expect(findOverlappingSubscription(dated, { userId: 'u1', startsOn: '2030-02-01', endsOn: '' })).toBeNull()
  })

  it('gives no end date suggestion for unlimited plans', () => {
    expect(suggestedEndDate('unlimited', '2026-01-15')).toBe('')
  })
})
