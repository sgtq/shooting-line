import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useManagerStore } from '../stores/managerStore'
import { useScoring } from './useScoring'

const people = ['a', 'b', 'c', 'd'].map((id) => ({ id, firstName: id.toUpperCase(), lastName: 'Archer' }))

let store
let repository
let notify
let selectedTournamentId
let scoring

function setup({ categoryIds = [], assignments = {}, participantIds = ['a', 'b', 'c', 'd'] } = {}) {
  setActivePinia(createPinia())
  store = useManagerStore()
  store.load({
    participants: people,
    tournaments: [
      {
        id: 't1',
        rounds: ['Qualification'],
        participantIds,
        categoryIds,
        categoryAssignments: assignments,
      },
      { id: 't2', rounds: ['Heat'], participantIds: [], categoryIds: [], categoryAssignments: {} },
    ],
    scores: [],
    matches: [],
  })
  repository = {
    addTournamentRound: vi.fn().mockResolvedValue(),
    saveScore: vi.fn().mockResolvedValue(),
    replaceMatches: vi.fn().mockResolvedValue(),
    setMatchScore: vi.fn().mockResolvedValue(),
  }
  notify = vi.fn()
  selectedTournamentId = ref('t1')
  const selectedTournament = computed(() =>
    store.data.tournaments.find((item) => item.id === selectedTournamentId.value),
  )
  const tournamentParticipants = computed(() =>
    selectedTournament.value.participantIds.map((id) => store.data.participants.find((person) => person.id === id)),
  )
  scoring = useScoring({ repository, notify, selectedTournamentId, selectedTournament, tournamentParticipants })
}

beforeEach(() => setup())

describe('selected round and category', () => {
  it('starts on the first round and no category', () => {
    expect(scoring.selectedRound.value).toBe('Qualification')
    expect(scoring.selectedCategoryId.value).toBe('')
  })

  it('remembers the choice for each tournament separately', () => {
    scoring.selectedRound.value = 'Final'
    scoring.selectedCategoryId.value = 'cat-1'
    selectedTournamentId.value = 't2'
    expect(scoring.selectedRound.value).toBe('Heat')
    expect(scoring.selectedCategoryId.value).toBe('')
    selectedTournamentId.value = 't1'
    expect(scoring.selectedRound.value).toBe('Final')
    expect(scoring.selectedCategoryId.value).toBe('cat-1')
  })

  it('ignores a choice when no tournament is selected', () => {
    selectedTournamentId.value = ''
    scoring.selectedRound.value = 'Final'
    expect(scoring.selectedRound.value).toBe('')
  })
})

describe('scoreRows, scoredCount, and olympicMatches', () => {
  it('lists every entered archer with their score for the selected round, or an empty string', async () => {
    store.data.scores = [
      { tournamentId: 't1', participantId: 'a', round: 'Qualification', score: 0 },
      { tournamentId: 't1', participantId: 'b', round: 'Other round', score: 5 },
    ]
    expect(scoring.scoreRows.value.map((row) => row.score)).toEqual([0, '', '', ''])
    expect(scoring.scoredCount.value).toBe(1)
  })

  it('shows the category assigned to each archer', () => {
    setup({ assignments: { a: 'cat-1' } })
    expect(scoring.scoreRows.value[0].categoryId).toBe('cat-1')
    expect(scoring.scoreRows.value[1].categoryId).toBe('')
  })

  it('shows only the matches of the selected tournament, round, and category', () => {
    store.data.matches = [
      { id: 'm1', tournamentId: 't1', sourceRound: 'Qualification', categoryId: '' },
      { id: 'm2', tournamentId: 't1', categoryId: undefined },
      { id: 'm3', tournamentId: 't1', sourceRound: 'Other', categoryId: '' },
      { id: 'm4', tournamentId: 't2', sourceRound: 'Heat', categoryId: '' },
      { id: 'm5', tournamentId: 't1', sourceRound: 'Qualification', categoryId: 'cat-1' },
    ]
    expect(scoring.olympicMatches.value.map((match) => match.id)).toEqual(['m1', 'm2'])
  })
})

describe('addRound', () => {
  it('adds the round, selects it, clears the box, and tells the user', async () => {
    scoring.newRoundName.value = '  Semifinal '
    await scoring.addRound()
    expect(repository.addTournamentRound).toHaveBeenCalledWith('t1', 'Semifinal', 1)
    expect(store.data.tournaments[0].rounds).toEqual(['Qualification', 'Semifinal'])
    expect(scoring.selectedRound.value).toBe('Semifinal')
    expect(scoring.newRoundName.value).toBe('')
    expect(notify).toHaveBeenCalledWith('Round added to this tournament')
  })

  it('does nothing for a blank name', async () => {
    scoring.newRoundName.value = '   '
    await scoring.addRound()
    expect(repository.addTournamentRound).not.toHaveBeenCalled()
  })

  it('refuses a round that exists, ignoring case', async () => {
    scoring.newRoundName.value = 'qualification'
    await scoring.addRound()
    expect(repository.addTournamentRound).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('That round already exists for this tournament')
  })

  it('keeps the box and the rounds when the save fails', async () => {
    repository.addTournamentRound.mockRejectedValue(new Error('denied'))
    scoring.newRoundName.value = 'Final'
    await scoring.addRound()
    expect(store.data.tournaments[0].rounds).toEqual(['Qualification'])
    expect(scoring.newRoundName.value).toBe('Final')
    expect(store.databaseError).toBe('Save failed: denied')
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('saveScore', () => {
  it('adds a score with the archer category', async () => {
    setup({ assignments: { a: 'cat-1' } })
    await scoring.saveScore('a', '640')
    expect(repository.saveScore).toHaveBeenCalledWith({
      tournamentId: 't1',
      participantId: 'a',
      round: 'Qualification',
      categoryId: 'cat-1',
      score: 640,
    })
    expect(store.data.scores).toHaveLength(1)
  })

  it('updates the score that already exists instead of adding another', async () => {
    store.data.scores = [{ tournamentId: 't1', participantId: 'a', round: 'Qualification', categoryId: '', score: 600 }]
    await scoring.saveScore('a', '650')
    expect(store.data.scores).toHaveLength(1)
    expect(store.data.scores[0].score).toBe(650)
  })

  it('accepts zero', async () => {
    await scoring.saveScore('a', '0')
    expect(store.data.scores[0].score).toBe(0)
  })

  it('refuses a negative or invalid score without calling the database', async () => {
    await scoring.saveScore('a', '-3')
    await scoring.saveScore('a', 'abc')
    expect(repository.saveScore).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Enter a non-negative score')
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('deletes the score when the value is emptied, only for that archer, round, and tournament', async () => {
    store.data.scores = [
      { tournamentId: 't1', participantId: 'a', round: 'Qualification', score: 600 },
      { tournamentId: 't1', participantId: 'b', round: 'Qualification', score: 500 },
      { tournamentId: 't1', participantId: 'a', round: 'Other', score: 400 },
    ]
    await scoring.saveScore('a', '')
    expect(repository.saveScore).toHaveBeenCalledWith(expect.objectContaining({ participantId: 'a', score: null }))
    expect(store.data.scores.map((item) => `${item.participantId}-${item.round}`)).toEqual([
      'b-Qualification',
      'a-Other',
    ])
  })

  it('keeps the list when the save fails', async () => {
    repository.saveScore.mockRejectedValue(new Error('denied'))
    await scoring.saveScore('a', '640')
    expect(store.data.scores).toEqual([])
    expect(store.databaseError).toBe('Save failed: denied')
  })
})

describe('generateMatches', () => {
  function score(id, value) {
    store.data.scores.push({ tournamentId: 't1', participantId: id, round: 'Qualification', score: value })
  }

  it('pairs the highest score with the lowest, and the second with the second lowest', async () => {
    score('a', 600)
    score('b', 650)
    score('c', 500)
    score('d', 580)
    await scoring.generateMatches()
    const [, , , created] = repository.replaceMatches.mock.calls[0]
    expect(created.map((match) => [match.seed1Id, match.seed2Id, match.seed1, match.seed2])).toEqual([
      ['b', 'c', 1, 4],
      ['a', 'd', 2, 3],
    ])
    expect(created.every((match) => match.round === 'Semifinal')).toBe(true)
    expect(store.data.matches).toHaveLength(2)
    expect(notify).toHaveBeenCalledWith('{count} first-round matches seeded', { count: 2 })
  })

  it('names the round after how many archers are paired', async () => {
    score('a', 600)
    score('b', 500)
    await scoring.generateMatches()
    expect(repository.replaceMatches.mock.calls[0][3][0].round).toBe('Final')
  })

  it('needs at least two scores', async () => {
    score('a', 600)
    await scoring.generateMatches()
    expect(repository.replaceMatches).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Enter at least two scores for this round before seeding matches')
  })

  it('needs an even number of scores because byes are not supported', async () => {
    score('a', 600)
    score('b', 500)
    score('c', 400)
    await scoring.generateMatches()
    expect(repository.replaceMatches).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('An even number of scored participants is required; byes are not supported yet')
  })

  it('counts a score of zero as a score', async () => {
    score('a', 10)
    score('b', 0)
    await scoring.generateMatches()
    expect(repository.replaceMatches).toHaveBeenCalled()
  })

  it('asks for a category when the tournament has categories, and seeds only that category', async () => {
    setup({ categoryIds: ['cat-1'], assignments: { a: 'cat-1', b: 'cat-1', c: 'cat-2', d: 'cat-2' } })
    for (const [id, value] of [
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]) {
      store.data.scores.push({ tournamentId: 't1', participantId: id, round: 'Qualification', score: value })
    }
    await scoring.generateMatches()
    expect(repository.replaceMatches).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Select a tournament category before seeding Olympic matches')

    scoring.selectedCategoryId.value = 'cat-1'
    await scoring.generateMatches()
    const created = repository.replaceMatches.mock.calls[0][3]
    expect(created).toHaveLength(1)
    expect([created[0].seed1Id, created[0].seed2Id]).toEqual(['b', 'a'])
    expect(created[0].categoryId).toBe('cat-1')
  })

  it('replaces only the matches of the same round and category and keeps the others', async () => {
    store.data.matches = [
      { id: 'old', tournamentId: 't1', sourceRound: 'Qualification', categoryId: '' },
      { id: 'other-round', tournamentId: 't1', sourceRound: 'Heat', categoryId: '' },
      { id: 'other-tournament', tournamentId: 't2', sourceRound: 'Qualification', categoryId: '' },
    ]
    score('a', 2)
    score('b', 1)
    await scoring.generateMatches()
    const ids = store.data.matches.map((match) => match.id)
    expect(ids).not.toContain('old')
    expect(ids).toEqual(expect.arrayContaining(['other-round', 'other-tournament']))
    expect(store.data.matches).toHaveLength(3)
  })

  it('keeps the old matches and stays quiet when the save fails', async () => {
    repository.replaceMatches.mockRejectedValue(new Error('denied'))
    store.data.matches = [{ id: 'old', tournamentId: 't1', sourceRound: 'Qualification', categoryId: '' }]
    score('a', 2)
    score('b', 1)
    await scoring.generateMatches()
    expect(store.data.matches.map((match) => match.id)).toEqual(['old'])
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('recordMatchScore', () => {
  it('saves the score on the right side', async () => {
    const match = { id: 'm1', score1: '', score2: '' }
    await scoring.recordMatchScore(match, 'score2', '7')
    expect(repository.setMatchScore).toHaveBeenCalledWith('m1', 'score2', 7)
    expect(match.score2).toBe(7)
    expect(match.score1).toBe('')
  })

  it('clears the score for an empty value, and turns a negative or invalid value into zero', async () => {
    const match = { id: 'm1', score1: 5, score2: 5 }
    await scoring.recordMatchScore(match, 'score1', '')
    expect(match.score1).toBe('')
    await scoring.recordMatchScore(match, 'score2', '-4')
    expect(match.score2).toBe(0)
    await scoring.recordMatchScore(match, 'score2', 'abc')
    expect(match.score2).toBe(0)
  })

  it('keeps the score when the save fails', async () => {
    repository.setMatchScore.mockRejectedValue(new Error('denied'))
    const match = { id: 'm1', score1: 3, score2: '' }
    await scoring.recordMatchScore(match, 'score1', '9')
    expect(match.score1).toBe(3)
  })
})
