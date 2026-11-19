import { describe, expect, it } from 'vitest'
import { filterTournaments, findNextTournament, sortByFirstDay } from './tournamentList'

const past = { id: 'past', name: 'Winter Cup', dates: ['2026-01-10', '2026-01-11'] }
const running = { id: 'running', name: 'Spring Open', dates: ['2026-05-01', '2026-05-20'] }
const future = { id: 'future', name: 'Autumn Open', dates: ['2026-09-01'] }
const today = '2026-05-10'

describe('sortByFirstDay', () => {
  it('sorts earliest first without changing the original list', () => {
    const original = [future, past, running]
    expect(sortByFirstDay(original).map((item) => item.id)).toEqual(['past', 'running', 'future'])
    expect(original.map((item) => item.id)).toEqual(['future', 'past', 'running'])
  })
})

describe('findNextTournament', () => {
  it('skips finished tournaments and keeps one that is still running', () => {
    expect(findNextTournament([past, running, future], today)).toBe(running)
  })

  it('counts a tournament as upcoming on its last day', () => {
    expect(findNextTournament([past], '2026-01-11')).toBe(past)
  })

  it('returns undefined when everything is finished or the list is empty', () => {
    expect(findNextTournament([past], today)).toBeUndefined()
    expect(findNextTournament([], today)).toBeUndefined()
  })
})

describe('filterTournaments', () => {
  const sorted = [past, running, future]

  it('splits past from upcoming', () => {
    expect(filterTournaments(sorted, { query: '', status: 'past', today })).toEqual([past])
    expect(filterTournaments(sorted, { query: '', status: 'upcoming', today })).toEqual([running, future])
  })

  it('matches the name without caring about case', () => {
    expect(filterTournaments(sorted, { query: 'OPEN', status: 'upcoming', today })).toEqual([running, future])
    expect(filterTournaments(sorted, { query: 'autumn', status: 'upcoming', today })).toEqual([future])
  })

  it('returns nothing when the query matches only the other status', () => {
    expect(filterTournaments(sorted, { query: 'winter', status: 'upcoming', today })).toEqual([])
  })
})
