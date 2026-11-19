import { language, t } from '@shooting-line/i18n'
import { formatMonth as formatMonthName } from './dateFormat'
import { firstDay, isConsecutive, lastDay } from './tournamentDates'

// Values stored in English that have a translation. Other values are user text and are shown as typed.
const TRANSLATED_CHOICES = [
  'Outdoor target',
  'Indoor target',
  'Field',
  'Other',
  'Recurve',
  'Compound',
  'Barebow',
  'Longbow',
  'Traditional',
]

/** @returns {string} Today as YYYY-MM-DD in UTC. */
export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {string} value A date as YYYY-MM-DD.
 * @returns {string} The date in the current language, or a placeholder when there is none.
 */
export function formatDate(value) {
  if (!value) return t('Date to be confirmed')
  return new Intl.DateTimeFormat(language.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

/**
 * @param {{ dates: string[] }} tournament Tournament with its days oldest first.
 * @returns {string} One day, a start to end range for consecutive days, or the first day with a day count.
 */
export function formatDates(tournament) {
  const days = tournament.dates
  if (days.length < 2) return formatDate(days[0])
  return isConsecutive(days)
    ? t('{start} to {end}', { start: formatDate(firstDay(tournament)), end: formatDate(lastDay(tournament)) })
    : t('{start} ({count} days)', { start: formatDate(firstDay(tournament)), count: days.length })
}

/**
 * @param {string} value A date as YYYY-MM-DD.
 * @returns {string} The short month name in the current language.
 */
export function formatMonth(value) {
  return formatMonthName(value, language.value)
}

/**
 * @param {string} value A stored choice such as a discipline or bow type.
 * @returns {string} The translation for a known choice, otherwise the value itself.
 */
export function displayChoice(value) {
  return TRANSLATED_CHOICES.includes(value) ? t(value) : value
}

/**
 * @param {{ firstName: string, lastName: string }} person
 * @returns {string} The first and last name together.
 */
export function fullName(person) {
  return `${person.firstName} ${person.lastName}`
}

/**
 * @param {{ minAge: number|string|null, maxAge: number|string|null, bowType: string }} category
 * @returns {string} The age range and bow type, for example "Age 18+ · Recurve".
 */
export function categoryDescription(category) {
  const hasValue = (value) => value !== null && value !== ''
  let ageRange = t('All ages')
  if (hasValue(category.minAge)) {
    ageRange = t('Age {age}', { age: `${category.minAge}${hasValue(category.maxAge) ? `–${category.maxAge}` : '+'}` })
  } else if (hasValue(category.maxAge)) {
    ageRange = t('Up to age {age}', { age: category.maxAge })
  }
  return [ageRange, category.bowType ? displayChoice(category.bowType) : t('Any bow type')].join(' · ')
}

/**
 * @param {{ birthDate: string }} participant
 * @param {{ dates: string[] }} tournament
 * @returns {number|null} The age on the first day of the tournament, or null when unknown.
 */
export function ageAtTournament(participant, tournament) {
  const startDay = firstDay(tournament)
  if (!participant.birthDate || !startDay) return null
  const birthDate = new Date(`${participant.birthDate}T00:00:00Z`)
  const eventDate = new Date(`${startDay}T00:00:00Z`)
  const years = eventDate.getUTCFullYear() - birthDate.getUTCFullYear()
  const birthdayHasPassed =
    eventDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (eventDate.getUTCMonth() === birthDate.getUTCMonth() && eventDate.getUTCDate() >= birthDate.getUTCDate())
  return years - (birthdayHasPassed ? 0 : 1)
}

/**
 * @param {string} userName The signed-in user's name, or an empty string.
 * @param {number} hour The hour of the day, 0 to 23.
 * @returns {string} A greeting for the time of day, such as "Good morning, Ana".
 */
export function greetingFor(userName, hour) {
  const salutation = t(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
  return `${salutation}, ${userName || t('there')}`
}

/**
 * @param {{ venueMode: string, customAddress: string, clubId: string }|undefined} tournament
 * @param {{ id: string, address: string }[]} clubs
 * @returns {string} The custom address, or the hosting club's address, or a note that none is set.
 */
export function venueFor(tournament, clubs) {
  if (!tournament) return ''
  if (tournament.venueMode === 'custom') return tournament.customAddress
  return clubs.find((club) => club.id === tournament.clubId)?.address || t('Club address not set')
}
