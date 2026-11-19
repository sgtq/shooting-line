import { describe, expect, it } from 'vitest'
import { countScores, filterArchers } from './archerDirectory'

const people = [
  { id: '1', firstName: 'Alex', lastName: 'Archer', waId: 'WA-100', aetayId: '' },
  { id: '2', firstName: 'Sam', lastName: 'Shooter', waId: '', aetayId: 'AE-7' },
]

describe('filterArchers', () => {
  it('returns everyone for a blank or spaces only term', () => {
    expect(filterArchers(people, '')).toEqual(people)
    expect(filterArchers(people, '   ')).toEqual(people)
  })

  it('matches first name, last name, and both affiliation ids without caring about case', () => {
    expect(filterArchers(people, 'ALEX')).toEqual([people[0]])
    expect(filterArchers(people, 'shoot')).toEqual([people[1]])
    expect(filterArchers(people, 'wa-1')).toEqual([people[0]])
    expect(filterArchers(people, 'ae-7')).toEqual([people[1]])
  })

  it('returns nothing when no field matches', () => {
    expect(filterArchers(people, 'zzz')).toEqual([])
  })
})

describe('countScores', () => {
  const scores = [{ participantId: '1' }, { participantId: '1' }, { participantId: '2' }]
  const matches = [
    { seed1Id: '1', seed2Id: '2', score1: 70, score2: '' },
    { seed1Id: '2', seed2Id: '1', score1: 60, score2: 0 },
    { seed1Id: '1', seed2Id: '2', score1: '', score2: '' },
  ]

  it('adds round scores and match scores', () => {
    expect(countScores('1', scores, matches)).toBe(2 + 2)
  })

  it('counts a score of zero but not an empty one', () => {
    expect(countScores('2', scores, matches)).toBe(1 + 1)
  })

  it('returns zero for an archer with nothing', () => {
    expect(countScores('3', scores, matches)).toBe(0)
  })
})
