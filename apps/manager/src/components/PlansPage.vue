<script setup>
import { language, t } from '@shooting-line/i18n'
import { computed, ref, watch } from 'vue'
import { activeSubscription, currentPrice, suggestedEndDate, todayString } from '../services/planRules'

const props = defineProps({
  plans: { type: Array, required: true },
  prices: { type: Array, required: true },
  subscriptions: { type: Array, required: true },
  // Club and archer accounts that can be given a plan: { userId, email, role }.
  accounts: { type: Array, required: true },
  error: { type: String, default: '' },
})

const emit = defineEmits([
  'save-plan',
  'save-price',
  'save-subscription',
  'set-subscription-end',
  'remove-subscription',
])

// Prices are in Mexican pesos only.
const CURRENCY = 'MXN'
const DURATION_LABELS = { monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom range', unlimited: 'No end date' }
const ROLE_LABELS = { club: 'Club', archer: 'Archer' }

const planForm = ref({ name: '', userRole: 'club', durationKind: 'monthly' })
const priceForm = ref({ planId: '', amount: '', startsAt: todayString(), endsAt: '' })
const subscriptionForm = ref({
  userId: '',
  planId: '',
  startsOn: todayString(),
  endsOn: '',
  price: '',
})

const endDrafts = ref({})

const selectedAccount = computed(
  () => props.accounts.find((account) => account.userId === subscriptionForm.value.userId) || null,
)
// An account can only be given a plan made for its own role.
const assignablePlans = computed(() =>
  props.plans.filter(
    (plan) => plan.isActive && (!selectedAccount.value || plan.userRole === selectedAccount.value.role),
  ),
)
const selectedPlan = computed(() => props.plans.find((plan) => plan.id === subscriptionForm.value.planId) || null)
const isCustomRange = computed(() => selectedPlan.value?.durationKind === 'custom')
const hasNoEndDate = computed(() => selectedPlan.value?.durationKind === 'unlimited')

function formatMoney(amount) {
  return new Intl.NumberFormat(language.value, { style: 'currency', currency: CURRENCY }).format(amount)
}

function priceLabel(plan) {
  const price = currentPrice(props.prices, plan.id, todayString())
  return price ? formatMoney(price.amount) : t('No price set')
}

function planName(planId) {
  return props.plans.find((plan) => plan.id === planId)?.name || ''
}

function accountEmail(userId) {
  return props.accounts.find((account) => account.userId === userId)?.email || ''
}

// A plan made for another role cannot stay selected after the account changes.
watch(
  () => subscriptionForm.value.userId,
  () => {
    if (selectedPlan.value && !assignablePlans.value.includes(selectedPlan.value)) {
      subscriptionForm.value.planId = ''
      subscriptionForm.value.endsOn = ''
      subscriptionForm.value.price = ''
    }
  },
)

// The end date and price follow the chosen plan and start date, and the manager can still change both.
watch(
  () => [subscriptionForm.value.planId, subscriptionForm.value.startsOn],
  () => {
    const plan = selectedPlan.value
    if (!plan) return
    subscriptionForm.value.endsOn = suggestedEndDate(plan.durationKind, subscriptionForm.value.startsOn)
    const price = currentPrice(props.prices, plan.id, subscriptionForm.value.startsOn)
    subscriptionForm.value.price = price ? String(price.amount) : ''
  },
)

function submitPlan() {
  const { name, userRole, durationKind } = planForm.value
  emit('save-plan', { name: name.trim(), userRole, durationKind })
  planForm.value = { name: '', userRole, durationKind: 'monthly' }
}

function submitPrice() {
  const form = priceForm.value
  emit('save-price', {
    planId: form.planId,
    amount: Number(form.amount),
    currency: CURRENCY,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
  })
  priceForm.value = { ...form, amount: '', endsAt: '' }
}

function submitSubscription() {
  const form = subscriptionForm.value
  emit('save-subscription', {
    userId: form.userId,
    planId: form.planId,
    startsOn: form.startsOn,
    endsOn: form.endsOn,
    pricePaid: Number(form.price),
    currency: CURRENCY,
  })
}

function submitEndDate(subscription) {
  const endsOn = endDrafts.value[subscription.id]
  if (!endsOn) return
  emit('set-subscription-end', { subscription, endsOn })
  delete endDrafts.value[subscription.id]
}

function periodLabel(subscription) {
  return `${subscription.startsOn} – ${subscription.endsOn || t('No end date')}`
}

function subscriptionStatus(subscription) {
  const today = todayString()
  if (subscription.endsOn && subscription.endsOn < today) return t('Expired')
  if (subscription.startsOn > today) return t('Scheduled')
  return t('Active')
}

function accountLabel(account) {
  const active = hasActivePlan(account.userId) ? ` (${t('Active')})` : ''
  return `${account.email} (${roleLabel(account.role)})${active}`
}

function roleLabel(role) {
  return t(ROLE_LABELS[role] || role)
}

function hasActivePlan(userId) {
  return Boolean(activeSubscription(props.subscriptions, userId, todayString()))
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('ACCOUNT MANAGEMENT') }}</p>
        <h1>{{ t('Plans') }}</h1>
        <p class="page-subtitle">{{ t('Set plan prices and give clubs and archers access.') }}</p>
      </div>
    </div>
    <p v-if="error" class="database-error" role="alert">{{ error }}</p>

    <section class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('PLAN') }}</th>
              <th>{{ t('ROLE') }}</th>
              <th>{{ t('DURATION') }}</th>
              <th>{{ t('CURRENT PRICE') }}</th>
              <th>{{ t('STATUS') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plan in plans" :key="plan.id">
              <td>{{ plan.name }}</td>
              <td>{{ roleLabel(plan.userRole) }}</td>
              <td>{{ t(DURATION_LABELS[plan.durationKind]) }}</td>
              <td>{{ priceLabel(plan) }}</td>
              <td>{{ plan.isActive ? t('Active') : t('Inactive') }}</td>
              <td class="row-actions">
                <button class="text-link" @click="emit('save-plan', { ...plan, isActive: !plan.isActive })">
                  {{ plan.isActive ? t('Deactivate') : t('Activate') }}
                </button>
              </td>
            </tr>
            <tr v-if="!plans.length">
              <td colspan="6">
                <div class="table-empty">{{ t('No plans yet.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <form class="panel plan-form" @submit.prevent="submitPlan">
      <h2>{{ t('Add a plan') }}</h2>
      <div class="form-grid">
        <label class="form-field"
          ><span>{{ t('PLAN NAME') }} <b>*</b></span
          ><input v-model="planForm.name" required :placeholder="t('e.g. Club monthly')"
        /></label>
        <label class="form-field"
          ><span>{{ t('ROLE') }} <b>*</b></span
          ><select v-model="planForm.userRole">
            <option v-for="(label, role) in ROLE_LABELS" :key="role" :value="role">{{ t(label) }}</option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('DURATION') }} <b>*</b></span
          ><select v-model="planForm.durationKind">
            <option v-for="(label, kind) in DURATION_LABELS" :key="kind" :value="kind">{{ t(label) }}</option>
          </select></label
        >
      </div>
      <button class="button button-primary" type="submit">{{ t('Add plan') }}</button>
    </form>

    <form class="panel plan-form" @submit.prevent="submitPrice">
      <h2>{{ t('Set a price') }}</h2>
      <p class="page-subtitle">
        {{ t('A price with an end date works as a deal. The regular price applies again after it ends.') }}
      </p>
      <div class="form-grid">
        <label class="form-field"
          ><span>{{ t('PLAN') }} <b>*</b></span
          ><select v-model="priceForm.planId" required>
            <option value="" disabled>{{ t('Select a plan') }}</option>
            <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('AMOUNT') }} (MXN) <b>*</b></span
          ><input v-model="priceForm.amount" required type="number" min="0" step="0.01"
        /></label>
        <label class="form-field"
          ><span>{{ t('VALID FROM') }} <b>*</b></span
          ><input v-model="priceForm.startsAt" required type="date"
        /></label>
        <label class="form-field"
          ><span
            >{{ t('VALID UNTIL') }} <small>{{ t('OPTIONAL') }}</small></span
          ><input v-model="priceForm.endsAt" type="date" :min="priceForm.startsAt"
        /></label>
      </div>
      <button class="button button-primary" type="submit">{{ t('Save price') }}</button>
    </form>

    <form class="panel plan-form" @submit.prevent="submitSubscription">
      <h2>{{ t('Give an account a plan') }}</h2>
      <div class="form-grid">
        <label class="form-field"
          ><span>{{ t('ACCOUNT') }} <b>*</b></span
          ><select v-model="subscriptionForm.userId" required>
            <option value="" disabled>{{ t('Select an account') }}</option>
            <option v-for="account in accounts" :key="account.userId" :value="account.userId">
              {{ accountLabel(account) }}
            </option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('PLAN') }} <b>*</b></span
          ><select v-model="subscriptionForm.planId" required>
            <option value="" disabled>{{ t('Select a plan') }}</option>
            <option v-for="plan in assignablePlans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('VALID FROM') }} <b>*</b></span
          ><input v-model="subscriptionForm.startsOn" required type="date"
        /></label>
        <label class="form-field"
          ><span
            >{{ t('VALID UNTIL') }} <b v-if="!hasNoEndDate">*</b><small v-else>{{ t('OPTIONAL') }}</small></span
          ><input
            v-model="subscriptionForm.endsOn"
            :required="!hasNoEndDate"
            type="date"
            :min="subscriptionForm.startsOn"
            :aria-describedby="isCustomRange ? 'custom-range-hint' : undefined"
          />
          <small v-if="isCustomRange" id="custom-range-hint">{{ t('Pick the last day of the range.') }}</small>
          <small v-if="hasNoEndDate">{{
            t('Leave empty so the plan never ends. A manager can set a date later.')
          }}</small></label
        >
        <label class="form-field"
          ><span>{{ t('PRICE CHARGED') }} (MXN) <b>*</b></span
          ><input v-model="subscriptionForm.price" required type="number" min="0" step="0.01"
        /></label>
      </div>
      <button class="button button-primary" type="submit">{{ t('Assign plan') }}</button>
    </form>

    <section class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('ACCOUNT') }}</th>
              <th>{{ t('PLAN') }}</th>
              <th>{{ t('PERIOD') }}</th>
              <th>{{ t('PRICE CHARGED') }} (MXN)</th>
              <th>{{ t('STATUS') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="subscription in subscriptions" :key="subscription.id">
              <td>{{ accountEmail(subscription.userId) || subscription.userId }}</td>
              <td>{{ planName(subscription.planId) }}</td>
              <td>{{ periodLabel(subscription) }}</td>
              <td>{{ formatMoney(subscription.pricePaid) }}</td>
              <td>{{ subscriptionStatus(subscription) }}</td>
              <td class="row-actions">
                <template v-if="!subscription.endsOn">
                  <input
                    v-model="endDrafts[subscription.id]"
                    type="date"
                    :min="subscription.startsOn"
                    :aria-label="t('End date')"
                  />
                  <button
                    class="text-link"
                    type="button"
                    :disabled="!endDrafts[subscription.id]"
                    @click="submitEndDate(subscription)"
                  >
                    {{ t('Set end date') }}
                  </button>
                </template>
                <button class="text-link" @click="emit('remove-subscription', subscription)">{{ t('Remove') }}</button>
              </td>
            </tr>
            <tr v-if="!subscriptions.length">
              <td colspan="6">
                <div class="table-empty">{{ t('No account has a plan yet.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
