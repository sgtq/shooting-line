import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import TournamentTypesPage from './TournamentTypesPage.vue'

const types = [
  { id: 'ty1', name: 'Outdoor 70m', distance: 70, distanceUnit: 'm', targetType: '122 cm', ends: 12, arrowsPerEnd: 6 },
  { id: 'ty2', name: 'Indoor 18m', distance: 18, distanceUnit: 'm', targetType: '40 cm', ends: 20, arrowsPerEnd: 3 },
]
const tournaments = [{ tournamentTypeId: 'ty1' }, { tournamentTypeId: 'ty1' }, { tournamentTypeId: 'ty2' }]

function mountPage(props = {}) {
  return mount(TournamentTypesPage, { props: { tournamentTypes: types, tournaments, canManage: true, ...props } })
}

afterEach(() => setLanguage('en'))

describe('TournamentTypesPage', () => {
  it('shows each type with its total arrows and how many tournaments use it', () => {
    const cards = mountPage().findAll('.format-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Outdoor 70m')
    expect(cards[0].find('.format-total strong').text()).toBe('72')
    expect(cards[0].find('.format-usage').text()).toContain('2')
    expect(cards[1].find('.format-total strong').text()).toBe('60')
    expect(cards[1].find('.format-usage').text()).toContain('1')
  })

  it('shows a zero count for a type nobody uses', () => {
    const wrapper = mountPage({ tournaments: [] })
    expect(wrapper.find('.format-usage').text()).toMatch(/^0 /)
  })

  it('asks to create from the heading button and the add card', async () => {
    const wrapper = mountPage()
    await wrapper.find('.button-primary').trigger('click')
    await wrapper.find('.add-card').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(2)
  })

  it('asks to edit the chosen type', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.format-card .button-icon')[1].trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([types[1]])
  })

  it('hides every edit and create control from people who cannot manage', () => {
    const wrapper = mountPage({ canManage: false })
    expect(wrapper.find('.button-primary').exists()).toBe(false)
    expect(wrapper.find('.button-icon').exists()).toBe(false)
    expect(wrapper.find('.add-card').exists()).toBe(false)
    expect(wrapper.findAll('.format-card')).toHaveLength(2)
  })

  it('shows the page in Spanish', () => {
    setLanguage('es-419')
    expect(mountPage().find('h1').text()).not.toBe('Tournament types')
  })
})
