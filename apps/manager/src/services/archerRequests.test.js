import { describe, expect, it } from 'vitest'
import { groupPendingByClub, requestableArchers, summarizeDecision } from './archerRequests'

const archer = (id, clubId, email = `${id}@example.test`) => ({ id, clubId, email, firstName: id, lastName: 'X' })
const request = (id, participantId, clubId, status = 'pending', createdAt = '2026-01-01T00:00:00Z') => ({
  id,
  participantId,
  clubId,
  status,
  createdAt,
})

describe('requestableArchers', () => {
  it('lists archers of the club that have an email and no open request', () => {
    const people = [archer('a', 'c1'), archer('b', 'c1'), archer('c', 'c2')]
    expect(requestableArchers(people, [], 'c1').map((person) => person.id)).toEqual(['a', 'b'])
  })

  it('leaves out archers without an email, including blank ones', () => {
    const people = [archer('a', 'c1', ''), archer('b', 'c1', '   '), archer('c', 'c1')]
    expect(requestableArchers(people, [], 'c1').map((person) => person.id)).toEqual(['c'])
    expect(requestableArchers([{ id: 'd', clubId: 'c1' }], [], 'c1')).toEqual([])
  })

  it('leaves out archers with a pending or approved request but not a rejected one', () => {
    const people = [archer('a', 'c1'), archer('b', 'c1'), archer('c', 'c1')]
    const requests = [request('r1', 'a', 'c1', 'pending'), request('r2', 'b', 'c1', 'approved')]
    expect(requestableArchers(people, requests, 'c1').map((person) => person.id)).toEqual(['c'])
    expect(requestableArchers(people, [request('r3', 'a', 'c1', 'rejected')], 'c1')).toHaveLength(3)
  })

  it('returns nothing when the club is unknown', () => {
    expect(requestableArchers([archer('a', 'c1')], [], '')).toEqual([])
  })
})

describe('groupPendingByClub', () => {
  const clubs = [
    { id: 'c1', name: 'Zeta' },
    { id: 'c2', name: 'Alpha' },
  ]

  it('groups pending requests by club in name order', () => {
    const groups = groupPendingByClub(
      [request('r1', 'a', 'c1'), request('r2', 'b', 'c2'), request('r3', 'c', 'c1')],
      clubs,
    )
    expect(groups.map((group) => group.club.name)).toEqual(['Alpha', 'Zeta'])
    expect(groups[1].requests.map((item) => item.id)).toEqual(['r1', 'r3'])
  })

  it('orders requests of a club by creation time', () => {
    const groups = groupPendingByClub(
      [request('late', 'a', 'c1', 'pending', '2026-02-01T00:00:00Z'), request('early', 'b', 'c1')],
      clubs,
    )
    expect(groups[0].requests.map((item) => item.id)).toEqual(['early', 'late'])
  })

  it('ignores decided requests and requests of unknown clubs', () => {
    const groups = groupPendingByClub(
      [request('r1', 'a', 'c1', 'approved'), request('r2', 'b', 'c1', 'rejected'), request('r3', 'c', 'gone')],
      clubs,
    )
    expect(groups).toEqual([])
  })
})

describe('summarizeDecision', () => {
  it('separates succeeded ids from failure messages', () => {
    expect(
      summarizeDecision([
        { id: 'a', ok: true },
        { id: 'b', ok: false, error: 'No email' },
        { id: 'c', ok: false },
      ]),
    ).toEqual({ succeededIds: ['a'], failures: ['No email', 'Unknown error'] })
  })

  it('handles an empty result', () => {
    expect(summarizeDecision([])).toEqual({ succeededIds: [], failures: [] })
  })
})
