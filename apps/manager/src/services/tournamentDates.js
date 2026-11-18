export const MAX_TOURNAMENT_DAYS = 31

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * @param {string} day ISO day, for example 2026-03-15.
 * @returns {number} Milliseconds at midnight UTC, or NaN when the day is not a real date.
 */
function toTime(day) {
  if (!DAY_PATTERN.test(day)) return NaN
  const time = Date.parse(`${day}T00:00:00Z`)
  // Date.parse rolls 2026-02-31 over to March, so a round trip tells a real day from an invalid one.
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== day ? NaN : time
}

/**
 * Lists every day from start to end, both included. Returns an empty list when the range is not usable.
 * @param {string} start First day.
 * @param {string} end Last day.
 * @returns {string[]} ISO days in order.
 */
export function expandRange(start, end) {
  const first = toTime(start)
  const last = toTime(end)
  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return []
  const days = Math.round((last - first) / MS_PER_DAY) + 1
  // Past the limit the list is not used, so building thousands of rows is skipped.
  if (days > MAX_TOURNAMENT_DAYS) return []
  return Array.from({ length: days }, (_, index) => new Date(first + index * MS_PER_DAY).toISOString().slice(0, 10))
}

/**
 * @param {string[]} days Days in the order the user entered them.
 * @returns {string[]} The days without blanks or repeats, oldest first.
 */
export function normalizeDays(days) {
  return [...new Set(days.filter(Boolean))].sort()
}

/**
 * Checks the days of a tournament. The returned text is an English message key for t().
 * @param {string[]} days Days in the order the user entered them.
 * @returns {string} The first problem found, or an empty string when the days are valid.
 */
export function validateDays(days) {
  const filled = days.filter(Boolean)
  if (!filled.length) return 'Add at least one tournament date'
  if (filled.some((day) => Number.isNaN(toTime(day)))) return 'Enter valid tournament dates'
  if (new Set(filled).size !== filled.length) return 'Tournament dates cannot repeat'
  if (filled.length > MAX_TOURNAMENT_DAYS) return 'A tournament can last at most 31 days'
  return ''
}

/**
 * Checks a start and end day.
 * @param {string} start First day.
 * @param {string} end Last day.
 * @returns {string} The first problem found as an English message key, or an empty string when valid.
 */
export function validateRange(start, end) {
  if (!start || !end) return 'Add at least one tournament date'
  if (Number.isNaN(toTime(start)) || Number.isNaN(toTime(end))) return 'Enter valid tournament dates'
  if (toTime(end) < toTime(start)) return 'The end date cannot be before the start date'
  if (!expandRange(start, end).length) return 'A tournament can last at most 31 days'
  return ''
}

/**
 * @param {{ dates: string[] }} tournament Tournament with its days oldest first.
 * @returns {string} First day, or an empty string when there are none.
 */
export function firstDay(tournament) {
  return tournament.dates[0] || ''
}

/**
 * @param {{ dates: string[] }} tournament Tournament with its days oldest first.
 * @returns {string} Last day, or an empty string when there are none.
 */
export function lastDay(tournament) {
  return tournament.dates[tournament.dates.length - 1] || ''
}
