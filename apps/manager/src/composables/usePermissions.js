import { computed } from 'vue'
import { activeSubscription, todayString } from '../services/planRules'

/**
 * What the signed-in user may do. The database enforces the same rules, so these only decide what the
 * screens offer.
 * @param {{ userRole: string, userId: string, userScope: { clubId?: string } }} session The signed-in user.
 * @param {import('vue').Ref<{ subscriptions?: object[], userRoles?: object[] }>} data The workspace data.
 * @param {import('vue').Ref<{ clubId: string, startedAt?: string }|undefined>} selectedTournament
 * @returns {object} Role flags, permission flags, and permission checks for a club or an archer.
 */
export function usePermissions(session, data, selectedTournament) {
  const canManage = computed(() => ['admin', 'manager'].includes(session.userRole))
  const isAdmin = computed(() => session.userRole === 'admin')
  const isClubUser = computed(() => session.userRole === 'club')
  // Clubs can create tournaments only while they hold an active plan.
  const clubHasActivePlan = computed(() =>
    Boolean(activeSubscription(data.value.subscriptions ?? [], session.userId, todayString())),
  )
  // A club without an active plan can read but cannot change anything.
  const canClubEdit = computed(() => isClubUser.value && clubHasActivePlan.value)
  const canCreateTournament = computed(
    () => canManage.value || (isClubUser.value && Boolean(session.userScope.clubId) && clubHasActivePlan.value),
  )
  // Clubs can read every tournament but change only their own, and only until it is started. A manager can
  // always change a tournament, and is the only one who can reopen a started one.
  const canEditTournament = computed(
    () =>
      canManage.value ||
      Boolean(
        canClubEdit.value &&
        selectedTournament.value?.clubId === session.userScope.clubId &&
        !selectedTournament.value.startedAt,
      ),
  )
  const canStartTournament = computed(() => !selectedTournament.value?.startedAt && canEditTournament.value)
  const showPlanNotice = computed(() => isClubUser.value && !canManage.value && !clubHasActivePlan.value)
  const planAccounts = computed(() =>
    (data.value.userRoles ?? [])
      .filter((item) => ['club', 'archer'].includes(item.role))
      .map(({ userId, email, role }) => ({ userId, email, role })),
  )
  const canManageParticipants = computed(
    () => canManage.value || (canClubEdit.value && Boolean(session.userScope.clubId)),
  )
  // Only users who may change data search for archers, so a club without an active plan never reaches the database.
  const canSearchArchers = computed(() => canManage.value || canClubEdit.value)

  /**
   * @param {{ id: string }} club
   * @returns {boolean} True when the user may edit this club.
   */
  function canEditClub(club) {
    return canManage.value || (canClubEdit.value && club.id === session.userScope.clubId)
  }

  /**
   * @param {{ clubId: string }} person
   * @returns {boolean} True when the user may edit this archer.
   */
  function canEditParticipant(person) {
    return canManage.value || (canClubEdit.value && person.clubId === session.userScope.clubId)
  }

  return {
    canManage,
    isAdmin,
    isClubUser,
    clubHasActivePlan,
    canClubEdit,
    canCreateTournament,
    canEditTournament,
    canStartTournament,
    showPlanNotice,
    planAccounts,
    canManageParticipants,
    canSearchArchers,
    canEditClub,
    canEditParticipant,
  }
}
