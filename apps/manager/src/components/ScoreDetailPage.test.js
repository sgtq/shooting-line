import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ScoreDetailPage from './ScoreDetailPage.vue'

const participant = { id: 'me', firstName: 'Ana', lastName: 'Archer' }
const rows = [
  {
    tournamentId: 't1',
    tournament: { name: 'Spring Open', dates: ['2026-03-01'] },
    category: { name: 'Open' },
    scoreType: 'Round score',
    round: 'Qualification',
    score: 640,
  },
  { tournamentId: 'gone', scoreType: 'Olympic match', round: 'Final vs Rui', score: 0 },
]

describe('ScoreDetailPage', () => {
  it('shows the archer name and one row per score', () => {
    const wrapper = mountPage({ participant, rows })
    expect(wrapper.find('h1').text()).toBe('Archer, Ana')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Spring Open')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Open')
  })

  it('shows fallbacks for a removed tournament and a missing category, and keeps a score of zero', () => {
    const second = mountPage({ participant, rows }).findAll('tbody tr')[1]
    expect(second.text()).toContain('Tournament removed')
    expect(second.text()).toContain('Unassigned')
    expect(second.text()).toContain('—')
    expect(second.find('strong').text()).toBe('0')
  })

  it('shows the empty state when the archer has no scores', async () => {
    const wrapper = mountPage({ participant, rows: [] })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('shows a generic title and the empty state when the archer is not found', () => {
    const wrapper = mountPage({ participant: undefined, rows })
    expect(wrapper.find('h1').text()).toBe('Archer details')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('goes back from the link at the top', async () => {
    const wrapper = mountPage({ participant, rows })
    await wrapper.find('.back-link').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})

function mountPage(props) {
  return mount(ScoreDetailPage, { props })
}
