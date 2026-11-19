<script setup>
import { t } from '@shooting-line/i18n'
import LanguageSwitcher from '@shooting-line/i18n/LanguageSwitcher.vue'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import CategoriesPage from './components/CategoriesPage.vue'
import ClubsPage from './components/ClubsPage.vue'
import DashboardPage from './components/DashboardPage.vue'
import TournamentArchersTab from './components/TournamentArchersTab.vue'
import TournamentCategoriesTab from './components/TournamentCategoriesTab.vue'
import TournamentDetailPage from './components/TournamentDetailPage.vue'
import TournamentOlympicTab from './components/TournamentOlympicTab.vue'
import TournamentScoresTab from './components/TournamentScoresTab.vue'
import TournamentsPage from './components/TournamentsPage.vue'
import ParticipantsPage from './components/ParticipantsPage.vue'
import ScoreDetailPage from './components/ScoreDetailPage.vue'
import PlansPage from './components/PlansPage.vue'
import TournamentTypesPage from './components/TournamentTypesPage.vue'
import UserAccessPage from './components/UserAccessPage.vue'
import { useTheme } from './composables/useTheme'
import { useNavItems } from './composables/useNavItems'
import { usePermissions } from './composables/usePermissions'
import { useToast } from './composables/useToast'
import { useManagerStore } from './stores/managerStore'
import CategoryForm from './components/CategoryForm.vue'
import ClubForm from './components/ClubForm.vue'
import ProfileForm from './components/ProfileForm.vue'
import TournamentTypeForm from './components/TournamentTypeForm.vue'
import UserRoleForm from './components/UserRoleForm.vue'
import ArcherForm from './components/ArcherForm.vue'
import TournamentForm from './components/TournamentForm.vue'
import AppModal from './components/AppModal.vue'
import TargetTypeModal from './components/TargetTypeModal.vue'
import ArcherRequestsPage from './components/ArcherRequestsPage.vue'
import { summarizeDecision } from './services/archerRequests'
import { fullName } from './services/display'
import { modalLabels } from './services/modalLabels'
import { buildScoreRows } from './services/scoreRows'
import { categoryBlockReason as categoryBlockReasonFor } from './services/categoryEligibility'
import { findOverlappingSubscription } from './services/planRules'
import { datesToForm, resolveDays } from './services/tournamentDates'

const props = defineProps({
  initialData: { type: Object, required: true },
  repository: { type: Object, required: true },
  userEmail: { type: String, default: '' },
  userId: { type: String, default: '' },
  userName: { type: String, default: '' },
  userRole: { type: String, default: 'manager' },
  userRoles: { type: Array, default: () => ['manager'] },
  userScope: { type: Object, default: () => ({}) },
})

const isDevelopmentPreview = import.meta.env.VITE_APP_ENV === 'development'
const { theme, toggleTheme } = useTheme()
const store = useManagerStore()
store.load(props.initialData)
const { data, databaseError, modalError, targetTypeError } = storeToRefs(store)
const { persistChange, clubFor, tournamentTypeFor, categoryFor, participantById } = store

function makeId() {
  return crypto.randomUUID()
}

const selectedTournamentId = ref(data.value.tournaments[0]?.id || '')
const selectedTournament = computed(() => data.value.tournaments.find((item) => item.id === selectedTournamentId.value))
const {
  canManage,
  isAdmin,
  isClubUser,
  clubHasActivePlan,
  canCreateTournament,
  canEditTournament,
  canStartTournament,
  showPlanNotice,
  planAccounts,
  canClubEdit,
  canManageParticipants,
  canSearchArchers,
  canEditClub,
} = usePermissions(props, data, selectedTournament)
const visibleNavItems = useNavItems(canManage, isClubUser)
const { toast, notify } = useToast()
// Clubs have no separate detail page; the edit form is the club's detail view, so users who cannot edit
// are taken to the Clubs directory instead.
function openClubDetails(club) {
  if (canEditClub(club)) editClub(club)
  else activePage.value = 'clubs'
}
const activePage = ref('dashboard')
const search = ref('')
const participantClubFilter = ref('')
const participantDirectorySearch = ref('')
const tournamentStatusFilter = ref('upcoming')
const selectedRounds = ref({})
const selectedCategories = ref({})
const selectedTournamentTab = ref('participants')
const newRoundName = ref('')
const selectedScoreParticipantId = ref('')
const editingTournamentTypeId = ref('')
const editingCategoryId = ref('')
const editingUserRoleId = ref('')
const modalFlow = ref(null)
const showModal = ref(false)
const modalType = ref('')
const showTargetTypeModal = ref(false)
const targetTypeName = ref('')
const assignNewParticipant = ref(false)
// Matches for what the user types in the add-archer form. Each has a one-time token and never a database ID.
const archerMatches = ref([])
const selectedMatchToken = ref('')
let archerSearchTimer = null
let archerSearchRun = 0
const editingClubId = ref('')
const editingParticipantId = ref('')
const tournamentQuery = ref('')
const userName = ref(props.userName)
const targetTypeOptions = computed(() => {
  const options = data.value.targetTypes.map((type) => type.name)
  const selected = form.value.targetType
  if (selected && !options.some((name) => name.toLowerCase() === selected.toLowerCase())) {
    options.push(selected)
  }
  return options
})

const selectedScoreParticipant = computed(() =>
  data.value.participants.find((person) => person.id === selectedScoreParticipantId.value),
)
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
const currentNavPage = computed(() =>
  activePage.value === 'tournament-detail'
    ? 'tournaments'
    : activePage.value === 'score-detail'
      ? 'participants'
      : activePage.value,
)
// A tournament still counts as next while its last day has not passed.
const roleSummary = computed(() => {
  const roleLabels = {
    admin: 'System admin',
    manager: 'Manager',
    club: 'Club',
    archer: 'Archer',
  }
  return props.userRoles
    .map((role) => roleLabels[role] && t(roleLabels[role]))
    .filter(Boolean)
    .join(' · ')
})
// Name-only archers (other clubs') appear in tournaments and scores but never in the directory or its pickers,
// so a club cannot browse archers it does not own.
const directoryParticipants = computed(() => data.value.participants.filter((person) => !person.nameOnly))
const selectedMatch = computed(
  () => archerMatches.value.find((match) => match.token === selectedMatchToken.value) || null,
)
const tournamentParticipants = computed(() => {
  if (!selectedTournament.value) return []
  return selectedTournament.value.participantIds
    .map((id) => data.value.participants.find((person) => person.id === id))
    .filter(Boolean)
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
const selectedParticipantScoreRows = computed(() => buildScoreRows(selectedScoreParticipantId.value, data.value))

const blankClub = () => ({
  name: '',
  representative: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  mapUrl: '',
  logoUrl: '',
  logoFile: null,
  logoPreview: '',
  userEmail: '',
  userEnabled: false,
})
const blankTournament = () => ({
  name: '',
  dateMode: 'range',
  startDate: '',
  endDate: '',
  days: [''],
  discipline: 'Outdoor target',
  tournamentTypeId: data.value.tournamentTypes[0]?.id || '',
  clubId: !canManage.value && isClubUser.value ? props.userScope.clubId || '' : data.value.clubs[0]?.id || '',
  venueMode: 'club',
  customAddress: '',
})
const blankTournamentType = () => ({
  name: '',
  distance: '',
  distanceUnit: 'm',
  targetType: data.value.targetTypes[0]?.name || '',
  ends: '',
  arrowsPerEnd: '',
})
const blankCategory = () => ({
  name: '',
  minAge: '',
  maxAge: '',
  bowType: '',
  sortOrder: '',
  levelExempt: false,
})
const blankParticipant = () => ({
  firstName: '',
  lastName: '',
  birthDate: '',
  waId: '',
  aetayId: '',
  email: '',
  clubId: !canManage.value && isClubUser.value ? props.userScope.clubId || '' : '',
  // Only used when the archer is created from a tournament roster. They are not saved on the archer.
  bowType: '',
  categoryId: '',
})
const blankUserRole = () => ({
  email: '',
  role: 'manager',
  displayName: '',
})
const form = ref({})
// Searches while the user types: the affiliation IDs first, then the name. Only the add-archer form searches, and
// only for users who may change data, so a club without an active plan never reaches the database.
watch(() => [form.value.waId, form.value.aetayId, form.value.lastName, form.value.firstName], scheduleArcherSearch)

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
      const found = await props.repository.searchArchers(query)
      if (run === archerSearchRun) archerMatches.value = found
    } catch (error) {
      if (run !== archerSearchRun) return
      archerMatches.value = []
      modalError.value = `${t('Archer search failed')}: ${error.message}`
    }
  }, 300)
}

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
  editingUserRoleId.value = ''
  form.value =
    type === 'club'
      ? blankClub()
      : type === 'tournament'
        ? blankTournament()
        : type === 'tournamentType'
          ? blankTournamentType()
          : type === 'category'
            ? blankCategory()
            : type === 'userRole'
              ? blankUserRole()
              : type === 'profile'
                ? { displayName: userName.value }
                : blankParticipant()
  showModal.value = true
}

function openTournamentChildModal(type) {
  modalFlow.value = {
    parentType: 'tournament',
    parentForm: { ...form.value },
    linkField: type === 'club' ? 'clubId' : 'tournamentTypeId',
  }
  editingClubId.value = ''
  editingTournamentTypeId.value = ''
  modalType.value = type
  form.value = type === 'club' ? blankClub() : blankTournamentType()
}

function returnToParentModal(record) {
  if (!modalFlow.value) return false

  const flow = modalFlow.value
  releaseClubLogoPreview()
  modalFlow.value = null
  modalType.value = flow.parentType
  form.value = { ...flow.parentForm, [flow.linkField]: record.id }
  return true
}

function releaseClubLogoPreview() {
  if (form.value.logoFile && form.value.logoPreview) {
    URL.revokeObjectURL(form.value.logoPreview)
  }
}

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

function addParticipantToClub(clubId) {
  openModal('participant')
  form.value.clubId = clubId
}

function addParticipantToTournament() {
  openModal('participant', true)
  if (participantClubFilter.value && participantClubFilter.value !== '__unassigned__') {
    form.value.clubId = participantClubFilter.value
  }
}

function editClub(club) {
  modalType.value = 'club'
  editingClubId.value = club.id
  form.value = { ...club, logoFile: null, logoPreview: club.logoUrl }
  showModal.value = true
}

function editParticipant(person) {
  modalType.value = 'participant'
  editingParticipantId.value = person.id
  form.value = { ...person }
  showModal.value = true
}

function editTournamentType(type) {
  modalType.value = 'tournamentType'
  editingTournamentTypeId.value = type.id
  form.value = { ...type }
  showModal.value = true
}

function editCategory(category) {
  modalType.value = 'category'
  editingCategoryId.value = category.id
  form.value = { ...category }
  showModal.value = true
}

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
  editingUserRoleId.value = ''
}

async function saveClub() {
  const isEditing = Boolean(editingClubId.value)
  const existingClub = isEditing ? clubFor(editingClubId.value) : null
  const hadUserEnabled = Boolean(existingClub?.userEnabled)
  const { logoFile } = form.value
  const clubForm = { ...form.value }
  delete clubForm.logoFile
  delete clubForm.logoPreview
  clubForm.email = (clubForm.email || '').trim()
  clubForm.userEmail = clubForm.email || (clubForm.userEmail || '').trim()
  if (!clubForm.userEmail) clubForm.userEnabled = false
  const club = { ...clubForm, id: editingClubId.value || makeId() }
  const saved = await persistChange(
    async () => {
      if (logoFile) club.logoUrl = await props.repository.uploadClubLogo(club.id, logoFile)
      await props.repository.saveClub(club, {
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
    clubId: canManage.value ? form.value.clubId : props.userScope.clubId,
    id: makeId(),
    rounds: ['Qualification'],
    participantIds: [],
    categoryIds: [],
    categoryAssignments: {},
  }
  if (
    !(await persistChange(
      () => props.repository.saveTournament(tournament),
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

function openTournamentDatesModal(tournament) {
  openModal('tournamentDates')
  form.value = datesToForm(tournament.dates)
}

async function saveTournamentDates() {
  const tournament = selectedTournament.value
  if (!tournament || !canEditTournament.value) return
  const { dates, error } = resolveDays(form.value)
  if (error) {
    modalError.value = t(error)
    return
  }
  const saved = await persistChange(
    () => props.repository.saveTournamentDates(tournament.id, dates),
    () => {
      tournament.dates = dates
    },
    'modal',
  )
  if (!saved) return
  closeModal()
  notify('Tournament dates updated')
}

async function savePlan(plan) {
  const saved = { ...plan, id: plan.id || makeId(), userRole: plan.userRole ?? 'club', isActive: plan.isActive ?? true }
  await persistChange(
    () => props.repository.savePlan(saved),
    () => {
      data.value.plans ??= []
      const index = data.value.plans.findIndex((item) => item.id === saved.id)
      if (index === -1) data.value.plans.push(saved)
      else data.value.plans[index] = saved
    },
  )
}

async function savePlanPrice(price) {
  const saved = { ...price, id: makeId() }
  const wasSaved = await persistChange(
    () => props.repository.savePlanPrice(saved),
    () => {
      data.value.planPrices ??= []
      data.value.planPrices.push(saved)
    },
  )
  if (wasSaved) notify('Price saved')
}

async function saveSubscription(subscription) {
  if (findOverlappingSubscription(data.value.subscriptions ?? [], subscription)) {
    notify('This account already has a plan during these dates')
    return
  }
  const saved = { ...subscription, id: makeId() }
  const wasSaved = await persistChange(
    () => props.repository.saveSubscription(saved),
    () => {
      data.value.subscriptions ??= []
      data.value.subscriptions.push(saved)
    },
  )
  if (wasSaved) notify('Plan assigned')
}

async function setSubscriptionEnd({ subscription, endsOn }) {
  const wasSaved = await persistChange(
    () => props.repository.updateSubscriptionEnd(subscription.id, endsOn),
    () => {
      const saved = data.value.subscriptions.find((item) => item.id === subscription.id)
      if (saved) saved.endsOn = endsOn
    },
  )
  if (wasSaved) notify('End date saved')
}

async function removeSubscription(subscription) {
  await persistChange(
    () => props.repository.removeSubscription(subscription.id),
    () => {
      data.value.subscriptions = data.value.subscriptions.filter((item) => item.id !== subscription.id)
    },
  )
}

/** @returns {Promise<void>} */
async function createArcherRequest(participantId) {
  const request = {
    id: makeId(),
    participantId,
    clubId: props.userScope.clubId || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  const wasSaved = await persistChange(
    () => props.repository.createArcherRequest(request),
    () => {
      data.value.archerRequests ??= []
      data.value.archerRequests.push(request)
    },
  )
  if (wasSaved) notify('Request sent')
}

/** @returns {Promise<void>} */
async function decideArcherRequests({ action, requestIds }) {
  const status = action === 'approve' ? 'approved' : 'rejected'
  let results
  try {
    results = await props.repository.decideArcherRequests(action, requestIds)
  } catch (error) {
    databaseError.value = `${t('Save failed')}: ${error.message}`
    return
  }
  const { succeededIds, failures } = summarizeDecision(results)
  for (const request of data.value.archerRequests ?? []) {
    if (succeededIds.includes(request.id)) request.status = status
  }
  if (failures.length) {
    databaseError.value = `${t('Some requests could not be decided')}: ${failures.join('; ')}`
    return
  }
  databaseError.value = ''
  notify(action === 'approve' ? 'Requests approved' : 'Requests rejected')
}

async function saveTournamentType() {
  const isEditing = Boolean(editingTournamentTypeId.value)
  const type = {
    ...form.value,
    id: editingTournamentTypeId.value || makeId(),
    distance: Number(form.value.distance),
    ends: Number(form.value.ends),
    arrowsPerEnd: Number(form.value.arrowsPerEnd),
  }
  const saved = await persistChange(
    () => props.repository.saveTournamentType(type),
    () => {
      if (isEditing) {
        const existing = tournamentTypeFor(type.id)
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

function openTargetTypeModal() {
  targetTypeName.value = ''
  targetTypeError.value = ''
  showTargetTypeModal.value = true
}

function closeTargetTypeModal() {
  showTargetTypeModal.value = false
  targetTypeError.value = ''
}

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
  const saved = await persistChange(
    () => props.repository.saveTargetType(targetType),
    () => data.value.targetTypes.push(targetType),
    'targetType',
  )
  if (!saved) return

  form.value.targetType = targetType.name
  closeTargetTypeModal()
}

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
  const saved = await persistChange(
    () => props.repository.saveCategory(category),
    () => {
      if (isEditing) {
        const existing = categoryFor(category.id)
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

async function saveUserRole() {
  const role = {
    email: form.value.email.trim(),
    role: 'manager',
    displayName: form.value.displayName.trim(),
  }
  let userId
  const saved = await persistChange(
    async () => {
      userId = await props.repository.assignUserRole(role)
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

async function removeUserRole(role) {
  if (
    !(await persistChange(
      () => props.repository.removeUserRole(role.userId, role.role),
      () => {
        data.value.userRoles = data.value.userRoles.filter(
          (item) => item.userId !== role.userId || item.role !== role.role,
        )
      },
    ))
  )
    return
  notify('User role removed')
}

async function saveUserProfile() {
  const displayName = form.value.displayName.trim()
  if (!displayName) {
    modalError.value = t('Enter a display name.')
    return
  }

  if (
    !(await persistChange(
      () => props.repository.saveUserProfile(props.userId, displayName),
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
    !(await persistChange(
      () => props.repository.sendOwnPasswordReset(props.userEmail),
      () => {},
      'modal',
    ))
  )
    return

  notify('If the account exists, a password reset email will be sent')
}

/** @returns {Promise<void>} */
async function sendRolePasswordReset(role) {
  if (
    !(await persistChange(
      () => props.repository.sendAdminPasswordReset(role.email),
      () => {},
    ))
  )
    return

  notify('If the account exists, a password reset email will be sent')
}

async function toggleTournamentCategory(tournament, categoryId) {
  const index = tournament.categoryIds.indexOf(categoryId)
  const enabled = index === -1
  if (
    !(await persistChange(
      () => props.repository.setTournamentCategory(tournament.id, categoryId, enabled),
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

/** @returns {string} The reason an archer cannot enter the category, or an empty string. */
function categoryBlockReason(tournament, participant, category) {
  return categoryBlockReasonFor(tournament, participant, category, data.value)
}

async function addParticipantWithCategory(tournament, participant, event) {
  const categoryId = event.target.value
  const category = categoryFor(categoryId)
  event.target.value = ''
  if (!category) {
    notify('Select a valid category')
    return
  }
  const reason = categoryBlockReason(tournament, participant, category)
  if (reason) {
    notify(reason)
    return
  }
  await persistChange(
    () => props.repository.setTournamentParticipant(tournament.id, participant.id, true, categoryId),
    () => {
      if (!tournament.participantIds.includes(participant.id)) tournament.participantIds.push(participant.id)
      tournament.categoryAssignments[participant.id] = categoryId
    },
  )
}

async function clearParticipantCategory(tournament, participant) {
  await persistChange(
    () => props.repository.setParticipantCategory(tournament.id, participant.id, ''),
    () => {
      delete tournament.categoryAssignments[participant.id]
    },
  )
}

async function toggleTournamentStarted(tournament) {
  const starting = !tournament.startedAt
  if (starting && !window.confirm(t('Start this tournament? A club cannot change it after it starts.'))) return
  const startedAt = starting ? new Date().toISOString() : ''
  const saved = await persistChange(
    () => props.repository.setTournamentStarted(tournament.id, startedAt),
    () => {
      tournament.startedAt = startedAt
    },
  )
  if (saved) notify(starting ? 'Tournament started' : 'Tournament reopened')
}

async function removeParticipantFromTournament(tournament, participant) {
  if (!window.confirm(t('Remove {name} from this tournament?', { name: fullName(participant) }))) return
  await toggleParticipant(tournament, participant.id)
}

async function setParticipantClub(participant, event) {
  const existingClubId = participant.clubId || ''
  const clubId = event.target.value
  const saved = await persistChange(
    () => props.repository.setParticipantClub(participant.id, clubId),
    () => {
      participant.clubId = clubId
    },
  )
  if (!saved) event.target.value = existingClubId
}

function openTournament(tournamentId, tab = 'participants') {
  selectedTournamentId.value = tournamentId
  selectedTournamentTab.value = tab
  participantClubFilter.value = ''
  activePage.value = 'tournament-detail'
}

function openScoreDetails(participantId) {
  selectedScoreParticipantId.value = participantId
  activePage.value = 'score-detail'
}

async function addRound() {
  const name = newRoundName.value.trim()
  if (!name || !selectedTournament.value) return
  if (selectedTournament.value.rounds.some((round) => round.toLowerCase() === name.toLowerCase())) {
    notify('That round already exists for this tournament')
    return
  }
  if (
    !(await persistChange(
      () =>
        props.repository.addTournamentRound(selectedTournamentId.value, name, selectedTournament.value.rounds.length),
      () => selectedTournament.value.rounds.push(name),
    ))
  )
    return

  selectedRound.value = name
  newRoundName.value = ''
  notify('Round added to this tournament')
}

/** @returns {string} Why the chosen category cannot be used, or an empty string when it can. */
function categoryChoiceProblem(tournament, participant, categoryId) {
  if (!tournament.categoryIds.length) return ''
  const category = categoryFor(categoryId)
  if (!category) return t('Select a valid category')
  return categoryBlockReason(tournament, participant, category)
}

/**
 * Empties the add-archer form so a different archer can be found or created. The club stays as it was, because a
 * club user cannot change it and a manager may have opened the form from a club filter.
 * @returns {void}
 */
function clearArcherForm() {
  form.value = { ...blankParticipant(), clubId: form.value.clubId }
  selectedMatchToken.value = ''
  archerMatches.value = []
  modalError.value = ''
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
  if (tournament.categoryIds.length && !categoryFor(categoryId)) {
    notify('Select a valid category')
    return
  }
  let archer = null
  const saved = await persistChange(
    async () => {
      archer = await props.repository.addArcherByToken(tournament.id, token, categoryId)
    },
    () => {
      if (!participantById(archer.id)) data.value.participants.push(archer)
      tournament.participantIds.push(archer.id)
      if (categoryId) tournament.categoryAssignments[archer.id] = categoryId
    },
    'modal',
  )
  if (!saved) return

  closeModal()
  notify('Archer added to this tournament')
}

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
    clubId: !canManage.value && isClubUser.value ? props.userScope.clubId || '' : form.value.clubId || '',
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
    !(await persistChange(
      () => props.repository.saveParticipant(participant, tournament?.id || '', isEditing, categoryId),
      () => {
        if (isEditing) {
          const existing = participantById(participant.id)
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

async function toggleClub(club) {
  if (!club.email && !club.userEmail && !club.userEnabled) {
    notify('Add a club email before enabling access')
    return
  }
  const enabled = !club.userEnabled
  if (
    !(await persistChange(
      () => props.repository.setClubEnabled(club.id, enabled),
      () => {
        club.userEnabled = enabled
      },
    ))
  )
    return

  notify(club.userEnabled ? 'Club user enabled' : 'Club user disabled')
}
async function toggleParticipant(tournament, participantId) {
  const index = tournament.participantIds.indexOf(participantId)
  const included = index === -1
  if (
    !(await persistChange(
      () => props.repository.setTournamentParticipant(tournament.id, participantId, included),
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

async function saveScore(participantId, value) {
  if (value === '' || value === null) {
    await persistChange(
      () =>
        props.repository.saveScore({
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
  await persistChange(
    () => props.repository.saveScore(score),
    () => {
      if (existing) Object.assign(existing, score)
      else data.value.scores.push(score)
    },
  )
}

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
    !(await persistChange(
      () =>
        props.repository.replaceMatches(
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

async function recordMatchScore(match, side, value) {
  const score = value === '' ? '' : Math.max(0, Number(value) || 0)
  if (
    !(await persistChange(
      () => props.repository.setMatchScore(match.id, side, score),
      () => {
        match[side] = score
      },
    ))
  )
    return
}
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :active-page="currentNavPage"
      :nav-items="visibleNavItems"
      :tournament-count="data.tournaments.length"
      :user-email="userEmail"
      :user-name="userName"
      :role-summary="roleSummary"
      :can-edit-profile="userRole !== 'archer' && (!isClubUser || canManage || clubHasActivePlan)"
      @navigate="activePage = $event"
      @edit-profile="openModal('profile')"
    />

    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumbs">
          <span>{{ t('Main menu') }}</span><span class="crumb-slash">/</span
          ><strong>{{
            activePage === 'tournament-detail'
              ? selectedTournament?.name
              : visibleNavItems.find((item) => item.id === activePage)?.label
          }}</strong>
        </div>
        <div class="topbar-actions">
          <span v-if="isDevelopmentPreview" class="environment-badge">{{ t('DEVELOPMENT / QA') }}</span>
          <span class="demo-chip"><i></i> {{ t('Shared database') }}</span>
          <a class="portal-link" href="../">{{ t('App launcher') }}</a>
          <LanguageSwitcher />
          <button
            class="theme-toggle"
            type="button"
            :aria-pressed="theme === 'dark'"
            :aria-label="theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')"
            @click="toggleTheme"
          >
            <span aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span>
            <span class="theme-toggle-label">{{ theme === 'dark' ? t('Light theme') : t('Dark theme') }}</span>
          </button>
          <button class="icon-button" :aria-label="t('Help')" @click="notify('ShootingLine is ready to use')">?</button>
        </div>
      </header>

      <p v-if="databaseError" class="database-error" role="alert">{{ databaseError }}</p>
      <div class="page-container">
        <DashboardPage
          v-if="activePage === 'dashboard'"
          :user-name="userName"
          :tournaments="data.tournaments"
          :clubs="data.clubs"
          :archer-count="directoryParticipants.length"
          :selected-tournament-id="selectedTournament?.id || ''"
          :can-manage="canManage"
          :can-manage-participants="canManageParticipants"
          :can-create-tournament="canCreateTournament"
          :show-plan-notice="showPlanNotice"
          @navigate="activePage = $event"
          @create="openModal($event)"
          @open-tournament="openTournament"
          @open-club="openClubDetails"
          @toggle-club="toggleClub"
        />

        <ClubsPage
          v-else-if="activePage === 'clubs'"
          v-model:search="search"
          :clubs="data.clubs"
          :can-manage="canManage"
          :can-club-edit="canClubEdit"
          :is-club-user="isClubUser"
          :club-id="userScope.clubId || ''"
          @create="openModal('club')"
          @edit="editClub"
          @toggle-user="toggleClub"
          @add-archer="addParticipantToClub"
        />

        <ParticipantsPage
          v-else-if="activePage === 'participants'"
          v-model:search="search"
          :participants="directoryParticipants"
          :clubs="data.clubs"
          :tournaments="data.tournaments"
          :scores="data.scores"
          :matches="data.matches"
          :can-manage="canManage"
          :can-manage-participants="canManageParticipants"
          :can-club-edit="canClubEdit"
          :club-id="userScope.clubId || ''"
          @create="openModal('participant')"
          @edit="editParticipant"
          @set-club="setParticipantClub"
          @view-scores="openScoreDetails"
        />

        <TournamentsPage
          v-else-if="activePage === 'tournaments'"
          v-model:status="tournamentStatusFilter"
          v-model:query="tournamentQuery"
          :tournaments="data.tournaments"
          :tournament-types="data.tournamentTypes"
          :clubs="data.clubs"
          :can-manage="canManage"
          :can-create-tournament="canCreateTournament"
          :show-plan-notice="showPlanNotice"
          @create="openModal('tournament')"
          @open-tournament="openTournament"
          @open-types="activePage = 'tournament-types'"
        />

        <TournamentTypesPage
          v-else-if="activePage === 'tournament-types'"
          :tournament-types="data.tournamentTypes"
          :tournaments="data.tournaments"
          :can-manage="canManage"
          @create="openModal('tournamentType')"
          @edit="editTournamentType"
        />

        <CategoriesPage
          v-else-if="activePage === 'categories'"
          :categories="data.categories"
          :tournaments="data.tournaments"
          :can-manage="canManage"
          @create="openModal('category')"
          @edit="editCategory"
        />

        <UserAccessPage
          v-else-if="activePage === 'user-access' && canManage"
          :user-roles="data.userRoles"
          :user-id="userId"
          :is-admin="isAdmin"
          @add="openModal('userRole')"
          @reset-password="sendRolePasswordReset"
          @remove="removeUserRole"
        />

        <ArcherRequestsPage
          v-else-if="activePage === 'requests' && (canManage || isClubUser)"
          :requests="data.archerRequests ?? []"
          :participants="data.participants"
          :clubs="data.clubs"
          :can-decide="canManage"
          :club-id="props.userScope.clubId || ''"
          :can-request="canClubEdit && Boolean(props.userScope.clubId)"
          :error="databaseError"
          @create-request="createArcherRequest"
          @decide="decideArcherRequests"
        />

        <PlansPage
          v-else-if="activePage === 'plans' && canManage"
          :plans="data.plans ?? []"
          :prices="data.planPrices ?? []"
          :subscriptions="data.subscriptions ?? []"
          :accounts="planAccounts"
          :error="databaseError"
          @save-plan="savePlan"
          @save-price="savePlanPrice"
          @save-subscription="saveSubscription"
          @set-subscription-end="setSubscriptionEnd"
          @remove-subscription="removeSubscription"
        />

        <ScoreDetailPage
          v-else-if="activePage === 'score-detail'"
          :participant="selectedScoreParticipant"
          :rows="selectedParticipantScoreRows"
          @back="activePage = 'participants'"
        />

        <TournamentDetailPage
          v-else-if="activePage === 'tournament-detail'"
          v-model:tab="selectedTournamentTab"
          :tournament="selectedTournament"
          :clubs="data.clubs"
          :tournament-types="data.tournamentTypes"
          :can-manage="canManage"
          :can-edit-tournament="canEditTournament"
          :can-start-tournament="canStartTournament"
          @back="activePage = 'tournaments'"
          @edit-dates="openTournamentDatesModal"
          @toggle-started="toggleTournamentStarted"
        >
          <TournamentArchersTab
            v-if="selectedTournamentTab === 'participants'"
            v-model:club-filter="participantClubFilter"
            v-model:search="participantDirectorySearch"
            :tournament="selectedTournament"
            :participants="data.participants"
            :clubs="data.clubs"
            :categories="data.categories"
            :tournaments="data.tournaments"
            :can-edit-tournament="canEditTournament"
            @add-archer="addParticipantToTournament"
            @choose-category="addParticipantWithCategory"
            @change-category="addParticipantWithCategory"
            @clear-category="clearParticipantCategory"
            @remove="removeParticipantFromTournament"
          />
          <TournamentCategoriesTab
            v-else-if="selectedTournamentTab === 'categories'"
            :tournament="selectedTournament"
            :categories="data.categories"
            :can-manage="canManage"
            :can-edit-tournament="canEditTournament"
            @toggle="toggleTournamentCategory"
            @open-catalogue="activePage = 'categories'"
          />
          <TournamentScoresTab
            v-else-if="selectedTournamentTab === 'scores'"
            v-model:round="selectedRound"
            v-model:new-round-name="newRoundName"
            :tournament="selectedTournament"
            :rows="scoreRows"
            :categories="data.categories"
            :scored-count="scoredCount"
            :archer-count="tournamentParticipants.length"
            :can-manage="canManage"
            :can-edit-tournament="canEditTournament"
            @add-round="addRound"
            @save-score="saveScore"
            @view-archers="selectedTournamentTab = 'participants'"
          />
          <TournamentOlympicTab
            v-else
            v-model:category-id="selectedCategoryId"
            :tournament="selectedTournament"
            :categories="data.categories"
            :participants="data.participants"
            :matches="olympicMatches"
            :round="selectedRound"
            :can-manage="canManage"
            @generate="generateMatches"
            @record-score="recordMatchScore"
            @view-scores="selectedTournamentTab = 'scores'"
          />
          <template #empty>
            <strong>{{ t('Tournament not found') }}</strong><button
              class="button button-outline"
              @click="activePage = 'tournaments'"
            >
              {{ t('Back to tournaments') }}
            </button>
          </template>
        </TournamentDetailPage>
      </div>
    </main>

    <AppModal
      v-if="showModal"
      :eyebrow="modalText.eyebrow"
      :title="modalText.title"
      :submit-label="modalText.submit"
      :cancel-label="modalText.cancel"
      :error="modalError"
      @submit="submitModal"
      @close="closeModal"
    >
      <ClubForm
        v-if="modalType === 'club'"
        v-model:form="form"
        :can-manage="canManage"
        @logo-selected="handleClubLogoSelection"
      />
      <TournamentForm
        v-else-if="modalType === 'tournament' || modalType === 'tournamentDates'"
        v-model:form="form"
        :modal-type="modalType"
        :tournament-types="data.tournamentTypes"
        :clubs="data.clubs"
        :club-id="userScope.clubId || ''"
        :can-manage="canManage"
        @add-type="openTournamentChildModal('tournamentType')"
        @add-club="openTournamentChildModal('club')"
      />
      <TournamentTypeForm
        v-else-if="modalType === 'tournamentType'"
        v-model:form="form"
        :target-type-options="targetTypeOptions"
        :can-manage="canManage"
        @add-target-type="openTargetTypeModal"
      />
      <CategoryForm v-else-if="modalType === 'category'" v-model:form="form" />
      <UserRoleForm v-else-if="modalType === 'userRole'" v-model:form="form" />
      <ProfileForm
        v-else-if="modalType === 'profile'"
        v-model:form="form"
        :user-email="userEmail"
        @reset-password="sendOwnPasswordReset"
      />
      <ArcherForm
        v-else
        v-model:form="form"
        v-model:match-token="selectedMatchToken"
        :selected-match="selectedMatch"
        :archer-matches="archerMatches"
        :assign-new-participant="assignNewParticipant"
        :editing-participant-id="editingParticipantId"
        :selected-tournament="selectedTournament"
        :clubs="data.clubs"
        :categories="data.categories"
        :tournaments="data.tournaments"
        :club-id="userScope.clubId || ''"
        :can-manage="canManage"
        @clear="clearArcherForm"
      />
      <template #after>
        <TargetTypeModal
          v-if="showTargetTypeModal"
          v-model:name="targetTypeName"
          :error="targetTypeError"
          @save="saveTargetType"
          @close="closeTargetTypeModal"
        />
      </template>
    </AppModal>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message"><span>✓</span>{{ toast }}</div></Transition
    >
  </div>
</template>
