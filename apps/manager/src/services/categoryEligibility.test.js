import { describe, expect, it } from 'vitest'
import { categoryBlockReason, categoryChangeOptions } from './categoryEligibility'

const open = { id: 'open', name: 'Recurve Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null }
const youth = { id: 'youth', name: 'Recurve Youth', bowType: 'Recurve', sortOrder: 0, minAge: null, maxAge: 17 }
const pro = { id: 'pro', name: 'Recurve Pro', bowType: 'Recurve', sortOrder: 2, minAge: null, maxAge: null }
const categories = [open, youth, pro]
const archer = { id: 'me', firstName: 'Ana', lastName: 'Archer', birthDate: '2000-01-01' }
const child = { id: 'kid', firstName: 'Kid', lastName: 'Archer', birthDate: '2015-01-01' }

function tournament(assignments = {}, categoryIds = ['open', 'youth', 'pro']) {
  return { id: 't1', dates: ['2026-06-01'], categoryIds, categoryAssignments: assignments }
}

function data(tournaments = []) {
  return { tournaments, categories }
}

describe('categoryBlockReason', () => {
  it('allows an archer inside the age range with no history', () => {
    expect(categoryBlockReason(tournament(), archer, open, data())).toBe('')
  })

  it('refuses an archer below the minimum age', () => {
    expect(categoryBlockReason(tournament(), child, open, data())).toBe(
      "Kid Archer is below this category's minimum age",
    )
  })

  it('refuses an archer above the maximum age', () => {
    expect(categoryBlockReason(tournament(), archer, youth, data())).toBe(
      "Ana Archer is above this category's maximum age",
    )
  })

  it('does not check age when the birth date is unknown', () => {
    expect(categoryBlockReason(tournament(), { ...archer, birthDate: '' }, youth, data())).toBe('')
  })

  it('treats a minimum age of zero as a limit', () => {
    const teens = { ...open, minAge: 0, maxAge: null }
    expect(categoryBlockReason(tournament(), archer, teens, data())).toBe('')
  })

  it('refuses a lower level category after entering a higher one of the same bow type', () => {
    const earlier = tournament({ me: 'pro' })
    expect(categoryBlockReason(tournament(), archer, open, data([earlier]))).toBe(
      'Already entered Recurve Pro, a higher level',
    )
  })

  it('allows the same level or a higher one', () => {
    const earlier = tournament({ me: 'open' })
    expect(categoryBlockReason(tournament(), archer, open, data([earlier]))).toBe('')
    expect(categoryBlockReason(tournament(), archer, pro, data([earlier]))).toBe('')
  })
})

describe('categoryChangeOptions', () => {
  it('lists the other categories of the tournament the archer may enter', () => {
    const current = tournament({ me: 'open' })
    const options = categoryChangeOptions(current, archer, data([current]))
    expect(options.map((category) => category.id)).toEqual(['pro'])
  })

  it('leaves out categories that are not in the catalogue', () => {
    const current = tournament({ me: 'open' }, ['open', 'missing', 'pro'])
    const options = categoryChangeOptions(current, archer, data([current]))
    expect(options.map((category) => category.id)).toEqual(['pro'])
  })

  it('returns nothing when no other category is allowed', () => {
    const current = tournament({ me: 'pro' }, ['pro', 'open'])
    expect(categoryChangeOptions(current, archer, data([current]))).toEqual([])
  })
})
