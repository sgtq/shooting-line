import { firstDay, lastDay } from './tournamentDates'

/**
 * @param {{ dates: string[] }[]} tournaments
 * @returns {object[]} A copy sorted by first day, earliest first.
 */
export function sortByFirstDay(tournaments) {
  return [...tournaments].sort((a, b) => firstDay(a).localeCompare(firstDay(b)))
}

/**
 * A tournament counts as upcoming until its last day has passed.
 * @param {{ dates: string[] }[]} sorted Tournaments sorted by first day.
 * @param {string} today Today as YYYY-MM-DD.
 * @returns {object|undefined} The first tournament that has not finished.
 */
export function findNextTournament(sorted, today) {
  return sorted.find((item) => lastDay(item) >= today)
}

/**
 * @param {{ name: string, dates: string[] }[]} sorted Tournaments sorted by first day.
 * @param {{ query: string, status: 'upcoming'|'past', today: string }} options
 * @returns {object[]} Tournaments whose name contains the query and that are past or not, as asked.
 */
export function filterTournaments(sorted, { query, status, today }) {
  const needle = query.toLowerCase()
  return sorted.filter((tournament) => {
    const isPast = lastDay(tournament) < today
    return tournament.name.toLowerCase().includes(needle) && (status === 'past' ? isPast : !isPast)
  })
}
