<script setup>
import { t } from '@shooting-line/i18n'
import LanguageSwitcher from '@shooting-line/i18n/LanguageSwitcher.vue'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
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
import { useArcherRequestActions } from './composables/useArcherRequestActions'
import { useNavItems } from './composables/useNavItems'
import { usePlanActions } from './composables/usePlanActions'
import { usePermissions } from './composables/usePermissions'
import { useScoring } from './composables/useScoring'
import { useTournamentActions } from './composables/useTournamentActions'
import { useDialogSaves } from './composables/useDialogSaves'
import { useDialogs } from './composables/useDialogs'
import { useToast } from './composables/useToast'
import { useUserAccessActions } from './composables/useUserAccessActions'
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

import { buildScoreRows } from './services/scoreRows'

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
const { savePlan, savePlanPrice, saveSubscription, setSubscriptionEnd, removeSubscription } = usePlanActions({
  repository: props.repository,
  notify,
})
const { createArcherRequest, decideArcherRequests } = useArcherRequestActions({
  repository: props.repository,
  scope: props.userScope,
  notify,
})
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
const selectedTournamentTab = ref('participants')
const selectedScoreParticipantId = ref('')
const tournamentQuery = ref('')
const userName = ref(props.userName)

const selectedScoreParticipant = computed(() =>
  data.value.participants.find((person) => person.id === selectedScoreParticipantId.value),
)
const currentNavPage = computed(() =>
  activePage.value === 'tournament-detail'
    ? 'tournaments'
    : activePage.value === 'score-detail'
      ? 'participants'
      : activePage.value,
)
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
const tournamentParticipants = computed(() => {
  if (!selectedTournament.value) return []
  return selectedTournament.value.participantIds
    .map((id) => data.value.participants.find((person) => person.id === id))
    .filter(Boolean)
})
const {
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
} = useScoring({
  repository: props.repository,
  notify,
  selectedTournamentId,
  selectedTournament,
  tournamentParticipants,
})
const {
  toggleTournamentCategory,
  addParticipantWithCategory,
  clearParticipantCategory,
  toggleTournamentStarted,
  removeParticipantFromTournament,
  setParticipantClub,
  toggleClub,
} = useTournamentActions({ repository: props.repository, notify, selectedCategoryId })
const selectedParticipantScoreRows = computed(() => buildScoreRows(selectedScoreParticipantId.value, data.value))
const dialogs = useDialogs({
  repository: props.repository,
  userScope: props.userScope,
  userName,
  canManage,
  isClubUser,
  canSearchArchers,
  selectedTournamentId,
  participantClubFilter,
})
const {
  form,
  showModal,
  modalType,
  modalText,
  showTargetTypeModal,
  targetTypeName,
  targetTypeOptions,
  assignNewParticipant,
  editingParticipantId,
  archerMatches,
  selectedMatchToken,
  selectedMatch,
  openModal,
  openTournamentChildModal,
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
} = dialogs
const { submitModal, saveTargetType, sendOwnPasswordReset } = useDialogSaves({
  repository: props.repository,
  notify,
  userId: props.userId,
  userEmail: props.userEmail,
  userScope: props.userScope,
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
})
const { removeUserRole, sendRolePasswordReset } = useUserAccessActions({ repository: props.repository, notify })

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
