import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { makeId } from '../services/ids'
import { useManagerStore } from '../stores/managerStore'

/**
 * Rounds, scores, and the first knockout round of the open tournament.
 * @param {{
 *   repository: object,
 *   notify: (message: string, values?: object) => void,
 *   selectedTournamentId: import('vue').Ref<string>,
 *   selectedTournament: import('vue').ComputedRef<object|undefined>,
 *   tournamentParticipants: import('vue').ComputedRef<object[]>,
 * }} context
 * @returns {object} The selected round and category, the lists the screens show, and the save functions.
 */
export function useScoring({ repository, notify, selectedTournamentId, selectedTournament, tournamentParticipants }) {
  const store = useManagerStore()
  const { data } = storeToRefs(store)
  // The choice is remembered per tournament, so going back to a tournament shows the round and category last used.
  const selectedRounds = ref({})
  const selectedCategories = ref({})
  const newRoundName = ref('')

  const selectedRound = computed({
    get() {
      return selectedRounds.value[selectedTournamentId.value] || selectedTournament.value?.rounds?.[0] || ''
    },
    set(round) {
      if (selectedTournamentId.value) selectedRounds.value[selectedTournamentId.value] = round
    },
  })
  const selectedCategoryId = computed({
    get() {
      return selectedCategories.value[selectedTournamentId.value] || ''
    },
    set(categoryId) {
      if (selectedTournamentId.value) selectedCategories.value[selectedTournamentId.value] = categoryId
    },
  })
  const scoreRows = computed(() =>
    tournamentParticipants.value.map((participant) => ({
      participant,
      categoryId: selectedTournament.value?.categoryAssignments?.[participant.id] || '',
      score:
        data.value.scores.find(
          (item) =>
            item.tournamentId === selectedTournamentId.value &&
            item.participantId === participant.id &&
            item.round === selectedRound.value,
        )?.score ?? '',
    })),
  )
  const olympicMatches = computed(() =>
    data.value.matches.filter(
      (match) =>
        match.tournamentId === selectedTournamentId.value &&
        (match.sourceRound || selectedTournament.value?.rounds?.[0]) === selectedRound.value &&
        (match.categoryId || '') === selectedCategoryId.value,
    ),
  )
  const scoredCount = computed(
    () =>
      data.value.scores.filter(
        (item) => item.tournamentId === selectedTournamentId.value && item.round === selectedRound.value,
      ).length,
  )

  /** @returns {Promise<void>} Adds the typed round to the open tournament and selects it. */
  async function addRound() {
    const name = newRoundName.value.trim()
    if (!name || !selectedTournament.value) return
    if (selectedTournament.value.rounds.some((round) => round.toLowerCase() === name.toLowerCase())) {
      notify('That round already exists for this tournament')
      return
    }
    if (
      !(await store.persistChange(
        () => repository.addTournamentRound(selectedTournamentId.value, name, selectedTournament.value.rounds.length),
        () => selectedTournament.value.rounds.push(name),
      ))
    )
      return

    selectedRound.value = name
    newRoundName.value = ''
    notify('Round added to this tournament')
  }

  /**
   * An empty value deletes the score.
   * @param {string} participantId
   * @param {string|number|null} value The typed score.
   * @returns {Promise<void>}
   */
  async function saveScore(participantId, value) {
    if (value === '' || value === null) {
      await store.persistChange(
        () =>
          repository.saveScore({
            tournamentId: selectedTournamentId.value,
            participantId,
            round: selectedRound.value,
            score: null,
          }),
        () => {
          data.value.scores = data.value.scores.filter(
            (item) =>
              !(
                item.tournamentId === selectedTournamentId.value &&
                item.participantId === participantId &&
                item.round === selectedRound.value
              ),
          )
        },
      )
      return
    }
    const numericScore = Number(value)
    if (!Number.isFinite(numericScore) || numericScore < 0) {
      notify('Enter a non-negative score')
      return
    }
    const existing = data.value.scores.find(
      (item) =>
        item.tournamentId === selectedTournamentId.value &&
        item.participantId === participantId &&
        item.round === selectedRound.value,
    )
    const categoryId = selectedTournament.value?.categoryAssignments?.[participantId] || ''
    const score = {
      tournamentId: selectedTournamentId.value,
      participantId,
      round: selectedRound.value,
      categoryId,
      score: numericScore,
    }
    await store.persistChange(
      () => repository.saveScore(score),
      () => {
        if (existing) Object.assign(existing, score)
        else data.value.scores.push(score)
      },
    )
  }

  /**
   * Pairs the highest score with the lowest of the selected round and category, and replaces the matches
   * seeded before for them.
   * @returns {Promise<void>}
   */
  async function generateMatches() {
    if (selectedTournament.value?.categoryIds.length && !selectedCategoryId.value) {
      notify('Select a tournament category before seeding Olympic matches')
      return
    }
    const eligibleParticipants = tournamentParticipants.value.filter(
      (participant) =>
        !selectedTournament.value?.categoryIds.length ||
        selectedTournament.value.categoryAssignments[participant.id] === selectedCategoryId.value,
    )
    const ranked = eligibleParticipants
      .map((participant) => ({
        participant,
        score: data.value.scores.find(
          (item) =>
            item.tournamentId === selectedTournamentId.value &&
            item.participantId === participant.id &&
            item.round === selectedRound.value,
        )?.score,
      }))
      .filter((entry) => entry.score !== undefined)
      .sort((a, b) => b.score - a.score)
    if (ranked.length < 2) {
      notify('Enter at least two scores for this round before seeding matches')
      return
    }
    if (ranked.length % 2 !== 0) {
      notify('An even number of scored participants is required; byes are not supported yet')
      return
    }
    const half = Math.floor(ranked.length / 2)
    const newMatches = Array.from({ length: half }, (_, index) => {
      const higherSeed = ranked[index]
      const lowerSeed = ranked[ranked.length - index - 1]
      return {
        id: makeId(),
        tournamentId: selectedTournamentId.value,
        sourceRound: selectedRound.value,
        categoryId: selectedCategoryId.value,
        round:
          ranked.length === 2
            ? 'Final'
            : ranked.length === 4
              ? 'Semifinal'
              : ranked.length === 8
                ? 'Quarterfinal'
                : ranked.length === 16 || ranked.length === 32
                  ? `Round of ${ranked.length}`
                  : `Opening round (${ranked.length} archers)`,
        seed1Id: higherSeed.participant.id,
        seed2Id: lowerSeed.participant.id,
        seed1: index + 1,
        seed2: ranked.length - index,
        score1: '',
        score2: '',
      }
    })
    if (
      !(await store.persistChange(
        () =>
          repository.replaceMatches(
            selectedTournamentId.value,
            selectedRound.value,
            selectedCategoryId.value,
            newMatches,
          ),
        () => {
          data.value.matches = [
            ...data.value.matches.filter(
              (match) =>
                match.tournamentId !== selectedTournamentId.value ||
                (match.sourceRound || selectedTournament.value?.rounds?.[0]) !== selectedRound.value ||
                (match.categoryId || '') !== selectedCategoryId.value,
            ),
            ...newMatches,
          ]
        },
      ))
    )
      return

    notify('{count} first-round matches seeded', { count: newMatches.length })
  }

  /**
   * @param {{ id: string }} match
   * @param {'score1'|'score2'} side Which archer's score.
   * @param {string|number} value The typed score. A negative or invalid value becomes 0.
   * @returns {Promise<void>}
   */
  async function recordMatchScore(match, side, value) {
    const score = value === '' ? '' : Math.max(0, Number(value) || 0)
    if (
      !(await store.persistChange(
        () => repository.setMatchScore(match.id, side, score),
        () => {
          match[side] = score
        },
      ))
    )
      return
  }

  return {
    selectedRound,
    selectedCategoryId,
    newRoundName,
    scoreRows,
    olympicMatches,
    scoredCount,
    addRound,
    saveScore,
    generateMatches,
    recordMatchScore,
  }
}
