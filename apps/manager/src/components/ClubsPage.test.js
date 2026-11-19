import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClubsPage from './ClubsPage.vue'

const clubs = [
  {
    id: 'c1',
    name: 'North Club',
    representative: 'Rita',
    phone: '123',
    email: 'north@x.test',
    address: '1 Main St',
    mapUrl: 'https://maps.test/n',
    website: 'https://north.test',
    logoUrl: '',
    userEnabled: true,
  },
  {
    id: 'c2',
    name: 'South Club',
    representative: '',
    phone: '',
    email: '',
    address: '',
    mapUrl: '',
    userEnabled: false,
  },
]

function mountPage(props = {}) {
  return mount(ClubsPage, { props: { clubs, canManage: true, canClubEdit: false, isClubUser: false, ...props } })
}

describe('ClubsPage', () => {
  it('shows every club with fallbacks for missing details', () => {
    const cards = mountPage().findAll('.club-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('a.club-location').attributes('href')).toBe('https://maps.test/n')
    expect(cards[1].text()).toContain('No address added')
    expect(cards[1].text()).toContain('Not provided')
    expect(cards[1].text()).toContain('No phone number')
  })

  it('filters by name as the user types, ignoring case', async () => {
    const wrapper = mountPage()
    await wrapper.find('.search-box input').setValue('SOUTH')
    expect(wrapper.findAll('.club-card')).toHaveLength(1)
    expect(wrapper.find('.club-card h3').text()).toBe('South Club')
    expect(wrapper.emitted('update:search')[0]).toEqual(['SOUTH'])
  })

  it('shows the count of all clubs, not only the filtered ones', () => {
    expect(mountPage({ search: 'zzz' }).find('.toolbar-count').text()).toContain('2')
  })

  it('lets a manager create, edit, enable or disable, and add archers', async () => {
    const wrapper = mountPage()
    await wrapper.find('.button-primary').trigger('click')
    await wrapper.find('.add-card').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(2)

    const first = wrapper.findAll('.club-card')[0]
    await first.find('.button-icon').trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([clubs[0]])

    const toggle = first.find('.club-user-controls button')
    expect(toggle.text()).toBe('Disable')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-user')[0]).toEqual([clubs[0]])

    await first.findAll('.club-card-actions button')[0].trigger('click')
    expect(wrapper.emitted('add-archer')[0]).toEqual(['c1'])
  })

  it('shows Enable for a disabled club user', () => {
    expect(mountPage().findAll('.club-card')[1].find('.club-user-controls button').text()).toBe('Enable')
  })

  it('lets a club with an active plan edit and add archers only for its own club', () => {
    const wrapper = mountPage({ canManage: false, isClubUser: true, canClubEdit: true, clubId: 'c1' })
    const [own, other] = wrapper.findAll('.club-card')
    expect(own.find('.button-icon').exists()).toBe(true)
    expect(own.text()).toContain('Add archer')
    expect(other.find('.button-icon').exists()).toBe(false)
    expect(other.text()).not.toContain('Add archer')
    expect(wrapper.find('.button-primary').exists()).toBe(false)
    expect(wrapper.find('.club-user-controls button').exists()).toBe(false)
  })

  it('lets a club without an active plan see its club but not edit it', () => {
    const wrapper = mountPage({ canManage: false, isClubUser: true, canClubEdit: false, clubId: 'c1' })
    expect(wrapper.find('.button-icon').exists()).toBe(false)
  })

  it('hides the club user row from other roles', () => {
    const wrapper = mountPage({ canManage: false, isClubUser: false })
    expect(wrapper.find('.club-user-row').exists()).toBe(false)
  })
})
