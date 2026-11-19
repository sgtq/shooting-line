import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage.vue'

const clubs = [
  { id: 'c1', name: 'North Club', representative: 'Rita', userEnabled: true },
  { id: 'c2', name: 'South Club', representative: 'Sol', userEnabled: false },
  { id: 'c3', name: 'East Club', representative: '', userEnabled: true },
  { id: 'c4', name: 'West Club', representative: '', userEnabled: true },
]
const tournaments = [
  {
    id: 't-future',
    name: 'Future Open',
    dates: ['2099-05-01'],
    clubId: 'c1',
    discipline: 'Field',
    participantIds: ['a'],
  },
  { id: 't-past', name: 'Old Cup', dates: ['2001-05-01'], clubId: '', discipline: 'Other', participantIds: [] },
]

function mountPage(props = {}) {
  return mount(DashboardPage, {
    props: {
      userName: 'Ana',
      tournaments,
      clubs,
      archerCount: 7,
      canManage: true,
      canManageParticipants: true,
      canCreateTournament: true,
      ...props,
    },
  })
}

afterEach(() => vi.restoreAllMocks())

describe('DashboardPage', () => {
  it('greets the user and shows the totals', () => {
    const wrapper = mountPage()
    expect(wrapper.find('h1').text()).toContain('Ana')
    const values = wrapper.findAll('.stat-value').map((item) => item.text())
    expect(values).toEqual(['2', '4', '7'])
  })

  it('shows the next tournament that has not finished and skips past ones', () => {
    const wrapper = mountPage()
    expect(wrapper.find('.next-event').text()).toBe('Future Open')
  })

  it('says there is no upcoming event when every tournament is over', () => {
    const wrapper = mountPage({ tournaments: [tournaments[1]] })
    expect(wrapper.find('.next-event').text()).toBe('No upcoming events')
    expect(wrapper.find('.next-stat .text-link').exists()).toBe(false)
  })

  it('lists tournaments earliest first with the host club or independent label', () => {
    const rows = mountPage().findAll('.event-row')
    expect(rows.map((row) => row.attributes('aria-label'))).toEqual(['Old Cup', 'Future Open'])
    expect(rows[0].text()).toContain('Independent event')
    expect(rows[1].text()).toContain('North Club')
  })

  it('shows only the first three clubs in the preview', () => {
    expect(mountPage().findAll('.club-preview-item')).toHaveLength(3)
  })

  it('shows an empty state with a create button for a user who can create', async () => {
    const wrapper = mountPage({ tournaments: [] })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('create')[0]).toEqual(['tournament'])
  })

  it('hides create controls and shows the plan notice for a club without a plan', () => {
    const wrapper = mountPage({
      canManage: false,
      canManageParticipants: false,
      canCreateTournament: false,
      showPlanNotice: true,
      tournaments: [],
    })
    expect(wrapper.find('.privacy-note').exists()).toBe(true)
    expect(wrapper.find('.button-primary').exists()).toBe(false)
    expect(wrapper.find('.empty-state button').exists()).toBe(false)
    expect(wrapper.find('.quick-action').exists()).toBe(false)
  })

  it('navigates from the stat cards and the view all link', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.stat-value')[0].trigger('click')
    await wrapper.findAll('.stat-value')[1].trigger('click')
    await wrapper.findAll('.stat-value')[2].trigger('click')
    await wrapper.find('.events-panel .text-link').trigger('click')
    const pages = wrapper.emitted('navigate').map(([page]) => page)
    expect(pages).toContain('tournaments')
    expect(pages).toContain('clubs')
    expect(pages).toContain('participants')
  })

  it('opens a tournament by click and by keyboard', async () => {
    const wrapper = mountPage()
    const row = wrapper.findAll('.event-row')[1]
    await row.trigger('click')
    await row.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('open-tournament')).toEqual([['t-future'], ['t-future']])
  })

  it('does not open a tournament when the click ends a text selection', async () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected' })
    const wrapper = mountPage()
    await wrapper.findAll('.event-row')[1].trigger('click')
    expect(wrapper.emitted('open-tournament')).toBeUndefined()
  })

  it('opens the selected tournament on its scores tab, or the list when none is selected', async () => {
    const withSelection = mountPage({ selectedTournamentId: 't-future' })
    await withSelection.findAll('.quick-action')[2].trigger('click')
    expect(withSelection.emitted('open-tournament')[0]).toEqual(['t-future', 'scores'])

    const without = mountPage()
    await without.findAll('.quick-action')[2].trigger('click')
    expect(without.emitted('navigate').pop()).toEqual(['tournaments'])
  })

  it('offers the quick actions that match the role', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.quick-action')[0].trigger('click')
    await wrapper.findAll('.quick-action')[1].trigger('click')
    expect(wrapper.emitted('create')).toEqual([['participant'], ['club']])

    const club = mountPage({ canManage: false, canManageParticipants: true })
    expect(club.findAll('.quick-action')).toHaveLength(1)
  })

  it('lets only a manager toggle a club, and anyone open its details', async () => {
    const asManager = mountPage()
    const first = asManager.findAll('.club-preview-item')[0]
    await first.find('.status-pill-button:not(.details-control)').trigger('click')
    expect(asManager.emitted('toggle-club')[0]).toEqual([clubs[0]])
    await first.find('.details-control').trigger('click')
    expect(asManager.emitted('open-club')[0]).toEqual([clubs[0]])

    const asClub = mountPage({ canManage: false })
    expect(asClub.find('.club-preview-item .status-pill-button:not(.details-control)').exists()).toBe(false)
    expect(asClub.find('.club-preview-item span.status-pill').exists()).toBe(true)
  })
})
