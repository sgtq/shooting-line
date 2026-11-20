import { t } from '@shooting-line/i18n'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  blankCategory,
  blankClub,
  blankParticipant,
  blankTournament,
  blankTournamentType,
  blankUserRole,
} from '../services/blankForms'
import { modalLabels } from '../services/modalLabels'
import { datesToForm } from '../services/tournamentDates'
import { useManagerStore } from '../stores/managerStore'

/**
 * The state of the dialogs: which one is open, its form, the dialog opened on top of the tournament form, the
 * archer search, and the custom target type dialog. Saving is in useDialogSaves.
 * @param {{
 *   repository: object,
 *   userScope: { clubId?: string },
 *   userName: import('vue').Ref<string>,
 *   canManage: import('vue').Ref<boolean>,
 *   isClubUser: import('vue').Ref<boolean>,
 *   canSearchArchers: import('vue').Ref<boolean>,
 *   selectedTournamentId: import('vue').Ref<string>,
 *   participantClubFilter: import('vue').Ref<string>,
 * }} context
 * @returns {object} The dialog state, the computed texts, and the functions that open and close dialogs.
 */
export function useDialogs({
  repository,
  userScope,
  userName,
  canManage,
  isClubUser,
  canSearchArchers,
  selectedTournamentId,
  participantClubFilter,
}) {
  const store = useManagerStore()
  const { data, databaseError, modalError, targetTypeError } = storeToRefs(store)

  const form = ref({})
  const modalFlow = ref(null)
  const showModal = ref(false)
  const modalType = ref('')
  const showTargetTypeModal = ref(false)
  const targetTypeName = ref('')
  const assignNewParticipant = ref(false)
  const editingClubId = ref('')
  const editingParticipantId = ref('')
  const editingTournamentTypeId = ref('')
  const editingCategoryId = ref('')
  // Matches for what the user types in the add-archer form. Each has a one-time token and never a database ID.
  const archerMatches = ref([])
  const selectedMatchToken = ref('')
  let archerSearchTimer = null
  let archerSearchRun = 0

  /** @returns {string|null} The club a club user works for, or null for people who may pick any club. */
  function ownClubId() {
    return !canManage.value && isClubUser.value ? userScope.clubId || '' : null
  }

  const targetTypeOptions = computed(() => {
    const options = data.value.targetTypes.map((type) => type.name)
    const selected = form.value.targetType
    if (selected && !options.some((name) => name.toLowerCase() === selected.toLowerCase())) {
      options.push(selected)
    }
    return options
  })
  const selectedMatch = computed(
    () => archerMatches.value.find((match) => match.token === selectedMatchToken.value) || null,
  )
  const modalText = computed(() => {
    const editingByType = {
      club: editingClubId.value,
      tournamentType: editingTournamentTypeId.value,
      category: editingCategoryId.value,
      participant: editingParticipantId.value,
    }
    return modalLabels(modalType.value, {
      editing: Boolean(editingByType[modalType.value]),
      hasMatch: Boolean(selectedMatch.value),
      hasParentForm: Boolean(modalFlow.value),
    })
  })

  /**
   * @param {string} type The dialog to open.
   * @param {boolean} [assignToCurrentTournament] Whether a new archer also joins the open tournament.
   * @returns {void}
   */
  function openModal(type, assignToCurrentTournament = false) {
    releaseClubLogoPreview()
    modalFlow.value = null
    databaseError.value = ''
    modalError.value = ''
    targetTypeError.value = ''
    showTargetTypeModal.value = false
    modalType.value = type
    assignNewParticipant.value = assignToCurrentTournament
    window.clearTimeout(archerSearchTimer)
    archerSearchRun += 1
    archerMatches.value = []
    selectedMatchToken.value = ''
    editingClubId.value = ''
    editingParticipantId.value = ''
    editingTournamentTypeId.value = ''
    editingCategoryId.value = ''
    form.value =
      type === 'club'
        ? blankClub()
        : type === 'tournament'
          ? blankTournament({
              tournamentTypes: data.value.tournamentTypes,
              clubs: data.value.clubs,
              ownClubId: ownClubId(),
            })
          : type === 'tournamentType'
            ? blankTournamentType(data.value.targetTypes)
            : type === 'category'
              ? blankCategory()
              : type === 'userRole'
                ? blankUserRole()
                : type === 'profile'
                  ? { displayName: userName.value }
                  : blankParticipant(ownClubId())
    showModal.value = true
  }

  /**
   * Opens a club or tournament type dialog on top of the tournament form, and remembers the form.
   * @param {'club'|'tournamentType'} type
   * @returns {void}
   */
  function openTournamentChildModal(type) {
    modalFlow.value = {
      parentType: 'tournament',
      parentForm: { ...form.value },
      linkField: type === 'club' ? 'clubId' : 'tournamentTypeId',
    }
    editingClubId.value = ''
    editingTournamentTypeId.value = ''
    modalType.value = type
    form.value = type === 'club' ? blankClub() : blankTournamentType(data.value.targetTypes)
  }

  /**
   * @param {{ id: string }} record The club or type just saved. It is chosen in the tournament form.
   * @returns {boolean} True when the dialog was opened from the tournament form and has gone back to it.
   */
  function returnToParentModal(record) {
    if (!modalFlow.value) return false

    const flow = modalFlow.value
    releaseClubLogoPreview()
    modalFlow.value = null
    modalType.value = flow.parentType
    form.value = { ...flow.parentForm, [flow.linkField]: record.id }
    return true
  }

  /** @returns {void} Frees the browser memory used by the logo preview. */
  function releaseClubLogoPreview() {
    if (form.value.logoFile && form.value.logoPreview) {
      URL.revokeObjectURL(form.value.logoPreview)
    }
  }

  /**
   * @param {Event} event The change event of the logo file input.
   * @returns {void}
   */
  function handleClubLogoSelection(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
      modalError.value = t('Choose a JPG, PNG, or WebP logo smaller than 2 MB.')
      event.target.value = ''
      return
    }

    releaseClubLogoPreview()
    form.value.logoFile = file
    form.value.logoPreview = URL.createObjectURL(file)
    modalError.value = ''
  }

  /**
   * @param {string} clubId
   * @returns {void}
   */
  function addParticipantToClub(clubId) {
    openModal('participant')
    form.value.clubId = clubId
  }

  /** @returns {void} Opens the archer form for the open tournament, with the club filter as the club. */
  function addParticipantToTournament() {
    openModal('participant', true)
    if (participantClubFilter.value && participantClubFilter.value !== '__unassigned__') {
      form.value.clubId = participantClubFilter.value
    }
  }

  /**
   * @param {object} club
   * @returns {void}
   */
  function editClub(club) {
    modalType.value = 'club'
    editingClubId.value = club.id
    form.value = { ...club, logoFile: null, logoPreview: club.logoUrl }
    showModal.value = true
  }

  /**
   * @param {object} person
   * @returns {void}
   */
  function editParticipant(person) {
    modalType.value = 'participant'
    editingParticipantId.value = person.id
    form.value = { ...person }
    showModal.value = true
  }

  /**
   * @param {object} type
   * @returns {void}
   */
  function editTournamentType(type) {
    modalType.value = 'tournamentType'
    editingTournamentTypeId.value = type.id
    form.value = { ...type }
    showModal.value = true
  }

  /**
   * @param {object} category
   * @returns {void}
   */
  function editCategory(category) {
    modalType.value = 'category'
    editingCategoryId.value = category.id
    form.value = { ...category }
    showModal.value = true
  }

  /** @returns {void} Goes back to the tournament form when opened from it, otherwise closes the dialog. */
  function closeModal() {
    if (modalFlow.value) {
      const flow = modalFlow.value
      releaseClubLogoPreview()
      modalFlow.value = null
      modalType.value = flow.parentType
      form.value = flow.parentForm
      modalError.value = ''
      return
    }

    releaseClubLogoPreview()
    showModal.value = false
    showTargetTypeModal.value = false
    modalError.value = ''
    targetTypeError.value = ''
    editingClubId.value = ''
    editingParticipantId.value = ''
    editingTournamentTypeId.value = ''
    editingCategoryId.value = ''
  }

  /** @returns {void} */
  function openTargetTypeModal() {
    targetTypeName.value = ''
    targetTypeError.value = ''
    showTargetTypeModal.value = true
  }

  /** @returns {void} */
  function closeTargetTypeModal() {
    showTargetTypeModal.value = false
    targetTypeError.value = ''
  }

  /**
   * Empties the add-archer form so a different archer can be found or created. The club stays as it was, because a
   * club user cannot change it and a manager may have opened the form from a club filter.
   * @returns {void}
   */
  function clearArcherForm() {
    form.value = { ...blankParticipant(ownClubId()), clubId: form.value.clubId }
    selectedMatchToken.value = ''
    archerMatches.value = []
    modalError.value = ''
  }

  /** @returns {void} */
  function scheduleArcherSearch() {
    window.clearTimeout(archerSearchTimer)
    selectedMatchToken.value = ''
    const isAddingArcher = showModal.value && modalType.value === 'participant' && !editingParticipantId.value
    const query = {
      affiliationId: (form.value.waId || '').trim() || (form.value.aetayId || '').trim(),
      lastName: (form.value.lastName || '').trim(),
      firstName: (form.value.firstName || '').trim(),
      tournamentId: assignNewParticipant.value ? selectedTournamentId.value : '',
    }
    if (!isAddingArcher || !canSearchArchers.value || (!query.affiliationId && query.lastName.length < 3)) {
      archerSearchRun += 1
      archerMatches.value = []
      return
    }
    const run = (archerSearchRun += 1)
    archerSearchTimer = window.setTimeout(async () => {
      try {
        const found = await repository.searchArchers(query)
        if (run === archerSearchRun) archerMatches.value = found
      } catch (error) {
        if (run !== archerSearchRun) return
        archerMatches.value = []
        modalError.value = `${t('Archer search failed')}: ${error.message}`
      }
    }, 300)
  }

  /**
   * @param {{ dates: string[] }} tournament
   * @returns {void}
   */
  function openTournamentDatesModal(tournament) {
    openModal('tournamentDates')
    form.value = datesToForm(tournament.dates)
  }

  // Searches while the user types: the affiliation IDs first, then the name. Only the add-archer form searches, and
  // only for users who may change data, so a club without an active plan never reaches the database.
  watch(() => [form.value.waId, form.value.aetayId, form.value.lastName, form.value.firstName], scheduleArcherSearch)

  return {
    form,
    showModal,
    modalType,
    modalText,
    showTargetTypeModal,
    targetTypeName,
    targetTypeOptions,
    assignNewParticipant,
    editingClubId,
    editingParticipantId,
    editingTournamentTypeId,
    editingCategoryId,
    archerMatches,
    selectedMatchToken,
    selectedMatch,
    openModal,
    openTournamentChildModal,
    returnToParentModal,
    handleClubLogoSelection,
    addParticipantToClub,
    addParticipantToTournament,
    editClub,
    editParticipant,
    editTournamentType,
    editCategory,
    closeModal,
    openTargetTypeModal,
    closeTargetTypeModal,
    clearArcherForm,
    openTournamentDatesModal,
  }
}
