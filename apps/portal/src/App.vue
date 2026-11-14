<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { APP_IDS, createSupabaseClient, listAppAccess } from '@shooting-line/auth'

const baseUrl = import.meta.env.BASE_URL
const isDevelopmentPreview = import.meta.env.VITE_APP_ENV === 'development'
const appDefinitions = [
  {
    id: APP_IDS.manager,
    name: 'Tournament Manager',
    description: 'Manage clubs, tournaments, archers, and scores.',
    path: `${baseUrl}manager/`,
    ready: true,
  },
  {
    id: APP_IDS.ianseoDashboard,
    name: 'Ianseo Dashboard',
    description: 'Browse published Ianseo tournament records.',
    ready: false,
  },
  {
    id: APP_IDS.scorecard,
    name: 'Shooting Scorecard',
    description: 'Record scores from the range.',
    ready: false,
  },
]

const client = ref(null)
const configurationError = ref('')
const errorMessage = ref('')
const email = ref('')
const password = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isSubmitting = ref(false)
const isUpdatingPassword = ref(false)
const isSigningOut = ref(false)
const session = ref(null)
const accessibleApps = ref([])
const isLoadingAccess = ref(false)
const isPasswordRecovery = ref(false)
let authSubscription

try {
  client.value = createSupabaseClient()
} catch (error) {
  configurationError.value = error.message
}

const visibleApps = computed(() =>
  appDefinitions.map((app) => ({
    ...app,
    hasAccess: accessibleApps.value.includes(app.id),
  })),
)

async function updateAppAccess(userId) {
  isLoadingAccess.value = true
  errorMessage.value = ''
  accessibleApps.value = []

  const { data, error } = await listAppAccess(client.value, userId)
  if (error) {
    errorMessage.value = `Unable to verify app access: ${error.message}`
  } else {
    accessibleApps.value = data
  }

  isLoadingAccess.value = false
}

async function restoreSession() {
  const { data, error } = await client.value.auth.getSession()
  if (error) {
    errorMessage.value = `Unable to restore your session: ${error.message}`
    return
  }

  session.value = data.session
  if (session.value) await updateAppAccess(session.value.user.id)
}

async function signIn() {
  isSubmitting.value = true
  errorMessage.value = ''

  const { data, error } = await client.value.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })

  if (error) {
    errorMessage.value = error.message
  } else {
    session.value = data.session
    await updateAppAccess(data.session.user.id)
  }

  isSubmitting.value = false
}

async function signOut() {
  isSigningOut.value = true
  errorMessage.value = ''
  const { error } = await client.value.auth.signOut()
  if (error) {
    errorMessage.value = `Unable to sign out: ${error.message}`
    isSigningOut.value = false
    return
  }

  session.value = null
  accessibleApps.value = []
  isPasswordRecovery.value = false
  isSigningOut.value = false
}

async function updatePassword() {
  if (newPassword.value.length < 8) {
    errorMessage.value = 'Use a password with at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'The passwords do not match.'
    return
  }

  isUpdatingPassword.value = true
  errorMessage.value = ''
  const { error } = await client.value.auth.updateUser({ password: newPassword.value })
  if (error) {
    errorMessage.value = error.message
  } else {
    if (session.value) await updateAppAccess(session.value.user.id)
    isPasswordRecovery.value = false
    newPassword.value = ''
    confirmPassword.value = ''
  }
  isUpdatingPassword.value = false
}

onMounted(() => {
  if (!client.value) return

  authSubscription = client.value.auth.onAuthStateChange((event, nextSession) => {
    session.value = nextSession
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecovery.value = true
      errorMessage.value = ''
    }
    if (!nextSession) accessibleApps.value = []
  }).data.subscription

  void restoreSession()
})

onUnmounted(() => authSubscription?.unsubscribe())
</script>

<template>
  <main class="portal-shell">
    <header class="portal-header">
      <a class="brand" :href="baseUrl" aria-label="ShootingLine home">
        <img :src="`${baseUrl}shooting-line-icon-dark.svg`" alt="" />
        <span>ShootingLine</span>
      </a>
      <span v-if="isDevelopmentPreview" class="environment-badge">DEVELOPMENT / QA</span>
    </header>

    <section v-if="configurationError" class="portal-panel status-panel" role="alert">
      <p class="eyebrow">Setup required</p>
      <h1>Connect the access service</h1>
      <p>{{ configurationError }}</p>
      <p>
        Copy <code>.env.example</code> to <code>.env</code>, configure the Supabase project values, and restart the app.
      </p>
    </section>

    <section v-else-if="isPasswordRecovery" class="portal-panel sign-in-panel">
      <div class="panel-copy">
        <p class="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <p>Your administrator requested this one-time recovery link.</p>
      </div>
      <form class="sign-in-form" @submit.prevent="updatePassword">
        <label>
          New password
          <input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label>
          Confirm new password
          <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <button class="primary-button" type="submit" :disabled="isUpdatingPassword">
          {{ isUpdatingPassword ? 'Updating password…' : 'Update password' }}
        </button>
      </form>
    </section>

    <section v-else-if="!session" class="portal-panel sign-in-panel">
      <div class="panel-copy">
        <p class="eyebrow">Your archery workspace</p>
        <h1>Sign in to ShootingLine</h1>
        <p>Use an account invited by your ShootingLine administrator.</p>
      </div>

      <form class="sign-in-form" @submit.prevent="signIn">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="username" required />
        </label>
        <label>
          Password
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <button class="primary-button" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </section>

    <section v-else class="workspace-section">
      <div class="welcome-row">
        <div>
          <h1>Choose an app</h1>
          <p class="signed-in-as">Signed in as {{ session.user.email }}</p>
        </div>
        <button class="secondary-button" type="button" :disabled="isSigningOut" @click="signOut">
          {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>

      <p v-if="errorMessage" class="error-message access-error" role="alert">{{ errorMessage }}</p>
      <p v-if="isLoadingAccess" class="loading-message" role="status">Checking your app access…</p>
      <div v-else class="app-grid">
        <component
          :is="app.ready && app.hasAccess ? 'a' : 'article'"
          v-for="app in visibleApps"
          :key="app.id"
          :href="app.ready && app.hasAccess ? app.path : null"
          class="app-card"
          :class="{
            'app-card-link': app.ready && app.hasAccess,
            'app-card-disabled': !app.ready || !app.hasAccess,
          }"
          :aria-disabled="app.ready && app.hasAccess ? null : 'true'"
        >
          <p v-if="!app.ready" class="card-status coming-soon-status">COMING SOON</p>
          <p v-else-if="!app.hasAccess" class="card-status access-required-status">Access required</p>
          <h2>{{ app.name }}</h2>
          <p>{{ app.description }}</p>
          <p v-if="app.ready && app.hasAccess" class="card-action">Open app <span aria-hidden="true">→</span></p>
          <p v-else-if="app.ready" class="access-note">Contact ShootingLine administrators for access.</p>
          <p v-else class="access-note">This app is not available yet</p>
        </component>
      </div>
      <p v-if="!isLoadingAccess && !errorMessage && accessibleApps.length === 0" class="empty-access">
        No apps are assigned to this account. Contact ShootingLine administrators for access.
      </p>
    </section>

    <footer class="portal-footer">
      <span>One sign-in for your ShootingLine apps</span>
      <span>Contact ShootingLine administrators for access</span>
    </footer>
  </main>
</template>
