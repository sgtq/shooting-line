import { describe, expect, it } from 'vitest'
import { buildScoreRows } from './scoreRows'

const tournaments = [
  { id: 't-old', name: 'Old Cup', dates: ['2025-01-01'], categoryAssignments: { me: 'c-open' } },
  { id: 't-new', name: 'New Cup', dates: ['2026-06-01'], categoryAssignments: {} },
]
const categories = [
  { id: 'c-open', name: 'Open' },
  { id: 'c-youth', name: 'Youth' },
]
const participants = [
  { id: 'me', firstName: 'Ana', lastName: 'Archer' },
  { id: 'rival', firstName: 'Rui', lastName: 'Shooter' },
]

function build(data) {
  return buildScoreRows('me', { scores: [], matches: [], tournaments, categories, participants, ...data })
}

describe('buildScoreRows', () => {
  it('takes the category from the score, or from the tournament entry when the score has none', () => {
    const rows = build({
      scores: [
        { tournamentId: 't-old', participantId: 'me', round: 'Qualification', score: 600 },
        { tournamentId: 't-new', participantId: 'me', round: 'Qualification', score: 650, categoryId: 'c-youth' },
      ],
    })
    expect(rows.find((row) => row.tournamentId === 't-old').category.name).toBe('Open')
    expect(rows.find((row) => row.tournamentId === 't-new').category.name).toBe('Youth')
  })

  it('leaves the category empty when none can be found', () => {
    const rows = build({ scores: [{ tournamentId: 't-new', participantId: 'me', round: 'Q', score: 1 }] })
    expect(rows[0].category).toBeUndefined()
  })

  it('ignores scores of other archers', () => {
    const rows = build({ scores: [{ tournamentId: 't-old', participantId: 'rival', round: 'Q', score: 5 }] })
    expect(rows).toEqual([])
  })

  it('names the opponent in a match, whichever side the archer shot', () => {
    const rows = build({
      matches: [
        { tournamentId: 't-old', round: 'Final', seed1Id: 'me', seed2Id: 'rival', score1: 6, score2: 4 },
        { tournamentId: 't-new', round: 'Semi', seed1Id: 'rival', seed2Id: 'me', score1: 3, score2: 7 },
      ],
    })
    expect(rows.map((row) => [row.round, row.score, row.scoreType])).toEqual([
      ['Semi vs Rui Shooter', 7, 'Olympic match'],
      ['Final vs Rui Shooter', 6, 'Olympic match'],
    ])
  })

  it('skips a match the archer has not scored yet, but keeps a score of zero', () => {
    const rows = build({
      matches: [
        { tournamentId: 't-old', round: 'A', seed1Id: 'me', seed2Id: 'rival', score1: '', score2: '' },
        { tournamentId: 't-old', round: 'B', seed1Id: 'me', seed2Id: 'rival', score1: 0, score2: 5 },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].score).toBe(0)
  })

  it('shows an unknown opponent when the opponent is not in the archer list', () => {
    const rows = build({
      matches: [{ tournamentId: 't-old', round: 'Final', seed1Id: 'me', seed2Id: 'gone', score1: 6, score2: 2 }],
    })
    expect(rows[0].round).toBe('Final vs Unknown ')
  })

  it('sorts the newest tournament first and puts removed tournaments last', () => {
    const rows = build({
      scores: [
        { tournamentId: 't-old', participantId: 'me', round: 'Q', score: 1 },
        { tournamentId: 't-gone', participantId: 'me', round: 'Q', score: 2 },
        { tournamentId: 't-new', participantId: 'me', round: 'Q', score: 3 },
      ],
    })
    expect(rows.map((row) => row.tournamentId)).toEqual(['t-new', 't-old', 't-gone'])
  })
})
