import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ParticipantsPage from './ParticipantsPage.vue'

const participants = [
  { id: 'p1', firstName: 'Alex', lastName: 'Archer', birthDate: '2000-01-01', waId: 'WA-1', aetayId: '', clubId: 'c1' },
  { id: 'p2', firstName: 'Sam', lastName: 'Shooter', birthDate: '', waId: '', aetayId: 'AE-2', clubId: '' },
]
const clubs = [{ id: 'c1', name: 'North Club' }]
const tournaments = [{ participantIds: ['p1'] }, { participantIds: ['p1', 'p2'] }]
const scores = [{ participantId: 'p1' }]
const matches = []

function mountPage(props = {}) {
  return mount(ParticipantsPage, {
    props: {
      participants,
      clubs,
      tournaments,
      scores,
      matches,
      canManage: true,
      canManageParticipants: true,
      canClubEdit: false,
      clubId: '',
      ...props,
    },
  })
}

describe('ParticipantsPage', () => {
  it('shows each archer with tournament and score counts', () => {
    const rows = mountPage().findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Archer, Alex')
    expect(rows[0].find('.tournament-count').text()).toContain('2')
    expect(rows[0].text()).toContain('WA-1')
    expect(rows[1].find('.tournament-count').text()).toContain('1')
    expect(rows[1].text()).toContain('No scores yet')
  })

  it('filters by what the user types and says so when nothing matches', async () => {
    const wrapper = mountPage()
    await wrapper.find('.search-box input').setValue('ae-2')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Shooter')
    await wrapper.find('.search-box input').setValue('nobody')
    expect(wrapper.find('.table-empty').exists()).toBe(true)
  })

  it('shows the total archers in the toolbar, not only the filtered ones', () => {
    expect(mountPage({ search: 'nobody' }).find('.toolbar-count').text()).toContain('2')
  })

  it('lets a manager pick a club and reports the browser event', async () => {
    const wrapper = mountPage()
    const select = wrapper.findAll('tbody tr')[1].find('select')
    await select.setValue('c1')
    const [person, event] = wrapper.emitted('set-club')[0]
    expect(person).toEqual(participants[1])
    expect(event.target.value).toBe('c1')
  })

  it('shows the club name as text for people who cannot manage', () => {
    const wrapper = mountPage({ canManage: false })
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('North Club')
    expect(wrapper.findAll('tbody tr')[1].text()).toContain('—')
  })

  it('asks to create, edit, and view scores', async () => {
    const wrapper = mountPage()
    await wrapper.find('.button-primary').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
    const row = wrapper.findAll('tbody tr')[0]
    await row.find('.button-icon').trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([participants[0]])
    await row.find('.text-link').trigger('click')
    expect(wrapper.emitted('view-scores')[0]).toEqual(['p1'])
  })

  it('lets a club with an active plan edit only its own archers', () => {
    const wrapper = mountPage({ canManage: false, canClubEdit: true, clubId: 'c1', canManageParticipants: true })
    const [own, other] = wrapper.findAll('tbody tr')
    expect(own.find('.button-icon').exists()).toBe(true)
    expect(other.find('.button-icon').exists()).toBe(false)
  })

  it('hides Add archer when the user cannot manage archers but still allows viewing scores', () => {
    const wrapper = mountPage({ canManage: false, canManageParticipants: false })
    expect(wrapper.find('.button-primary').exists()).toBe(false)
    expect(wrapper.find('.text-link').exists()).toBe(true)
  })
})
