import { describe, expect, it } from 'vitest'
import { averageByEnds, buildScoreRows, formatDays, isInRange } from './archerView'

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

describe('averageByEnds', () => {
  it('averages round scores separately for each ends count', () => {
    const rows = buildScoreRows({ data: makeData(), ...args })
    expect(averageByEnds(rows)).toEqual([
      { ends: 6, rounds: 1, average: 300 },
      { ends: 10, rounds: 2, average: 620 },
    ])
  })

  it('rounds to two decimals', () => {
    const rows = [{ rounds: [1, 1, 2].map((score) => ({ name: 'q', score, ends: 10 })) }]
    expect(averageByEnds(rows)).toEqual([{ ends: 10, rounds: 3, average: 1.33 }])
  })

  it('ignores rounds with unknown ends and returns nothing when there are no rounds', () => {
    expect(averageByEnds([{ rounds: [{ name: 'q', score: 5, ends: null }] }])).toEqual([])
    expect(averageByEnds([])).toEqual([])
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
