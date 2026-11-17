import { describe, expect, it } from 'vitest'
import { defaultLevelOrders, findBlockingCategory } from './categoryRules'

const categories = [
  { id: 'rec-youth', bowType: 'Recurve', sortOrder: 0 },
  { id: 'rec-open', bowType: 'Recurve', sortOrder: 1 },
  { id: 'rec-pro', bowType: 'Recurve', sortOrder: 2 },
  { id: 'rec-open-2', bowType: 'Recurve', sortOrder: 1 },
  { id: 'rec-master', bowType: 'Recurve', sortOrder: 0, levelExempt: true },
  { id: 'comp-youth', bowType: 'Compound', sortOrder: 0 },
]
const byId = (id) => categories.find((category) => category.id === id)

function check(entered, target) {
  const tournaments = [{ categoryAssignments: entered ? { a1: entered } : {} }, { categoryAssignments: {} }]
  return findBlockingCategory({ participantId: 'a1', category: byId(target), tournaments, categories })
}

describe('findBlockingCategory', () => {
  it('blocks a lower level after a higher one', () => {
    expect(check('rec-open', 'rec-youth')?.id).toBe('rec-open')
  })

  it('blocks every lower level after the highest one', () => {
    expect(check('rec-pro', 'rec-youth')?.id).toBe('rec-pro')
    expect(check('rec-pro', 'rec-open')?.id).toBe('rec-pro')
  })

  it('allows the same or a higher level', () => {
    expect(check('rec-open', 'rec-open')).toBeNull()
    expect(check('rec-open', 'rec-open-2')).toBeNull()
    expect(check('rec-open', 'rec-pro')).toBeNull()
  })

  it('does not apply across bow types', () => {
    expect(check('rec-pro', 'comp-youth')).toBeNull()
  })

  it('allows an archer with no history', () => {
    expect(check('', 'rec-youth')).toBeNull()
  })

  it('lets an exempt category be entered after any level', () => {
    expect(check('rec-pro', 'rec-master')).toBeNull()
  })

  it('does not let an exempt category block a level', () => {
    expect(check('rec-master', 'rec-youth')).toBeNull()
    expect(check('rec-master', 'rec-open')).toBeNull()
    expect(check('rec-master', 'rec-pro')).toBeNull()
  })
})

describe('defaultLevelOrders', () => {
  it('ranks each bow type separately by minimum age, then maximum age, then list position', () => {
    const orders = defaultLevelOrders([
      { id: 'rec-pro', bowType: 'Recurve', minAge: 18, maxAge: null },
      { id: 'rec-youth', bowType: 'Recurve', minAge: '', maxAge: 17 },
      { id: 'comp-open', bowType: 'Compound', minAge: 18, maxAge: null },
      { id: 'rec-open', bowType: 'Recurve', minAge: null, maxAge: 40 },
      { id: 'rec-same', bowType: 'Recurve', minAge: 18, maxAge: null },
    ])

    expect(orders.get('rec-youth')).toBe(0)
    expect(orders.get('rec-open')).toBe(1)
    expect(orders.get('rec-pro')).toBe(2)
    expect(orders.get('rec-same')).toBe(3)
    expect(orders.get('comp-open')).toBe(0)
  })

  it('returns an empty map for no categories', () => {
    expect(defaultLevelOrders([]).size).toBe(0)
  })
})
