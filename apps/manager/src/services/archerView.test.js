import { describe, expect, it } from 'vitest'
import {
  averageByCategory,
  buildScoreRows,
  formatDays,
  groupCategoriesByBow,
  isInRange,
  safeMapUrl,
} from './archerView'

const ME = 'me'
const OTHER = 'other'

function makeData() {
  return {
    tournamentTypes: [
      { id: 'ty10', ends: 10 },
      { id: 'ty6', ends: 6 },
    ],
    categories: [{ id: 'c1', name: 'Recurve Open' }],
    tournaments: [
      {
        id: 't1',
        name: 'Spring',
        dates: ['2026-03-01'],
        tournamentTypeId: 'ty10',
        participantIds: [ME, OTHER],
        categoryAssignments: { [ME]: 'c1', [OTHER]: 'c1' },
      },
      {
        id: 't2',
        name: 'Summer',
        dates: ['2026-06-10', '2026-06-11'],
        tournamentTypeId: 'ty6',
        participantIds: [ME],
        categoryAssignments: { [ME]: 'c1' },
      },
      {
        id: 't3',
        name: 'Not mine',
        dates: ['2026-01-01'],
        tournamentTypeId: 'ty10',
        participantIds: [OTHER],
        categoryAssignments: {},
      },
      {
        id: 't4',
        name: 'Later',
        dates: ['2026-12-01'],
        tournamentTypeId: 'ty10',
        participantIds: [ME],
        categoryAssignments: {},
      },
    ],
    scores: [
      { tournamentId: 't1', participantId: ME, round: 'Qualification 1', score: 600 },
      { tournamentId: 't1', participantId: ME, round: 'Qualification 2', score: 640 },
      { tournamentId: 't1', participantId: OTHER, round: 'Qualification 1', score: 700 },
      { tournamentId: 't2', participantId: ME, round: 'Qualification 1', score: 300 },
    ],
    matches: [
      { tournamentId: 't1', round: 'Semifinal', seed1Id: OTHER, seed2Id: ME, score1: 140, score2: 120 },
      { tournamentId: 't1', round: 'Final', seed1Id: ME, seed2Id: OTHER, score1: '', score2: '' },
      { tournamentId: 't1', round: 'Quarter', seed1Id: OTHER, seed2Id: 'third', score1: 1, score2: 2 },
    ],
  }
}

const args = { participantId: ME, today: '2026-06-10' }

describe('isInRange', () => {
  it('includes both ends and treats a blank end as open', () => {
    expect(isInRange('2026-03-01', '2026-03-01', '2026-03-01')).toBe(true)
    expect(isInRange('2026-02-28', '2026-03-01', '')).toBe(false)
    expect(isInRange('2026-03-02', '', '2026-03-01')).toBe(false)
    expect(isInRange('2026-03-02', '', '')).toBe(true)
  })
})

describe('buildScoreRows', () => {
  it('lists started tournaments the archer is entered in, newest first', () => {
    const rows = buildScoreRows({ data: makeData(), ...args })
    expect(rows.map((row) => row.name)).toEqual(['Summer', 'Spring'])
  })

  it('keeps a tournament under way, so its scores are visible', () => {
    const [summer] = buildScoreRows({ data: makeData(), ...args })
    expect(summer).toMatchObject({ firstDay: '2026-06-10', lastDay: '2026-06-11', total: 300 })
  })

  it('totals only the own round scores and reads the own category', () => {
    const spring = buildScoreRows({ data: makeData(), ...args }).find((row) => row.id === 't1')
    expect(spring.total).toBe(1240)
    expect(spring.category).toBe('Recurve Open')
    expect(spring.rounds).toEqual([
      { name: 'Qualification 1', score: 600, ends: 10 },
      { name: 'Qualification 2', score: 640, ends: 10 },
    ])
  })

  it('shows only the own score of a match, never the opponent score', () => {
    const spring = buildScoreRows({ data: makeData(), ...args }).find((row) => row.id === 't1')
    expect(spring.matches).toEqual([
      { round: 'Semifinal', score: 120 },
      { round: 'Final', score: '' },
    ])
    expect(JSON.stringify(spring)).not.toContain('140')
  })

  it('leaves out tournaments the archer is not entered in and ones that have not started', () => {
    const names = buildScoreRows({ data: makeData(), ...args }).map((row) => row.name)
    expect(names).not.toContain('Not mine')
    expect(names).not.toContain('Later')
  })

  it('filters by the first day of the tournament', () => {
    const rows = buildScoreRows({ data: makeData(), ...args, from: '2026-06-01', to: '2026-06-30' })
    expect(rows.map((row) => row.name)).toEqual(['Summer'])
    expect(buildScoreRows({ data: makeData(), ...args, from: '2027-01-01' })).toEqual([])
  })

  it('handles a tournament with no scores and an unknown type', () => {
    const data = makeData()
    data.scores = []
    data.tournaments[1].tournamentTypeId = null
    const rows = buildScoreRows({ data, ...args })
    expect(rows[0]).toMatchObject({ total: 0, rounds: [], matches: [] })
  })

  it('skips a tournament with no dates', () => {
    const data = makeData()
    data.tournaments[0].dates = []
    expect(buildScoreRows({ data, ...args }).map((row) => row.name)).toEqual(['Summer'])
  })
})

describe('averageByCategory', () => {
  const round = (score, ends = 10) => ({ name: 'q', score, ends })

  it('gives one average for each category', () => {
    const rows = [
      { category: 'Recurve Open', rounds: [round(600), round(640)] },
      { category: 'Compound Open', rounds: [round(700)] },
      { category: 'Recurve Open', rounds: [round(620)] },
    ]
    expect(averageByCategory(rows)).toEqual([
      { category: 'Compound Open', ends: 10, showEnds: false, rounds: 1, average: 700 },
      { category: 'Recurve Open', ends: 10, showEnds: false, rounds: 3, average: 620 },
    ])
  })

  it('splits a category by ends when its rounds have a different number of ends', () => {
    const rows = buildScoreRows({ data: makeData(), ...args })
    expect(averageByCategory(rows)).toEqual([
      { category: 'Recurve Open', ends: 6, showEnds: true, rounds: 1, average: 300 },
      { category: 'Recurve Open', ends: 10, showEnds: true, rounds: 2, average: 620 },
    ])
  })

  it('lists rows with no category last', () => {
    const rows = [
      { category: '', rounds: [round(500)] },
      { category: 'Recurve Open', rounds: [round(600)] },
    ]
    expect(averageByCategory(rows).map((line) => line.category)).toEqual(['Recurve Open', ''])
  })

  it('keeps rounds with unknown ends and does not label them', () => {
    const rows = [{ category: 'Recurve Open', rounds: [{ name: 'q', score: 5, ends: null }] }]
    expect(averageByCategory(rows)).toEqual([
      { category: 'Recurve Open', ends: null, showEnds: false, rounds: 1, average: 5 },
    ])
  })

  it('rounds to two decimals and returns nothing when there are no rounds', () => {
    expect(averageByCategory([{ category: 'A', rounds: [1, 1, 2].map((score) => round(score)) }])[0].average).toBe(1.33)
    expect(averageByCategory([])).toEqual([])
    expect(averageByCategory([{ category: 'A', rounds: [] }])).toEqual([])
  })
})

describe('formatDays', () => {
  it('formats one day, a consecutive range, separate days and no days', () => {
    expect(formatDays(['2026-06-10'])).toBe('2026-06-10')
    expect(formatDays(['2026-06-10', '2026-06-11', '2026-06-12'])).toBe('2026-06-10 - 2026-06-12')
    expect(formatDays(['2026-06-10', '2026-06-12'])).toBe('2026-06-10, 2026-06-12')
    expect(formatDays([])).toBe('')
  })
})

describe('safeMapUrl', () => {
  it('keeps web links', () => {
    expect(safeMapUrl('https://maps.example.com/place?q=1')).toBe('https://maps.example.com/place?q=1')
    expect(safeMapUrl('  http://maps.example.com  ')).toBe('http://maps.example.com/')
  })

  it('drops other schemes, plain text, and empty values', () => {
    expect(safeMapUrl('javascript:alert(1)')).toBe('')
    expect(safeMapUrl('data:text/html,hi')).toBe('')
    expect(safeMapUrl('Main street 1')).toBe('')
    expect(safeMapUrl('')).toBe('')
    expect(safeMapUrl(null)).toBe('')
  })
})

describe('groupCategoriesByBow', () => {
  it('groups by bow type and orders both the groups and the names', () => {
    expect(
      groupCategoriesByBow([
        { name: 'Open', bowType: 'Recurve' },
        { name: 'Youth', bowType: 'Recurve' },
        { name: 'Open', bowType: 'Compound' },
        { name: 'Master', bowType: 'Recurve' },
      ]),
    ).toEqual([
      { bowType: 'Compound', names: ['Open'] },
      { bowType: 'Recurve', names: ['Master', 'Open', 'Youth'] },
    ])
  })

  it('returns nothing for no categories', () => {
    expect(groupCategoriesByBow([])).toEqual([])
  })
})
