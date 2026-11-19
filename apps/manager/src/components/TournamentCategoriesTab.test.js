import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TournamentCategoriesTab from './TournamentCategoriesTab.vue'

const categories = [
  { id: 'c1', name: 'Recurve Open', minAge: 18, maxAge: null, bowType: 'Recurve' },
  { id: 'c2', name: 'Youth', minAge: null, maxAge: 17, bowType: '' },
]
const tournament = { id: 't1', categoryIds: ['c1'] }

function mountTab(props = {}) {
  return mount(TournamentCategoriesTab, {
    props: { tournament, categories, canManage: true, canEditTournament: true, ...props },
  })
}

describe('TournamentCategoriesTab', () => {
  it('shows every category with its description and whether the tournament offers it', () => {
    const rows = mountTab().findAll('.category-roster-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Age 18+')
    expect(rows[0].find('.roster-state').text()).toBe('Available')
    expect(rows[0].find('input').element.checked).toBe(true)
    expect(rows[1].find('.roster-state').text()).toBe('Not added')
    expect(rows[1].find('input').element.checked).toBe(false)
  })

  it('asks to toggle the chosen category for this tournament', async () => {
    const wrapper = mountTab()
    await wrapper.findAll('.category-roster-row input')[1].trigger('change')
    expect(wrapper.emitted('toggle')[0]).toEqual([tournament, 'c2'])
  })

  it('disables the checkboxes for someone who cannot edit the tournament', () => {
    const wrapper = mountTab({ canEditTournament: false })
    expect(wrapper.findAll('input').every((box) => box.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.find('p').text()).toBe('Divisions available for this event.')
  })

  it('opens the category catalogue for a manager only', async () => {
    const wrapper = mountTab()
    await wrapper.find('.text-link').trigger('click')
    expect(wrapper.emitted('open-catalogue')).toHaveLength(1)
    expect(mountTab({ canManage: false }).find('.text-link').exists()).toBe(false)
  })

  it('shows the empty state, with a catalogue button only for a manager', async () => {
    const wrapper = mountTab({ categories: [] })
    expect(wrapper.find('.roster-list').exists()).toBe(false)
    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('open-catalogue')).toHaveLength(1)

    const viewer = mountTab({ categories: [], canManage: false })
    expect(viewer.find('.empty-state button').exists()).toBe(false)
    expect(viewer.text()).toContain('Categories will appear here when available.')
  })
})
