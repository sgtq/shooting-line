<script setup>
import { computed, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'

const STORAGE_KEY = 'archery-manager-workspace-v1'

function makeId() {
  return crypto.randomUUID()
}

function exampleTournamentTypes() {
  return [
    { id: 'type-70m', name: 'Outdoor 70m Recurve', distance: 70, distanceUnit: 'm', targetType: '122 cm face', ends: 12, arrowsPerEnd: 6 },
    { id: 'type-18m', name: 'Indoor 18m', distance: 18, distanceUnit: 'm', targetType: '40 cm triple-spot', ends: 20, arrowsPerEnd: 3 },
  ]
}

function exampleCategories() {
  return [
    { id: 'category-open-recurve', name: 'Open Recurve', minAge: null, maxAge: null, bowType: 'Recurve' },
    { id: 'category-junior-recurve', name: 'Junior Recurve', minAge: null, maxAge: 17, bowType: 'Recurve' },
    { id: 'category-open-compound', name: 'Open Compound', minAge: null, maxAge: null, bowType: 'Compound' },
  ]
}

function initialData() {
  const tournamentTypes = exampleTournamentTypes()
  const categories = exampleCategories()
  const clubs = [
    {
      id: 'club-river',
      name: 'Riverbend Archery Club',
      representative: 'Morgan Lee',
      phone: '(555) 218-4402',
      email: 'morgan@example.com',
      website: 'https://example.com/riverbend',
      address: '18 Meadow Lane, Asheville, NC 28801',
      mapUrl: 'https://maps.google.com',
      userEmail: 'club@example.com',
      userEnabled: true,
    },
    {
      id: 'club-pine',
      name: 'Pine Valley Bowmen',
      representative: 'Taylor Brooks',
      phone: '(555) 305-7714',
      email: 'taylor@example.com',
      website: '',
      address: '240 Forest Road, Hendersonville, NC 28792',
      mapUrl: 'https://maps.google.com',
      userEmail: 'office@example.com',
      userEnabled: true,
    },
    {
      id: 'club-mountain',
      name: 'Mountain View Archers',
      representative: 'Jordan Kim',
      phone: '(555) 882-1930',
      email: '',
      website: '',
      address: '5 Summit Drive, Brevard, NC 28712',
      mapUrl: '',
      userEmail: 'archery@example.com',
      userEnabled: false,
    },
  ]
  const participants = [
    { id: 'p-1', firstName: 'Avery', lastName: 'Chen', birthDate: '2002-06-14', waId: '10482931', aetayId: '' },
    { id: 'p-2', firstName: 'Riley', lastName: 'Morgan', birthDate: '1997-11-03', waId: '10482702', aetayId: 'AET-48291' },
    { id: 'p-3', firstName: 'Casey', lastName: 'Patel', birthDate: '2005-02-20', waId: '', aetayId: 'AET-51820' },
    { id: 'p-4', firstName: 'Jamie', lastName: 'Rivera', birthDate: '1994-09-08', waId: '10483014', aetayId: '' },
  ]
  const tournament = {
    id: 't-1',
    name: 'Blue Ridge Spring Classic',
    date: '2027-04-19',
    discipline: 'Outdoor target',
    tournamentTypeId: 'type-70m',
    clubId: 'club-river',
    venueMode: 'club',
    customAddress: '',
    rounds: ['Qualification'],
    participantIds: participants.map((participant) => participant.id),
    categoryIds: [],
    categoryAssignments: {},
  }
  const scores = [
    { tournamentId: 't-1', participantId: 'p-1', round: 'Qualification', score: 642 },
    { tournamentId: 't-1', participantId: 'p-2', round: 'Qualification', score: 618 },
    { tournamentId: 't-1', participantId: 'p-3', round: 'Qualification', score: 601 },
    { tournamentId: 't-1', participantId: 'p-4', round: 'Qualification', score: 587 },
  ]
  return { clubs, participants, tournaments: [tournament], tournamentTypes, categories, scores, matches: [] }
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY)
  const workspace = saved ? JSON.parse(saved) : initialData()
  if (!Array.isArray(workspace.tournamentTypes)) workspace.tournamentTypes = exampleTournamentTypes()
  if (!Array.isArray(workspace.categories)) workspace.categories = exampleCategories()
  for (const tournament of workspace.tournaments) {
    if (!Array.isArray(tournament.rounds)) tournament.rounds = ['Qualification']
    if (!Array.isArray(tournament.categoryIds)) tournament.categoryIds = []
    if (!tournament.categoryAssignments) tournament.categoryAssignments = {}
    if (!tournament.tournamentTypeId) tournament.tournamentTypeId = workspace.tournamentTypes[0]?.id || ''
  }
  return workspace
}

const data = ref(loadData())
watch(data, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'tournaments', label: 'Tournaments', icon: '▦' },
  { id: 'tournament-types', label: 'Tournament types', icon: '⚙' },
  { id: 'categories', label: 'Categories', icon: '◇' },
  { id: 'clubs', label: 'Clubs', icon: '⌂' },
  { id: 'participants', label: 'Participants', icon: '♙' },
  { id: 'scores', label: 'Scores', icon: '▤' },
]
const activePage = ref('dashboard')
const search = ref('')
const selectedTournamentId = ref(data.value.tournaments[0]?.id || '')
const selectedRounds = ref({})
const selectedCategories = ref({})
const selectedTournamentTab = ref('participants')
const newRoundName = ref('')
const selectedScoreParticipantId = ref('')
const editingTournamentTypeId = ref('')
const editingCategoryId = ref('')
const showModal = ref(false)
const modalType = ref('')
const assignNewParticipant = ref(false)
const editingClubId = ref('')
const toast = ref('')
const tournamentQuery = ref('')

const selectedTournament = computed(() =>
  data.value.tournaments.find((item) => item.id === selectedTournamentId.value),
)
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
  activePage.value === 'tournament-detail' ? 'tournaments'
    : activePage.value === 'score-detail' ? 'scores'
      : activePage.value,
)
const upcomingTournaments = computed(() =>
  [...data.value.tournaments].sort((a, b) => a.date.localeCompare(b.date)),
)
const nextTournament = computed(() => upcomingTournaments.value.find((item) => item.date >= today()))
const activeClubs = computed(() => data.value.clubs.filter((club) => club.userEnabled).length)
const filteredParticipants = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return data.value.participants
  return data.value.participants.filter((person) =>
    [person.firstName, person.lastName, person.waId, person.aetayId]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term)),
  )
})
const filteredTournaments = computed(() =>
  upcomingTournaments.value.filter((tournament) =>
    tournament.name.toLowerCase().includes(tournamentQuery.value.toLowerCase()),
  ),
)
const tournamentParticipants = computed(() => {
  if (!selectedTournament.value) return []
  return selectedTournament.value.participantIds
    .map((id) => data.value.participants.find((person) => person.id === id))
    .filter(Boolean)
})
const scoreRows = computed(() => tournamentParticipants.value.map((participant) => ({
  participant,
  categoryId: selectedTournament.value?.categoryAssignments?.[participant.id] || '',
  score: data.value.scores.find((item) =>
    item.tournamentId === selectedTournamentId.value
      && item.participantId === participant.id
      && item.round === selectedRound.value,
  )?.score ?? '',
})))
const olympicMatches = computed(() =>
  data.value.matches.filter((match) =>
    match.tournamentId === selectedTournamentId.value
      && (match.sourceRound || selectedTournament.value?.rounds?.[0]) === selectedRound.value
      && (match.categoryId || '') === selectedCategoryId.value,
  ),
)
const scoredCount = computed(() =>
  data.value.scores.filter((item) => item.tournamentId === selectedTournamentId.value && item.round === selectedRound.value).length,
)
const scoreSummaries = computed(() => data.value.participants.map((participant) => {
  const roundScores = data.value.scores.filter((item) => item.participantId === participant.id)
  const matchScores = data.value.matches.filter((match) =>
    (match.seed1Id === participant.id && match.score1 !== '')
      || (match.seed2Id === participant.id && match.score2 !== ''),
  )
  return {
    participant,
    scoreCount: roundScores.length + matchScores.length,
    tournamentCount: new Set([...roundScores, ...matchScores].map((item) => item.tournamentId)).size,
  }
}))
const selectedParticipantScoreRows = computed(() =>
  [
    ...data.value.scores
    .filter((item) => item.participantId === selectedScoreParticipantId.value)
    .map((item) => ({
      ...item,
      tournament: data.value.tournaments.find((event) => event.id === item.tournamentId),
      category: categoryFor(item.categoryId || data.value.tournaments.find((event) => event.id === item.tournamentId)?.categoryAssignments?.[item.participantId]),
      scoreType: 'Round score',
    })),
    ...data.value.matches.flatMap((match) => {
      const shooterIsFirst = match.seed1Id === selectedScoreParticipantId.value && match.score1 !== ''
      const shooterIsSecond = match.seed2Id === selectedScoreParticipantId.value && match.score2 !== ''
      if (!shooterIsFirst && !shooterIsSecond) return []
      const opponentId = shooterIsFirst ? match.seed2Id : match.seed1Id
      return [{
        tournamentId: match.tournamentId,
        tournament: data.value.tournaments.find((event) => event.id === match.tournamentId),
        category: categoryFor(match.categoryId),
        round: `${match.round} vs ${fullName(participantById(opponentId) || { firstName: 'Unknown', lastName: '' })}`,
        score: shooterIsFirst ? match.score1 : match.score2,
        scoreType: 'Olympic match',
      }]
    }),
  ].sort((a, b) => (b.tournament?.date || '').localeCompare(a.tournament?.date || '')),
)

const blankClub = () => ({
  name: '', representative: '', phone: '', email: '', website: '', address: '', mapUrl: '', userEmail: '', userEnabled: false,
})
const blankTournament = () => ({
  name: '', date: '', discipline: 'Outdoor target', tournamentTypeId: data.value.tournamentTypes[0]?.id || '', clubId: data.value.clubs[0]?.id || '', venueMode: 'club', customAddress: '',
})
const blankTournamentType = () => ({
  name: '', distance: '', distanceUnit: 'm', targetType: '', ends: '', arrowsPerEnd: '',
})
const blankCategory = () => ({
  name: '', minAge: '', maxAge: '', bowType: '',
})
const blankParticipant = () => ({
  firstName: '', lastName: '', birthDate: '', waId: '', aetayId: '',
})
const form = ref({})

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
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
  const ageRange = category.minAge !== null && category.minAge !== ''
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
  const birthdayHasPassed = eventDate.getUTCMonth() > birthDate.getUTCMonth()
    || (eventDate.getUTCMonth() === birthDate.getUTCMonth() && eventDate.getUTCDate() >= birthDate.getUTCDate())
  return years - (birthdayHasPassed ? 0 : 1)
}

function venueFor(tournament) {
  if (!tournament) return ''
  return tournament.venueMode === 'custom' ? tournament.customAddress : clubFor(tournament.clubId)?.address || 'Club address not set'
}

function notify(message) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, 2800)
}

function openModal(type, assignToCurrentTournament = false) {
  modalType.value = type
  assignNewParticipant.value = assignToCurrentTournament
  editingClubId.value = ''
  editingTournamentTypeId.value = ''
  editingCategoryId.value = ''
  form.value = type === 'club' ? blankClub()
    : type === 'tournament' ? blankTournament()
      : type === 'tournamentType' ? blankTournamentType()
      : type === 'category' ? blankCategory()
      : blankParticipant()
  showModal.value = true
}

function editClub(club) {
  modalType.value = 'club'
  editingClubId.value = club.id
  form.value = { ...club }
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
  showModal.value = false
  editingClubId.value = ''
  editingTournamentTypeId.value = ''
  editingCategoryId.value = ''
}

function saveClub() {
  if (editingClubId.value) {
    const club = clubFor(editingClubId.value)
    if (club) Object.assign(club, form.value)
    closeModal()
    notify('Club details updated')
    return
  }
  data.value.clubs.unshift({ ...form.value, id: makeId() })
  closeModal()
  notify('Club added')
}

function saveTournament() {
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
  data.value.tournaments.unshift(tournament)
  selectedTournamentId.value = tournament.id
  selectedTournamentTab.value = 'participants'
  closeModal()
  activePage.value = 'tournament-detail'
  notify('Tournament created')
}

function saveTournamentType() {
  const type = {
    ...form.value,
    distance: Number(form.value.distance),
    ends: Number(form.value.ends),
    arrowsPerEnd: Number(form.value.arrowsPerEnd),
  }
  if (editingTournamentTypeId.value) {
    const existing = tournamentTypeFor(editingTournamentTypeId.value)
    if (existing) Object.assign(existing, type)
    closeModal()
    notify('Tournament type updated')
    return
  }
  data.value.tournamentTypes.push({ ...type, id: makeId() })
  closeModal()
  notify('Tournament type created')
}

function saveCategory() {
  const category = {
    ...form.value,
    minAge: form.value.minAge === '' ? null : Number(form.value.minAge),
    maxAge: form.value.maxAge === '' ? null : Number(form.value.maxAge),
  }
  if (category.minAge !== null && category.maxAge !== null && category.minAge > category.maxAge) {
    notify('Minimum age cannot be greater than maximum age')
    return
  }
  if (editingCategoryId.value) {
    const existing = categoryFor(editingCategoryId.value)
    if (existing) Object.assign(existing, category)
    closeModal()
    notify('Category updated')
    return
  }
  data.value.categories.push({ ...category, id: makeId() })
  closeModal()
  notify('Category created')
}

function toggleTournamentCategory(tournament, categoryId) {
  const index = tournament.categoryIds.indexOf(categoryId)
  if (index === -1) tournament.categoryIds.push(categoryId)
  else {
    tournament.categoryIds.splice(index, 1)
    for (const [participantId, assignedCategoryId] of Object.entries(tournament.categoryAssignments)) {
      if (assignedCategoryId === categoryId) delete tournament.categoryAssignments[participantId]
    }
    if (selectedCategoryId.value === categoryId) selectedCategoryId.value = ''
  }
}

function setParticipantCategory(tournament, participant, event) {
  const categoryId = event.target.value
  if (categoryId) {
    const category = categoryFor(categoryId)
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
  tournament.categoryAssignments[participant.id] = categoryId
}

function openTournament(tournamentId, tab = 'participants') {
  selectedTournamentId.value = tournamentId
  selectedTournamentTab.value = tab
  activePage.value = 'tournament-detail'
}

function openScoreDetails(participantId) {
  selectedScoreParticipantId.value = participantId
  activePage.value = 'score-detail'
}

function addRound() {
  const name = newRoundName.value.trim()
  if (!name || !selectedTournament.value) return
  if (selectedTournament.value.rounds.some((round) => round.toLowerCase() === name.toLowerCase())) {
    notify('That round already exists for this tournament')
    return
  }
  selectedTournament.value.rounds.push(name)
  selectedRound.value = name
  newRoundName.value = ''
  notify('Round added to this tournament')
}

function saveParticipant() {
  const participant = { ...form.value, id: makeId() }
  data.value.participants.unshift(participant)
  if (assignNewParticipant.value && selectedTournament.value && !selectedTournament.value.participantIds.includes(participant.id)) {
    selectedTournament.value.participantIds.push(participant.id)
  }
  closeModal()
  notify('Participant saved to your database')
}

function toggleClub(club) {
  if (!club.userEmail && !club.userEnabled) {
    notify('Add a club user email before enabling access')
    return
  }
  club.userEnabled = !club.userEnabled
  notify(`Club user ${club.userEnabled ? 'enabled' : 'disabled'}`)
}

function toggleParticipant(tournament, participantId) {
  const index = tournament.participantIds.indexOf(participantId)
  if (index === -1) tournament.participantIds.push(participantId)
  else tournament.participantIds.splice(index, 1)
}

function saveScore(participantId, value) {
  if (value === '' || value === null) {
    data.value.scores = data.value.scores.filter((item) =>
      !(item.tournamentId === selectedTournamentId.value && item.participantId === participantId && item.round === selectedRound.value),
    )
    return
  }
  const numericScore = Number(value)
  if (!Number.isFinite(numericScore) || numericScore < 0) return
  const existing = data.value.scores.find((item) =>
    item.tournamentId === selectedTournamentId.value && item.participantId === participantId && item.round === selectedRound.value,
  )
  const categoryId = selectedTournament.value?.categoryAssignments?.[participantId] || ''
  if (existing) {
    existing.score = numericScore
    existing.categoryId = categoryId
  } else {
    data.value.scores.push({ tournamentId: selectedTournamentId.value, participantId, round: selectedRound.value, categoryId, score: numericScore })
  }
}

function generateMatches() {
  if (selectedTournament.value?.categoryIds.length && !selectedCategoryId.value) {
    notify('Select a tournament category before seeding Olympic matches')
    return
  }
  const eligibleParticipants = tournamentParticipants.value.filter((participant) =>
    !selectedTournament.value?.categoryIds.length
      || selectedTournament.value.categoryAssignments[participant.id] === selectedCategoryId.value,
  )
  const ranked = eligibleParticipants
    .map((participant) => ({
      participant,
      score: data.value.scores.find((item) =>
        item.tournamentId === selectedTournamentId.value && item.participantId === participant.id && item.round === selectedRound.value,
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
      round: ranked.length === 2 ? 'Final'
        : ranked.length === 4 ? 'Semifinal'
          : ranked.length === 8 ? 'Quarterfinal'
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
  data.value.matches = [
    ...data.value.matches.filter((match) =>
      match.tournamentId !== selectedTournamentId.value
        || (match.sourceRound || selectedTournament.value?.rounds?.[0]) !== selectedRound.value
        || (match.categoryId || '') !== selectedCategoryId.value,
    ),
    ...newMatches,
  ]
  notify(`${newMatches.length} first-round matches seeded`)
}

function participantById(id) {
  return data.value.participants.find((person) => person.id === id)
}

function recordMatchScore(match, side, value) {
  match[side] = value === '' ? '' : Math.max(0, Number(value) || 0)
}

function resetDemoData() {
  data.value = initialData()
  selectedTournamentId.value = data.value.tournaments[0]?.id || ''
  selectedRounds.value = {}
  selectedCategories.value = {}
  selectedTournamentTab.value = 'participants'
  newRoundName.value = ''
  selectedScoreParticipantId.value = ''
  activePage.value = 'dashboard'
  search.value = ''
  tournamentQuery.value = ''
  notify('Demo data restored')
}
</script>

<template>
  <div class="app-shell">
    <AppSidebar :active-page="currentNavPage" :nav-items="navItems" :tournament-count="data.tournaments.length" @navigate="activePage = $event" />

    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumbs"><span>Workspace</span><span class="crumb-slash">/</span><strong>{{ activePage === 'tournament-detail' ? selectedTournament?.name : navItems.find((item) => item.id === activePage)?.label }}</strong></div>
        <div class="topbar-actions">
          <span class="demo-chip"><i></i> Demo data · saved on this device</span>
          <button class="icon-button" aria-label="Help" @click="notify('Your workspace is ready to use')">?</button>
        </div>
      </header>

      <div class="page-container">
        <section v-if="activePage === 'dashboard'">
          <div class="page-heading heading-row">
            <div>
              <p class="eyebrow">OVERVIEW</p>
              <h1>Good morning, Alex <span class="wave">✳</span></h1>
              <p class="page-subtitle">Here’s what’s happening across your archery community.</p>
            </div>
            <button class="button button-primary" @click="openModal('tournament')"><span>＋</span> Create tournament</button>
          </div>

          <div class="stats-grid">
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon olive">▦</span><span class="stat-caption">ALL TIME</span></div>
              <strong class="stat-value">{{ data.tournaments.length }}</strong>
              <span class="stat-label">Total tournaments</span>
              <div class="stat-foot"><span class="stat-dot green"></span> Your event calendar</div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon sand">⌂</span><span class="stat-caption">ACTIVE</span></div>
              <strong class="stat-value">{{ activeClubs }}</strong>
              <span class="stat-label">Club accounts</span>
              <div class="stat-foot"><span class="stat-dot green"></span> {{ data.clubs.length }} clubs registered</div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon blue">♙</span><span class="stat-caption">DATABASE</span></div>
              <strong class="stat-value">{{ data.participants.length }}</strong>
              <span class="stat-label">Participants</span>
              <div class="stat-foot">Available to add to events</div>
            </article>
            <article class="stat-card next-stat">
              <div class="stat-top"><span class="stat-icon peach">◷</span><span class="stat-caption">UP NEXT</span></div>
              <strong class="next-event">{{ nextTournament?.name || 'No upcoming events' }}</strong>
              <span class="stat-label">{{ nextTournament ? formatDate(nextTournament.date) : 'Create your first tournament' }}</span>
              <button v-if="nextTournament" class="text-link" @click="openTournament(nextTournament.id)">View tournament <span>→</span></button>
            </article>
          </div>

          <div class="content-grid">
            <section class="panel events-panel">
              <div class="panel-heading">
                <div><h2>Upcoming tournaments</h2><p>Your next events at a glance</p></div>
                <button class="text-link" @click="activePage = 'tournaments'">View all <span>→</span></button>
              </div>
              <div v-if="upcomingTournaments.length" class="event-list">
                <article v-for="event in upcomingTournaments.slice(0, 4)" :key="event.id" class="event-row">
                  <div class="date-tile"><span>{{ formatDate(event.date).split(' ')[0] }}</span><strong>{{ new Date(`${event.date}T00:00:00Z`).getUTCDate() }}</strong></div>
                  <div class="event-info"><strong>{{ event.name }}</strong><span>{{ clubFor(event.clubId)?.name || 'Independent event' }} · {{ event.discipline }}</span></div>
                  <span class="event-attendees">{{ event.participantIds.length }} <small>archers</small></span>
                  <button class="row-arrow" aria-label="Open tournament" @click="openTournament(event.id)">↗</button>
                </article>
              </div>
              <div v-else class="empty-state"><div class="empty-icon">▦</div><strong>No tournaments yet</strong><p>Create an event to get started.</p><button class="button button-outline" @click="openModal('tournament')">Create tournament</button></div>
            </section>
            <section class="panel quick-panel">
              <div class="panel-heading"><div><h2>Quick actions</h2><p>Keep things moving</p></div></div>
              <button class="quick-action" @click="openModal('participant')"><span class="quick-icon lavender">♙</span><span><strong>Add participant</strong><small>Grow your participant database</small></span><b>→</b></button>
              <button class="quick-action" @click="openModal('club')"><span class="quick-icon peach">⌂</span><span><strong>Add a club</strong><small>Register a new archery club</small></span><b>→</b></button>
              <button class="quick-action" @click="selectedTournament ? openTournament(selectedTournament.id, 'scores') : activePage = 'tournaments'"><span class="quick-icon mint">▤</span><span><strong>Enter scores</strong><small>Record a tournament round</small></span><b>→</b></button>
              <div class="tip-box"><span>✦</span><p><strong>Good to know</strong><br />Participants can be reused across multiple tournaments.</p></div>
            </section>
          </div>
          <section class="panel clubs-preview">
            <div class="panel-heading"><div><h2>Your clubs</h2><p>Club accounts and representatives</p></div><button class="text-link" @click="activePage = 'clubs'">Manage clubs <span>→</span></button></div>
            <div class="club-preview-list">
              <div v-for="club in data.clubs.slice(0, 3)" :key="club.id" class="club-preview-item">
                <span class="club-avatar">{{ club.name.charAt(0) }}</span><span class="club-preview-name"><strong>{{ club.name }}</strong><small>{{ club.representative }}</small></span>
                <span class="status-pill" :class="club.userEnabled ? 'status-active' : 'status-disabled'"><i></i>{{ club.userEnabled ? 'Enabled' : 'Disabled' }}</span>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'clubs'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">YOUR COMMUNITY</p><h1>Archery clubs</h1><p class="page-subtitle">Manage club details and their workspace access.</p></div>
            <button class="button button-primary" @click="openModal('club')"><span>＋</span> Add club</button>
          </div>
          <div class="section-toolbar"><div class="toolbar-count">{{ data.clubs.length }} clubs <span>·</span> {{ activeClubs }} enabled accounts</div><div class="search-box"><span>⌕</span><input v-model="search" placeholder="Search clubs..." /></div></div>
          <div class="clubs-grid">
            <article v-for="club in data.clubs.filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()))" :key="club.id" class="club-card">
              <div class="club-card-head"><span class="club-avatar large">{{ club.name.charAt(0) }}</span><button class="more-button" aria-label="Club options">···</button></div>
              <h3>{{ club.name }}</h3>
              <a v-if="club.mapUrl" class="club-location" :href="club.mapUrl" target="_blank" rel="noreferrer">⌖ {{ club.address || 'Open map' }} ↗</a>
              <p v-else class="club-location">⌖ {{ club.address || 'No address added' }}</p>
              <div class="club-contact"><span class="contact-label">REPRESENTATIVE</span><strong>{{ club.representative || 'Not provided' }}</strong><a :href="`tel:${club.phone}`">{{ club.phone || 'No phone number' }}</a><a v-if="club.email" :href="`mailto:${club.email}`">{{ club.email }}</a></div>
              <div class="club-user-row"><div><span class="contact-label">CLUB USER</span><strong>{{ club.userEmail || 'No user assigned' }}</strong></div><span class="status-pill" :class="club.userEnabled ? 'status-active' : 'status-disabled'"><i></i>{{ club.userEnabled ? 'Enabled' : 'Disabled' }}</span></div>
              <div class="club-card-actions"><a v-if="club.website" :href="club.website" target="_blank" rel="noreferrer" class="button button-small button-outline">Website ↗</a><button class="button button-small button-outline" @click="editClub(club)">Edit club</button><button class="button button-small" :class="club.userEnabled ? 'button-soft-danger' : 'button-soft-success'" :disabled="!club.userEmail && !club.userEnabled" @click="toggleClub(club)">{{ club.userEnabled ? 'Disable user' : 'Enable user' }}</button></div>
            </article>
            <button class="add-card" @click="openModal('club')"><span>＋</span><strong>Add a club</strong><small>Add club contact and location details</small></button>
          </div>
        </section>

        <section v-else-if="activePage === 'participants'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">ARCHER DIRECTORY</p><h1>Participants</h1><p class="page-subtitle">A reusable directory of archers for your tournaments.</p></div>
            <button class="button button-primary" @click="openModal('participant')"><span>＋</span> Add participant</button>
          </div>
          <div class="section-toolbar"><div class="toolbar-count">{{ data.participants.length }} participants <span>·</span> Saved for future events</div><div class="search-box"><span>⌕</span><input v-model="search" placeholder="Search name or affiliation..." /></div></div>
          <section class="panel table-panel">
            <div class="table-wrap">
              <table>
                <thead><tr><th>PARTICIPANT</th><th>BIRTH DATE</th><th>WORLD ARCHERY ID</th><th>AETAY ID</th><th>TOURNAMENTS</th></tr></thead>
                <tbody>
                  <tr v-for="person in filteredParticipants" :key="person.id">
                    <td><div class="person-cell"><span class="person-avatar">{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span><span><strong>{{ fullName(person) }}</strong><small>Participant</small></span></div></td>
                    <td>{{ formatDate(person.birthDate) }}</td><td>{{ person.waId || '—' }}</td><td>{{ person.aetayId || '—' }}</td>
                    <td><span class="tournament-count">{{ data.tournaments.filter((event) => event.participantIds.includes(person.id)).length }} events</span></td>
                  </tr>
                  <tr v-if="!filteredParticipants.length"><td colspan="5"><div class="table-empty">No participants found.</div></td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'tournaments'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">EVENT MANAGEMENT</p><h1>Tournaments</h1><p class="page-subtitle">Create events, select participants, and manage event details.</p></div>
            <button class="button button-primary" @click="openModal('tournament')"><span>＋</span> Create tournament</button>
          </div>
          <div class="type-shortcut"><span>Need a different event format?</span><button class="text-link" @click="activePage = 'tournament-types'">Manage tournament types →</button></div>
          <div class="section-toolbar"><div class="toolbar-count">{{ data.tournaments.length }} tournaments</div><div class="search-box"><span>⌕</span><input v-model="tournamentQuery" placeholder="Search tournaments..." /></div></div>
          <div class="tournament-list">
            <article v-for="event in filteredTournaments" :key="event.id" class="tournament-card">
              <div class="tournament-date"><span>{{ formatDate(event.date).split(' ')[0] }}</span><strong>{{ new Date(`${event.date}T00:00:00Z`).getUTCDate() }}</strong><small>{{ new Date(`${event.date}T00:00:00Z`).getUTCFullYear() }}</small></div>
              <div class="tournament-details"><span class="event-tag">{{ tournamentTypeFor(event.tournamentTypeId)?.name || event.discipline }}</span><h3>{{ event.name }}</h3><div class="tournament-meta"><span>⌖ {{ venueFor(event) }}</span><span>♙ {{ event.participantIds.length }} participants</span><span>◇ {{ event.categoryIds.length }} categories</span><span>⌂ {{ clubFor(event.clubId)?.name || 'Independent' }}</span></div></div>
              <button class="button button-small button-outline" @click="openTournament(event.id)">Open tournament →</button>
            </article>
            <div v-if="!filteredTournaments.length" class="empty-state panel"><div class="empty-icon">▦</div><strong>No tournaments found</strong><p>Try a different search or create a tournament.</p></div>
          </div>
        </section>

        <section v-else-if="activePage === 'tournament-types'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">EVENT FORMATS</p><h1>Tournament types</h1><p class="page-subtitle">Create reusable formats with a distance, target, ends, and arrows per end.</p></div>
            <button class="button button-primary" @click="openModal('tournamentType')"><span>＋</span> Create tournament type</button>
          </div>
          <div class="format-grid">
            <article v-for="type in data.tournamentTypes" :key="type.id" class="format-card">
              <div class="format-card-head"><span class="quick-icon mint">◎</span><button class="button button-small button-outline" @click="editTournamentType(type)">Edit type</button></div>
              <h2>{{ type.name }}</h2>
              <div class="format-distance"><strong>{{ type.distance }}</strong><span>{{ type.distanceUnit }}</span><small>distance</small></div>
              <div class="format-details"><div><span>TARGET</span><strong>{{ type.targetType }}</strong></div><div><span>ENDS</span><strong>{{ type.ends }}</strong></div><div><span>ARROWS / END</span><strong>{{ type.arrowsPerEnd }}</strong></div></div>
              <div class="format-total">Total arrows per archer <strong>{{ Number(type.ends) * Number(type.arrowsPerEnd) }}</strong></div>
              <div class="format-usage">{{ data.tournaments.filter((event) => event.tournamentTypeId === type.id).length }} tournaments use this type</div>
            </article>
            <button class="add-card format-add-card" @click="openModal('tournamentType')"><span>＋</span><strong>Create a tournament type</strong><small>Set a reusable shooting format</small></button>
          </div>
        </section>

        <section v-else-if="activePage === 'categories'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">CATEGORY DIRECTORY</p><h1>Categories</h1><p class="page-subtitle">Create age and/or bow-type divisions, then add them to each tournament.</p></div>
            <button class="button button-primary" @click="openModal('category')"><span>＋</span> Create category</button>
          </div>
          <div class="category-grid">
            <article v-for="category in data.categories" :key="category.id" class="category-card">
              <div class="format-card-head"><span class="quick-icon lavender">◇</span><button class="button button-small button-outline" @click="editCategory(category)">Edit category</button></div>
              <h2>{{ category.name }}</h2>
              <p>{{ categoryDescription(category) }}</p>
              <div class="format-usage">{{ data.tournaments.filter((event) => event.categoryIds.includes(category.id)).length }} tournaments use this category</div>
            </article>
            <button class="add-card format-add-card" @click="openModal('category')"><span>＋</span><strong>Create a category</strong><small>Set an age range, bow type, or both</small></button>
          </div>
        </section>

        <section v-else-if="activePage === 'scores'">
          <div class="page-heading heading-row">
            <div><p class="eyebrow">SHOOTER SCOREBOOK</p><h1>Score records</h1><p class="page-subtitle">Scores are grouped by shooter. Open a record to see each tournament and round.</p></div>
          </div>
          <div class="section-toolbar"><div class="toolbar-count">{{ scoreSummaries.length }} shooters <span>·</span> {{ data.scores.length }} round scores recorded</div><div class="search-box"><span>⌕</span><input v-model="search" placeholder="Search shooters..." /></div></div>
          <section class="panel table-panel">
            <div class="table-wrap">
              <table>
                <thead><tr><th>SHOOTER</th><th>WORLD ARCHERY ID</th><th>AETAY ID</th><th>TOURNAMENTS</th><th>ROUND SCORES</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="summary in scoreSummaries.filter((item) => !search || fullName(item.participant).toLowerCase().includes(search.toLowerCase()))" :key="summary.participant.id">
                    <td><div class="person-cell"><span class="person-avatar">{{ summary.participant.firstName.charAt(0) }}{{ summary.participant.lastName.charAt(0) }}</span><strong>{{ fullName(summary.participant) }}</strong></div></td>
                    <td>{{ summary.participant.waId || '—' }}</td><td>{{ summary.participant.aetayId || '—' }}</td><td>{{ summary.tournamentCount }}</td><td>{{ summary.scoreCount || 'No scores yet' }}</td>
                    <td><button class="text-link" @click="openScoreDetails(summary.participant.id)">View details →</button></td>
                  </tr>
                  <tr v-if="!scoreSummaries.length"><td colspan="6"><div class="table-empty">Add participants to start a scorebook.</div></td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-else-if="activePage === 'score-detail'">
          <div class="page-heading heading-row">
            <div><button class="text-link back-link" @click="activePage = 'scores'">← All score records</button><p class="eyebrow">SHOOTER SCOREBOOK</p><h1>{{ selectedScoreParticipant ? fullName(selectedScoreParticipant) : 'Shooter details' }}</h1><p class="page-subtitle">Tournament and round scores for this shooter.</p></div>
          </div>
          <section class="panel table-panel">
            <div v-if="selectedScoreParticipant && selectedParticipantScoreRows.length" class="table-wrap">
              <table><thead><tr><th>TOURNAMENT</th><th>DATE</th><th>CATEGORY</th><th>ENTRY</th><th>ROUND / MATCH</th><th>SCORE</th></tr></thead>
                <tbody><tr v-for="(row, index) in selectedParticipantScoreRows" :key="`${row.tournamentId}-${row.round}-${index}`"><td>{{ row.tournament?.name || 'Tournament removed' }}</td><td>{{ row.tournament ? formatDate(row.tournament.date) : '—' }}</td><td>{{ row.category?.name || 'Unassigned' }}</td><td>{{ row.scoreType }}</td><td>{{ row.round }}</td><td><strong>{{ row.score }}</strong></td></tr></tbody>
              </table>
            </div>
            <div v-else class="empty-state"><div class="empty-icon">▤</div><strong>No scores recorded yet</strong><p>Scores for this shooter will appear here after you record them in a tournament.</p><button class="button button-outline" @click="activePage = 'scores'">Back to score records</button></div>
          </section>
        </section>

        <section v-else-if="activePage === 'tournament-detail'">
          <template v-if="selectedTournament">
            <div class="page-heading heading-row">
              <div><button class="text-link back-link" @click="activePage = 'tournaments'">← All tournaments</button><p class="eyebrow">TOURNAMENT WORKSPACE</p><h1>{{ selectedTournament.name }}</h1><p class="page-subtitle">{{ formatDate(selectedTournament.date) }} · {{ selectedTournament.discipline }}</p></div>
            </div>
            <section class="tournament-summary">
              <div><span>HOST CLUB</span><strong>{{ clubFor(selectedTournament.clubId)?.name || 'Independent event' }}</strong></div>
              <div><span>LOCATION</span><strong>{{ venueFor(selectedTournament) }}</strong></div>
              <div><span>PARTICIPANTS</span><strong>{{ selectedTournament.participantIds.length }}</strong></div>
              <div><span>CATEGORIES</span><strong>{{ selectedTournament.categoryIds.length }}</strong></div>
              <div v-if="tournamentTypeFor(selectedTournament.tournamentTypeId)" class="format-summary"><span>FORMAT</span><strong>{{ tournamentTypeFor(selectedTournament.tournamentTypeId).distance }} {{ tournamentTypeFor(selectedTournament.tournamentTypeId).distanceUnit }} · {{ tournamentTypeFor(selectedTournament.tournamentTypeId).targetType }} · {{ tournamentTypeFor(selectedTournament.tournamentTypeId).ends }} × {{ tournamentTypeFor(selectedTournament.tournamentTypeId).arrowsPerEnd }}</strong></div>
              <a v-if="selectedTournament.venueMode === 'club' && clubFor(selectedTournament.clubId)?.mapUrl" :href="clubFor(selectedTournament.clubId).mapUrl" target="_blank" rel="noreferrer" class="button button-small button-outline">Open map ↗</a>
            </section>
            <div class="tournament-tabs" role="tablist" aria-label="Tournament sections">
              <button :class="{ active: selectedTournamentTab === 'participants' }" @click="selectedTournamentTab = 'participants'">Participants</button>
              <button :class="{ active: selectedTournamentTab === 'categories' }" @click="selectedTournamentTab = 'categories'">Categories</button>
              <button :class="{ active: selectedTournamentTab === 'scores' }" @click="selectedTournamentTab = 'scores'">Rounds & scores</button>
              <button :class="{ active: selectedTournamentTab === 'olympic' }" @click="selectedTournamentTab = 'olympic'">Olympic matches</button>
            </div>
            <section v-if="selectedTournamentTab === 'participants'" class="panel roster-panel">
              <div class="panel-heading"><div><h2>Tournament participants</h2><p>Select existing shooters from your directory or add a new one.</p></div><button class="button button-small button-outline" @click="openModal('participant', true)">＋ Add participant</button></div>
              <div v-if="data.participants.length" class="roster-list">
                <div v-for="person in data.participants" :key="person.id" class="roster-row">
                  <input type="checkbox" :aria-label="`Add ${fullName(person)} to tournament`" :checked="selectedTournament.participantIds.includes(person.id)" @change="toggleParticipant(selectedTournament, person.id)" />
                  <span class="person-avatar">{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span>
                  <span class="roster-name"><strong>{{ fullName(person) }}</strong><small>{{ person.waId ? `World Archery ${person.waId}` : person.aetayId || 'No affiliation number' }} · Age {{ ageAtTournament(person, selectedTournament) }} at event</small></span>
                  <span class="roster-state">{{ selectedTournament.participantIds.includes(person.id) ? 'Added' : 'Directory' }}</span>
                  <select class="category-select" :aria-label="`${fullName(person)} category`" :disabled="!selectedTournament.participantIds.includes(person.id) || !selectedTournament.categoryIds.length" :value="selectedTournament.categoryAssignments[person.id] || ''" @change="setParticipantCategory(selectedTournament, person, $event)">
                    <option value="">{{ selectedTournament.categoryIds.length ? 'Choose category' : 'No categories' }}</option>
                    <option v-for="categoryId in selectedTournament.categoryIds" :key="categoryId" :value="categoryId">{{ categoryFor(categoryId)?.name }}</option>
                  </select>
                </div>
              </div>
              <div v-else class="empty-state"><strong>No participants in your directory</strong><p>Add a shooter to create the first participant record.</p><button class="button button-primary" @click="openModal('participant', true)">Add participant</button></div>
            </section>
            <section v-else-if="selectedTournamentTab === 'categories'" class="panel roster-panel">
              <div class="panel-heading"><div><h2>Tournament categories</h2><p>Choose the divisions available for this event. Assign each shooter in Participants.</p></div><button class="text-link" @click="activePage = 'categories'">Manage category catalogue →</button></div>
              <div v-if="data.categories.length" class="roster-list">
                <label v-for="category in data.categories" :key="category.id" class="roster-row category-roster-row"><input type="checkbox" :checked="selectedTournament.categoryIds.includes(category.id)" @change="toggleTournamentCategory(selectedTournament, category.id)" /><span class="category-roster-copy"><strong>{{ category.name }}</strong><small>{{ categoryDescription(category) }}</small></span><span class="roster-state">{{ data.tournaments.filter((event) => event.id === selectedTournament.id && event.categoryIds.includes(category.id)).length ? 'Available' : 'Not added' }}</span></label>
              </div>
              <div v-else class="empty-state"><strong>No categories in the catalogue</strong><p>Create categories by age, bow type, or both.</p><button class="button button-primary" @click="activePage = 'categories'">Open category catalogue</button></div>
            </section>
            <section v-else-if="selectedTournamentTab === 'scores'" class="panel score-workspace">
              <div class="score-toolbar">
                <label class="select-field"><span>TOURNAMENT ROUND</span><select v-model="selectedRound"><option v-for="round in selectedTournament.rounds" :key="round">{{ round }}</option></select></label>
                <form class="add-round-form" @submit.prevent="addRound"><input v-model="newRoundName" placeholder="Add a round..." aria-label="New round name" /><button class="button button-small button-outline" type="submit">＋ Add round</button></form>
                <div class="score-completion"><strong>{{ scoredCount }}<small> / {{ tournamentParticipants.length }}</small></strong><span>scores entered</span></div>
              </div>
              <div v-if="scoreRows.length" class="table-wrap">
                <table class="score-table"><thead><tr><th>SHOOTER</th><th>CATEGORY</th><th>WORLD ARCHERY ID</th><th>ROUND SCORE</th><th>STATUS</th></tr></thead>
                  <tbody><tr v-for="row in scoreRows" :key="row.participant.id"><td><div class="person-cell"><span class="person-avatar">{{ row.participant.firstName.charAt(0) }}{{ row.participant.lastName.charAt(0) }}</span><strong>{{ fullName(row.participant) }}</strong></div></td><td>{{ categoryFor(row.categoryId)?.name || 'Unassigned' }}</td><td>{{ row.participant.waId || '—' }}</td><td><input class="score-input" type="number" min="0" :value="row.score" placeholder="Enter score" @change="saveScore(row.participant.id, $event.target.value)" /></td><td><span class="status-pill" :class="row.score !== '' ? 'status-active' : 'status-pending'"><i></i>{{ row.score !== '' ? 'Recorded' : 'Pending' }}</span></td></tr></tbody>
                </table>
              </div>
              <div v-else class="empty-state"><div class="empty-icon">♙</div><strong>No participants added</strong><p>Add shooters in the Participants section of this tournament before recording scores.</p><button class="button button-outline" @click="selectedTournamentTab = 'participants'">Manage participants</button></div>
              <div v-if="scoreRows.length" class="score-footnote">Enter or update a shooter’s score; changes save against this tournament and round.</div>
            </section>
            <section v-else>
              <div class="olympic-toolbar">
                <label class="select-field"><span>CATEGORY</span><select v-model="selectedCategoryId"><option value="">All participants</option><option v-for="categoryId in selectedTournament.categoryIds" :key="categoryId" :value="categoryId">{{ categoryFor(categoryId)?.name }}</option></select></label>
                <div><span class="contact-label">SEEDING SCORES FROM</span><strong class="round-label">{{ selectedRound }}</strong></div>
                <span class="seed-note"><span>↕</span> 1st place vs. last place · 2nd vs. second-last</span>
                <button class="button button-primary" @click="generateMatches"><span>✦</span> Seed from round scores</button>
              </div>
              <div v-if="olympicMatches.length" class="matches-grid">
                <section v-for="(match, index) in olympicMatches" :key="match.id" class="match-card">
                  <div class="match-head"><span>{{ match.round }}</span><span class="match-number">MATCH {{ String(index + 1).padStart(2, '0') }}</span></div>
                  <div class="match-archer"><span class="seed-badge">{{ match.seed1 }}</span><strong>{{ fullName(participantById(match.seed1Id) || { firstName: 'Unknown', lastName: '' }) }}</strong><input type="number" min="0" :value="match.score1" placeholder="—" @change="recordMatchScore(match, 'score1', $event.target.value)" /></div>
                  <div class="match-divider"><span>VS</span></div>
                  <div class="match-archer"><span class="seed-badge">{{ match.seed2 }}</span><strong>{{ fullName(participantById(match.seed2Id) || { firstName: 'Unknown', lastName: '' }) }}</strong><input type="number" min="0" :value="match.score2" placeholder="—" @change="recordMatchScore(match, 'score2', $event.target.value)" /></div>
                  <div class="match-foot"><span>{{ match.score1 !== '' && match.score2 !== '' ? 'Scores recorded' : 'Enter both match scores' }}</span><i :class="{ complete: match.score1 !== '' && match.score2 !== '' }"></i></div>
                </section>
              </div>
              <section v-else class="panel empty-state bracket-empty"><div class="empty-icon">⌁</div><strong>No matches seeded yet</strong><p>Record at least two scores for this tournament round. Highest seed faces lowest seed.</p><button class="button button-outline" @click="selectedTournamentTab = 'scores'">Enter round scores</button></section>
              <p class="bracket-note">First-round pairings belong to this tournament. Re-seeding replaces its current first-round matches.</p>
            </section>
          </template>
          <section v-else class="panel empty-state"><strong>Tournament not found</strong><button class="button button-outline" @click="activePage = 'tournaments'">Back to tournaments</button></section>
        </section>
      </div>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <form class="modal" @submit.prevent="modalType === 'club' ? saveClub() : modalType === 'tournament' ? saveTournament() : modalType === 'tournamentType' ? saveTournamentType() : modalType === 'category' ? saveCategory() : saveParticipant()">
        <div class="modal-heading"><div><p class="eyebrow">{{ modalType === 'club' ? 'CLUB DIRECTORY' : modalType === 'tournament' || modalType === 'tournamentType' ? 'EVENT MANAGEMENT' : modalType === 'category' ? 'CATEGORY DIRECTORY' : 'ARCHER DIRECTORY' }}</p><h2>{{ modalType === 'club' ? editingClubId ? 'Edit club' : 'Add a club' : modalType === 'tournament' ? 'Create tournament' : modalType === 'tournamentType' ? editingTournamentTypeId ? 'Edit tournament type' : 'Create tournament type' : modalType === 'category' ? editingCategoryId ? 'Edit category' : 'Create category' : 'Add participant' }}</h2></div><button type="button" class="modal-close" aria-label="Close dialog" @click="closeModal">×</button></div>
        <template v-if="modalType === 'club'">
          <div class="form-grid">
            <label class="form-field full"><span>CLUB NAME <b>*</b></span><input v-model="form.name" required placeholder="e.g. Northside Archery Club" /></label>
            <label class="form-field"><span>REPRESENTATIVE NAME <b>*</b></span><input v-model="form.representative" required placeholder="Full name" /></label>
            <label class="form-field"><span>PHONE NUMBER <b>*</b></span><input v-model="form.phone" required type="tel" placeholder="(555) 123-4567" /></label>
            <label class="form-field"><span>EMAIL <small>OPTIONAL</small></span><input v-model="form.email" type="email" placeholder="contact@club.org" /></label>
            <label class="form-field"><span>WEBSITE <small>OPTIONAL</small></span><input v-model="form.website" type="url" placeholder="https://" /></label>
            <label class="form-field full"><span>LOCATION ADDRESS <b>*</b></span><input v-model="form.address" required placeholder="Street, city, state, ZIP" /></label>
            <label class="form-field full"><span>MAP LOCATION URL <small>OPTIONAL</small></span><input v-model="form.mapUrl" type="url" placeholder="https://maps.google.com/..." /></label>
            <label class="form-field full"><span>CLUB USER EMAIL <small>DEMO ACCOUNT ACCESS</small></span><input v-model="form.userEmail" type="email" placeholder="club@club.org" /></label>
          </div>
        </template>
        <template v-else-if="modalType === 'tournament'">
          <div class="form-grid">
            <label class="form-field full"><span>TOURNAMENT NAME <b>*</b></span><input v-model="form.name" required placeholder="e.g. Spring Championship" /></label>
            <label class="form-field"><span>DATE <b>*</b></span><input v-model="form.date" required type="date" /></label>
            <label class="form-field"><span>DISCIPLINE</span><select v-model="form.discipline"><option>Outdoor target</option><option>Indoor target</option><option>Field</option><option>3D</option><option>Other</option></select></label>
            <label class="form-field full"><span>TOURNAMENT TYPE <b>*</b></span><select v-model="form.tournamentTypeId" required><option v-for="type in data.tournamentTypes" :key="type.id" :value="type.id">{{ type.name }} — {{ type.distance }} {{ type.distanceUnit }}, {{ type.targetType }}</option></select></label>
            <label class="form-field full"><span>HOST CLUB</span><select v-model="form.clubId"><option value="">No club / independent event</option><option v-for="club in data.clubs" :key="club.id" :value="club.id">{{ club.name }}</option></select></label>
            <div class="form-field full"><span>TOURNAMENT LOCATION</span><div class="radio-row"><label><input v-model="form.venueMode" type="radio" value="club" /> Use club address</label><label><input v-model="form.venueMode" type="radio" value="custom" /> Custom address</label></div></div>
            <label v-if="form.venueMode === 'custom'" class="form-field full"><span>CUSTOM ADDRESS <b>*</b></span><input v-model="form.customAddress" required placeholder="Street, city, state, ZIP" /></label>
            <p v-else-if="form.clubId" class="address-preview full">⌖ {{ clubFor(form.clubId)?.address || 'This club has no address yet.' }}</p>
          </div>
        </template>
        <template v-else-if="modalType === 'tournamentType'">
          <div class="form-grid">
            <label class="form-field full"><span>TYPE NAME <b>*</b></span><input v-model="form.name" required placeholder="e.g. Outdoor 70m Recurve" /></label>
            <label class="form-field"><span>DISTANCE <b>*</b></span><input v-model.number="form.distance" required type="number" min="0.1" step="any" placeholder="70" /></label>
            <label class="form-field"><span>DISTANCE UNIT <b>*</b></span><select v-model="form.distanceUnit" required><option value="m">Meters</option><option value="yd">Yards</option></select></label>
            <label class="form-field full"><span>TARGET TYPE <b>*</b></span><input v-model="form.targetType" required placeholder="e.g. 122 cm face or 40 cm triple-spot" /></label>
            <label class="form-field"><span>ENDS (SERIES) <b>*</b></span><input v-model.number="form.ends" required type="number" min="1" step="1" placeholder="12" /></label>
            <label class="form-field"><span>ARROWS PER END <b>*</b></span><input v-model.number="form.arrowsPerEnd" required type="number" min="1" step="1" placeholder="6" /></label>
            <p class="address-preview full">This format can be selected when creating a tournament and reused for future events.</p>
          </div>
        </template>
        <template v-else-if="modalType === 'category'">
          <div class="form-grid">
            <label class="form-field full"><span>CATEGORY NAME <b>*</b></span><input v-model="form.name" required placeholder="e.g. Junior Recurve" /></label>
            <label class="form-field"><span>MINIMUM AGE <small>OPTIONAL</small></span><input v-model.number="form.minAge" type="number" min="0" step="1" placeholder="No minimum" /></label>
            <label class="form-field"><span>MAXIMUM AGE <small>OPTIONAL</small></span><input v-model.number="form.maxAge" type="number" min="0" step="1" placeholder="No maximum" /></label>
            <label class="form-field full"><span>BOW TYPE <small>OPTIONAL</small></span><select v-model="form.bowType"><option value="">Any bow type</option><option>Recurve</option><option>Compound</option><option>Barebow</option><option>Longbow</option><option>Traditional</option></select></label>
            <p class="address-preview full">Age limits are checked against the participant's age on the tournament date. Leave a field blank when it does not apply.</p>
          </div>
        </template>
        <template v-else>
          <div class="form-grid">
            <label class="form-field"><span>FIRST NAME <b>*</b></span><input v-model="form.firstName" required autocomplete="given-name" placeholder="First name" /></label>
            <label class="form-field"><span>LAST NAME <b>*</b></span><input v-model="form.lastName" required autocomplete="family-name" placeholder="Last name" /></label>
            <label class="form-field full"><span>BIRTH DATE <b>*</b></span><input v-model="form.birthDate" required type="date" /></label>
            <label class="form-field"><span>WORLD ARCHERY ID <small>OPTIONAL</small></span><input v-model="form.waId" placeholder="Affiliation number" /></label>
            <label class="form-field"><span>AETAY ID <small>OPTIONAL</small></span><input v-model="form.aetayId" placeholder="Affiliation number" /></label>
            <p class="privacy-note full">Participant details are stored in this browser in this demo version.</p>
          </div>
        </template>
        <div class="modal-actions"><button type="button" class="button button-outline" @click="closeModal">Cancel</button><button type="submit" class="button button-primary">{{ modalType === 'club' ? editingClubId ? 'Save changes' : 'Save club' : modalType === 'tournament' ? 'Create tournament' : modalType === 'tournamentType' ? editingTournamentTypeId ? 'Save type' : 'Create type' : modalType === 'category' ? editingCategoryId ? 'Save category' : 'Create category' : 'Save participant' }}</button></div>
      </form>
    </div>
    <Transition name="toast"><div v-if="toast" class="toast-message"><span>✓</span>{{ toast }}</div></Transition>
    <button class="reset-demo" title="Restore example data" @click="resetDemoData">↻</button>
  </div>
</template>
