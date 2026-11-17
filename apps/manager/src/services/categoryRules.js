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
