import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TournamentOlympicTab from './TournamentOlympicTab.vue'

const categories = [
  { id: 'c1', name: 'Open' },
  { id: 'c2', name: 'Youth' },
]
const participants = [
  { id: 'a', firstName: 'Ana', lastName: 'Archer' },
  { id: 'b', firstName: 'Bo', lastName: 'Bowman' },
]
const matches = [
  { id: 'm1', round: 'Final', seed1: 1, seed2: 2, seed1Id: 'a', seed2Id: 'b', score1: 6, score2: '' },
  { id: 'm2', round: 'Final', seed1: 1, seed2: 2, seed1Id: 'a', seed2Id: 'gone', score1: 0, score2: 0 },
]

function mountTab(props = {}) {
  return mount(TournamentOlympicTab, {
    props: {
      tournament: { categoryIds: ['c1', 'c2'] },
      categories,
      participants,
      matches,
      round: 'Qualification',
      canManage: true,
      ...props,
    },
  })
}

describe('TournamentOlympicTab', () => {
  it('shows each match with seeds, names, and a numbered heading', () => {
    const cards = mountTab().findAll('.match-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('.match-number').text()).toContain('01')
    expect(cards[1].find('.match-number').text()).toContain('02')
    const names = cards[0].findAll('.match-archer strong').map((item) => item.text())
    expect(names).toEqual(['Ana Archer', 'Bo Bowman'])
    expect(cards[0].findAll('.seed-badge').map((item) => item.text())).toEqual(['1', '2'])
  })

  it('names an archer who is no longer in the list as unknown', () => {
    const second = mountTab().findAll('.match-card')[1]
    expect(second.findAll('.match-archer strong')[1].text()).toContain('Unknown')
  })

  it('marks a match complete only when both scores are entered, counting zero', () => {
    const cards = mountTab().findAll('.match-card')
    expect(cards[0].find('.match-foot i').classes()).not.toContain('complete')
    expect(cards[0].find('.match-foot').text()).toContain('Enter both match scores')
    expect(cards[1].find('.match-foot i').classes()).toContain('complete')
    expect(cards[1].find('.match-foot').text()).toContain('Scores recorded')
  })

  it('reports a typed match score with the match and the field', async () => {
    const wrapper = mountTab()
    const input = wrapper.findAll('.match-card')[0].findAll('input')[1]
    await input.setValue('4')
    await input.trigger('change')
    expect(wrapper.emitted('record-score')[0]).toEqual([matches[0], 'score2', '4'])
  })

  it('shows the seeding round and asks to seed', async () => {
    const wrapper = mountTab()
    expect(wrapper.find('.round-label').text()).toBe('Qualification')
    await wrapper.find('.olympic-toolbar .button-primary').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('lists the tournament categories and reports a change', async () => {
    const wrapper = mountTab()
    expect(wrapper.findAll('select option').map((option) => option.text())).toEqual(['All archers', 'Open', 'Youth'])
    await wrapper.find('select').setValue('c2')
    expect(wrapper.emitted('update:categoryId')[0]).toEqual(['c2'])
  })

  it('locks inputs and hides the seed button for someone who cannot manage', () => {
    const wrapper = mountTab({ canManage: false })
    expect(wrapper.find('.olympic-toolbar .button-primary').exists()).toBe(false)
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.match-card input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
  })

  it('shows the empty state and goes to the scores tab', async () => {
    const wrapper = mountTab({ matches: [] })
    expect(wrapper.find('.match-card').exists()).toBe(false)
    await wrapper.find('.bracket-empty button').trigger('click')
    expect(wrapper.emitted('view-scores')).toHaveLength(1)
    expect(wrapper.find('.bracket-note').exists()).toBe(true)
  })
})
