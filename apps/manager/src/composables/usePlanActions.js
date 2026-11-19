import { storeToRefs } from 'pinia'
import { makeId } from '../services/ids'
import { findOverlappingSubscription } from '../services/planRules'
import { useManagerStore } from '../stores/managerStore'

/**
 * Saves for the plans catalogue, plan prices, and the plans given to accounts.
 * @param {{ repository: object, notify: (message: string) => void }} context
 * @returns {{
 *   savePlan: (plan: object) => Promise<void>,
 *   savePlanPrice: (price: object) => Promise<void>,
 *   saveSubscription: (subscription: object) => Promise<void>,
 *   setSubscriptionEnd: (change: { subscription: object, endsOn: string }) => Promise<void>,
 *   removeSubscription: (subscription: object) => Promise<void>,
 * }} The save functions the Plans page calls.
 */
export function usePlanActions({ repository, notify }) {
  const store = useManagerStore()
  const { data } = storeToRefs(store)

  /**
   * @param {object} plan A new or changed plan.
   * @returns {Promise<void>}
   */
  async function savePlan(plan) {
    const saved = {
      ...plan,
      id: plan.id || makeId(),
      userRole: plan.userRole ?? 'club',
      isActive: plan.isActive ?? true,
    }
    await store.persistChange(
      () => repository.savePlan(saved),
      () => {
        data.value.plans ??= []
        const index = data.value.plans.findIndex((item) => item.id === saved.id)
        if (index === -1) data.value.plans.push(saved)
        else data.value.plans[index] = saved
      },
    )
  }

  /**
   * @param {object} price A new price for a plan. Old prices are kept as history.
   * @returns {Promise<void>}
   */
  async function savePlanPrice(price) {
    const saved = { ...price, id: makeId() }
    const wasSaved = await store.persistChange(
      () => repository.savePlanPrice(saved),
      () => {
        data.value.planPrices ??= []
        data.value.planPrices.push(saved)
      },
    )
    if (wasSaved) notify('Price saved')
  }

  /**
   * @param {object} subscription A plan given to an account for a period.
   * @returns {Promise<void>}
   */
  async function saveSubscription(subscription) {
    if (findOverlappingSubscription(data.value.subscriptions ?? [], subscription)) {
      notify('This account already has a plan during these dates')
      return
    }
    const saved = { ...subscription, id: makeId() }
    const wasSaved = await store.persistChange(
      () => repository.saveSubscription(saved),
      () => {
        data.value.subscriptions ??= []
        data.value.subscriptions.push(saved)
      },
    )
    if (wasSaved) notify('Plan assigned')
  }

  /**
   * @param {{ subscription: { id: string }, endsOn: string }} change
   * @returns {Promise<void>}
   */
  async function setSubscriptionEnd({ subscription, endsOn }) {
    const wasSaved = await store.persistChange(
      () => repository.updateSubscriptionEnd(subscription.id, endsOn),
      () => {
        const saved = data.value.subscriptions.find((item) => item.id === subscription.id)
        if (saved) saved.endsOn = endsOn
      },
    )
    if (wasSaved) notify('End date saved')
  }

  /**
   * @param {{ id: string }} subscription
   * @returns {Promise<void>}
   */
  async function removeSubscription(subscription) {
    await store.persistChange(
      () => repository.removeSubscription(subscription.id),
      () => {
        data.value.subscriptions = data.value.subscriptions.filter((item) => item.id !== subscription.id)
      },
    )
  }

  return { savePlan, savePlanPrice, saveSubscription, setSubscriptionEnd, removeSubscription }
}
