<script setup>
import { t } from '@shooting-line/i18n'
import LanguageSwitcher from '@shooting-line/i18n/LanguageSwitcher.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { APP_IDS, createSupabaseClient, hasAppAccess } from '@shooting-line/auth'
import { createManagerRepository, readLegacyWorkspace } from './services/workspace.js'
import App from './App.vue'

const client = ref(null)
const repository = ref(null)
const workspace = ref(null)
const userEmail = ref('')
const userId = ref('')
const userName = ref('')
const userRole = ref('manager')
const userRoles = ref(['manager'])
const userScope = ref({})
const userMetadata = ref({})
const legacyWorkspace = ref(null)
const configurationError = ref('')
const legacyDataError = ref('')
const errorMessage = ref('')
const isChecking = ref(true)
const isAuthorized = ref(false)
const hasAccess = ref(false)
const isImportPrompt = ref(false)
const isImporting = ref(false)
let authSubscription

try {
  client.value = createSupabaseClient()
} catch (error) {
  configurationError.value = error.message
  isChecking.value = false
}

function goToPortal() {
  window.location.replace(new URL('../', window.location.href).toString())
}

async function checkAppAccess(userId) {
  const { allowed, error } = await hasAppAccess(client.value, userId, APP_IDS.manager)
  if (error) {
    errorMessage.value = `${t('Unable to verify manager access')}: ${error.message}`
    isChecking.value = false
    return
  }

  hasAccess.value = allowed
  if (!allowed) {
    isChecking.value = false
    return
  }

  const [rolesResult, profileResult] = await Promise.all([
    client.value.from('user_roles').select('role, club_id, participant_id').eq('user_id', userId),
    client.value.from('user_profiles').select('display_name').eq('user_id', userId).maybeSingle(),
  ])
  if (rolesResult.error || profileResult.error) {
    errorMessage.value = `${t('Unable to load account details')}: ${rolesResult.error?.message || profileResult.error?.message}`
    isChecking.value = false
    return
  }

  const rolePriority = ['admin', 'manager', 'club', 'archer']
  const assignedRoles = rolesResult.data.map((record) => record.role)
  userRoles.value = assignedRoles.length ? assignedRoles : ['manager']
  const currentRole = rolePriority.find((role) => assignedRoles.includes(role)) || 'manager'
  userRole.value = currentRole
  const currentRoleRecord = rolesResult.data.find((record) => record.role === currentRole)
  userScope.value = {
    clubId: currentRoleRecord?.club_id || '',
    participantId: currentRoleRecord?.participant_id || '',
  }
  userName.value =
    profileResult.data?.display_name ||
    userMetadata.value.full_name ||
    userMetadata.value.name ||
    userMetadata.value.given_name ||
    ''

  const managerRepository = createManagerRepository(client.value)
  try {
    workspace.value = await managerRepository.load({ includeUserRoles: currentRole === 'admin' })
  } catch (loadError) {
    errorMessage.value = `${t('Unable to load the manager database')}: ${loadError.message}`
    isChecking.value = false
    return
  }

  repository.value = managerRepository
  const hasManagerData = Object.entries(workspace.value).some(([key, rows]) => key !== 'userRoles' && rows.length > 0)
  const databaseIsEmpty = !hasManagerData
  if (databaseIsEmpty && ['admin', 'manager'].includes(currentRole)) {
    try {
      legacyWorkspace.value = readLegacyWorkspace()
      if (legacyWorkspace.value && Object.values(legacyWorkspace.value).some((rows) => rows.length > 0)) {
        isImportPrompt.value = true
        isChecking.value = false
        return
      }
    } catch (legacyError) {
      legacyDataError.value = legacyError.message
      isImportPrompt.value = true
      isChecking.value = false
      return
    }
  }

  isAuthorized.value = true
  isChecking.value = false
}

async function importLegacyData() {
  if (!legacyWorkspace.value || !repository.value) return

  isImporting.value = true
  errorMessage.value = ''
  try {
    await repository.value.importLegacyWorkspace(legacyWorkspace.value)
    workspace.value = await repository.value.load()
    legacyWorkspace.value = null
    isImportPrompt.value = false
    isAuthorized.value = true
  } catch (error) {
    errorMessage.value = `${t('Unable to import saved browser data')}: ${error.message}`
  }
  isImporting.value = false
}

function continueWithoutImporting() {
  isImportPrompt.value = false
  isAuthorized.value = true
}

async function restoreSession() {
  const { data, error } = await client.value.auth.getSession()
  if (error) {
    errorMessage.value = `${t('Unable to verify your sign-in')}: ${error.message}`
    isChecking.value = false
    return
  }

  if (!data.session) {
    goToPortal()
    return
  }

  userEmail.value = data.session.user.email || ''
  userId.value = data.session.user.id
  userMetadata.value = data.session.user.user_metadata || {}
  await checkAppAccess(data.session.user.id)
}

onMounted(() => {
  if (!client.value) return

  authSubscription = client.value.auth.onAuthStateChange((_event, session) => {
    if (!session) goToPortal()
    else userEmail.value = session.user.email || ''
  }).data.subscription

  void restoreSession()
})

onUnmounted(() => authSubscription?.unsubscribe())
</script>

<template>
  <App
    v-if="isAuthorized"
    :initial-data="workspace"
    :repository="repository"
    :user-id="userId"
    :user-name="userName"
    :user-email="userEmail"
    :user-role="userRole"
    :user-roles="userRoles"
    :user-scope="userScope"
  />

  <main v-else-if="isImportPrompt" class="manager-access-state">
    <section class="manager-access-panel">
      <LanguageSwitcher />
      <p class="manager-access-eyebrow">{{ t('Saved browser data found') }}</p>
      <h1 v-if="legacyDataError">{{ t('Could not read saved browser data') }}</h1>
      <h1 v-else>{{ t('Import into the shared database?') }}</h1>
      <p v-if="legacyDataError">{{ legacyDataError }} {{ t('The local copy has been left untouched.') }}</p>
      <p v-else>
        {{ t('Existing local workspace data will be copied into Supabase. The browser copy will not be deleted.') }}
      </p>
      <p v-if="errorMessage" class="manager-access-error" role="alert">{{ errorMessage }}</p>
      <div class="manager-access-actions">
        <button type="button" :disabled="isImporting || !legacyWorkspace" @click="importLegacyData">
          {{ isImporting ? t('Importing…') : t('Import saved data') }}
        </button>
        <button type="button" class="secondary-action" :disabled="isImporting" @click="continueWithoutImporting">
          {{ t('Continue without import') }}
        </button>
      </div>
    </section>
  </main>

  <main v-else class="manager-access-state">
    <section class="manager-access-panel" role="status">
      <LanguageSwitcher />
      <p class="manager-access-eyebrow">{{ t('ShootingLine access') }}</p>
      <h1 v-if="isChecking">{{ t('Checking your account…') }}</h1>
      <h1 v-else-if="configurationError">{{ t('Access service needs setup') }}</h1>
      <h1 v-else-if="errorMessage">{{ t('Unable to verify access') }}</h1>
      <h1 v-else-if="hasAccess">{{ t('Opening Tournament Manager…') }}</h1>
      <h1 v-else>{{ t('Your account does not have access') }}</h1>
      <p v-if="configurationError">{{ configurationError }}</p>
      <p v-else-if="legacyDataError">{{ legacyDataError }} {{ t('The local copy has been left untouched.') }}</p>
      <p v-else-if="errorMessage">{{ errorMessage }}</p>
      <p v-else-if="!isChecking && !hasAccess">
        {{ t('Sign in from the main menu or ask an administrator to assign the Tournament Manager app.') }}
      </p>
      <a href="../">{{ t('Return to main menu') }}</a>
    </section>
  </main>
</template>

<style scoped>
.manager-access-state {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: #f3f6fa;
  color: #172033;
  font-family: system-ui, sans-serif;
}

.manager-access-panel {
  width: min(100%, 520px);
  padding: 36px;
  border: 1px solid #e1e7ee;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 60px rgba(28, 42, 63, 0.08);
}

.manager-access-eyebrow {
  color: #9a7223;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.manager-access-panel h1 {
  font-size: 28px;
}

.manager-access-panel p {
  color: #647184;
  line-height: 1.55;
}

.manager-access-panel a {
  color: #1e293b;
  font-weight: 700;
}

.manager-access-error {
  color: #a12622 !important;
}

.manager-access-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.manager-access-actions button {
  min-height: 42px;
  padding: 0 15px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #1e293b;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.manager-access-actions .secondary-action {
  border: 1px solid #d7dee7;
  color: #344054;
  background: #fff;
}

.manager-access-actions button:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
