<script setup>
import { computed, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'

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
const THEME_STORAGE_KEY = 'shooting-line-theme'
const theme = ref(localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light')
const data = ref(props.initialData)
const databaseError = ref('')
const modalError = ref('')

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value
    localStorage.setItem(THEME_STORAGE_KEY, value)
  },
  { immediate: true },
)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function makeId() {
  return crypto.randomUUID()
}

async function persistChange(operation, updateLocalState, errorTarget = 'page') {
  try {
    await operation()
    updateLocalState()
    databaseError.value = ''
    modalError.value = ''
    targetTypeError.value = ''
    return true
  } catch (error) {
    const message = `Save failed: ${error.message}`
    if (errorTarget === 'modal') modalError.value = message
    else if (errorTarget === 'targetType') targetTypeError.value = message
    else databaseError.value = message
    return false
  }
}

const allNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'tournaments', label: 'Tournaments', icon: '▦' },
  { id: 'tournament-types', label: 'Tournament types', icon: '⚙' },
  { id: 'categories', label: 'Categories', icon: '◇' },
  { id: 'clubs', label: 'Clubs', icon: '⌂' },
  { id: 'participants', label: 'Archers', icon: '♙' },
  { id: 'user-access', label: 'User access', icon: '♙' },
]
const canManage = computed(() => ['admin', 'manager'].includes(props.userRole))
const isAdmin = computed(() => props.userRole === 'admin')
function canEditClub(club) {
  return canManage.value || (props.userRole === 'club' && club.id === props.userScope.clubId)
}
const visibleNavItems = computed(() => allNavItems.filter((item) => item.id !== 'user-access' || canManage.value))
const activePage = ref('dashboard')
const search = ref('')
const participantClubFilter = ref('')
const participantDirectorySearch = ref('')
const tournamentStatusFilter = ref('upcoming')
const selectedTournamentId = ref(data.value.tournaments[0]?.id || '')
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
const targetTypeError = ref('')
const assignNewParticipant = ref(false)
const editingClubId = ref('')
const toast = ref('')
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

const selectedTournament = computed(() => data.value.tournaments.find((item) => item.id === selectedTournamentId.value))
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
const salutation = computed(() => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
})
const greeting = computed(() => `${salutation.value}, ${userName.value || 'there'}`)
const roleSummary = computed(() => {
  const roleLabels = {
    admin: 'System admin',
    manager: 'Manager',
    club: 'Club',
    archer: 'Archer',
  }
  return props.userRoles
    .map((role) => roleLabels[role])
    .filter(Boolean)
    .join(' · ')
})
const upcomingTournaments = computed(() => [...data.value.tournaments].sort((a, b) => a.date.localeCompare(b.date)))
const nextTournament = computed(() => upcomingTournaments.value.find((item) => item.date >= today()))
const filteredParticipants = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return data.value.participants
  return data.value.participants.filter((person) =>
    [person.firstName, person.lastName, person.waId, person.aetayId]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term)),
  )
})
const filteredTournamentParticipantsDirectory = computed(() => {
  const query = participantDirectorySearch.value.trim().toLowerCase()
  return data.value.participants.filter((person) => {
    const matchesClub =
      !participantClubFilter.value ||
      (participantClubFilter.value === '__unassigned__' && !person.clubId) ||
      person.clubId === participantClubFilter.value
    const matchesQuery =
      !query ||
      [person.lastName, person.waId, person.aetayId]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    return matchesClub && matchesQuery
  })
})
const participantSearchOptions = computed(() => {
  const values = data.value.participants
    .filter(
      (person) =>
        !participantClubFilter.value ||
        (participantClubFilter.value === '__unassigned__' && !person.clubId) ||
        person.clubId === participantClubFilter.value,
    )
    .flatMap((person) => [person.lastName, person.waId, person.aetayId])
    .filter(Boolean)
  return [...new Set(values)]
})
const filteredTournaments = computed(() =>
  upcomingTournaments.value.filter((tournament) => {
    const matchesSearch = tournament.name.toLowerCase().includes(tournamentQuery.value.toLowerCase())
    const isPast = tournament.date < today()
    const matchesStatus = tournamentStatusFilter.value === 'past' ? isPast : !isPast
    return matchesSearch && matchesStatus
  }),
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
const scoreSummaries = computed(() =>
  data.value.participants.map((participant) => {
    const roundScores = data.value.scores.filter((item) => item.participantId === participant.id)
    const matchScores = data.value.matches.filter(
      (match) =>
        (match.seed1Id === participant.id && match.score1 !== '') ||
        (match.seed2Id === participant.id && match.score2 !== ''),
    )
    return {
      participant,
      scoreCount: roundScores.length + matchScores.length,
    }
  }),
)
const selectedParticipantScoreRows = computed(() =>
  [
    ...data.value.scores
      .filter((item) => item.participantId === selectedScoreParticipantId.value)
      .map((item) => ({
        ...item,
        tournament: data.value.tournaments.find((event) => event.id === item.tournamentId),
        category: categoryFor(
          item.categoryId ||
            data.value.tournaments.find((event) => event.id === item.tournamentId)?.categoryAssignments?.[
              item.participantId
            ],
        ),
        scoreType: 'Round score',
      })),
    ...data.value.matches.flatMap((match) => {
      const shooterIsFirst = match.seed1Id === selectedScoreParticipantId.value && match.score1 !== ''
      const shooterIsSecond = match.seed2Id === selectedScoreParticipantId.value && match.score2 !== ''
      if (!shooterIsFirst && !shooterIsSecond) return []
      const opponentId = shooterIsFirst ? match.seed2Id : match.seed1Id
      return [
        {
          tournamentId: match.tournamentId,
          tournament: data.value.tournaments.find((event) => event.id === match.tournamentId),
          category: categoryFor(match.categoryId),
          round: `${match.round} vs ${fullName(participantById(opponentId) || { firstName: 'Unknown', lastName: '' })}`,
          score: shooterIsFirst ? match.score1 : match.score2,
          scoreType: 'Olympic match',
        },
      ]
    }),
  ].sort((a, b) => (b.tournament?.date || '').localeCompare(a.tournament?.date || '')),
)

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
  date: '',
  discipline: 'Outdoor target',
  tournamentTypeId: data.value.tournamentTypes[0]?.id || '',
  clubId: data.value.clubs[0]?.id || '',
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
})
const blankParticipant = () => ({
  firstName: '',
  lastName: '',
  birthDate: '',
  waId: '',
  aetayId: '',
  clubId: '',
})
const blankUserRole = () => ({
  email: '',
  role: 'manager',
  clubId: '',
  participantId: '',
  displayName: '',
})
const form = ref({})

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  )
}

function fullName(person) {
  return `${person.firstName} ${person.lastName}`
}

function clubFor(id) {
  return data.value.clubs.find((club) => club.id === id)
}

function tournamentTypeFor(id) {
  return data.value.tournamentTypes.find((type) => type.id === id)
}

function categoryFor(id) {
  return data.value.categories.find((category) => category.id === id)
}

function categoryDescription(category) {
  const ageRange =
    category.minAge !== null && category.minAge !== ''
      ? `Age ${category.minAge}${category.maxAge !== null && category.maxAge !== '' ? `–${category.maxAge}` : '+'}`
      : category.maxAge !== null && category.maxAge !== ''
        ? `Up to age ${category.maxAge}`
        : 'All ages'
  return [ageRange, category.bowType || 'Any bow type'].join(' · ')
}

function ageAtTournament(participant, tournament) {
  if (!participant.birthDate || !tournament.date) return null
  const birthDate = new Date(`${participant.birthDate}T00:00:00Z`)
  const eventDate = new Date(`${tournament.date}T00:00:00Z`)
  const years = eventDate.getUTCFullYear() - birthDate.getUTCFullYear()
  const birthdayHasPassed =
    eventDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (eventDate.getUTCMonth() === birthDate.getUTCMonth() && eventDate.getUTCDate() >= birthDate.getUTCDate())
  return years - (birthdayHasPassed ? 0 : 1)
}

function venueFor(tournament) {
  if (!tournament) return ''
  return tournament.venueMode === 'custom'
    ? tournament.customAddress
    : clubFor(tournament.clubId)?.address || 'Club address not set'
}

function notify(message) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, 2800)
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
  editingClubId.value = ''
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
              : type === 'passwordReset'
                ? { email: '' }
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
    modalError.value = 'Choose a JPG, PNG, or WebP logo smaller than 2 MB.'
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
  editingTournamentTypeId.value = ''
  editingCategoryId.value = ''
  editingUserRoleId.value = ''
}

async function saveClub() {
  const isEditing = Boolean(editingClubId.value)
  const { logoFile } = form.value
  const clubForm = { ...form.value }
  delete clubForm.logoFile
  delete clubForm.logoPreview
  const club = { ...clubForm, id: editingClubId.value || makeId() }
  const saved = await persistChange(
    async () => {
      if (logoFile) club.logoUrl = await props.repository.uploadClubLogo(club.id, logoFile)
      await props.repository.saveClub(club)
    },
    () => {
      if (isEditing) {
        const existing = clubFor(club.id)
        if (existing) Object.assign(existing, club)
      } else {
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
  if (form.value.venueMode === 'club' && !form.value.clubId) {
    notify('Select a host club or use a custom address')
    return
  }
  const tournament = {
    ...form.value,
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
    targetTypeError.value = 'Enter a target type name.'
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
    ...form.value,
    email: form.value.email.trim(),
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
        clubId: role.clubId || '',
        participantId: role.participantId || '',
      }
      const existing = data.value.userRoles.find((item) => item.userId === userId && item.role === role.role)
      if (existing) Object.assign(existing, assigned)
      else data.value.userRoles.push(assigned)
    },
    'modal',
  )
  if (!saved) return

  closeModal()
  notify('User role assigned')
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
    modalError.value = 'Enter a display name.'
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

async function sendAdminPasswordReset() {
  const email = form.value.email.trim()
  if (!email) {
    modalError.value = 'Enter the account email address.'
    return
  }

  if (
    !(await persistChange(
      () => props.repository.sendAdminPasswordReset(email),
      () => {},
      'modal',
    ))
  )
    return

  closeModal()
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

async function setParticipantCategory(tournament, participant, event) {
  const categoryId = event.target.value
  if (categoryId) {
    const category = categoryFor(categoryId)
    if (!category) {
      notify('Select a valid category')
      event.target.value = tournament.categoryAssignments[participant.id] || ''
      return
    }
    const age = ageAtTournament(participant, tournament)
    if (age !== null && category.minAge !== null && category.minAge !== '' && age < category.minAge) {
      notify(`${fullName(participant)} is below this category's minimum age`)
      event.target.value = tournament.categoryAssignments[participant.id] || ''
      return
    }
    if (age !== null && category.maxAge !== null && category.maxAge !== '' && age > category.maxAge) {
      notify(`${fullName(participant)} is above this category's maximum age`)
      event.target.value = tournament.categoryAssignments[participant.id] || ''
      return
    }
  }
  const existingCategoryId = tournament.categoryAssignments[participant.id] || ''
  const saved = await persistChange(
    () => props.repository.setParticipantCategory(tournament.id, participant.id, categoryId),
    () => {
      if (categoryId) tournament.categoryAssignments[participant.id] = categoryId
      else delete tournament.categoryAssignments[participant.id]
    },
  )
  if (!saved) event.target.value = existingCategoryId
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

async function saveParticipant() {
  const participant = { ...form.value, id: makeId() }
  const tournament = assignNewParticipant.value ? selectedTournament.value : null
  if (
    !(await persistChange(
      () => props.repository.saveParticipant(participant, tournament?.id || ''),
      () => {
        data.value.participants.unshift(participant)
        if (tournament) tournament.participantIds.push(participant.id)
      },
      'modal',
    ))
  )
    return

  closeModal()
  notify('Archer saved')
}

async function toggleParticipant(tournament, participantId) {
  const index = tournament.participantIds.indexOf(participantId)
  const included = index === -1
  if (
    !(await persistChange(
      () => props.repository.setTournamentParticipant(tournament.id, participantId, included),
      () => {
        if (included) tournament.participantIds.push(participantId)
        else tournament.participantIds.splice(index, 1)
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

  notify(`${newMatches.length} first-round matches seeded`)
}

function participantById(id) {
  return data.value.participants.find((person) => person.id === id)
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
      :can-edit-profile="userRole !== 'archer'"
      @navigate="activePage = $event"
      @edit-profile="openModal('profile')"
    />

    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumbs">
          <span>Main menu</span><span class="crumb-slash">/</span
          ><strong>{{
            activePage === 'tournament-detail'
              ? selectedTournament?.name
              : allNavItems.find((item) => item.id === activePage)?.label
          }}</strong>
        </div>
        <div class="topbar-actions">
          <span v-if="isDevelopmentPreview" class="environment-badge">DEVELOPMENT / QA</span>
          <span class="demo-chip"><i></i> Shared database</span>
          <a class="portal-link" href="../">App launcher</a>
          <button
            class="theme-toggle"
            type="button"
            :aria-pressed="theme === 'dark'"
            :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="toggleTheme"
          >
            <span aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span>
            <span class="theme-toggle-label">{{ theme === 'dark' ? 'Light theme' : 'Dark theme' }}</span>
          </button>
          <button class="icon-button" aria-label="Help" @click="notify('ShootingLine is ready to use')">?</button>
        </div>
      </header>

      <p v-if="databaseError" class="database-error" role="alert">{{ databaseError }}</p>
      <div class="page-container">
        <section v-if="activePage === 'dashboard'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">OVERVIEW</p>
              <h1>{{ greeting }} <span class="wave">✳</span></h1>
              <p class="page-subtitle">Here’s what’s happening across your archery community.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('tournament')">
              <span>＋</span> Create tournament
            </button>
          </div>

          <div class="stats-grid">
            <article class="stat-card">
              <div class="stat-top">
                <span class="stat-icon olive">▦</span><span class="stat-caption">ALL TIME</span>
              </div>
              <button
                class="stat-value stat-value-button"
                aria-label="Open tournaments"
                @click="activePage = 'tournaments'"
              >
                {{ data.tournaments.length }}
              </button>
              <span class="stat-label">Total tournaments</span>
              <div class="stat-foot"><span class="stat-dot green"></span> Open event calendar</div>
            </article>
            <article class="stat-card">
              <div class="stat-top">
                <span class="stat-icon sand">⌂</span><span class="stat-caption">REGISTERED</span>
              </div>
              <button class="stat-value stat-value-button" aria-label="Open clubs" @click="activePage = 'clubs'">
                {{ data.clubs.length }}
              </button>
              <span class="stat-label">Clubs</span>
              <div class="stat-foot"><span class="stat-dot green"></span> Open club directory</div>
            </article>
            <article class="stat-card">
              <div class="stat-top">
                <span class="stat-icon blue">♙</span><span class="stat-caption">DATABASE</span>
              </div>
              <button
                class="stat-value stat-value-button"
                aria-label="Open archers"
                @click="activePage = 'participants'"
              >
                {{ data.participants.length }}
              </button>
              <span class="stat-label">Archers</span>
              <div class="stat-foot">Open archer directory</div>
            </article>
            <article class="stat-card next-stat">
              <div class="stat-top">
                <span class="stat-icon peach">◷</span><span class="stat-caption">UP NEXT</span>
              </div>
              <strong class="next-event">{{ nextTournament?.name || 'No upcoming events' }}</strong>
              <span class="stat-label">{{
                nextTournament ? formatDate(nextTournament.date) : 'No event scheduled'
              }}</span>
              <button v-if="nextTournament" class="text-link" @click="openTournament(nextTournament.id)">
                View tournament <span>→</span>
              </button>
            </article>
          </div>

          <div class="content-grid">
            <section class="panel events-panel">
              <div class="panel-heading">
                <div>
                  <h2>Upcoming tournaments</h2>
                  <p>Your next events at a glance</p>
                </div>
                <button class="text-link" @click="activePage = 'tournaments'">View all <span>→</span></button>
              </div>
              <div v-if="upcomingTournaments.length" class="event-list">
                <article v-for="event in upcomingTournaments.slice(0, 4)" :key="event.id" class="event-row">
                  <div class="date-tile">
                    <span>{{ formatDate(event.date).split(' ')[0] }}</span><strong>{{
                      new Date(`${event.date}T00:00:00Z`).getUTCDate()
                    }}</strong>
                  </div>
                  <div class="event-info">
                    <strong>{{ event.name }}</strong><span
                      >{{ clubFor(event.clubId)?.name || 'Independent event' }} · {{ event.discipline }}</span
                    >
                  </div>
                  <span class="event-attendees">{{ event.participantIds.length }} <small>archers</small></span>
                  <button class="row-arrow" aria-label="Open tournament" @click="openTournament(event.id)">↗</button>
                </article>
              </div>
              <div v-else class="empty-state">
                <div class="empty-icon">▦</div>
                <strong>No tournaments yet</strong>
                <p>{{ canManage ? 'Create an event to get started.' : 'Upcoming events will appear here.' }}</p>
                <button v-if="canManage" class="button button-outline" @click="openModal('tournament')">
                  Create tournament
                </button>
              </div>
            </section>
            <section class="panel quick-panel">
              <div class="panel-heading">
                <div>
                  <h2>Quick actions</h2>
                  <p>Keep things moving</p>
                </div>
              </div>
              <button v-if="canManage" class="quick-action" @click="openModal('participant')">
                <span class="quick-icon lavender">♙</span
                ><span><strong>Add archer</strong><small>Grow your archer directory</small></span
                ><b>→</b>
              </button>
              <button v-if="canManage" class="quick-action" @click="openModal('club')">
                <span class="quick-icon peach">⌂</span
                ><span><strong>Add a club</strong><small>Register a new archery club</small></span
                ><b>→</b>
              </button>
              <button
                v-if="canManage"
                class="quick-action"
                @click="
                  selectedTournament ? openTournament(selectedTournament.id, 'scores') : (activePage = 'tournaments')
                "
              >
                <span class="quick-icon mint">▤</span
                ><span><strong>Enter scores</strong><small>Record a tournament round</small></span
                ><b>→</b>
              </button>
              <div class="tip-box">
                <span>✦</span>
                <p><strong>Good to know</strong><br />Archers can be reused across multiple tournaments.</p>
              </div>
            </section>
          </div>
          <section class="panel clubs-preview">
            <div class="panel-heading">
              <div>
                <h2>Your clubs</h2>
                <p>Club accounts and representatives</p>
              </div>
              <button class="text-link" @click="activePage = 'clubs'">Manage clubs <span>→</span></button>
            </div>
            <div class="club-preview-list">
              <div v-for="club in data.clubs.slice(0, 3)" :key="club.id" class="club-preview-item">
                <span class="club-avatar">{{ club.name.charAt(0) }}</span><span class="club-preview-name"
                  ><strong>{{ club.name }}</strong
                  ><small>{{ club.representative }}</small></span
                >
                <span class="status-pill" :class="club.userEnabled ? 'status-active' : 'status-disabled'"
                  ><i></i>{{ club.userEnabled ? 'Enabled' : 'Disabled' }}</span
                >
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'clubs'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">YOUR COMMUNITY</p>
              <h1>Archery clubs</h1>
              <p class="page-subtitle">View clubs and manage your club details.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('club')">
              <span>＋</span> Add club
            </button>
          </div>
          <div class="section-toolbar">
            <div class="toolbar-count">{{ data.clubs.length }} clubs in the directory</div>
            <div class="search-box"><span>⌕</span><input v-model="search" placeholder="Search clubs..." /></div>
          </div>
          <div class="clubs-grid">
            <article
              v-for="club in data.clubs.filter(
                (item) => !search || item.name.toLowerCase().includes(search.toLowerCase()),
              )"
              :key="club.id"
              class="club-card"
            >
              <div class="club-card-head">
                <img v-if="club.logoUrl" class="club-logo" :src="club.logoUrl" :alt="`${club.name} logo`" /><span
                  v-else
                  class="club-avatar large"
                  >{{ club.name.charAt(0) }}</span
                >
              </div>
              <h3>{{ club.name }}</h3>
              <a v-if="club.mapUrl" class="club-location" :href="club.mapUrl" target="_blank" rel="noreferrer"
                >⌖ {{ club.address || 'Open map' }} ↗</a
              >
              <p v-else class="club-location">⌖ {{ club.address || 'No address added' }}</p>
              <div class="club-contact">
                <span class="contact-label">REPRESENTATIVE</span
                ><strong>{{ club.representative || 'Not provided' }}</strong
                ><a :href="`tel:${club.phone}`">{{ club.phone || 'No phone number' }}</a
                ><a v-if="club.email" :href="`mailto:${club.email}`">{{ club.email }}</a>
              </div>
              <div v-if="canManage || userRole === 'club'" class="club-user-row">
                <div>
                  <span class="contact-label">CLUB USER</span
                  ><strong>{{
                    data.userRoles.find((role) => role.role === 'club' && role.clubId === club.id)?.email ||
                    club.userEmail ||
                    'No user assigned'
                  }}</strong>
                </div>
                <span
                  class="status-pill"
                  :class="
                    data.userRoles.some((role) => role.role === 'club' && role.clubId === club.id)
                      ? 'status-active'
                      : 'status-disabled'
                  "
                  ><i></i
                  >{{
                    data.userRoles.some((role) => role.role === 'club' && role.clubId === club.id)
                      ? 'Enabled'
                      : 'Disabled'
                  }}</span
                >
              </div>
              <div class="club-card-actions">
                <button
                  v-if="canManage"
                  class="button button-small button-outline"
                  @click="addParticipantToClub(club.id)"
                >
                  ＋ Add archer
                </button>
                <a
                  v-if="club.website"
                  :href="club.website"
                  target="_blank"
                  rel="noreferrer"
                  class="button button-small button-outline"
                  >Website ↗</a
                >
                <button v-if="canEditClub(club)" class="button button-small button-outline" @click="editClub(club)">
                  Edit club
                </button>
              </div>
            </article>
            <button v-if="canManage" class="add-card" @click="openModal('club')">
              <span>＋</span><strong>Add a club</strong><small>Add club contact and location details</small>
            </button>
          </div>
        </section>

        <section v-else-if="activePage === 'participants'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">ARCHER DIRECTORY</p>
              <h1>Archers</h1>
              <p class="page-subtitle">A reusable directory of archers for your tournaments.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('participant')">
              <span>＋</span> Add archer
            </button>
          </div>
          <div class="section-toolbar">
            <div class="toolbar-count">
              {{ data.participants.length }} archers <span>·</span> Saved for future events
            </div>
            <div class="search-box">
              <span>⌕</span><input v-model="search" placeholder="Search last name or affiliation..." />
            </div>
          </div>
          <section class="panel table-panel">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ARCHER</th>
                    <th>BIRTH DATE</th>
                    <th>WORLD ARCHERY ID</th>
                    <th>AETAY ID</th>
                    <th>CLUB</th>
                    <th>TOURNAMENTS</th>
                    <th>SCORES</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="person in filteredParticipants" :key="person.id">
                    <td>
                      <div class="person-cell">
                        <span class="person-avatar"
                          >{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span
                        ><span
                          ><strong>{{ person.lastName }}, {{ person.firstName }}</strong
                          ><small>Archer</small></span
                        >
                      </div>
                    </td>
                    <td>{{ formatDate(person.birthDate) }}</td>
                    <td>{{ person.waId || '—' }}</td>
                    <td>{{ person.aetayId || '—' }}</td>
                    <td>
                      <select
                        v-if="canManage"
                        class="category-select participant-club-select"
                        :aria-label="`${fullName(person)} club`"
                        :value="person.clubId || ''"
                        @change="setParticipantClub(person, $event)"
                      >
                        <option value="">No club</option>
                        <option v-for="club in data.clubs" :key="club.id" :value="club.id">
                          {{ club.name }}
                        </option></select
                      ><span v-else>{{ clubFor(person.clubId)?.name || '—' }}</span>
                    </td>
                    <td>
                      <span class="tournament-count"
                        >{{
                          data.tournaments.filter((event) => event.participantIds.includes(person.id)).length
                        }}
                        events</span
                      >
                    </td>
                    <td>
                      {{
                        scoreSummaries.find((summary) => summary.participant.id === person.id)?.scoreCount ||
                        'No scores yet'
                      }}
                    </td>
                    <td>
                      <button
                        class="text-link"
                        :aria-label="`View scores for ${fullName(person)}`"
                        @click="openScoreDetails(person.id)"
                      >
                        View scores →
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!filteredParticipants.length">
                    <td colspan="8"><div class="table-empty">No archers found.</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'tournaments'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">EVENT MANAGEMENT</p>
              <h1>Tournaments</h1>
              <p class="page-subtitle">Create events, select archers, and manage event details.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('tournament')">
              <span>＋</span> Create tournament
            </button>
          </div>
          <div v-if="canManage" class="type-shortcut">
            <span>Need a different event format?</span
            ><button class="text-link" @click="activePage = 'tournament-types'">Manage tournament types →</button>
          </div>
          <div class="section-toolbar">
            <div class="toolbar-count">{{ filteredTournaments.length }} {{ tournamentStatusFilter }} tournaments</div>
            <div class="tournament-filters" role="group" aria-label="Filter tournaments by date">
              <button
                :class="{ active: tournamentStatusFilter === 'upcoming' }"
                @click="tournamentStatusFilter = 'upcoming'"
              >
                Upcoming
              </button>
              <button :class="{ active: tournamentStatusFilter === 'past' }" @click="tournamentStatusFilter = 'past'">
                Past
              </button>
            </div>
            <div class="search-box">
              <span>⌕</span><input v-model="tournamentQuery" placeholder="Search tournaments..." />
            </div>
          </div>
          <div class="tournament-list">
            <article v-for="event in filteredTournaments" :key="event.id" class="tournament-card">
              <div class="tournament-date">
                <span>{{ formatDate(event.date).split(' ')[0] }}</span><strong>{{
                  new Date(`${event.date}T00:00:00Z`).getUTCDate()
                }}</strong
                ><small>{{ new Date(`${event.date}T00:00:00Z`).getUTCFullYear() }}</small>
              </div>
              <div class="tournament-details">
                <span class="event-tag">{{ tournamentTypeFor(event.tournamentTypeId)?.name || event.discipline }}</span>
                <h3>{{ event.name }}</h3>
                <div class="tournament-meta">
                  <span>⌖ {{ venueFor(event) }}</span
                  ><span>♙ {{ event.participantIds.length }} archers</span
                  ><span>◇ {{ event.categoryIds.length }} categories</span
                  ><span>⌂ {{ clubFor(event.clubId)?.name || 'Independent' }}</span>
                </div>
              </div>
              <button class="button button-small button-outline" @click="openTournament(event.id)">
                Open tournament →
              </button>
            </article>
            <div v-if="!filteredTournaments.length" class="empty-state panel">
              <div class="empty-icon">▦</div>
              <strong>No tournaments found</strong>
              <p>Try a different search or create a tournament.</p>
            </div>
          </div>
        </section>

        <section v-else-if="activePage === 'tournament-types'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">EVENT FORMATS</p>
              <h1>Tournament types</h1>
              <p class="page-subtitle">Create reusable formats with a distance, target, ends, and arrows per end.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('tournamentType')">
              <span>＋</span> Create tournament type
            </button>
          </div>
          <div class="format-grid">
            <article v-for="type in data.tournamentTypes" :key="type.id" class="format-card">
              <div class="format-card-head">
                <span class="quick-icon mint">◎</span
                ><button v-if="canManage" class="button button-small button-outline" @click="editTournamentType(type)">
                  Edit type
                </button>
              </div>
              <h2>{{ type.name }}</h2>
              <div class="format-distance">
                <strong>{{ type.distance }}</strong><span>{{ type.distanceUnit }}</span
                ><small>distance</small>
              </div>
              <div class="format-details">
                <div>
                  <span>TARGET</span><strong>{{ type.targetType }}</strong>
                </div>
                <div>
                  <span>ENDS</span><strong>{{ type.ends }}</strong>
                </div>
                <div>
                  <span>ARROWS / END</span><strong>{{ type.arrowsPerEnd }}</strong>
                </div>
              </div>
              <div class="format-total">
                Total arrows per archer <strong>{{ Number(type.ends) * Number(type.arrowsPerEnd) }}</strong>
              </div>
              <div class="format-usage">
                {{ data.tournaments.filter((event) => event.tournamentTypeId === type.id).length }} tournaments use this
                type
              </div>
            </article>
            <button v-if="canManage" class="add-card format-add-card" @click="openModal('tournamentType')">
              <span>＋</span><strong>Create a tournament type</strong><small>Set a reusable shooting format</small>
            </button>
          </div>
        </section>

        <section v-else-if="activePage === 'categories'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">CATEGORY DIRECTORY</p>
              <h1>Categories</h1>
              <p class="page-subtitle">Create age and/or bow-type divisions, then add them to each tournament.</p>
            </div>
            <button v-if="canManage" class="button button-primary" @click="openModal('category')">
              <span>＋</span> Create category
            </button>
          </div>
          <div class="category-grid">
            <article v-for="category in data.categories" :key="category.id" class="category-card">
              <div class="format-card-head">
                <span class="quick-icon lavender">◇</span
                ><button v-if="canManage" class="button button-small button-outline" @click="editCategory(category)">
                  Edit category
                </button>
              </div>
              <h2>{{ category.name }}</h2>
              <p>{{ categoryDescription(category) }}</p>
              <div class="format-usage">
                {{ data.tournaments.filter((event) => event.categoryIds.includes(category.id)).length }} tournaments use
                this category
              </div>
            </article>
            <button v-if="canManage" class="add-card format-add-card" @click="openModal('category')">
              <span>＋</span><strong>Create a category</strong><small>Set an age range, bow type, or both</small>
            </button>
          </div>
        </section>

        <section v-else-if="activePage === 'user-access' && canManage">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">ACCOUNT MANAGEMENT</p>
              <h1>User access</h1>
              <p class="page-subtitle">
                {{
                  isAdmin
                    ? 'Assign roles and send password reset emails.'
                    : 'Send password reset emails to users who need account help.'
                }}
              </p>
            </div>
            <div class="heading-actions">
              <button class="button button-outline" @click="openModal('passwordReset')">Send password reset</button>
              <button v-if="isAdmin" class="button button-primary" @click="openModal('userRole')">
                <span>＋</span> Assign role
              </button>
            </div>
          </div>
          <section v-if="isAdmin" class="panel table-panel">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ACCOUNT</th>
                    <th>ROLE</th>
                    <th>SCOPE</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="role in data.userRoles" :key="`${role.userId}-${role.role}`">
                    <td>{{ role.email }}</td>
                    <td>
                      {{
                        role.role === 'admin' ? 'System admin' : role.role.charAt(0).toUpperCase() + role.role.slice(1)
                      }}
                    </td>
                    <td>
                      {{
                        role.role === 'club'
                          ? clubFor(role.clubId)?.name
                          : role.role === 'archer'
                            ? fullName(participantById(role.participantId) || { firstName: '', lastName: '' })
                            : 'All records'
                      }}
                    </td>
                    <td>
                      <button
                        class="text-link"
                        :disabled="
                          role.role === 'admin' &&
                          role.userId === userId &&
                          data.userRoles.filter((item) => item.role === 'admin').length === 1
                        "
                        @click="removeUserRole(role)"
                      >
                        Remove role
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!data.userRoles.length">
                    <td colspan="4"><div class="table-empty">No role assignments found.</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <p class="privacy-note">
            A reset email can only be requested by an admin or manager. The account must already exist in Supabase Auth.
          </p>
        </section>

        <section v-else-if="activePage === 'score-detail'">
          <div class="page-heading heading-row">
            <div>
              <button class="text-link back-link" @click="activePage = 'participants'">← All archers</button>
              <p class="eyebrow">ARCHER RECORD</p>
              <h1>
                {{
                  selectedScoreParticipant
                    ? `${selectedScoreParticipant.lastName}, ${selectedScoreParticipant.firstName}`
                    : 'Archer details'
                }}
              </h1>
              <p class="page-subtitle">Tournament round and Olympic match scores for this archer.</p>
            </div>
          </div>
          <section class="panel table-panel">
            <div v-if="selectedScoreParticipant && selectedParticipantScoreRows.length" class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TOURNAMENT</th>
                    <th>DATE</th>
                    <th>CATEGORY</th>
                    <th>ENTRY</th>
                    <th>ROUND / MATCH</th>
                    <th>SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in selectedParticipantScoreRows"
                    :key="`${row.tournamentId}-${row.round}-${index}`"
                  >
                    <td>{{ row.tournament?.name || 'Tournament removed' }}</td>
                    <td>{{ row.tournament ? formatDate(row.tournament.date) : '—' }}</td>
                    <td>{{ row.category?.name || 'Unassigned' }}</td>
                    <td>{{ row.scoreType }}</td>
                    <td>{{ row.round }}</td>
                    <td>
                      <strong>{{ row.score }}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">
              <div class="empty-icon">▤</div>
              <strong>No scores recorded yet</strong>
              <p>Scores for this archer will appear here after you record them in a tournament.</p>
              <button class="button button-outline" @click="activePage = 'participants'">Back to archers</button>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'tournament-detail'">
          <template v-if="selectedTournament">
            <div class="page-heading heading-row">
              <div>
                <button class="text-link back-link" @click="activePage = 'tournaments'">← All tournaments</button>
                <p class="eyebrow">TOURNAMENT DETAILS</p>
                <h1>{{ selectedTournament.name }}</h1>
                <p class="page-subtitle">
                  {{ formatDate(selectedTournament.date) }} · {{ selectedTournament.discipline }}
                </p>
              </div>
            </div>
            <section class="tournament-summary">
              <div>
                <span>HOST CLUB</span
                ><strong>{{ clubFor(selectedTournament.clubId)?.name || 'Independent event' }}</strong>
              </div>
              <div>
                <span>LOCATION</span><strong>{{ venueFor(selectedTournament) }}</strong>
              </div>
              <div>
                <span>ARCHERS</span><strong>{{ selectedTournament.participantIds.length }}</strong>
              </div>
              <div>
                <span>CATEGORIES</span><strong>{{ selectedTournament.categoryIds.length }}</strong>
              </div>
              <div v-if="tournamentTypeFor(selectedTournament.tournamentTypeId)" class="format-summary">
                <span>FORMAT</span
                ><strong
                  >{{ tournamentTypeFor(selectedTournament.tournamentTypeId).distance }}
                  {{ tournamentTypeFor(selectedTournament.tournamentTypeId).distanceUnit }} ·
                  {{ tournamentTypeFor(selectedTournament.tournamentTypeId).targetType }} ·
                  {{ tournamentTypeFor(selectedTournament.tournamentTypeId).ends }} ×
                  {{ tournamentTypeFor(selectedTournament.tournamentTypeId).arrowsPerEnd }}</strong
                >
              </div>
              <a
                v-if="selectedTournament.venueMode === 'club' && clubFor(selectedTournament.clubId)?.mapUrl"
                :href="clubFor(selectedTournament.clubId).mapUrl"
                target="_blank"
                rel="noreferrer"
                class="button button-small button-outline"
                >Open map ↗</a
              >
            </section>
            <div class="tournament-tabs" role="tablist" aria-label="Tournament sections">
              <button
                :class="{ active: selectedTournamentTab === 'participants' }"
                @click="selectedTournamentTab = 'participants'"
              >
                Archers
              </button>
              <button
                :class="{ active: selectedTournamentTab === 'categories' }"
                @click="selectedTournamentTab = 'categories'"
              >
                Categories
              </button>
              <button :class="{ active: selectedTournamentTab === 'scores' }" @click="selectedTournamentTab = 'scores'">
                Rounds & scores
              </button>
              <button
                :class="{ active: selectedTournamentTab === 'olympic' }"
                @click="selectedTournamentTab = 'olympic'"
              >
                Olympic matches
              </button>
            </div>
            <section v-if="selectedTournamentTab === 'participants'" class="panel roster-panel">
              <div class="panel-heading">
                <div>
                  <h2>Tournament archers</h2>
                  <p>
                    {{
                      canManage
                        ? 'Select archers from your directory or add a new one.'
                        : 'Archers entered in this tournament.'
                    }}
                  </p>
                </div>
                <button v-if="canManage" class="button button-small button-outline" @click="addParticipantToTournament">
                  ＋ Add archer
                </button>
              </div>
              <div class="participant-directory-filter">
                <label class="select-field"
                  ><span>FILTER BY CLUB</span
                  ><select v-model="participantClubFilter" aria-label="Filter archers by club">
                    <option value="">All clubs</option>
                    <option value="__unassigned__">No club assigned</option>
                    <option v-for="club in data.clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
                  </select></label
                >
                <label class="select-field"
                  ><span>SEARCH LAST NAME OR AFFILIATION</span
                  ><input
                    v-model="participantDirectorySearch"
                    list="archer-search-options"
                    aria-label="Search archers by last name or affiliation"
                    placeholder="Type a last name or ID"
                /></label>
                <datalist id="archer-search-options">
                  <option v-for="value in participantSearchOptions" :key="value" :value="value" />
                </datalist>
              </div>
              <div v-if="filteredTournamentParticipantsDirectory.length" class="roster-list">
                <div v-for="person in filteredTournamentParticipantsDirectory" :key="person.id" class="roster-row">
                  <input
                    type="checkbox"
                    :aria-label="`Add ${fullName(person)} to tournament`"
                    :checked="selectedTournament.participantIds.includes(person.id)"
                    :disabled="!canManage"
                    @change="toggleParticipant(selectedTournament, person.id)"
                  />
                  <span class="person-avatar">{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span>
                  <span class="roster-name"
                    ><strong>{{ person.lastName }}, {{ person.firstName }}</strong
                    ><small
                      >{{ person.waId ? `World Archery ${person.waId}` : person.aetayId || 'No affiliation number' }} ·
                      {{ clubFor(person.clubId)?.name || 'No club' }} ·
                      {{ ageAtTournament(person, selectedTournament) ?? 'Age unknown' }} at event</small
                    ></span
                  >
                  <span class="roster-state">{{
                    selectedTournament.participantIds.includes(person.id)
                      ? 'Added'
                      : canManage
                        ? 'Directory'
                        : 'Not entered'
                  }}</span>
                  <select
                    v-if="canManage"
                    class="category-select"
                    :aria-label="`${fullName(person)} category`"
                    :disabled="
                      !selectedTournament.participantIds.includes(person.id) || !selectedTournament.categoryIds.length
                    "
                    :value="selectedTournament.categoryAssignments[person.id] || ''"
                    @change="setParticipantCategory(selectedTournament, person, $event)"
                  >
                    <option value="">
                      {{ selectedTournament.categoryIds.length ? 'Choose category' : 'No categories' }}
                    </option>
                    <option v-for="categoryId in selectedTournament.categoryIds" :key="categoryId" :value="categoryId">
                      {{ categoryFor(categoryId)?.name }}
                    </option>
                  </select>
                  <span v-else class="category-select">{{
                    categoryFor(selectedTournament.categoryAssignments[person.id])?.name || '—'
                  }}</span>
                </div>
              </div>
              <div v-else class="empty-state">
                <strong>{{
                  data.participants.length ? 'No archers match these filters' : 'No archers in your directory'
                }}</strong>
                <p>
                  {{
                    data.participants.length
                      ? 'Choose another club or clear the search.'
                      : canManage
                        ? 'Add an archer to create the first record.'
                        : 'Archer records will appear here when available.'
                  }}
                </p>
                <button
                  v-if="canManage && !data.participants.length"
                  class="button button-primary"
                  @click="addParticipantToTournament"
                >
                  Add archer
                </button>
              </div>
            </section>
            <section v-else-if="selectedTournamentTab === 'categories'" class="panel roster-panel">
              <div class="panel-heading">
                <div>
                  <h2>Tournament categories</h2>
                  <p>
                    {{
                      canManage
                        ? 'Choose the divisions available for this event. Assign each archer in Archers.'
                        : 'Divisions available for this event.'
                    }}
                  </p>
                </div>
                <button v-if="canManage" class="text-link" @click="activePage = 'categories'">
                  Manage category catalogue →
                </button>
              </div>
              <div v-if="data.categories.length" class="roster-list">
                <label v-for="category in data.categories" :key="category.id" class="roster-row category-roster-row"
                  ><input
                    type="checkbox"
                    :checked="selectedTournament.categoryIds.includes(category.id)"
                    :disabled="!canManage"
                    @change="toggleTournamentCategory(selectedTournament, category.id)"
                  /><span class="category-roster-copy"
                    ><strong>{{ category.name }}</strong
                    ><small>{{ categoryDescription(category) }}</small></span
                  ><span class="roster-state">{{
                    data.tournaments.filter(
                      (event) => event.id === selectedTournament.id && event.categoryIds.includes(category.id),
                    ).length
                      ? 'Available'
                      : 'Not added'
                  }}</span></label
                >
              </div>
              <div v-else class="empty-state">
                <strong>No categories in the catalogue</strong>
                <p>
                  {{
                    canManage
                      ? 'Create categories by age, bow type, or both.'
                      : 'Categories will appear here when available.'
                  }}
                </p>
                <button v-if="canManage" class="button button-primary" @click="activePage = 'categories'">
                  Open category catalogue
                </button>
              </div>
            </section>
            <section v-else-if="selectedTournamentTab === 'scores'" class="panel score-workspace">
              <div class="score-toolbar">
                <label class="select-field"
                  ><span>TOURNAMENT ROUND</span
                  ><select v-model="selectedRound">
                    <option v-for="round in selectedTournament.rounds" :key="round">{{ round }}</option>
                  </select></label
                >
                <form v-if="canManage" class="add-round-form" @submit.prevent="addRound">
                  <input v-model="newRoundName" placeholder="Add a round..." aria-label="New round name" /><button
                    class="button button-small button-outline"
                    type="submit"
                  >
                    ＋ Add round
                  </button>
                </form>
                <div class="score-completion">
                  <strong
                    >{{ scoredCount }}<small> / {{ tournamentParticipants.length }}</small></strong
                  ><span>scores entered</span>
                </div>
              </div>
              <div v-if="scoreRows.length" class="table-wrap">
                <table class="score-table">
                  <thead>
                    <tr>
                      <th>ARCHER</th>
                      <th>CATEGORY</th>
                      <th>WORLD ARCHERY ID</th>
                      <th>ROUND SCORE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in scoreRows" :key="row.participant.id">
                      <td>
                        <div class="person-cell">
                          <span class="person-avatar"
                            >{{ row.participant.firstName.charAt(0) }}{{ row.participant.lastName.charAt(0) }}</span
                          ><strong>{{ row.participant.lastName }}, {{ row.participant.firstName }}</strong>
                        </div>
                      </td>
                      <td>{{ categoryFor(row.categoryId)?.name || 'Unassigned' }}</td>
                      <td>{{ row.participant.waId || '—' }}</td>
                      <td>
                        <input
                          class="score-input sl-score"
                          type="number"
                          min="0"
                          :value="row.score"
                          placeholder="Enter score"
                          :disabled="!canManage"
                          @change="saveScore(row.participant.id, $event.target.value)"
                        />
                      </td>
                      <td>
                        <span class="status-pill" :class="row.score !== '' ? 'status-active' : 'status-pending'"
                          ><i></i>{{ row.score !== '' ? 'Recorded' : 'Pending' }}</span
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-state">
                <div class="empty-icon">♙</div>
                <strong>No archers added</strong>
                <p>Add archers in the Archers section of this tournament before recording scores.</p>
                <button class="button button-outline" @click="selectedTournamentTab = 'participants'">
                  View archers
                </button>
              </div>
              <div v-if="canManage && scoreRows.length" class="score-footnote">
                Enter or update an archer’s score; changes save against this tournament and round.
              </div>
            </section>
            <section v-else>
              <div class="olympic-toolbar">
                <label class="select-field"
                  ><span>CATEGORY</span
                  ><select v-model="selectedCategoryId" :disabled="!canManage">
                    <option value="">All archers</option>
                    <option v-for="categoryId in selectedTournament.categoryIds" :key="categoryId" :value="categoryId">
                      {{ categoryFor(categoryId)?.name }}
                    </option>
                  </select></label
                >
                <div>
                  <span class="contact-label">SEEDING SCORES FROM</span
                  ><strong class="round-label">{{ selectedRound }}</strong>
                </div>
                <span class="seed-note"><span>↕</span> 1st place vs. last place · 2nd vs. second-last</span>
                <button v-if="canManage" class="button button-primary" @click="generateMatches">
                  <span>✦</span> Seed from round scores
                </button>
              </div>
              <div v-if="olympicMatches.length" class="matches-grid">
                <section v-for="(match, index) in olympicMatches" :key="match.id" class="match-card">
                  <div class="match-head">
                    <span>{{ match.round }}</span><span class="match-number"
                      >MATCH {{ String(index + 1).padStart(2, '0') }}</span
                    >
                  </div>
                  <div class="match-archer">
                    <span class="seed-badge">{{ match.seed1 }}</span><strong>{{
                      fullName(participantById(match.seed1Id) || { firstName: 'Unknown', lastName: '' })
                    }}</strong
                    ><input
                      class="sl-score"
                      type="number"
                      min="0"
                      :value="match.score1"
                      placeholder="—"
                      :disabled="!canManage"
                      @change="recordMatchScore(match, 'score1', $event.target.value)"
                    />
                  </div>
                  <div class="match-divider"><span>VS</span></div>
                  <div class="match-archer">
                    <span class="seed-badge">{{ match.seed2 }}</span><strong>{{
                      fullName(participantById(match.seed2Id) || { firstName: 'Unknown', lastName: '' })
                    }}</strong
                    ><input
                      class="sl-score"
                      type="number"
                      min="0"
                      :value="match.score2"
                      placeholder="—"
                      :disabled="!canManage"
                      @change="recordMatchScore(match, 'score2', $event.target.value)"
                    />
                  </div>
                  <div class="match-foot">
                    <span>{{
                      match.score1 !== '' && match.score2 !== '' ? 'Scores recorded' : 'Enter both match scores'
                    }}</span><i :class="{ complete: match.score1 !== '' && match.score2 !== '' }"></i>
                  </div>
                </section>
              </div>
              <section v-else class="panel empty-state bracket-empty">
                <div class="empty-icon">⌁</div>
                <strong>No matches seeded yet</strong>
                <p>Record at least two scores for this tournament round. Highest seed faces lowest seed.</p>
                <button class="button button-outline" @click="selectedTournamentTab = 'scores'">
                  Enter round scores
                </button>
              </section>
              <p class="bracket-note">
                First-round pairings belong to this tournament. Re-seeding replaces its current first-round matches.
              </p>
            </section>
          </template>
          <section v-else class="panel empty-state">
            <strong>Tournament not found</strong
            ><button class="button button-outline" @click="activePage = 'tournaments'">Back to tournaments</button>
          </section>
        </section>
      </div>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <form
        class="modal"
        @submit.prevent="
          modalType === 'club'
            ? saveClub()
            : modalType === 'tournament'
              ? saveTournament()
              : modalType === 'tournamentType'
                ? saveTournamentType()
                : modalType === 'category'
                  ? saveCategory()
                  : modalType === 'userRole'
                    ? saveUserRole()
                    : modalType === 'passwordReset'
                      ? sendAdminPasswordReset()
                      : modalType === 'profile'
                        ? saveUserProfile()
                        : saveParticipant()
        "
      >
        <div class="modal-heading">
          <div>
            <p class="eyebrow">
              {{
                modalType === 'club'
                  ? 'CLUB DIRECTORY'
                  : modalType === 'tournament' || modalType === 'tournamentType'
                    ? 'EVENT MANAGEMENT'
                    : modalType === 'category'
                      ? 'CATEGORY DIRECTORY'
                      : modalType === 'userRole'
                        ? 'SYSTEM SETTINGS'
                        : modalType === 'passwordReset'
                          ? 'ACCOUNT MANAGEMENT'
                          : modalType === 'profile'
                            ? 'ACCOUNT PROFILE'
                            : 'ARCHER DIRECTORY'
              }}
            </p>
            <h2>
              {{
                modalType === 'club'
                  ? editingClubId
                    ? 'Edit club'
                    : 'Add a club'
                  : modalType === 'tournament'
                    ? 'Create tournament'
                    : modalType === 'tournamentType'
                      ? editingTournamentTypeId
                        ? 'Edit tournament type'
                        : 'Create tournament type'
                      : modalType === 'category'
                        ? editingCategoryId
                          ? 'Edit category'
                          : 'Create category'
                        : modalType === 'userRole'
                          ? 'Assign user role'
                          : modalType === 'passwordReset'
                            ? 'Send password reset'
                            : modalType === 'profile'
                              ? 'Edit profile'
                              : 'Add archer'
              }}
            </h2>
          </div>
          <button type="button" class="modal-close" aria-label="Close dialog" @click="closeModal">×</button>
        </div>
        <p v-if="modalError" class="database-error modal-error" role="alert">{{ modalError }}</p>
        <template v-if="modalType === 'club'">
          <div class="form-grid">
            <label class="form-field full"
              ><span>CLUB NAME <b>*</b></span
              ><input v-model="form.name" required placeholder="e.g. Northside Archery Club"
            /></label>
            <label class="form-field"
              ><span>REPRESENTATIVE NAME <b>*</b></span
              ><input v-model="form.representative" required placeholder="Full name"
            /></label>
            <label class="form-field"
              ><span>PHONE NUMBER <b>*</b></span
              ><input v-model="form.phone" required type="tel" placeholder="(555) 123-4567"
            /></label>
            <label class="form-field"
              ><span>EMAIL <small>OPTIONAL</small></span
              ><input v-model="form.email" type="email" placeholder="contact@club.org"
            /></label>
            <label class="form-field"
              ><span>WEBSITE <small>OPTIONAL</small></span
              ><input v-model="form.website" type="url" placeholder="https://"
            /></label>
            <label class="form-field full"
              ><span>LOCATION ADDRESS <b>*</b></span
              ><input v-model="form.address" required placeholder="Street, city, state, ZIP"
            /></label>
            <label class="form-field full"
              ><span>MAP LOCATION URL <small>OPTIONAL</small></span
              ><input v-model="form.mapUrl" type="url" placeholder="https://maps.google.com/..."
            /></label>
            <label class="form-field full">
              <span>CLUB LOGO <small>JPG, PNG, OR WEBP · MAX 2 MB</small></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleClubLogoSelection" />
            </label>
            <img
              v-if="form.logoPreview"
              class="club-logo-preview"
              :src="form.logoPreview"
              :alt="`${form.name || 'Club'} logo preview`"
            />
          </div>
        </template>
        <template v-else-if="modalType === 'tournament'">
          <div class="form-grid">
            <label class="form-field full"
              ><span>TOURNAMENT NAME <b>*</b></span
              ><input v-model="form.name" required placeholder="e.g. Spring Championship"
            /></label>
            <label class="form-field"
              ><span>DATE <b>*</b></span
              ><input v-model="form.date" required type="date"
            /></label>
            <label class="form-field"
              ><span>DISCIPLINE</span
              ><select v-model="form.discipline">
                <option>Outdoor target</option>
                <option>Indoor target</option>
                <option>Field</option>
                <option>3D</option>
                <option>Other</option>
              </select></label
            >
            <div class="form-field full">
              <span>TOURNAMENT TYPE <b>*</b></span>
              <div class="field-with-button">
                <select v-model="form.tournamentTypeId" required aria-label="Tournament type">
                  <option value="" disabled>Select a tournament type</option>
                  <option v-for="type in data.tournamentTypes" :key="type.id" :value="type.id">
                    {{ type.name }} — {{ type.distance }} {{ type.distanceUnit }}, {{ type.targetType }}
                  </option>
                </select>
                <button
                  v-if="canManage"
                  type="button"
                  class="icon-button target-type-add"
                  aria-label="Add tournament type"
                  title="Add tournament type"
                  @click="openTournamentChildModal('tournamentType')"
                >
                  ＋
                </button>
              </div>
            </div>
            <div class="form-field full">
              <span>HOST CLUB</span>
              <div class="field-with-button">
                <select v-model="form.clubId" aria-label="Host club">
                  <option value="">No club / independent event</option>
                  <option v-for="club in data.clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
                </select>
                <button
                  v-if="canManage"
                  type="button"
                  class="icon-button target-type-add"
                  aria-label="Add new club"
                  title="Add new club"
                  @click="openTournamentChildModal('club')"
                >
                  ＋
                </button>
              </div>
            </div>
            <div class="form-field full">
              <span>TOURNAMENT LOCATION</span>
              <div class="radio-row">
                <label><input v-model="form.venueMode" type="radio" value="club" /> Use club address</label
                ><label><input v-model="form.venueMode" type="radio" value="custom" /> Custom address</label>
              </div>
            </div>
            <label v-if="form.venueMode === 'custom'" class="form-field full"
              ><span>CUSTOM ADDRESS <b>*</b></span
              ><input v-model="form.customAddress" required placeholder="Street, city, state, ZIP"
            /></label>
            <p v-else-if="form.clubId" class="address-preview full">
              ⌖ {{ clubFor(form.clubId)?.address || 'This club has no address yet.' }}
            </p>
          </div>
        </template>
        <template v-else-if="modalType === 'tournamentType'">
          <div class="form-grid">
            <label class="form-field full"
              ><span>TYPE NAME <b>*</b></span
              ><input v-model="form.name" required placeholder="e.g. Outdoor 70m Recurve"
            /></label>
            <label class="form-field"
              ><span>DISTANCE <b>*</b></span
              ><input v-model.number="form.distance" required type="number" min="0.1" step="any" placeholder="70"
            /></label>
            <label class="form-field"
              ><span>DISTANCE UNIT <b>*</b></span
              ><select v-model="form.distanceUnit" required>
                <option value="m">Meters</option>
                <option value="yd">Yards</option>
              </select></label
            >
            <div class="form-field full">
              <span>TARGET TYPE <b>*</b></span>
              <div class="field-with-button">
                <select v-model="form.targetType" required aria-label="Target type">
                  <option value="" disabled>Select or add a custom target type</option>
                  <option v-for="targetType in targetTypeOptions" :key="targetType">{{ targetType }}</option>
                </select>
                <button
                  v-if="canManage"
                  type="button"
                  class="icon-button target-type-add"
                  aria-label="Add custom target type"
                  title="Add custom target type"
                  @click="openTargetTypeModal"
                >
                  ＋
                </button>
              </div>
            </div>
            <label class="form-field"
              ><span>ENDS (SERIES) <b>*</b></span
              ><input v-model.number="form.ends" required type="number" min="1" step="1" placeholder="12"
            /></label>
            <label class="form-field"
              ><span>ARROWS PER END <b>*</b></span
              ><input v-model.number="form.arrowsPerEnd" required type="number" min="1" step="1" placeholder="6"
            /></label>
            <p class="address-preview full">
              This format can be selected when creating a tournament and reused for future events.
            </p>
          </div>
        </template>
        <template v-else-if="modalType === 'category'">
          <div class="form-grid">
            <label class="form-field full"
              ><span>CATEGORY NAME <b>*</b></span
              ><input v-model="form.name" required placeholder="e.g. Junior Recurve"
            /></label>
            <label class="form-field"
              ><span>MINIMUM AGE <small>OPTIONAL</small></span
              ><input v-model.number="form.minAge" type="number" min="0" step="1" placeholder="No minimum"
            /></label>
            <label class="form-field"
              ><span>MAXIMUM AGE <small>OPTIONAL</small></span
              ><input v-model.number="form.maxAge" type="number" min="0" step="1" placeholder="No maximum"
            /></label>
            <label class="form-field full"
              ><span>BOW TYPE <small>OPTIONAL</small></span
              ><select v-model="form.bowType">
                <option value="">Any bow type</option>
                <option>Recurve</option>
                <option>Compound</option>
                <option>Barebow</option>
                <option>Longbow</option>
                <option>Traditional</option>
              </select></label
            >
            <p class="address-preview full">
              Age limits are checked against the archer's age on the tournament date. Leave a field blank when it does
              not apply.
            </p>
          </div>
        </template>
        <template v-else-if="modalType === 'userRole'">
          <div class="form-grid">
            <label class="form-field full">
              <span>ACCOUNT EMAIL <b>*</b></span>
              <input v-model="form.email" required type="email" placeholder="archer@example.com" />
            </label>
            <label class="form-field full">
              <span>ROLE <b>*</b></span>
              <select v-model="form.role" required>
                <option value="admin">System admin</option>
                <option value="manager">Manager</option>
                <option value="club">Club</option>
                <option value="archer">Archer</option>
              </select>
            </label>
            <label v-if="form.role === 'club'" class="form-field full">
              <span>CLUB <b>*</b></span>
              <select v-model="form.clubId" required>
                <option value="" disabled>Select a club</option>
                <option v-for="club in data.clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
              </select>
            </label>
            <label v-if="form.role === 'archer'" class="form-field full">
              <span>ARCHER <b>*</b></span>
              <select v-model="form.participantId" required>
                <option value="" disabled>Select an archer</option>
                <option v-for="person in data.participants" :key="person.id" :value="person.id">
                  {{ person.lastName }}, {{ person.firstName }} — {{ person.waId || person.aetayId || 'No ID' }}
                </option>
              </select>
            </label>
            <label class="form-field full">
              <span>DISPLAY NAME <small>OPTIONAL</small></span>
              <input v-model="form.displayName" placeholder="Name shown in the app" />
            </label>
            <p class="address-preview full">
              The account must already exist in Supabase Auth before a role can be assigned.
            </p>
          </div>
        </template>
        <template v-else-if="modalType === 'profile'">
          <label class="form-field">
            <span>DISPLAY NAME <b>*</b></span>
            <input v-model="form.displayName" required autocomplete="name" />
          </label>
        </template>
        <template v-else-if="modalType === 'passwordReset'">
          <label class="form-field full">
            <span>ACCOUNT EMAIL <b>*</b></span>
            <input v-model="form.email" required type="email" autocomplete="email" placeholder="user@example.com" />
          </label>
          <p class="address-preview full">
            A one-time recovery email will be requested. Users cannot request password resets from the main menu.
          </p>
        </template>
        <template v-else>
          <div class="form-grid">
            <label class="form-field"
              ><span>LAST NAME <b>*</b></span
              ><input v-model="form.lastName" required autocomplete="family-name" placeholder="Last name"
            /></label>
            <label class="form-field"
              ><span>FIRST NAME <b>*</b></span
              ><input v-model="form.firstName" required autocomplete="given-name" placeholder="First name"
            /></label>
            <label class="form-field full"
              ><span>BIRTH DATE <b>*</b></span
              ><input v-model="form.birthDate" required type="date"
            /></label>
            <label class="form-field full"
              ><span>CLUB <small>OPTIONAL</small></span
              ><select v-model="form.clubId">
                <option value="">No club / independent archer</option>
                <option v-for="club in data.clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
              </select></label
            >
            <label class="form-field"
              ><span>WORLD ARCHERY ID <small>OPTIONAL</small></span
              ><input v-model="form.waId" placeholder="Affiliation number"
            /></label>
            <label class="form-field"
              ><span>AETAY ID <small>OPTIONAL</small></span
              ><input v-model="form.aetayId" placeholder="Affiliation number"
            /></label>
            <p class="privacy-note full">Archer details are stored in the shared manager database.</p>
          </div>
        </template>
        <div class="modal-actions">
          <button type="button" class="button button-outline" @click="closeModal">
            {{ modalFlow ? 'Back' : 'Cancel' }}</button><button type="submit" class="button button-primary">
            {{
              modalType === 'club'
                ? editingClubId
                  ? 'Save changes'
                  : 'Save club'
                : modalType === 'tournament'
                  ? 'Create tournament'
                  : modalType === 'tournamentType'
                    ? editingTournamentTypeId
                      ? 'Save type'
                      : 'Create type'
                    : modalType === 'category'
                      ? editingCategoryId
                        ? 'Save category'
                        : 'Create category'
                      : modalType === 'userRole'
                        ? 'Assign role'
                        : modalType === 'passwordReset'
                          ? 'Send reset email'
                          : modalType === 'profile'
                            ? 'Save profile'
                            : 'Save archer'
            }}
          </button>
        </div>
      </form>
      <div v-if="showTargetTypeModal" class="modal-backdrop target-type-backdrop" @click.self="closeTargetTypeModal">
        <section
          class="modal target-type-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="target-type-modal-title"
        >
          <div class="modal-heading">
            <div>
              <p class="eyebrow">CUSTOM TARGET TYPES</p>
              <h2 id="target-type-modal-title">Add a target type</h2>
            </div>
            <button type="button" class="modal-close" aria-label="Close dialog" @click="closeTargetTypeModal">×</button>
          </div>
          <label class="form-field">
            <span>TARGET TYPE NAME <b>*</b></span>
            <input
              v-model="targetTypeName"
              required
              autofocus
              aria-label="Custom target type name"
              placeholder="e.g. 40 cm triple-spot"
              @keydown.enter.prevent="saveTargetType"
            />
          </label>
          <p v-if="targetTypeError" class="database-error modal-error" role="alert">
            {{ targetTypeError }}
          </p>
          <div class="modal-actions">
            <button type="button" class="button button-outline" @click="closeTargetTypeModal">Cancel</button>
            <button
              type="button"
              class="button button-primary"
              aria-label="Save custom target type"
              @click="saveTargetType"
            >
              Save target type
            </button>
          </div>
        </section>
      </div>
    </div>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message"><span>✓</span>{{ toast }}</div></Transition
    >
  </div>
</template>
