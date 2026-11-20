import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TournamentScoresTab from './TournamentScoresTab.vue'

const categories = [{ id: 'c1', name: 'Open' }]
const tournament = { id: 't1', rounds: ['Qualification', 'Round 2'] }
const rows = [
  { participant: { id: 'a', firstName: 'Ana', lastName: 'Archer', waId: 'WA-1' }, categoryId: 'c1', score: 640 },
  { participant: { id: 'b', firstName: 'Bo', lastName: 'Bowman', waId: '' }, categoryId: '', score: '' },
]

function mountTab(props = {}) {
  return mount(TournamentScoresTab, {
    props: {
      tournament,
      rows,
      categories,
      scoredCount: 1,
      archerCount: 2,
      canManage: true,
      canEditTournament: true,
      round: 'Qualification',
      ...props,
    },
  })
}

describe('TournamentScoresTab', () => {
  it('shows a row per archer with category, id, score, and status', () => {
    const trs = mountTab().findAll('tbody tr')
    expect(trs).toHaveLength(2)
    expect(trs[0].text()).toContain('Archer, Ana')
    expect(trs[0].text()).toContain('Open')
    expect(trs[0].text()).toContain('WA-1')
    expect(trs[0].find('input').element.value).toBe('640')
    expect(trs[0].find('.status-pill').text()).toBe('Recorded')
    expect(trs[1].text()).toContain('Unassigned')
    expect(trs[1].text()).toContain('—')
    expect(trs[1].find('.status-pill').text()).toBe('Pending')
  })

  it('treats a score of zero as recorded', () => {
    const wrapper = mountTab({ rows: [{ ...rows[1], score: 0 }] })
    expect(wrapper.find('.status-pill').text()).toBe('Recorded')
  })

  it('shows how many scores are entered', () => {
    expect(mountTab().find('.score-completion').text()).toContain('1 / 2')
  })

  it('lists the rounds and reports a change', async () => {
    const wrapper = mountTab()
    expect(wrapper.findAll('select option').map((option) => option.text())).toEqual(['Qualification', 'Round 2'])
    await wrapper.find('select').setValue('Round 2')
    expect(wrapper.emitted('update:round')[0]).toEqual(['Round 2'])
  })

  it('reports the typed score with the archer id', async () => {
    const wrapper = mountTab()
    const input = wrapper.findAll('tbody tr')[1].find('input')
    await input.setValue('555')
    await input.trigger('change')
    expect(wrapper.emitted('save-score')[0]).toEqual(['b', '555'])
  })

  it('reports an emptied score as an empty string', async () => {
    const wrapper = mountTab()
    const input = wrapper.findAll('tbody tr')[0].find('input')
    await input.setValue('')
    await input.trigger('change')
    expect(wrapper.emitted('save-score')[0]).toEqual(['a', ''])
  })

  it('locks the score inputs and hides the footnote for someone who cannot manage', () => {
    const wrapper = mountTab({ canManage: false })
    expect(wrapper.findAll('tbody input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.find('.score-footnote').exists()).toBe(false)
  })

  it('adds a round from the form, only for someone who can edit the tournament', async () => {
    const wrapper = mountTab()
    await wrapper.find('.add-round-form input').setValue('Final')
    expect(wrapper.emitted('update:newRoundName')[0]).toEqual(['Final'])
    await wrapper.find('.add-round-form').trigger('submit')
    expect(wrapper.emitted('add-round')).toHaveLength(1)

    expect(mountTab({ canEditTournament: false }).find('.add-round-form').exists()).toBe(false)
  })

  it('shows the empty state and goes to the archers tab', async () => {
    const wrapper = mountTab({ rows: [], archerCount: 0, scoredCount: 0 })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('.score-footnote').exists()).toBe(false)
    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('view-archers')).toHaveLength(1)
  })
})
