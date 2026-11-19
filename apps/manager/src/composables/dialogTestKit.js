import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { computed, ref } from 'vue'
import { useManagerStore } from '../stores/managerStore'
import { useDialogSaves } from './useDialogSaves'
import { useDialogs } from './useDialogs'

/** @returns {object} The repository methods the dialogs call, all succeeding. */
export function fakeRepository() {
  return {
    saveClub: vi.fn().mockResolvedValue(),
    uploadClubLogo: vi.fn().mockResolvedValue('https://logo.test/logo.png'),
    saveTournament: vi.fn().mockResolvedValue(),
    saveTournamentDates: vi.fn().mockResolvedValue(),
    saveTournamentType: vi.fn().mockResolvedValue(),
    saveTargetType: vi.fn().mockResolvedValue(),
    saveCategory: vi.fn().mockResolvedValue(),
    assignUserRole: vi.fn().mockResolvedValue('user-new'),
    saveUserProfile: vi.fn().mockResolvedValue(),
    sendOwnPasswordReset: vi.fn().mockResolvedValue(),
    saveParticipant: vi.fn().mockResolvedValue(),
    addArcherByToken: vi.fn().mockResolvedValue({ id: 'found', firstName: 'Fay', lastName: 'Found' }),
    searchArchers: vi.fn().mockResolvedValue([]),
  }
}

/**
 * Builds the dialogs and their saves with real state, so tests drive them the way the app does.
 * @param {{ role?: 'manager'|'club', clubId?: string, canCreate?: boolean, canEdit?: boolean, data?: object }} [options]
 * @returns {object} The store, the refs, the fakes, and everything the composables return.
 */
export function buildDialogKit({ role = 'manager', clubId = '', canCreate = true, canEdit = true, data = {} } = {}) {
  setActivePinia(createPinia())
  const store = useManagerStore()
  store.load({
    clubs: [{ id: 'c1', name: 'North', address: '1 Main St', email: 'north@x.test', userEnabled: false }],
    participants: [],
    tournaments: [
      {
        id: 't1',
        dates: ['2026-06-01'],
        participantIds: [],
        categoryIds: [],
        categoryAssignments: {},
        rounds: ['Qualification'],
      },
    ],
    tournamentTypes: [{ id: 'ty1', name: 'Outdoor 70m' }],
    targetTypes: [{ id: 'tt1', name: '122 cm face' }],
    categories: [],
    userRoles: [],
    ...data,
  })
  const repository = fakeRepository()
  const notify = vi.fn()
  const userName = ref('Ana')
  const selectedTournamentId = ref('t1')
  const selectedTournamentTab = ref('participants')
  const activePage = ref('dashboard')
  const participantClubFilter = ref('')
  const canManage = ref(role === 'manager')
  const isClubUser = ref(role === 'club')
  const canSearchArchers = ref(true)
  const selectedTournament = computed(() =>
    store.data.tournaments.find((item) => item.id === selectedTournamentId.value),
  )
  const userScope = { clubId }
  const dialogs = useDialogs({
    repository,
    userScope,
    userName,
    canManage,
    isClubUser,
    canSearchArchers,
    selectedTournamentId,
    participantClubFilter,
  })
  const saves = useDialogSaves({
    repository,
    notify,
    userId: 'me',
    userEmail: 'me@x.test',
    userScope,
    userName,
    canManage,
    isClubUser,
    canCreateTournament: ref(canCreate),
    canEditTournament: ref(canEdit),
    selectedTournament,
    selectedTournamentId,
    selectedTournamentTab,
    activePage,
    dialogs,
  })
  return {
    store,
    repository,
    notify,
    userName,
    selectedTournamentId,
    selectedTournamentTab,
    activePage,
    participantClubFilter,
    canSearchArchers,
    selectedTournament,
    dialogs,
    saves,
  }
}
