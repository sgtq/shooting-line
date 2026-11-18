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
 * Average round score for each category the archer has scores in. Scores of different categories and bow types are
 * not comparable, so they are never mixed. Inside one category, rounds with a different number of ends are not
 * comparable either, so that category is split by ends and `showEnds` is true on its lines.
 * @returns {Array<{ category: string, ends: number|null, showEnds: boolean, rounds: number, average: number }>}
 * Named categories first by name, then rows with no category. The category is an empty string when there is none.
 */
export function averageByCategory(rows) {
  const groups = new Map()
  const endsByCategory = new Map()
  for (const row of rows) {
    for (const round of row.rounds) {
      const ends = round.ends ?? null
      const key = `${row.category}|${ends}`
      const group = groups.get(key) || { category: row.category, ends, rounds: 0, sum: 0 }
      group.rounds += 1
      group.sum += round.score
      groups.set(key, group)
      endsByCategory.set(row.category, new Set(endsByCategory.get(row.category)).add(ends))
    }
  }
  return [...groups.values()]
    .sort((a, b) => {
      if (Boolean(a.category) !== Boolean(b.category)) return a.category ? -1 : 1
      return a.category.localeCompare(b.category) || (a.ends ?? 0) - (b.ends ?? 0)
    })
    .map(({ category, ends, rounds, sum }) => ({
      category,
      ends,
      showEnds: endsByCategory.get(category).size > 1 && ends !== null,
      rounds,
      average: Math.round((sum / rounds) * 100) / 100,
    }))
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

/**
 * A map link is stored as free text, so only web links are made clickable. Anything else, such as a
 * `javascript:` link, is dropped.
 * @param {string} value
 * @returns {string} The link when it is a web address, or an empty string.
 */
export function safeMapUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

/**
 * @param {Array<{ name: string, bowType: string }>} categories
 * @returns {Array<{ bowType: string, names: string[] }>} Categories grouped by bow type, ordered by name.
 */
export function groupCategoriesByBow(categories) {
  const groups = new Map()
  for (const category of categories) {
    const names = groups.get(category.bowType) || []
    names.push(category.name)
    groups.set(category.bowType, names)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bowType, names]) => ({ bowType, names: names.sort((a, b) => a.localeCompare(b)) }))
}
