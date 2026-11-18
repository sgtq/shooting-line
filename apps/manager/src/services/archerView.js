import { isConsecutive } from './tournamentDates.js'

/**
 * @param {string} value A date as YYYY-MM-DD, or an empty string.
 * @param {string} from Range start, or an empty string for no start.
 * @param {string} to Range end, or an empty string for no end.
 * @returns {boolean} True when the date is inside the range, ends included.
 */
export function isInRange(value, from, to) {
  if (from && value < from) return false
  if (to && value > to) return false
  return true
}

/**
 * Own score of one knockout match, or an empty string when it is not entered yet.
 * @returns {number|''}
 */
function ownMatchScore(match, participantId) {
  return match.seed1Id === participantId ? match.score1 : match.score2
}

/**
 * Round scores and knockout matches of the archer's tournaments that have started, newest first. Only the
 * archer's own rows are used, so another archer's score or name never reaches the rows.
 * A tournament is listed from its first day, so scores of one that is still under way are visible.
 * @returns {Array<{
 *   id: string, name: string, dates: string[], firstDay: string, lastDay: string, category: string,
 *   rounds: Array<{ name: string, score: number, ends: number|null }>,
 *   matches: Array<{ round: string, score: number|'' }>,
 *   total: number
 * }>}
 */
export function buildScoreRows({ data, participantId, today, from = '', to = '' }) {
  const rows = []
  for (const tournament of data.tournaments) {
    if (!tournament.participantIds.includes(participantId)) continue
    const first = tournament.dates[0] || ''
    if (!first || first > today || !isInRange(first, from, to)) continue

    const type = data.tournamentTypes.find((item) => item.id === tournament.tournamentTypeId)
    const rounds = data.scores
      .filter((score) => score.tournamentId === tournament.id && score.participantId === participantId)
      .map((score) => ({ name: score.round, score: score.score, ends: type?.ends ?? null }))
    const matches = data.matches
      .filter(
        (match) =>
          match.tournamentId === tournament.id && (match.seed1Id === participantId || match.seed2Id === participantId),
      )
      .map((match) => ({ round: match.round, score: ownMatchScore(match, participantId) }))
    const categoryId = tournament.categoryAssignments[participantId]
    rows.push({
      id: tournament.id,
      name: tournament.name,
      dates: tournament.dates,
      firstDay: first,
      lastDay: tournament.dates[tournament.dates.length - 1],
      category: data.categories.find((item) => item.id === categoryId)?.name || '',
      rounds,
      matches,
      total: rounds.reduce((sum, round) => sum + round.score, 0),
    })
  }
  return rows.sort((a, b) => b.firstDay.localeCompare(a.firstDay) || a.name.localeCompare(b.name))
}

/**
 * Average round score for each ends count. Rounds with a different number of ends are never mixed, because
 * their scores are not comparable. Rounds whose ends are unknown, such as knockout matches, are left out.
 * @returns {Array<{ ends: number, rounds: number, average: number }>} Fewest ends first.
 */
export function averageByEnds(rows) {
  const groups = new Map()
  for (const row of rows) {
    for (const round of row.rounds) {
      if (!round.ends) continue
      const group = groups.get(round.ends) || { ends: round.ends, rounds: 0, sum: 0 }
      group.rounds += 1
      group.sum += round.score
      groups.set(round.ends, group)
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.ends - b.ends)
    .map(({ ends, rounds, sum }) => ({ ends, rounds, average: Math.round((sum / rounds) * 100) / 100 }))
}

/**
 * @param {string[]} days Days oldest first.
 * @returns {string} One day, a range such as `2026-06-10 - 2026-06-12`, or a comma list when days have gaps.
 */
export function formatDays(days) {
  if (!days.length) return ''
  if (days.length === 1) return days[0]
  if (isConsecutive(days)) return `${days[0]} - ${days[days.length - 1]}`
  return days.join(', ')
}
