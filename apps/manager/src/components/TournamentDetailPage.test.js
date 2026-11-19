import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TournamentDetailPage from './TournamentDetailPage.vue'

const clubs = [{ id: 'c1', name: 'North Club', address: '1 Main St', mapUrl: 'https://maps.test/n' }]
const tournamentTypes = [
  { id: 'ty1', distance: 70, distanceUnit: 'm', targetType: '122 cm', ends: 12, arrowsPerEnd: 6 },
]
const tournament = {
  id: 't1',
  name: 'Spring Open',
  dates: ['2026-05-01'],
  discipline: 'Field',
  clubId: 'c1',
  tournamentTypeId: 'ty1',
  venueMode: 'club',
  customAddress: '',
  participantIds: ['a', 'b'],
  categoryIds: ['x'],
  startedAt: '',
}

function mountPage(props = {}, slots = {}) {
  return mount(TournamentDetailPage, {
    props: { tournament, clubs, tournamentTypes, canManage: true, canEditTournament: true, ...props },
    slots: { default: '<p class="tab-content">content</p>', ...slots },
  })
}

describe('TournamentDetailPage', () => {
  it('shows the summary of the tournament', () => {
    const wrapper = mountPage()
    expect(wrapper.find('h1').text()).toBe('Spring Open')
    const summary = wrapper.find('.tournament-summary').text()
    expect(summary).toContain('North Club')
    expect(summary).toContain('1 Main St')
    expect(summary).toContain('70 m · 122 cm · 12 × 6')
    expect(wrapper.find('.tournament-summary a').attributes('href')).toBe('https://maps.test/n')
    expect(wrapper.find('.tab-content').exists()).toBe(true)
  })

  it('shows an independent event with a custom venue and no map link or format', () => {
    const wrapper = mountPage({
      tournament: { ...tournament, clubId: '', tournamentTypeId: '', venueMode: 'custom', customAddress: 'Field 9' },
    })
    const summary = wrapper.find('.tournament-summary')
    expect(summary.text()).toContain('Independent event')
    expect(summary.text()).toContain('Field 9')
    expect(summary.find('.format-summary').exists()).toBe(false)
    expect(summary.find('a').exists()).toBe(false)
  })

  it('does not link the club map when the venue is custom', () => {
    const wrapper = mountPage({ tournament: { ...tournament, venueMode: 'custom', customAddress: 'Field 9' } })
    expect(wrapper.find('.tournament-summary a').exists()).toBe(false)
  })

  it('changes tab and marks the active one', async () => {
    const wrapper = mountPage()
    const buttons = wrapper.findAll('.tournament-tabs button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].classes()).toContain('active')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('update:tab')[0]).toEqual(['scores'])
    expect(buttons[2].classes()).toContain('active')
  })

  it('goes back and edits dates', async () => {
    const wrapper = mountPage()
    await wrapper.find('.back-link').trigger('click')
    await wrapper.find('.heading-actions button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
    expect(wrapper.emitted('edit-dates')[0]).toEqual([tournament])
  })

  it('hides Edit dates from someone who cannot edit', () => {
    const wrapper = mountPage({ canEditTournament: false, canManage: false })
    expect(wrapper.find('.heading-actions button').exists()).toBe(false)
  })

  it('offers Start when allowed and asks to toggle', async () => {
    const wrapper = mountPage({ canStartTournament: true })
    const start = wrapper.findAll('.heading-actions button').find((item) => item.text() === 'Start tournament')
    await start.trigger('click')
    expect(wrapper.emitted('toggle-started')[0]).toEqual([tournament])
  })

  it('offers Reopen to a manager for a started tournament, with a note', async () => {
    const started = { ...tournament, startedAt: '2026-05-01' }
    const wrapper = mountPage({ tournament: started })
    expect(wrapper.text()).toContain('This tournament is started.')
    const reopen = wrapper.findAll('.heading-actions button').find((item) => item.text() === 'Reopen tournament')
    await reopen.trigger('click')
    expect(wrapper.emitted('toggle-started')[0]).toEqual([started])
  })

  it('tells a non-manager that a started tournament is locked and gives no reopen button', () => {
    const wrapper = mountPage({ tournament: { ...tournament, startedAt: '2026-05-01' }, canManage: false })
    expect(wrapper.text()).toContain('started and locked')
    expect(wrapper.text()).not.toContain('Reopen tournament')
  })

  it('shows the empty slot and no tabs when the tournament is not found', () => {
    const wrapper = mountPage({ tournament: undefined }, { empty: '<strong class="missing">gone</strong>' })
    expect(wrapper.find('.missing').exists()).toBe(true)
    expect(wrapper.find('.tournament-tabs').exists()).toBe(false)
    expect(wrapper.find('.tab-content').exists()).toBe(false)
  })
})
