/** Club filter value for archers who have no club. */
export const UNASSIGNED_CLUB = '__unassigned__'

/**
 * @param {{ clubId?: string }} person
 * @param {string} clubFilter A club id, UNASSIGNED_CLUB, or an empty string for every club.
 * @returns {boolean} True when the archer passes the club filter.
 */
function matchesClub(person, clubFilter) {
  if (!clubFilter) return true
  if (clubFilter === UNASSIGNED_CLUB) return !person.clubId
  return person.clubId === clubFilter
}

/**
 * @param {object[]} participants Every archer.
 * @param {string[]} enteredIds Ids of the archers entered in the tournament.
 * @param {{ clubId: string, query: string }} filters
 * @returns {object[]} Entered archers in the chosen club whose last name or affiliation id contains the query.
 */
export function filterRoster(participants, enteredIds, { clubId, query }) {
  const needle = query.trim().toLowerCase()
  return participants.filter((person) => {
    if (!enteredIds.includes(person.id) || !matchesClub(person, clubId)) return false
    if (!needle) return true
    return [person.lastName, person.waId, person.aetayId]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle))
  })
}

/**
 * @param {object[]} participants Every archer.
 * @param {string[]} enteredIds Ids of the archers entered in the tournament.
 * @param {string} clubId The club filter.
 * @returns {string[]} The distinct last names and affiliation ids to suggest while typing.
 */
export function rosterSearchOptions(participants, enteredIds, clubId) {
  const values = participants
    .filter((person) => enteredIds.includes(person.id) && matchesClub(person, clubId))
    .flatMap((person) => [person.lastName, person.waId, person.aetayId])
    .filter(Boolean)
  return [...new Set(values)]
}
