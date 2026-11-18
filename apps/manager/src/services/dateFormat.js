/**
 * @param {string} value A date as YYYY-MM-DD.
 * @returns {number|''} The day of the month, or an empty string for no date.
 */
export function dayOfMonth(value) {
  return value ? new Date(`${value}T00:00:00Z`).getUTCDate() : ''
}

/**
 * @param {string} value A date as YYYY-MM-DD.
 * @param {string} locale A language tag such as `en` or `es-419`.
 * @returns {string} The short month name in that language, or an empty string for no date.
 */
export function formatMonth(value, locale) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
