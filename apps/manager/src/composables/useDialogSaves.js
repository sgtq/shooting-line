import { t } from '@shooting-line/i18n'
import { storeToRefs } from 'pinia'
import { categoryBlockReason as categoryBlockReasonFor } from '../services/categoryEligibility'
import { makeId } from '../services/ids'
import { resolveDays } from '../services/tournamentDates'
import { useManagerStore } from '../stores/managerStore'

/**
 * What happens when the user saves the open dialog: checks, the repository call, the local update, and where the
 * user goes next.
 * @param {{
 *   repository: object,
 *   notify: (message: string, values?: object) => void,
 *   userId: string,
 *   userEmail: string,
 *   userScope: { clubId?: string },
 *   userName: import('vue').Ref<string>,
 *   canManage: import('vue').Ref<boolean>,
 *   isClubUser: import('vue').Ref<boolean>,
 *   canCreateTournament: import('vue').Ref<boolean>,
 *   canEditTournament: import('vue').Ref<boolean>,
 *   selectedTournament: import('vue').ComputedRef<object|undefined>,
 *   selectedTournamentId: import('vue').Ref<string>,
 *   selectedTournamentTab: import('vue').Ref<string>,
 *   activePage: import('vue').Ref<string>,
 *   dialogs: object,
 * }} context `dialogs` is what useDialogs returns.
 * @returns {object} The save of the open dialog, and the two actions the dialogs call directly.
 */
export function useDialogSaves({
  repository,
  notify,
  userId,
  userEmail,
  userScope,
  userName,
  canManage,
  isClubUser,
  canCreateTournament,
  canEditTournament,
  selectedTournament,
  selectedTournamentId,
  selectedTournamentTab,
  activePage,
  dialogs,
}) {
  const store = useManagerStore()
  const { data, modalError, targetTypeError } = storeToRefs(store)
  const {
    form,
    modalType,
    targetTypeName,
    assignNewParticipant,
    editingClubId,
    editingParticipantId,
    editingTournamentTypeId,
    editingCategoryId,
    selectedMatch,
    selectedMatchToken,
    closeModal,
    returnToParentModal,
    closeTargetTypeModal,
  } = dialogs

  /** @returns {Promise<void>} */
  async function saveClub() {
    const isEditing = Boolean(editingClubId.value)
    const existingClub = isEditing ? store.clubFor(editingClubId.value) : null
    const hadUserEnabled = Boolean(existingClub?.userEnabled)
    const { logoFile } = form.value
    const clubForm = { ...form.value }
    delete clubForm.logoFile
    delete clubForm.logoPreview
    clubForm.email = (clubForm.email || '').trim()
    clubForm.userEmail = clubForm.email || (clubForm.userEmail || '').trim()
    if (!clubForm.userEmail) clubForm.userEnabled = false
    const club = { ...clubForm, id: editingClubId.value || makeId() }
    const saved = await store.persistChange(
      async () => {
        if (logoFile) club.logoUrl = await repository.uploadClubLogo(club.id, logoFile)
        await repository.saveClub(club, {
          syncUserAccess: canManage.value,
          hadUserEnabled,
        })
      },
      () => {
        if (isEditing && existingClub) {
          Object.assign(existingClub, club)
        } else if (!isEditing) {
          data.value.clubs.unshift(club)
        }
      },
      'modal',
    )
    if (!saved) return

    if (returnToParentModal(club)) {
      notify('Club added')
      return
    }
    closeModal()
    notify(isEditing ? 'Club details updated' : 'Club added')
  }

  /** @returns {Promise<void>} */
  async function saveTournament() {
    if (!canCreateTournament.value) {
      notify('An active plan is required to create tournaments')
      return
    }
    if (form.value.venueMode === 'club' && !form.value.clubId) {
      notify('Select a host club or use a custom address')
      return
    }
    const { dateMode, startDate, endDate, days, ...details } = form.value
    const { dates, error: dateError } = resolveDays({ dateMode, startDate, endDate, days })
    if (dateError) {
      modalError.value = t(dateError)
      return
    }
    const tournament = {
      ...details,
      dates,
      // A club user can only host for their own club, whatever the form holds.
      clubId: canManage.value ? form.value.clubId : userScope.clubId,
      id: makeId(),
      rounds: ['Qualification'],
      participantIds: [],
      categoryIds: [],
      categoryAssignments: {},
    }
    if (
      !(await store.persistChange(
        () => repository.saveTournament(tournament),
        () => data.value.tournaments.unshift(tournament),
        'modal',
      ))
    )
      return

    selectedTournamentId.value = tournament.id
    selectedTournamentTab.value = 'participants'
    closeModal()
    activePage.value = 'tournament-detail'
    notify('Tournament created')
  }

  /** @returns {Promise<void>} */
  async function saveTournamentDates() {
    const tournament = selectedTournament.value
    if (!tournament || !canEditTournament.value) return
    const { dates, error } = resolveDays(form.value)
    if (error) {
      modalError.value = t(error)
      return
    }
    const saved = await store.persistChange(
      () => repository.saveTournamentDates(tournament.id, dates),
      () => {
        tournament.dates = dates
      },
      'modal',
    )
    if (!saved) return
    closeModal()
    notify('Tournament dates updated')
  }

  /** @returns {Promise<void>} */
  async function saveTournamentType() {
    const isEditing = Boolean(editingTournamentTypeId.value)
    const type = {
      ...form.value,
      id: editingTournamentTypeId.value || makeId(),
      distance: Number(form.value.distance),
      ends: Number(form.value.ends),
      arrowsPerEnd: Number(form.value.arrowsPerEnd),
    }
    const saved = await store.persistChange(
      () => repository.saveTournamentType(type),
      () => {
        if (isEditing) {
          const existing = store.tournamentTypeFor(type.id)
          if (existing) Object.assign(existing, type)
        } else {
          data.value.tournamentTypes.push(type)
        }
      },
      'modal',
    )
    if (!saved) return

    if (returnToParentModal(type)) {
      notify('Tournament type added')
      return
    }
    closeModal()
    notify(isEditing ? 'Tournament type updated' : 'Tournament type created')
  }

  /** @returns {Promise<void>} */
  async function saveTargetType() {
    const name = targetTypeName.value.trim()
    if (!name) {
      targetTypeError.value = t('Enter a target type name.')
      return
    }

    const existing = data.value.targetTypes.find((type) => type.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      form.value.targetType = existing.name
      closeTargetTypeModal()
      return
    }

    const targetType = { id: makeId(), name }
    const saved = await store.persistChange(
      () => repository.saveTargetType(targetType),
      () => data.value.targetTypes.push(targetType),
      'targetType',
    )
    if (!saved) return

    form.value.targetType = targetType.name
    closeTargetTypeModal()
  }

  /** @returns {Promise<void>} */
  async function saveCategory() {
    const isEditing = Boolean(editingCategoryId.value)
    const category = {
      ...form.value,
      id: editingCategoryId.value || makeId(),
      minAge: form.value.minAge === '' ? null : Number(form.value.minAge),
      maxAge: form.value.maxAge === '' ? null : Number(form.value.maxAge),
      // Exempt categories are not ranked, so their order is stored as 0 and never read.
      sortOrder: form.value.levelExempt ? 0 : Number(form.value.sortOrder),
      levelExempt: Boolean(form.value.levelExempt),
    }
    if (category.minAge !== null && category.maxAge !== null && category.minAge > category.maxAge) {
      notify('Minimum age cannot be greater than maximum age')
      return
    }
    const saved = await store.persistChange(
      () => repository.saveCategory(category),
      () => {
        if (isEditing) {
          const existing = store.categoryFor(category.id)
          if (existing) Object.assign(existing, category)
        } else {
          data.value.categories.push(category)
        }
      },
      'modal',
    )
    if (!saved) return

    closeModal()
    notify(isEditing ? 'Category updated' : 'Category created')
  }

  /** @returns {Promise<void>} */
  async function saveUserRole() {
    const role = {
      email: form.value.email.trim(),
      role: 'manager',
      displayName: form.value.displayName.trim(),
    }
    let userId
    const saved = await store.persistChange(
      async () => {
        userId = await repository.assignUserRole(role)
      },
      () => {
        const assigned = {
          userId,
          email: role.email,
          role: role.role,
          clubId: '',
          participantId: '',
        }
        const existing = data.value.userRoles.find((item) => item.userId === userId && item.role === role.role)
        if (existing) Object.assign(existing, assigned)
        else data.value.userRoles.push(assigned)
      },
      'modal',
    )
    if (!saved) return

    closeModal()
    notify('Manager role assigned')
  }

  /** @returns {Promise<void>} */
  async function saveUserProfile() {
    const displayName = form.value.displayName.trim()
    if (!displayName) {
      modalError.value = t('Enter a display name.')
      return
    }

    if (
      !(await store.persistChange(
        () => repository.saveUserProfile(userId, displayName),
        () => {
          userName.value = displayName
        },
        'modal',
      ))
    )
      return

    closeModal()
    notify('Profile updated')
  }

  /** @returns {Promise<void>} */
  async function sendOwnPasswordReset() {
    if (
      !(await store.persistChange(
        () => repository.sendOwnPasswordReset(userEmail),
        () => {},
        'modal',
      ))
    )
      return

    notify('If the account exists, a password reset email will be sent')
  }

  /** @returns {string} Why the chosen category cannot be used, or an empty string when it can. */
  function categoryChoiceProblem(tournament, participant, categoryId) {
    if (!tournament.categoryIds.length) return ''
    const category = store.categoryFor(categoryId)
    if (!category) return t('Select a valid category')
    return categoryBlockReasonFor(tournament, participant, category, data.value)
  }

  /**
   * Adds the archer the user chose from the matches. The database does the adding and the checks (age limits,
   * category level) and returns only the archer's name.
   * @returns {Promise<void>}
   */
  async function addSelectedMatch() {
    const tournament = selectedTournament.value
    const token = selectedMatchToken.value
    const categoryId = tournament.categoryIds.length ? form.value.categoryId : ''
    if (tournament.categoryIds.length && !store.categoryFor(categoryId)) {
      notify('Select a valid category')
      return
    }
    let archer = null
    const saved = await store.persistChange(
      async () => {
        archer = await repository.addArcherByToken(tournament.id, token, categoryId)
      },
      () => {
        if (!store.participantById(archer.id)) data.value.participants.push(archer)
        tournament.participantIds.push(archer.id)
        if (categoryId) tournament.categoryAssignments[archer.id] = categoryId
      },
      'modal',
    )
    if (!saved) return

    closeModal()
    notify('Archer added to this tournament')
  }

  /** @returns {Promise<void>} */
  async function saveParticipant() {
    if (selectedMatch.value) {
      await addSelectedMatch()
      return
    }
    const isEditing = Boolean(editingParticipantId.value)
    // eslint-disable-next-line no-unused-vars
    const { bowType, categoryId: chosenCategoryId, ...fields } = form.value
    const participant = {
      ...fields,
      id: editingParticipantId.value || makeId(),
      clubId: !canManage.value && isClubUser.value ? userScope.clubId || '' : form.value.clubId || '',
    }
    const tournament = !isEditing && assignNewParticipant.value ? selectedTournament.value : null
    const categoryId = tournament?.categoryIds.length ? chosenCategoryId : ''
    if (tournament) {
      const problem = categoryChoiceProblem(tournament, participant, categoryId)
      if (problem) {
        notify(problem)
        return
      }
    }
    if (
      !(await store.persistChange(
        () => repository.saveParticipant(participant, tournament?.id || '', isEditing, categoryId),
        () => {
          if (isEditing) {
            const existing = store.participantById(participant.id)
            if (existing) Object.assign(existing, participant)
          } else {
            data.value.participants.unshift(participant)
            if (tournament) {
              tournament.participantIds.push(participant.id)
              if (categoryId) tournament.categoryAssignments[participant.id] = categoryId
            }
          }
        },
        'modal',
      ))
    )
      return

    closeModal()
    notify(isEditing ? 'Archer details updated' : 'Archer saved')
  }

  /** @returns {Promise<void>} Runs the save of the open dialog. */
  async function submitModal() {
    const saves = {
      club: saveClub,
      tournament: saveTournament,
      tournamentDates: saveTournamentDates,
      tournamentType: saveTournamentType,
      category: saveCategory,
      userRole: saveUserRole,
      profile: saveUserProfile,
    }
    await (saves[modalType.value] ?? saveParticipant)()
  }

  return { submitModal, saveTargetType, sendOwnPasswordReset }
}
