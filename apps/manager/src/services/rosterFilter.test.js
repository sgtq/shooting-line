import { describe, expect, it } from 'vitest'
import { filterRoster, rosterSearchOptions, UNASSIGNED_CLUB } from './rosterFilter'

const ana = { id: 'a', firstName: 'Ana', lastName: 'Archer', waId: 'WA-1', aetayId: '', clubId: 'c1' }
const bo = { id: 'b', firstName: 'Bo', lastName: 'Bowman', waId: '', aetayId: 'AE-2', clubId: '' }
const cy = { id: 'c', firstName: 'Cy', lastName: 'Archer', waId: '', aetayId: '', clubId: 'c2' }
const all = [ana, bo, cy]
const entered = ['a', 'b']

describe('filterRoster', () => {
  it('keeps only archers entered in the tournament', () => {
    expect(filterRoster(all, entered, { clubId: '', query: '' })).toEqual([ana, bo])
    expect(filterRoster(all, [], { clubId: '', query: '' })).toEqual([])
  })

  it('filters by club, and by no club', () => {
    expect(filterRoster(all, entered, { clubId: 'c1', query: '' })).toEqual([ana])
    expect(filterRoster(all, entered, { clubId: UNASSIGNED_CLUB, query: '' })).toEqual([bo])
    expect(filterRoster(all, entered, { clubId: 'c2', query: '' })).toEqual([])
  })

  it('matches the last name and both affiliation ids without caring about case or spaces around', () => {
    expect(filterRoster(all, entered, { clubId: '', query: '  BOW ' })).toEqual([bo])
    expect(filterRoster(all, entered, { clubId: '', query: 'wa-1' })).toEqual([ana])
    expect(filterRoster(all, entered, { clubId: '', query: 'ae-2' })).toEqual([bo])
  })

  it('does not match on the first name', () => {
    expect(filterRoster(all, entered, { clubId: '', query: 'ana' })).toEqual([])
  })

  it('combines the club filter and the query', () => {
    expect(filterRoster(all, entered, { clubId: 'c1', query: 'bow' })).toEqual([])
  })
})

describe('rosterSearchOptions', () => {
  it('suggests distinct last names and ids of entered archers only', () => {
    expect(rosterSearchOptions(all, ['a', 'b', 'c'], '')).toEqual(['Archer', 'WA-1', 'Bowman', 'AE-2'])
  })

  it('follows the club filter and skips empty values', () => {
    expect(rosterSearchOptions(all, entered, UNASSIGNED_CLUB)).toEqual(['Bowman', 'AE-2'])
    expect(rosterSearchOptions(all, [], '')).toEqual([])
  })
})
