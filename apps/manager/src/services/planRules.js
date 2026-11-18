/**
 * Plan dates are plain `YYYY-MM-DD` strings. Comparing them as text keeps the result independent of the
 * viewer's time zone, which a `Date` comparison would not.
 */

/**
 * Today as `YYYY-MM-DD` in the viewer's local calendar.
 * @returns {string}
 */
export function todayString() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * The price in force for a plan on a day. The latest start wins, so a deal overrides the base price.
 * @param {Array<{ planId: string, startsAt: string, endsAt: string }>} prices
 * @param {string} planId
 * @param {string} today
 * @returns {object | null}
 */
export function currentPrice(prices, planId, today) {
  const covering = prices.filter(
    (price) => price.planId === planId && price.startsAt <= today && (!price.endsAt || price.endsAt >= today),
  )
  if (!covering.length) return null
  return covering.reduce((latest, price) => (price.startsAt > latest.startsAt ? price : latest))
}

/**
 * The subscription that covers a day for a user, or null when the user has none.
 * @param {Array<{ userId: string, startsOn: string, endsOn: string }>} subscriptions
 * @param {string} userId
 * @param {string} today
 * @returns {object | null}
 */
export function activeSubscription(subscriptions, userId, today) {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.userId === userId && subscription.startsOn <= today && subscription.endsOn >= today,
    ) || null
  )
}

/**
 * A subscription of the same user whose days share at least one day with the given range. Both end dates are
 * covered days, so ranges that only touch on one day overlap. Mirrors the database constraint.
 * @param {Array<{ userId: string, startsOn: string, endsOn: string }>} subscriptions
 * @param {{ userId: string, startsOn: string, endsOn: string }} range
 * @returns {object | null}
 */
export function findOverlappingSubscription(subscriptions, { userId, startsOn, endsOn }) {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.userId === userId && subscription.startsOn <= endsOn && subscription.endsOn >= startsOn,
    ) || null
  )
}

/**
 * Suggested last day for a plan that starts on `startsOn`: one month or one year later, minus a day.
 * A month shorter than the start day (31 Jan + 1 month) ends on that month's last day.
 * Custom plans have no suggestion because the manager picks the end date.
 * @param {'monthly' | 'yearly' | 'custom'} durationKind
 * @param {string} startsOn
 * @returns {string} The suggested end date, or an empty string for custom plans.
 */
export function suggestedEndDate(durationKind, startsOn) {
  if (durationKind === 'custom') return ''
  const [year, month, day] = startsOn.split('-').map(Number)
  const monthsToAdd = durationKind === 'yearly' ? 12 : 1
  const target = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1))
  const lastDayOfTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDayOfTarget)))
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
}
