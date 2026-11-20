import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePermissions } from './usePermissions'

const activePlan = { userId: 'u1', startsOn: '2000-01-01', endsOn: null }
const endedPlan = { userId: 'u1', startsOn: '2000-01-01', endsOn: '2000-12-31' }

function build(role, { subscriptions = [], clubId = 'club-1', tournament } = {}) {
  const session = { userRole: role, userId: 'u1', userScope: { clubId } }
  const data = ref({ subscriptions, userRoles: [] })
  return usePermissions(session, data, ref(tournament))
}

describe('usePermissions', () => {
  it('lets managers and admins do everything without a plan', () => {
    for (const role of ['manager', 'admin']) {
      const p = build(role)
      expect(p.canManage.value).toBe(true)
      expect(p.canCreateTournament.value).toBe(true)
      expect(p.canEditClub({ id: 'other' })).toBe(true)
      expect(p.canEditParticipant({ clubId: 'other' })).toBe(true)
      expect(p.canSearchArchers.value).toBe(true)
    }
    expect(build('admin').isAdmin.value).toBe(true)
    expect(build('manager').isAdmin.value).toBe(false)
  })

  it('lets a club with an active plan edit only its own records', () => {
    const p = build('club', { subscriptions: [activePlan] })
    expect(p.clubHasActivePlan.value).toBe(true)
    expect(p.canCreateTournament.value).toBe(true)
    expect(p.canEditClub({ id: 'club-1' })).toBe(true)
    expect(p.canEditClub({ id: 'club-2' })).toBe(false)
    expect(p.canEditParticipant({ clubId: 'club-1' })).toBe(true)
    expect(p.canEditParticipant({ clubId: 'club-2' })).toBe(false)
    expect(p.canSearchArchers.value).toBe(true)
    expect(p.showPlanNotice.value).toBe(false)
  })

  it('makes a club without an active plan read only and shows the plan notice', () => {
    for (const subscriptions of [[], [endedPlan]]) {
      const p = build('club', { subscriptions })
      expect(p.clubHasActivePlan.value).toBe(false)
      expect(p.canCreateTournament.value).toBe(false)
      expect(p.canEditClub({ id: 'club-1' })).toBe(false)
      expect(p.canManageParticipants.value).toBe(false)
      expect(p.canSearchArchers.value).toBe(false)
      expect(p.showPlanNotice.value).toBe(true)
    }
  })

  it('does not let a club without a club id create tournaments', () => {
    const p = build('club', { subscriptions: [activePlan], clubId: '' })
    expect(p.canCreateTournament.value).toBe(false)
    expect(p.canManageParticipants.value).toBe(false)
  })

  it('lets a club change only its own tournament, and only until it starts', () => {
    const subscriptions = [activePlan]
    const own = build('club', { subscriptions, tournament: { clubId: 'club-1' } })
    expect(own.canEditTournament.value).toBe(true)
    expect(own.canStartTournament.value).toBe(true)

    const started = build('club', { subscriptions, tournament: { clubId: 'club-1', startedAt: '2026-01-01' } })
    expect(started.canEditTournament.value).toBe(false)
    expect(started.canStartTournament.value).toBe(false)

    expect(build('club', { subscriptions, tournament: { clubId: 'club-2' } }).canEditTournament.value).toBe(false)
    expect(build('club', { subscriptions }).canEditTournament.value).toBe(false)
  })

  it('lets a manager reopen a started tournament but not start it again', () => {
    const p = build('manager', { tournament: { clubId: 'x', startedAt: '2026-01-01' } })
    expect(p.canEditTournament.value).toBe(true)
    expect(p.canStartTournament.value).toBe(false)
  })

  it('gives archers no edit rights', () => {
    const p = build('archer', { subscriptions: [activePlan] })
    expect(p.canManage.value).toBe(false)
    expect(p.canEditClub({ id: 'club-1' })).toBe(false)
    expect(p.canCreateTournament.value).toBe(false)
  })

  it('lists only club and archer accounts for plans', () => {
    const session = { userRole: 'manager', userId: 'm', userScope: {} }
    const data = ref({
      userRoles: [
        { userId: 'a', email: 'a@x.test', role: 'club', extra: 1 },
        { userId: 'b', email: 'b@x.test', role: 'manager' },
        { userId: 'c', email: 'c@x.test', role: 'archer' },
      ],
    })
    const { planAccounts } = usePermissions(session, data, ref())
    expect(planAccounts.value).toEqual([
      { userId: 'a', email: 'a@x.test', role: 'club' },
      { userId: 'c', email: 'c@x.test', role: 'archer' },
    ])
  })
})
