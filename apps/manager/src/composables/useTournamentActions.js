import { t } from '@shooting-line/i18n'
import { storeToRefs } from 'pinia'
import { categoryBlockReason as categoryBlockReasonFor } from '../services/categoryEligibility'
import { fullName } from '../services/display'
import { useManagerStore } from '../stores/managerStore'

/**
 * Saves that change who is in a tournament, their categories, whether it has started, and club access.
 * @param {{
 *   repository: object,
 *   notify: (message: string, values?: object) => void,
 *   selectedCategoryId: import('vue').Ref<string>,
 * }} context `selectedCategoryId` is the category picked on the Olympic tab.
 * It is cleared when that category is taken off the tournament.
 * @returns {object} The save functions the tournament, archers, and clubs pages call.
 */
export function useTournamentActions({ repository, notify, selectedCategoryId }) {
  const store = useManagerStore()
  const { data } = storeToRefs(store)

  /**
   * Turning a category off also removes it from the archers who had it, and from the Olympic category picker.
   * @param {object} tournament
   * @param {string} categoryId
   * @returns {Promise<void>}
   */
  async function toggleTournamentCategory(tournament, categoryId) {
    const index = tournament.categoryIds.indexOf(categoryId)
    const enabled = index === -1
    if (
      !(await store.persistChange(
        () => repository.setTournamentCategory(tournament.id, categoryId, enabled),
        () => {
          if (enabled) {
            tournament.categoryIds.push(categoryId)
          } else {
            tournament.categoryIds.splice(index, 1)
            for (const [participantId, assignedCategoryId] of Object.entries(tournament.categoryAssignments)) {
              if (assignedCategoryId === categoryId) delete tournament.categoryAssignments[participantId]
            }
            if (selectedCategoryId.value === categoryId) selectedCategoryId.value = ''
          }
        },
      ))
    )
      return
  }

  /**
   * Enters an archer in the tournament with the category chosen in a picker. The picker is reset either way.
   * @param {object} tournament
   * @param {object} participant
   * @param {Event} event The change event of the category picker.
   * @returns {Promise<void>}
   */
  async function addParticipantWithCategory(tournament, participant, event) {
    const categoryId = event.target.value
    const category = store.categoryFor(categoryId)
    event.target.value = ''
    if (!category) {
      notify('Select a valid category')
      return
    }
    const reason = categoryBlockReasonFor(tournament, participant, category, data.value)
    if (reason) {
      notify(reason)
      return
    }
    await store.persistChange(
      () => repository.setTournamentParticipant(tournament.id, participant.id, true, categoryId),
      () => {
        if (!tournament.participantIds.includes(participant.id)) tournament.participantIds.push(participant.id)
        tournament.categoryAssignments[participant.id] = categoryId
      },
    )
  }

  /**
   * @param {object} tournament
   * @param {object} participant The archer stays in the tournament without a category.
   * @returns {Promise<void>}
   */
  async function clearParticipantCategory(tournament, participant) {
    await store.persistChange(
      () => repository.setParticipantCategory(tournament.id, participant.id, ''),
      () => {
        delete tournament.categoryAssignments[participant.id]
      },
    )
  }

  /**
   * Starting asks the user first, because a club cannot change a started tournament.
   * @param {object} tournament
   * @returns {Promise<void>}
   */
  async function toggleTournamentStarted(tournament) {
    const starting = !tournament.startedAt
    if (starting && !window.confirm(t('Start this tournament? A club cannot change it after it starts.'))) return
    const startedAt = starting ? new Date().toISOString() : ''
    const saved = await store.persistChange(
      () => repository.setTournamentStarted(tournament.id, startedAt),
      () => {
        tournament.startedAt = startedAt
      },
    )
    if (saved) notify(starting ? 'Tournament started' : 'Tournament reopened')
  }

  /**
   * Asks the user first. The archer stays in the archer directory.
   * @param {object} tournament
   * @param {object} participant
   * @returns {Promise<void>}
   */
  async function removeParticipantFromTournament(tournament, participant) {
    if (!window.confirm(t('Remove {name} from this tournament?', { name: fullName(participant) }))) return
    await toggleParticipant(tournament, participant.id)
  }

  /**
   * @param {object} participant
   * @param {Event} event The change event of the club picker. The picker goes back to the old club on failure.
   * @returns {Promise<void>}
   */
  async function setParticipantClub(participant, event) {
    const existingClubId = participant.clubId || ''
    const clubId = event.target.value
    const saved = await store.persistChange(
      () => repository.setParticipantClub(participant.id, clubId),
      () => {
        participant.clubId = clubId
      },
    )
    if (!saved) event.target.value = existingClubId
  }

  /**
   * @param {object} tournament
   * @param {string} participantId
   * @returns {Promise<void>} Adds the archer to the tournament, or removes them with their category.
   */
  async function toggleParticipant(tournament, participantId) {
    const index = tournament.participantIds.indexOf(participantId)
    const included = index === -1
    if (
      !(await store.persistChange(
        () => repository.setTournamentParticipant(tournament.id, participantId, included),
        () => {
          if (included) {
            tournament.participantIds.push(participantId)
          } else {
            tournament.participantIds.splice(index, 1)
            delete tournament.categoryAssignments[participantId]
          }
        },
      ))
    )
      return
  }

  /**
   * @param {object} club
   * @returns {Promise<void>} Enables or disables the login of a club. A club needs an email first.
   */
  async function toggleClub(club) {
    if (!club.email && !club.userEmail && !club.userEnabled) {
      notify('Add a club email before enabling access')
      return
    }
    const enabled = !club.userEnabled
    if (
      !(await store.persistChange(
        () => repository.setClubEnabled(club.id, enabled),
        () => {
          club.userEnabled = enabled
        },
      ))
    )
      return

    notify(club.userEnabled ? 'Club user enabled' : 'Club user disabled')
  }

  return {
    toggleTournamentCategory,
    addParticipantWithCategory,
    clearParticipantCategory,
    toggleTournamentStarted,
    removeParticipantFromTournament,
    setParticipantClub,
    toggleClub,
  }
}
