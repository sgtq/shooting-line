import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import CategoriesPage from './CategoriesPage.vue'

const categories = [
  { id: 'c1', name: 'Recurve Open', minAge: 18, maxAge: null, bowType: 'Recurve' },
  { id: 'c2', name: 'Youth', minAge: null, maxAge: 17, bowType: '' },
]
const tournaments = [{ categoryIds: ['c1', 'c2'] }, { categoryIds: ['c1'] }, { categoryIds: [] }]

function mountPage(props = {}) {
  return mount(CategoriesPage, { props: { categories, tournaments, canManage: true, ...props } })
}

afterEach(() => setLanguage('en'))

describe('CategoriesPage', () => {
  it('shows each category with its description and how many tournaments offer it', () => {
    const cards = mountPage().findAll('.category-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Recurve Open')
    expect(cards[0].text()).toContain('Age 18+')
    expect(cards[0].find('.format-usage').text()).toContain('2')
    expect(cards[1].text()).toContain('Up to age 17')
    expect(cards[1].find('.format-usage').text()).toContain('1')
  })

  it('shows a zero count when no tournament offers the category', () => {
    const wrapper = mountPage({ tournaments: [] })
    expect(wrapper.find('.format-usage').text()).toMatch(/^0 /)
  })

  it('asks to create from the heading button and the add card', async () => {
    const wrapper = mountPage()
    await wrapper.find('.button-primary').trigger('click')
    await wrapper.find('.add-card').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(2)
  })

  it('asks to edit the chosen category', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.category-card .button-icon')[0].trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([categories[0]])
  })

  it('hides every edit and create control from people who cannot manage', () => {
    const wrapper = mountPage({ canManage: false })
    expect(wrapper.find('.button-primary').exists()).toBe(false)
    expect(wrapper.find('.button-icon').exists()).toBe(false)
    expect(wrapper.find('.add-card').exists()).toBe(false)
  })

  it('shows the page in Spanish', () => {
    setLanguage('es-419')
    expect(mountPage().find('h1').text()).not.toBe('Categories')
  })
})
