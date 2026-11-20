import { t } from '@shooting-line/i18n'
import { fullName } from './display'
import { firstDay } from './tournamentDates'

/**
 * Round scores and knockout match scores of one archer, newest tournament first.
 * @param {string} participantId
 * @param {{ scores: object[], matches: object[], tournaments: object[], categories: object[], participants: object[] }} data
 * @returns {{ tournamentId: string, tournament?: object, category?: object, round: string, score: number|string,
 * scoreType: string }[]} One row per score.
 */
export function buildScoreRows(participantId, { scores, matches, tournaments, categories, participants }) {
  const tournamentFor = (id) => tournaments.find((event) => event.id === id)
  const categoryFor = (id) => categories.find((category) => category.id === id)

  const roundRows = scores
    .filter((item) => item.participantId === participantId)
    .map((item) => {
      const tournament = tournamentFor(item.tournamentId)
      return {
        ...item,
        tournament,
        category: categoryFor(item.categoryId || tournament?.categoryAssignments?.[item.participantId]),
        scoreType: t('Round score'),
      }
    })

  const matchRows = matches.flatMap((match) => {
    const shooterIsFirst = match.seed1Id === participantId && match.score1 !== ''
    const shooterIsSecond = match.seed2Id === participantId && match.score2 !== ''
    if (!shooterIsFirst && !shooterIsSecond) return []
    const opponentId = shooterIsFirst ? match.seed2Id : match.seed1Id
    const opponent = participants.find((person) => person.id === opponentId) || {
      firstName: t('Unknown'),
      lastName: '',
    }
    return [
      {
        tournamentId: match.tournamentId,
        tournament: tournamentFor(match.tournamentId),
        category: categoryFor(match.categoryId),
        round: `${match.round} ${t('vs')} ${fullName(opponent)}`,
        score: shooterIsFirst ? match.score1 : match.score2,
        scoreType: t('Olympic match'),
      },
    ]
  })

  return [...roundRows, ...matchRows].sort((a, b) =>
    (b.tournament ? firstDay(b.tournament) : '').localeCompare(a.tournament ? firstDay(a.tournament) : ''),
  )
}
