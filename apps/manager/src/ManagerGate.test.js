import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import ManagerGate from './ManagerGate.vue'

const holder = vi.hoisted(() => ({ client: null, load: null, loadUpcoming: null }))

vi.mock('@shooting-line/auth', () => ({
  APP_IDS: { manager: 'manager' },
  createSupabaseClient: () => holder.client,
  hasAppAccess: vi.fn().mockResolvedValue({ allowed: true, error: null }),
}))

vi.mock('./services/workspace.js', () => ({
  createManagerRepository: () => ({ load: holder.load, loadUpcomingTournaments: holder.loadUpcoming }),
  readLegacyWorkspace: () => null,
}))

vi.mock('./App.vue', async () => {
  const { h } = await import('vue')
  return { default: { render: () => h('div', { class: 'app-stub' }) } }
})

function makeClient({
  role = 'club',
  hasPlan = false,
  lastEnd = '2026-03-31',
  planError = null,
  archerLocked = false,
} = {}) {
  const query = (result) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    }
    return chain
  }
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'club@example.test', user_metadata: {} } } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    rpc: vi.fn((name) =>
      Promise.resolve({ data: name === 'user_without_plan' ? archerLocked : hasPlan, error: planError }),
    ),
    from: vi.fn((table) => {
      if (table === 'user_roles') {
        return query({ data: [{ role, club_id: 'club-1', participant_id: null }], error: null })
      }
      if (table === 'user_profiles') return query({ data: null, error: null })
      return query({ data: lastEnd ? [{ ends_on: lastEnd }] : [], error: null })
    }),
  }
}

async function openGate(options) {
  holder.client = makeClient(options)
  const wrapper = mount(ManagerGate)
  await flushPromises()
  return wrapper
}

describe('manager gate and club plans', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() })
    holder.load = vi.fn().mockResolvedValue({ clubs: [], tournaments: [] })
    holder.loadUpcoming = vi.fn().mockResolvedValue([])
  })

  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('shows a plan-lapsed screen and loads nothing for a club whose plan ended', async () => {
    const wrapper = await openGate({ role: 'club', hasPlan: false, lastEnd: '2026-03-31' })

    expect(wrapper.text()).toContain('The plan for your club is no longer current')
    expect(wrapper.text()).toContain('Your last plan ended on 2026-03-31.')
    expect(wrapper.text()).toContain('Ask a manager to renew it')
    expect(wrapper.find('.app-stub').exists()).toBe(false)
    expect(holder.load).not.toHaveBeenCalled()
  })

  it('says so when the club never had a plan', async () => {
    const wrapper = await openGate({ role: 'club', hasPlan: false, lastEnd: '' })

    expect(wrapper.text()).toContain('Your club has no plan yet.')
    expect(wrapper.find('.app-stub').exists()).toBe(false)
  })

  it('opens the app for a club with an active plan', async () => {
    const wrapper = await openGate({ role: 'club', hasPlan: true })

    expect(wrapper.find('.app-stub').exists()).toBe(true)
    expect(holder.load).toHaveBeenCalledTimes(1)
  })

  it('does not check plans for managers', async () => {
    const wrapper = await openGate({ role: 'manager', hasPlan: false })

    expect(holder.client.rpc).not.toHaveBeenCalled()
    expect(wrapper.find('.app-stub').exists()).toBe(true)
  })

  it('does not open the app when the plan cannot be checked', async () => {
    const wrapper = await openGate({ role: 'club', planError: new Error('rpc down') })

    expect(wrapper.text()).toContain('Unable to check your club plan: rpc down')
    expect(wrapper.find('.app-stub').exists()).toBe(false)
    expect(holder.load).not.toHaveBeenCalled()
  })

  it('shows the lapsed screen in Spanish', async () => {
    setLanguage('es-419')
    const wrapper = await openGate({ role: 'club', hasPlan: false, lastEnd: '2026-03-31' })

    expect(wrapper.text()).toContain('El plan de tu club ya no está vigente')
  })

  describe('archers', () => {
    it('shows only the not-enabled screen and loads nothing for a disabled archer', async () => {
      const wrapper = await openGate({ role: 'archer', archerLocked: true })

      expect(wrapper.text()).toContain('Your user is not enabled')
      expect(wrapper.text()).toContain('Ask your club or a manager to enable it.')
      expect(wrapper.find('.app-stub').exists()).toBe(false)
      expect(holder.client.rpc).toHaveBeenCalledWith('user_without_plan')
      expect(holder.load).not.toHaveBeenCalled()
      expect(holder.loadUpcoming).not.toHaveBeenCalled()
    })

    it('opens the archer view, not the app, for an enabled archer', async () => {
      holder.loadUpcoming.mockResolvedValue([
        {
          id: 't1',
          name: 'Spring Open',
          days: ['2026-12-01'],
          tournamentType: '',
          hostClub: 'Club A',
          address: '',
          categories: [],
          isEntered: false,
        },
      ])
      const wrapper = await openGate({ role: 'archer', archerLocked: false })

      expect(wrapper.find('.app-stub').exists()).toBe(false)
      expect(wrapper.find('[data-testid="upcoming-list"]').text()).toContain('Spring Open')
      expect(holder.load).toHaveBeenCalledTimes(1)
      expect(holder.loadUpcoming).toHaveBeenCalledTimes(1)
    })

    it('does not open the archer view when the calendar cannot be loaded', async () => {
      holder.loadUpcoming.mockRejectedValue(new Error('rpc down'))
      const wrapper = await openGate({ role: 'archer', archerLocked: false })

      expect(wrapper.text()).toContain('Unable to load the tournament calendar: rpc down')
      expect(wrapper.find('[data-testid="upcoming-list"]').exists()).toBe(false)
    })

    it('does not load the calendar for clubs or managers', async () => {
      await openGate({ role: 'club', hasPlan: true })
      await openGate({ role: 'manager' })

      expect(holder.loadUpcoming).not.toHaveBeenCalled()
    })

    it('does not open the app when the archer check fails', async () => {
      const wrapper = await openGate({ role: 'archer', planError: new Error('rpc down') })

      expect(wrapper.text()).toContain('Unable to check your access: rpc down')
      expect(wrapper.find('.app-stub').exists()).toBe(false)
      expect(holder.load).not.toHaveBeenCalled()
      expect(holder.loadUpcoming).not.toHaveBeenCalled()
    })

    it('shows the not-enabled screen in Spanish', async () => {
      setLanguage('es-419')
      const wrapper = await openGate({ role: 'archer', archerLocked: true })

      expect(wrapper.text()).toContain('Tu usuario no está habilitado')
    })
  })
})
