import { t } from '@shooting-line/i18n'
import { findBlockingCategory } from './categoryRules'
import { ageAtTournament, fullName } from './display'

/**
 * @param {{ minAge: number|string|null, maxAge: number|string|null }} category
 * @param {number} age
 * @returns {'below'|'above'|''} Which age limit the age breaks, if any.
 */
function ageProblem(category, age) {
  const hasValue = (value) => value !== null && value !== ''
  if (hasValue(category.minAge) && age < category.minAge) return 'below'
  if (hasValue(category.maxAge) && age > category.maxAge) return 'above'
  return ''
}

/**
 * The database enforces the level rule too. This only explains the refusal before the call.
 * @param {object} tournament The tournament the archer would enter.
 * @param {{ id: string, firstName: string, lastName: string, birthDate?: string }} participant
 * @param {object} category The category being chosen.
 * @param {{ tournaments: object[], categories: object[] }} data All tournaments and categories, for the level rule.
 * @returns {string} The reason the archer cannot enter the category, or an empty string.
 */
export function categoryBlockReason(tournament, participant, category, { tournaments, categories }) {
  const age = ageAtTournament(participant, tournament)
  const problem = age === null ? '' : ageProblem(category, age)
  if (problem === 'below') {
    return t("{name} is below this category's minimum age", { name: fullName(participant) })
  }
  if (problem === 'above') {
    return t("{name} is above this category's maximum age", { name: fullName(participant) })
  }
  const blocking = findBlockingCategory({ participantId: participant.id, category, tournaments, categories })
  return blocking ? t('Already entered {category}, a higher level', { category: blocking.name }) : ''
}

/**
 * @param {object} tournament
 * @param {{ id: string }} participant An archer already entered in the tournament.
 * @param {{ tournaments: object[], categories: object[] }} data
 * @returns {object[]} The tournament's categories the archer may move to, other than the current one.
 */
export function categoryChangeOptions(tournament, participant, data) {
  const currentId = tournament.categoryAssignments[participant.id]
  return tournament.categoryIds
    .filter((categoryId) => categoryId !== currentId)
    .map((categoryId) => data.categories.find((category) => category.id === categoryId))
    .filter((category) => category && !categoryBlockReason(tournament, participant, category, data))
}
