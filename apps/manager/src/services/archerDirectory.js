/**
 * @param {{ firstName: string, lastName: string, waId?: string, aetayId?: string }[]} participants
 * @param {string} term What the user typed.
 * @returns {object[]} The archers whose name or affiliation id contains the term, or all of them for a blank term.
 */
export function filterArchers(participants, term) {
  const needle = term.trim().toLowerCase()
  if (!needle) return participants
  return participants.filter((person) =>
    [person.firstName, person.lastName, person.waId, person.aetayId]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle)),
  )
}

/**
 * Round scores and knockout match scores both count. A match counts once for an archer, whichever side they shot.
 * @param {string} participantId
 * @param {{ participantId: string }[]} scores Round scores.
 * @param {{ seed1Id: string, seed2Id: string, score1: number|string, score2: number|string }[]} matches
 * @returns {number} How many scores the archer has.
 */
export function countScores(participantId, scores, matches) {
  const roundScores = scores.filter((item) => item.participantId === participantId)
  const matchScores = matches.filter(
    (match) =>
      (match.seed1Id === participantId && match.score1 !== '') ||
      (match.seed2Id === participantId && match.score2 !== ''),
  )
  return roundScores.length + matchScores.length
}
