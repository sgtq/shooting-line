<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { APP_IDS, createSupabaseClient, hasAppAccess } from '@shooting-line/auth'
import { createManagerRepository, readLegacyWorkspace } from './services/workspace.js'
import App from './App.vue'

const client = ref(null)
const repository = ref(null)
const workspace = ref(null)
const userEmail = ref('')
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
    errorMessage.value = `Unable to verify manager access: ${error.message}`
    isChecking.value = false
    return
  }

  hasAccess.value = allowed
  if (!allowed) {
    isChecking.value = false
    return
  }

  const managerRepository = createManagerRepository(client.value)
  try {
    workspace.value = await managerRepository.load()
  } catch (loadError) {
    errorMessage.value = `Unable to load the manager database: ${loadError.message}`
    isChecking.value = false
    return
  }

  repository.value = managerRepository
  const databaseIsEmpty = Object.values(workspace.value).every((rows) => rows.length === 0)
  if (databaseIsEmpty) {
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
    errorMessage.value = `Unable to import saved browser data: ${error.message}`
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
    errorMessage.value = `Unable to verify your sign-in: ${error.message}`
    isChecking.value = false
    return
  }

  if (!data.session) {
    goToPortal()
    return
  }

  userEmail.value = data.session.user.email || ''
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
    :user-email="userEmail"
  />

  <main v-else-if="isImportPrompt" class="manager-access-state">
    <section class="manager-access-panel">
      <p class="manager-access-eyebrow">Saved browser data found</p>
      <h1 v-if="legacyDataError">Could not read saved browser data</h1>
      <h1 v-else>Import into the shared database?</h1>
      <p v-if="legacyDataError">{{ legacyDataError }} The local copy has been left untouched.</p>
      <p v-else>Existing local workspace data will be copied into Supabase. The browser copy will not be deleted.</p>
      <p v-if="errorMessage" class="manager-access-error" role="alert">{{ errorMessage }}</p>
      <div class="manager-access-actions">
        <button type="button" :disabled="isImporting || !legacyWorkspace" @click="importLegacyData">
          {{ isImporting ? 'Importing…' : 'Import saved data' }}
        </button>
        <button type="button" class="secondary-action" :disabled="isImporting" @click="continueWithoutImporting">
          Continue without import
        </button>
      </div>
    </section>
  </main>

  <main v-else class="manager-access-state">
    <section class="manager-access-panel" role="status">
      <p class="manager-access-eyebrow">ShootingLine access</p>
      <h1 v-if="isChecking">Checking your account…</h1>
      <h1 v-else-if="configurationError">Access service needs setup</h1>
      <h1 v-else-if="errorMessage">Unable to verify access</h1>
      <h1 v-else-if="hasAccess">Opening Tournament Manager…</h1>
      <h1 v-else>Your account does not have access</h1>
      <p v-if="configurationError">{{ configurationError }}</p>
      <p v-else-if="legacyDataError">{{ legacyDataError }} The local copy has been left untouched.</p>
      <p v-else-if="errorMessage">{{ errorMessage }}</p>
      <p v-else-if="!isChecking && !hasAccess">
        Sign in through the workspace portal or ask an administrator to assign the manager app.
      </p>
      <a href="../">Return to workspace portal</a>
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
