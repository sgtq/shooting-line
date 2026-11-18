import { requestPasswordReset } from '@shooting-line/auth'
import { normalizeDays } from './tournamentDates.js'

function throwOnError({ error }) {
  if (error) throw error
}

function mapClub(row) {
  return {
    id: row.id,
    name: row.name,
    representative: row.representative,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    mapUrl: row.map_url,
    logoUrl: row.logo_url || '',
    userEmail: row.user_email,
    userEnabled: row.user_enabled,
  }
}

function mapParticipant(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date || '',
    waId: row.wa_id,
    aetayId: row.aetay_id,
    email: row.email || '',
    clubId: row.club_id || '',
  }
}

function mapTournamentType(row) {
  return {
    id: row.id,
    name: row.name,
    distance: Number(row.distance),
    distanceUnit: row.distance_unit,
    targetType: row.target_type,
    ends: row.ends,
    arrowsPerEnd: row.arrows_per_end,
  }
}

function mapTargetType(row) {
  return {
    id: row.id,
    name: row.name,
  }
}

/**
 * An archer known only by name. Other clubs' archers reach a club this way, so birth date and affiliation IDs
 * stay empty and the row is left out of the archer directory and its pickers.
 * @returns {object}
 */
function mapNameOnlyParticipant(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: '',
    waId: '',
    aetayId: '',
    clubId: row.club_id || '',
    nameOnly: true,
  }
}

/**
 * @returns {object}
 */
function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    userRole: row.user_role,
    durationKind: row.duration_kind,
    isActive: row.is_active,
  }
}

/**
 * @returns {object}
 */
function mapPlanPrice(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    amount: Number(row.amount),
    currency: row.currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at || '',
  }
}

/**
 * @returns {object}
 */
function mapSubscription(row) {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on || '',
    pricePaid: Number(row.price_paid),
    currency: row.currency,
  }
}

/**
 * @returns {object}
 */
function mapArcherRequest(row) {
  return {
    id: row.id,
    participantId: row.participant_id,
    clubId: row.club_id,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapUserRole(row) {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    clubId: row.club_id || '',
    participantId: row.participant_id || '',
  }
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    minAge: row.min_age,
    maxAge: row.max_age,
    bowType: row.bow_type,
    sortOrder: row.sort_order,
    levelExempt: row.level_exempt,
  }
}

export function readLegacyWorkspace() {
  const saved =
    localStorage.getItem('shooting-line-workspace-v1') ?? localStorage.getItem('archery-manager-workspace-v1')
  if (!saved) return null

  let workspace
  try {
    workspace = JSON.parse(saved)
  } catch (error) {
    throw new Error(`Saved browser data could not be parsed: ${error.message}`, { cause: error })
  }
  if (!workspace || typeof workspace !== 'object') {
    throw new Error('Saved browser data has an invalid workspace format.')
  }

  return {
    clubs: Array.isArray(workspace.clubs) ? workspace.clubs : [],
    participants: Array.isArray(workspace.participants)
      ? workspace.participants.map((participant) => ({ ...participant, clubId: participant.clubId || '' }))
      : [],
    tournamentTypes: Array.isArray(workspace.tournamentTypes) ? workspace.tournamentTypes : [],
    categories: Array.isArray(workspace.categories) ? workspace.categories : [],
    tournaments: Array.isArray(workspace.tournaments)
      ? workspace.tournaments.map((tournament) => ({
          ...tournament,
          rounds: Array.isArray(tournament.rounds) ? tournament.rounds : ['Qualification'],
          participantIds: Array.isArray(tournament.participantIds) ? tournament.participantIds : [],
          categoryIds: Array.isArray(tournament.categoryIds) ? tournament.categoryIds : [],
          categoryAssignments: tournament.categoryAssignments || {},
        }))
      : [],
    scores: Array.isArray(workspace.scores) ? workspace.scores : [],
    matches: Array.isArray(workspace.matches) ? workspace.matches : [],
  }
}

export function createManagerRepository(client) {
  const roundIds = new Map()

  function roundKey(tournamentId, roundName) {
    return `${tournamentId}:${roundName}`
  }

  async function load({ includeUserRoles = false } = {}) {
    const tableNames = [
      'clubs',
      'participants',
      'tournament_types',
      'target_types',
      'categories',
      'tournaments',
      'tournament_dates',
      'tournament_rounds',
      'tournament_categories',
      'tournament_participants',
      'round_scores',
      'matches',
      'plans',
      'plan_prices',
      'user_subscriptions',
      'archer_requests',
    ]
    if (includeUserRoles) tableNames.push('user_roles')
    const [namesResult, ...results] = await Promise.all([
      client.rpc('visible_participant_names'),
      ...tableNames.map((table) => client.from(table).select('*')),
    ])
    throwOnError(namesResult)
    results.forEach(throwOnError)
    const [
      clubsResult,
      participantsResult,
      typesResult,
      targetTypesResult,
      categoriesResult,
      tournamentsResult,
      datesResult,
      roundsResult,
      tournamentCategoriesResult,
      tournamentParticipantsResult,
      scoresResult,
      matchesResult,
      plansResult,
      planPricesResult,
      subscriptionsResult,
      archerRequestsResult,
      userRolesResult,
    ] = results

    roundIds.clear()
    const roundsByTournament = new Map()
    const roundsById = new Map()
    for (const round of roundsResult.data) {
      roundIds.set(roundKey(round.tournament_id, round.name), round.id)
      roundsById.set(round.id, round)
      const tournamentRounds = roundsByTournament.get(round.tournament_id) || []
      tournamentRounds.push(round)
      roundsByTournament.set(round.tournament_id, tournamentRounds)
    }

    const datesByTournament = new Map()
    for (const entry of datesResult.data) {
      const days = datesByTournament.get(entry.tournament_id) || []
      days.push(entry.day)
      datesByTournament.set(entry.tournament_id, days)
    }

    const participantsByTournament = new Map()
    const categoryAssignmentsByTournament = new Map()
    for (const entry of tournamentParticipantsResult.data) {
      const participantIds = participantsByTournament.get(entry.tournament_id) || []
      participantIds.push(entry.participant_id)
      participantsByTournament.set(entry.tournament_id, participantIds)

      const assignments = categoryAssignmentsByTournament.get(entry.tournament_id) || {}
      if (entry.category_id) assignments[entry.participant_id] = entry.category_id
      categoryAssignmentsByTournament.set(entry.tournament_id, assignments)
    }

    const categoryIdsByTournament = new Map()
    for (const entry of tournamentCategoriesResult.data) {
      const categoryIds = categoryIdsByTournament.get(entry.tournament_id) || []
      categoryIds.push(entry.category_id)
      categoryIdsByTournament.set(entry.tournament_id, categoryIds)
    }

    return {
      clubs: clubsResult.data.map(mapClub),
      // Full records win. Name-only rows fill in archers the user may not read in full.
      participants: [
        ...participantsResult.data.map(mapParticipant),
        ...(namesResult.data ?? [])
          .filter((row) => !participantsResult.data.some((full) => full.id === row.id))
          .map(mapNameOnlyParticipant),
      ],
      tournamentTypes: typesResult.data.map(mapTournamentType),
      targetTypes: targetTypesResult.data.map(mapTargetType),
      categories: categoriesResult.data.map(mapCategory),
      tournaments: tournamentsResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        dates: (datesByTournament.get(row.id) || []).sort(),
        discipline: row.discipline,
        tournamentTypeId: row.tournament_type_id,
        clubId: row.club_id || '',
        venueMode: row.venue_mode,
        customAddress: row.custom_address,
        startedAt: row.started_at || '',
        rounds: (roundsByTournament.get(row.id) || [])
          .sort((a, b) => a.position - b.position)
          .map((round) => round.name),
        participantIds: participantsByTournament.get(row.id) || [],
        categoryIds: categoryIdsByTournament.get(row.id) || [],
        categoryAssignments: categoryAssignmentsByTournament.get(row.id) || {},
      })),
      scores: scoresResult.data.map((row) => ({
        tournamentId: row.tournament_id,
        participantId: row.participant_id,
        round: roundsById.get(row.round_id)?.name || '',
        categoryId: row.category_id || '',
        score: Number(row.score),
      })),
      matches: matchesResult.data.map((row) => ({
        id: row.id,
        tournamentId: row.tournament_id,
        sourceRound: roundsById.get(row.source_round_id)?.name || '',
        categoryId: row.category_id || '',
        round: row.round,
        seed1Id: row.seed1_id,
        seed2Id: row.seed2_id,
        seed1: row.seed1,
        seed2: row.seed2,
        score1: row.score1 === null ? '' : Number(row.score1),
        score2: row.score2 === null ? '' : Number(row.score2),
      })),
      plans: plansResult.data.map(mapPlan),
      planPrices: planPricesResult.data.map(mapPlanPrice),
      subscriptions: subscriptionsResult.data.map(mapSubscription),
      archerRequests: archerRequestsResult.data.map(mapArcherRequest),
      userRoles: userRolesResult ? userRolesResult.data.map(mapUserRole) : [],
    }
  }

  async function importLegacyWorkspace(workspace) {
    const remapIds = (rows) =>
      new Map(
        rows.map((row) => [
          row.id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) ? row.id : makeId(),
        ]),
      )
    const clubIds = remapIds(workspace.clubs)
    const participantIds = remapIds(workspace.participants)
    const typeIds = remapIds(workspace.tournamentTypes)
    const categoryIds = remapIds(workspace.categories)
    const tournamentIds = remapIds(workspace.tournaments)
    const roundMap = new Map()
    const getRoundId = (tournamentId, roundName) => {
      const key = `${tournamentId}:${roundName}`
      if (!roundMap.has(key)) roundMap.set(key, makeId())
      return roundMap.get(key)
    }

    const payload = {
      clubs: workspace.clubs.map((club) => ({
        id: clubIds.get(club.id),
        name: club.name,
        representative: club.representative || '',
        phone: club.phone || '',
        email: club.email || '',
        website: club.website || '',
        address: club.address || '',
        map_url: club.mapUrl || '',
        user_email: club.userEmail || '',
        user_enabled: Boolean(club.userEnabled),
      })),
      participants: workspace.participants.map((participant) => ({
        id: participantIds.get(participant.id),
        first_name: participant.firstName,
        last_name: participant.lastName,
        birth_date: participant.birthDate || null,
        wa_id: participant.waId || '',
        aetay_id: participant.aetayId || '',
        club_id: clubIds.get(participant.clubId) || null,
      })),
      tournament_types: workspace.tournamentTypes.map((type) => ({
        id: typeIds.get(type.id),
        name: type.name,
        distance: Number(type.distance),
        distance_unit: type.distanceUnit,
        target_type: type.targetType,
        ends: Number(type.ends),
        arrows_per_end: Number(type.arrowsPerEnd),
      })),
      categories: workspace.categories.map((category) => ({
        id: categoryIds.get(category.id),
        name: category.name,
        min_age: category.minAge === '' ? null : category.minAge,
        max_age: category.maxAge === '' ? null : category.maxAge,
        bow_type: category.bowType || '',
        // Browser data from before level orders has no sortOrder. The database then ranks the category.
        sort_order: category.sortOrder,
        level_exempt: Boolean(category.levelExempt),
      })),
      tournaments: workspace.tournaments.map((tournament) => ({
        id: tournamentIds.get(tournament.id),
        name: tournament.name,
        discipline: tournament.discipline || '',
        tournament_type_id: typeIds.get(tournament.tournamentTypeId) || null,
        club_id: clubIds.get(tournament.clubId) || null,
        venue_mode: tournament.venueMode || 'club',
        custom_address: tournament.customAddress || '',
      })),
      tournament_dates: workspace.tournaments.flatMap((tournament) =>
        // Browser data from before multi-day tournaments holds a single date.
        normalizeDays(tournament.dates ?? [tournament.date]).map((day) => ({
          tournament_id: tournamentIds.get(tournament.id),
          day,
        })),
      ),
      tournament_rounds: workspace.tournaments.flatMap((tournament) =>
        tournament.rounds.map((name, position) => ({
          id: getRoundId(tournament.id, name),
          tournament_id: tournamentIds.get(tournament.id),
          name,
          position,
        })),
      ),
      tournament_categories: workspace.tournaments.flatMap((tournament) =>
        tournament.categoryIds.map((categoryId) => ({
          tournament_id: tournamentIds.get(tournament.id),
          category_id: categoryIds.get(categoryId),
        })),
      ),
      tournament_participants: workspace.tournaments.flatMap((tournament) =>
        tournament.participantIds.map((participantId) => ({
          tournament_id: tournamentIds.get(tournament.id),
          participant_id: participantIds.get(participantId),
          category_id: categoryIds.get(tournament.categoryAssignments[participantId]) || null,
        })),
      ),
      round_scores: workspace.scores.map((score) => {
        const tournamentId = tournamentIds.get(score.tournamentId)
        const roundId = getRoundId(score.tournamentId, score.round)
        if (
          !workspace.tournaments
            .find((tournament) => tournament.id === score.tournamentId)
            ?.rounds.includes(score.round)
        ) {
          throw new Error(`Cannot import a score for missing round "${score.round}".`)
        }
        return {
          tournament_id: tournamentId,
          round_id: roundId,
          participant_id: participantIds.get(score.participantId),
          category_id: categoryIds.get(score.categoryId) || null,
          score: Number(score.score),
        }
      }),
      matches: workspace.matches.map((match) => {
        const tournament = workspace.tournaments.find((item) => item.id === match.tournamentId)
        const sourceRound = match.sourceRound || tournament?.rounds[0]
        if (!tournament || !tournament.rounds.includes(sourceRound)) {
          throw new Error(`Cannot import a match for missing round "${sourceRound}".`)
        }
        return {
          id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match.id)
            ? match.id
            : makeId(),
          tournament_id: tournamentIds.get(match.tournamentId),
          source_round_id: getRoundId(match.tournamentId, sourceRound),
          category_id: categoryIds.get(match.categoryId) || null,
          round: match.round,
          seed1_id: participantIds.get(match.seed1Id),
          seed2_id: participantIds.get(match.seed2Id),
          seed1: match.seed1,
          seed2: match.seed2,
          score1: match.score1 === '' ? null : Number(match.score1),
          score2: match.score2 === '' ? null : Number(match.score2),
        }
      }),
    }

    const { error } = await client.rpc('import_manager_workspace', { p_workspace: payload })
    if (error) throw error
  }

  async function saveClub(club, { syncUserAccess = false, hadUserEnabled = false } = {}) {
    if (!syncUserAccess) {
      const { error } = await client
        .from('clubs')
        .update({
          name: club.name,
          representative: club.representative,
          phone: club.phone,
          email: club.email,
          website: club.website,
          address: club.address,
          map_url: club.mapUrl,
          logo_url: club.logoUrl || '',
        })
        .eq('id', club.id)
      if (error) throw error
      return
    }

    const clubEmail = (club.email || club.userEmail || '').trim()
    const shouldEnable = Boolean(club.userEnabled && clubEmail)
    // One RPC so a failed account reassignment also rolls back the club details.
    const { error } = await client.rpc('save_club_with_access', {
      p_id: club.id,
      p_name: club.name,
      p_representative: club.representative,
      p_phone: club.phone,
      p_email: club.email,
      p_website: club.website,
      p_address: club.address,
      p_map_url: club.mapUrl,
      p_logo_url: club.logoUrl || '',
      p_user_email: clubEmail,
      p_enabled: shouldEnable,
      p_sync_access: shouldEnable || hadUserEnabled,
    })
    if (error) throw error
  }

  async function uploadClubLogo(clubId, file) {
    const { error } = await client.storage.from('club-logos').upload(`${clubId}/logo`, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })
    if (error) throw error

    return client.storage.from('club-logos').getPublicUrl(`${clubId}/logo`).data.publicUrl
  }

  async function assignUserRole(role) {
    const { data, error } = await client.rpc('assign_user_role', {
      p_email: role.email,
      p_role: role.role,
      p_club_id: role.clubId || null,
      p_participant_id: role.participantId || null,
      p_display_name: role.displayName || null,
    })
    if (error) throw error
    return data
  }

  async function removeUserRole(userId, role) {
    const { error } = await client.rpc('remove_user_role', {
      p_user_id: userId,
      p_role: role,
    })
    if (error) throw error
  }

  /** @returns {Promise<void>} */
  async function savePlan(plan) {
    const { error } = await client.from('plans').upsert({
      id: plan.id,
      name: plan.name,
      user_role: plan.userRole,
      duration_kind: plan.durationKind,
      is_active: plan.isActive,
    })
    if (error) throw error
  }

  /** @returns {Promise<void>} */
  async function savePlanPrice(price) {
    const { error } = await client.from('plan_prices').insert({
      id: price.id,
      plan_id: price.planId,
      amount: price.amount,
      currency: price.currency,
      starts_at: price.startsAt,
      ends_at: price.endsAt || null,
    })
    if (error) throw error
  }

  /** @returns {Promise<void>} */
  async function saveSubscription(subscription) {
    const { error } = await client.from('user_subscriptions').insert({
      id: subscription.id,
      user_id: subscription.userId,
      plan_id: subscription.planId,
      starts_on: subscription.startsOn,
      ends_on: subscription.endsOn || null,
      price_paid: subscription.pricePaid,
      currency: subscription.currency,
    })
    if (error) throw error
  }

  /**
   * Finds archers while the user types in the add-archer form. Each match carries a one-time token and no
   * database ID. Matches are name and club only.
   * @returns {Promise<Array<{ token: string, firstName: string, lastName: string, clubId: string }>>}
   */
  async function searchArchers({ affiliationId = '', lastName = '', firstName = '', tournamentId = '' } = {}) {
    const { data, error } = await client.rpc('search_archers', {
      p_affiliation_id: affiliationId || null,
      p_last_name: lastName || null,
      p_first_name: firstName || null,
      p_tournament_id: tournamentId || null,
    })
    if (error) throw error
    return data.map((row) => ({
      token: row.token,
      firstName: row.first_name,
      lastName: row.last_name,
      clubId: row.club_id || '',
    }))
  }

  /** @returns {Promise<object>} The archer as a name-only record. */
  async function addArcherByToken(tournamentId, token, categoryId = '') {
    const { data, error } = await client.rpc('add_archer_by_token', {
      p_tournament_id: tournamentId,
      p_token: token,
      p_category_id: categoryId || null,
    })
    if (error) throw error
    return mapNameOnlyParticipant(data[0])
  }

  /** @returns {Promise<void>} */
  async function setTournamentStarted(tournamentId, startedAt) {
    const { error } = await client
      .from('tournaments')
      .update({ started_at: startedAt || null })
      .eq('id', tournamentId)
    if (error) throw error
  }

  /**
   * Sets the last day of a subscription, for example to end one that had no end date.
   * @returns {Promise<void>}
   */
  async function updateSubscriptionEnd(subscriptionId, endsOn) {
    const { error } = await client.from('user_subscriptions').update({ ends_on: endsOn }).eq('id', subscriptionId)
    if (error) throw error
  }

  /** @returns {Promise<void>} */
  async function removeSubscription(subscriptionId) {
    const { error } = await client.from('user_subscriptions').delete().eq('id', subscriptionId)
    if (error) throw error
  }

  async function saveUserProfile(userId, displayName) {
    const { error } = await client.from('user_profiles').upsert({
      user_id: userId,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  }

  async function sendOwnPasswordReset(email) {
    const { error } = await requestPasswordReset(client, email)
    if (error) throw error
  }

  async function sendAdminPasswordReset(email) {
    const { error } = await client.functions.invoke('admin-password-reset', {
      body: { email },
    })
    if (!error) return

    if (error.context instanceof Response) {
      const payload = await error.context.json()
      if (payload.error) throw new Error(payload.error)
    }
    throw error
  }

  /** @returns {Promise<void>} */
  async function createArcherRequest(request) {
    const { error } = await client.from('archer_requests').insert({
      id: request.id,
      participant_id: request.participantId,
      club_id: request.clubId,
    })
    if (error) throw error
  }

  /**
   * Approves or rejects requests in the edge function, which creates the logins.
   * @returns {Promise<Array<{ id: string, ok: boolean, error?: string }>>} One result per request.
   */
  async function decideArcherRequests(action, requestIds) {
    const { data, error } = await client.functions.invoke('decide-archer-requests', {
      body: { action, requestIds },
    })
    if (error) {
      if (error.context instanceof Response) {
        const payload = await error.context.json()
        if (payload.error) throw new Error(payload.error)
      }
      throw error
    }
    return data.results
  }

  async function saveTournamentType(type) {
    const { error } = await client.from('tournament_types').upsert({
      id: type.id,
      name: type.name,
      distance: type.distance,
      distance_unit: type.distanceUnit,
      target_type: type.targetType,
      ends: type.ends,
      arrows_per_end: type.arrowsPerEnd,
    })
    if (error) throw error
  }

  async function saveTargetType(type) {
    const { error } = await client.from('target_types').insert({
      id: type.id,
      name: type.name,
    })
    if (error) throw error
  }

  async function saveCategory(category) {
    const { error } = await client.from('categories').upsert({
      id: category.id,
      name: category.name,
      min_age: category.minAge,
      max_age: category.maxAge,
      bow_type: category.bowType,
      sort_order: category.sortOrder,
      level_exempt: category.levelExempt,
    })
    if (error) throw error
  }

  /**
   * Deletes a half-created tournament so a failed save leaves nothing behind, then rethrows the original error.
   * @param {string} tournamentId Tournament to remove.
   * @param {Error} cause The error that stopped the save.
   * @returns {Promise<never>} Always throws.
   */
  async function removeTournamentAfterFailure(tournamentId, cause) {
    const { error: cleanupError } = await client.from('tournaments').delete().eq('id', tournamentId)
    if (cleanupError) {
      throw new Error(`${cause.message}; cleanup also failed: ${cleanupError.message}`)
    }
    throw cause
  }

  async function saveTournament(tournament) {
    const { error: tournamentError } = await client.from('tournaments').insert({
      id: tournament.id,
      name: tournament.name,
      discipline: tournament.discipline,
      tournament_type_id: tournament.tournamentTypeId || null,
      club_id: tournament.clubId || null,
      venue_mode: tournament.venueMode,
      custom_address: tournament.customAddress,
    })
    if (tournamentError) throw tournamentError

    const { error: datesError } = await client
      .from('tournament_dates')
      .insert(normalizeDays(tournament.dates).map((day) => ({ tournament_id: tournament.id, day })))
    if (datesError) await removeTournamentAfterFailure(tournament.id, datesError)

    const roundId = makeId()
    const { error: roundError } = await client.from('tournament_rounds').insert({
      id: roundId,
      tournament_id: tournament.id,
      name: 'Qualification',
      position: 0,
    })
    if (roundError) await removeTournamentAfterFailure(tournament.id, roundError)
    roundIds.set(roundKey(tournament.id, 'Qualification'), roundId)
  }

  // New days go in first so the tournament never has none if the second step fails.
  async function saveTournamentDates(tournamentId, dates) {
    const days = normalizeDays(dates)
    if (!days.length) throw new Error('A tournament needs at least one day')
    const { error: insertError } = await client.from('tournament_dates').upsert(
      days.map((day) => ({ tournament_id: tournamentId, day })),
      { onConflict: 'tournament_id,day', ignoreDuplicates: true },
    )
    if (insertError) throw insertError

    const { error: deleteError } = await client
      .from('tournament_dates')
      .delete()
      .eq('tournament_id', tournamentId)
      .not('day', 'in', `(${days.join(',')})`)
    if (deleteError) throw deleteError
  }

  async function saveParticipant(participant, tournamentId = '', isEditing = false, categoryId = '') {
    const payload = {
      first_name: participant.firstName,
      last_name: participant.lastName,
      birth_date: participant.birthDate || null,
      wa_id: participant.waId,
      aetay_id: participant.aetayId,
      email: (participant.email || '').trim(),
      club_id: participant.clubId || null,
    }
    if (isEditing) {
      const { error } = await client.from('participants').update(payload).eq('id', participant.id)
      if (error) throw error
      return
    }

    const { error } = await client.from('participants').insert({
      id: participant.id,
      ...payload,
    })
    if (error) throw error

    if (tournamentId) {
      const { error: assignmentError } = await client.from('tournament_participants').insert({
        tournament_id: tournamentId,
        participant_id: participant.id,
        category_id: categoryId || null,
      })
      if (assignmentError) {
        const { error: cleanupError } = await client.from('participants').delete().eq('id', participant.id)
        if (cleanupError) {
          throw new Error(`${assignmentError.message}; cleanup also failed: ${cleanupError.message}`)
        }
        throw assignmentError
      }
    }
  }

  async function setParticipantClub(participantId, clubId) {
    const { error } = await client
      .from('participants')
      .update({ club_id: clubId || null })
      .eq('id', participantId)
    if (error) throw error
  }

  async function setClubEnabled(clubId, enabled) {
    const { error } = await client.rpc('set_club_user_access', {
      p_club_id: clubId,
      p_enabled: enabled,
    })
    if (error) throw error
  }

  async function setTournamentCategory(tournamentId, categoryId, enabled) {
    const { error } = await client.rpc('set_tournament_category', {
      p_tournament_id: tournamentId,
      p_category_id: categoryId,
      p_enabled: enabled,
    })
    if (error) throw error
  }

  async function setParticipantCategory(tournamentId, participantId, categoryId) {
    const { error } = await client
      .from('tournament_participants')
      .update({ category_id: categoryId || null })
      .eq('tournament_id', tournamentId)
      .eq('participant_id', participantId)
    if (error) throw error
  }

  async function addTournamentRound(tournamentId, roundName, position) {
    const id = makeId()
    const { error } = await client.from('tournament_rounds').insert({
      id,
      tournament_id: tournamentId,
      name: roundName,
      position,
    })
    if (error) throw error
    roundIds.set(roundKey(tournamentId, roundName), id)
  }

  async function setTournamentParticipant(tournamentId, participantId, included, categoryId = '') {
    if (included) {
      const { error } = await client.from('tournament_participants').upsert({
        tournament_id: tournamentId,
        participant_id: participantId,
        category_id: categoryId || null,
      })
      if (error) throw error
      return
    }

    const { error } = await client
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('participant_id', participantId)
    if (error) throw error
  }

  async function saveScore(score) {
    const roundId = roundIds.get(roundKey(score.tournamentId, score.round))
    if (!roundId) throw new Error(`Could not find round "${score.round}" in the database.`)

    if (score.score === null) {
      const { error } = await client
        .from('round_scores')
        .delete()
        .eq('round_id', roundId)
        .eq('participant_id', score.participantId)
      if (error) throw error
      return
    }

    const { error } = await client.from('round_scores').upsert({
      tournament_id: score.tournamentId,
      round_id: roundId,
      participant_id: score.participantId,
      category_id: score.categoryId || null,
      score: score.score,
    })
    if (error) throw error
  }

  async function replaceMatches(tournamentId, sourceRound, categoryId, matches) {
    const sourceRoundId = roundIds.get(roundKey(tournamentId, sourceRound))
    if (!sourceRoundId) throw new Error(`Could not find round "${sourceRound}" in the database.`)

    const { error } = await client.rpc('replace_first_round_matches', {
      p_tournament_id: tournamentId,
      p_source_round_id: sourceRoundId,
      p_category_id: categoryId || null,
      p_matches: matches.map((match) => ({
        id: match.id,
        round: match.round,
        seed1_id: match.seed1Id,
        seed2_id: match.seed2Id,
        seed1: match.seed1,
        seed2: match.seed2,
      })),
    })
    if (error) throw error
  }

  async function setMatchScore(matchId, side, value) {
    if (side !== 'score1' && side !== 'score2') throw new Error('Invalid match score side.')
    const score = value === '' ? null : Number(value)
    const { error } = await client
      .from('matches')
      .update({ [side]: score })
      .eq('id', matchId)
    if (error) throw error
  }

  /**
   * The tournament calendar for an archer, from a database function so no table policy is widened.
   * @returns {Promise<object[]>}
   */
  async function loadUpcomingTournaments() {
    const { data, error } = await client.rpc('upcoming_tournaments')
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      days: row.days ?? [],
      discipline: row.discipline || '',
      tournamentType: row.tournament_type || '',
      hostClub: row.host_club || '',
      address: row.address || '',
      categories: row.categories ?? [],
      isEntered: Boolean(row.is_entered),
    }))
  }

  return {
    load,
    loadUpcomingTournaments,
    importLegacyWorkspace,
    saveClub,
    uploadClubLogo,
    assignUserRole,
    removeUserRole,
    savePlan,
    savePlanPrice,
    saveSubscription,
    updateSubscriptionEnd,
    removeSubscription,
    setTournamentStarted,
    searchArchers,
    addArcherByToken,
    saveUserProfile,
    sendAdminPasswordReset,
    createArcherRequest,
    decideArcherRequests,
    sendOwnPasswordReset,
    saveTournamentType,
    saveTargetType,
    saveCategory,
    saveTournament,
    saveTournamentDates,
    saveParticipant,
    setParticipantClub,
    setClubEnabled,
    setTournamentCategory,
    addTournamentRound,
    setParticipantCategory,
    setTournamentParticipant,
    saveScore,
    replaceMatches,
    setMatchScore,
  }
}

function makeId() {
  return crypto.randomUUID()
}
