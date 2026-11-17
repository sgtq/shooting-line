/**
 * Finds a higher level category of the same bow type that the archer already entered, in any tournament
 * including the one being edited, so an entered archer cannot move down. Categories flagged as exempt
 * from the level order neither block nor get blocked. Mirrors the database trigger, which is the source of truth.
 * @param {{
 *   participantId: string,
 *   category: { bowType: string, sortOrder: number, levelExempt?: boolean },
 *   tournaments: Array<{ categoryAssignments: Record<string, string> }>,
 *   categories: Array<{ id: string, bowType: string, sortOrder: number, levelExempt?: boolean }>,
 * }} input
 * @returns {object | null} The blocking category, or null when the archer may enter.
 */
export function findBlockingCategory({ participantId, category, tournaments, categories }) {
  if (category.levelExempt) return null
  const entered = tournaments.map((tournament) => tournament.categoryAssignments?.[participantId]).filter(Boolean)
  return (
    categories.find(
      (candidate) =>
        entered.includes(candidate.id) &&
        !candidate.levelExempt &&
        candidate.bowType === category.bowType &&
        candidate.sortOrder > category.sortOrder,
    ) || null
  )
}

const ageOrDefault = (age, fallback) => (age === null || age === undefined || age === '' ? fallback : Number(age))

/**
 * Ranks categories within each bow type by minimum age, then maximum age, then list position.
 * Matches the ranking the database migration gives existing categories, for data that has no level order yet.
 * @param {Array<{ id: string, bowType?: string, minAge?: number | string | null, maxAge?: number | string | null }>} categories
 * @returns {Map<string, number>} The level order for each category id, starting at 0 in each bow type.
 */
export function defaultLevelOrders(categories) {
  const orders = new Map()
  const byBowType = Map.groupBy(
    categories.map((category, index) => ({ category, index })),
    ({ category }) => category.bowType || '',
  )
  for (const group of byBowType.values()) {
    group
      .sort(
        (a, b) =>
          ageOrDefault(a.category.minAge, 0) - ageOrDefault(b.category.minAge, 0) ||
          ageOrDefault(a.category.maxAge, 1000) - ageOrDefault(b.category.maxAge, 1000) ||
          a.index - b.index,
      )
      .forEach(({ category }, position) => orders.set(category.id, position))
  }
  return orders
}
