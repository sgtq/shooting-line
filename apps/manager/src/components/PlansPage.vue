<script setup>
import { language, t } from '@shooting-line/i18n'
import { computed, ref, watch } from 'vue'
import { activeSubscription, currentPrice, suggestedEndDate, todayString } from '../services/planRules'

const props = defineProps({
  plans: { type: Array, required: true },
  prices: { type: Array, required: true },
  subscriptions: { type: Array, required: true },
  // Club accounts that can be given a plan: { userId, email }.
  clubUsers: { type: Array, required: true },
  error: { type: String, default: '' },
})

const emit = defineEmits(['save-plan', 'save-price', 'save-subscription', 'remove-subscription'])

// Prices are in Mexican pesos only.
const CURRENCY = 'MXN'
const DURATION_LABELS = { monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom range' }

const planForm = ref({ name: '', durationKind: 'monthly' })
const priceForm = ref({ planId: '', amount: '', startsAt: todayString(), endsAt: '' })
const subscriptionForm = ref({
  userId: '',
  planId: '',
  startsOn: todayString(),
  endsOn: '',
  price: '',
})

const activePlans = computed(() => props.plans.filter((plan) => plan.isActive))
const selectedPlan = computed(() => props.plans.find((plan) => plan.id === subscriptionForm.value.planId) || null)
const isCustomRange = computed(() => selectedPlan.value?.durationKind === 'custom')

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

function clubUserEmail(userId) {
  return props.clubUsers.find((user) => user.userId === userId)?.email || ''
}

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
  emit('save-plan', { name: planForm.value.name.trim(), durationKind: planForm.value.durationKind })
  planForm.value = { name: '', durationKind: 'monthly' }
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

function subscriptionStatus(subscription) {
  const today = todayString()
  if (subscription.endsOn < today) return t('Expired')
  if (subscription.startsOn > today) return t('Scheduled')
  return t('Active')
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
        <p class="page-subtitle">{{ t('Set plan prices and give clubs access to create tournaments.') }}</p>
      </div>
    </div>
    <p v-if="error" class="database-error" role="alert">{{ error }}</p>

    <section class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('PLAN') }}</th>
              <th>{{ t('DURATION') }}</th>
              <th>{{ t('CURRENT PRICE') }}</th>
              <th>{{ t('STATUS') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plan in plans" :key="plan.id">
              <td>{{ plan.name }}</td>
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
              <td colspan="5">
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
      <h2>{{ t('Give a club a plan') }}</h2>
      <div class="form-grid">
        <label class="form-field"
          ><span>{{ t('CLUB ACCOUNT') }} <b>*</b></span
          ><select v-model="subscriptionForm.userId" required>
            <option value="" disabled>{{ t('Select a club account') }}</option>
            <option v-for="user in clubUsers" :key="user.userId" :value="user.userId">
              {{ user.email }}{{ hasActivePlan(user.userId) ? ` (${t('Active')})` : '' }}
            </option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('PLAN') }} <b>*</b></span
          ><select v-model="subscriptionForm.planId" required>
            <option value="" disabled>{{ t('Select a plan') }}</option>
            <option v-for="plan in activePlans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ t('VALID FROM') }} <b>*</b></span
          ><input v-model="subscriptionForm.startsOn" required type="date"
        /></label>
        <label class="form-field"
          ><span>{{ t('VALID UNTIL') }} <b>*</b></span
          ><input
            v-model="subscriptionForm.endsOn"
            required
            type="date"
            :min="subscriptionForm.startsOn"
            :aria-describedby="isCustomRange ? 'custom-range-hint' : undefined"
          />
          <small v-if="isCustomRange" id="custom-range-hint">{{ t('Pick the last day of the range.') }}</small></label
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
              <th>{{ t('CLUB ACCOUNT') }}</th>
              <th>{{ t('PLAN') }}</th>
              <th>{{ t('PERIOD') }}</th>
              <th>{{ t('PRICE CHARGED') }} (MXN)</th>
              <th>{{ t('STATUS') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="subscription in subscriptions" :key="subscription.id">
              <td>{{ clubUserEmail(subscription.userId) || subscription.userId }}</td>
              <td>{{ planName(subscription.planId) }}</td>
              <td>{{ subscription.startsOn }} – {{ subscription.endsOn }}</td>
              <td>{{ formatMoney(subscription.pricePaid) }}</td>
              <td>{{ subscriptionStatus(subscription) }}</td>
              <td class="row-actions">
                <button class="text-link" @click="emit('remove-subscription', subscription)">{{ t('Remove') }}</button>
              </td>
            </tr>
            <tr v-if="!subscriptions.length">
              <td colspan="6">
                <div class="table-empty">{{ t('No club has a plan yet.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
