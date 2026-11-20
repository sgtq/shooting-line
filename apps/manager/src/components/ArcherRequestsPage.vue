<script setup>
import { t } from '@shooting-line/i18n'
import { computed, ref } from 'vue'
import { groupPendingByClub, requestableArchers } from '../services/archerRequests'

const props = defineProps({
  requests: { type: Array, required: true },
  participants: { type: Array, required: true },
  clubs: { type: Array, required: true },
  // Managers and admins decide requests. Clubs only make them and read their status.
  canDecide: { type: Boolean, default: false },
  // The club a club user belongs to. Empty for managers and admins.
  clubId: { type: String, default: '' },
  // A club without an active plan can read its requests but not make new ones.
  canRequest: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['create-request', 'decide'])

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
const selectedParticipantId = ref('')

const eligibleArchers = computed(() => requestableArchers(props.participants, props.requests, props.clubId))
const pendingGroups = computed(() => groupPendingByClub(props.requests, props.clubs))
const listedRequests = computed(() => {
  // The database already limits a club to its own requests. The filter keeps the list correct if more are loaded.
  const scoped = props.canDecide
    ? props.requests.filter((request) => request.status !== 'pending')
    : props.requests.filter((request) => request.clubId === props.clubId)
  return [...scoped].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
})

/** @returns {object|null} The archer a request is for. */
function participantFor(request) {
  return props.participants.find((person) => person.id === request.participantId) || null
}

/** @returns {string} The archer's name, last name first. */
function archerName(request) {
  const person = participantFor(request)
  return person ? `${person.lastName}, ${person.firstName}` : '—'
}

/** @returns {string} The name of the club that made the request. */
function clubName(request) {
  return props.clubs.find((club) => club.id === request.clubId)?.name || '—'
}

/** @returns {void} */
function submitRequest() {
  if (!selectedParticipantId.value) return
  emit('create-request', selectedParticipantId.value)
  selectedParticipantId.value = ''
}

/** @returns {void} */
function decide(action, requests) {
  emit('decide', { action, requestIds: requests.map((request) => request.id) })
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('ACCOUNT MANAGEMENT') }}</p>
        <h1>{{ t('Requests') }}</h1>
        <p class="page-subtitle">
          {{
            canDecide
              ? t('Approve or reject requests to give archers a login.')
              : t('Ask for a login for an archer of your club.')
          }}
        </p>
      </div>
    </div>
    <p v-if="error" class="database-error" role="alert">{{ error }}</p>

    <form v-if="!canDecide" class="panel plan-form" @submit.prevent="submitRequest">
      <h2>{{ t('Request a login for an archer') }}</h2>
      <p v-if="!canRequest" class="page-subtitle">{{ t('Your club needs an active plan to make requests.') }}</p>
      <p v-else-if="!eligibleArchers.length" class="page-subtitle">
        {{ t('No archer can be requested. An archer needs an email and no open request.') }}
      </p>
      <div v-else class="form-grid">
        <label class="form-field"
          ><span>{{ t('ARCHER') }} <b>*</b></span
          ><select v-model="selectedParticipantId" required>
            <option value="" disabled>{{ t('Select an archer') }}</option>
            <option v-for="person in eligibleArchers" :key="person.id" :value="person.id">
              {{ person.lastName }}, {{ person.firstName }} ({{ person.email }})
            </option>
          </select></label
        >
      </div>
      <button class="button button-primary" type="submit" :disabled="!canRequest || !eligibleArchers.length">
        {{ t('Send request') }}
      </button>
    </form>

    <template v-if="canDecide">
      <section v-for="group in pendingGroups" :key="group.club.id" class="panel table-panel">
        <div class="heading-row">
          <h2>{{ group.club.name }}</h2>
          <button class="button button-primary" type="button" @click="decide('approve', group.requests)">
            {{ t('Approve all pending') }} ({{ group.requests.length }})
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('ARCHER') }}</th>
                <th>{{ t('EMAIL') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="request in group.requests" :key="request.id">
                <td>{{ archerName(request) }}</td>
                <td>{{ participantFor(request)?.email || '—' }}</td>
                <td class="row-actions">
                  <button class="text-link" type="button" @click="decide('approve', [request])">
                    {{ t('Approve') }}
                  </button>
                  <button class="text-link" type="button" @click="decide('reject', [request])">
                    {{ t('Reject') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p v-if="!pendingGroups.length" class="table-empty">{{ t('No pending requests.') }}</p>
    </template>

    <section class="panel table-panel">
      <h2>{{ canDecide ? t('Decided requests') : t('Your requests') }}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('ARCHER') }}</th>
              <th>{{ t('EMAIL') }}</th>
              <th v-if="canDecide">{{ t('CLUB') }}</th>
              <th>{{ t('STATUS') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in listedRequests" :key="request.id">
              <td>{{ archerName(request) }}</td>
              <td>{{ participantFor(request)?.email || '—' }}</td>
              <td v-if="canDecide">{{ clubName(request) }}</td>
              <td>{{ t(STATUS_LABELS[request.status] || request.status) }}</td>
            </tr>
            <tr v-if="!listedRequests.length">
              <td :colspan="canDecide ? 4 : 3">
                <div class="table-empty">{{ t('No requests yet.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
