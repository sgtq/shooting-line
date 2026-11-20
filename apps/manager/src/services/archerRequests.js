const OPEN_STATUSES = ['pending', 'approved']

/**
 * @returns {boolean} True when the request still blocks a new one for the same archer.
 */
function isOpen(request) {
  return OPEN_STATUSES.includes(request.status)
}

/**
 * Archers of a club that a request can be made for: they have an email and no pending or approved request.
 * @returns {object[]}
 */
export function requestableArchers(participants, requests, clubId) {
  const blocked = new Set(requests.filter(isOpen).map((request) => request.participantId))
  return participants.filter(
    (person) => person.clubId === clubId && Boolean((person.email || '').trim()) && !blocked.has(person.id),
  )
}

/**
 * Pending requests grouped by club, with clubs in name order and requests in the order they were made.
 * @returns {Array<{ club: object, requests: object[] }>}
 */
export function groupPendingByClub(requests, clubs) {
  const groups = new Map()
  for (const request of requests) {
    if (request.status !== 'pending') continue
    const club = clubs.find((item) => item.id === request.clubId)
    if (!club) continue
    const group = groups.get(club.id) || { club, requests: [] }
    group.requests.push(request)
    groups.set(club.id, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      requests: [...group.requests].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    }))
    .sort((a, b) => a.club.name.localeCompare(b.club.name))
}

/**
 * Splits the results of a decision into the ids that worked and the messages of those that did not.
 * @returns {{ succeededIds: string[], failures: string[] }}
 */
export function summarizeDecision(results) {
  return {
    succeededIds: results.filter((result) => result.ok).map((result) => result.id),
    failures: results.filter((result) => !result.ok).map((result) => result.error || 'Unknown error'),
  }
}
