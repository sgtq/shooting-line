import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TournamentsPage from './TournamentsPage.vue'

const clubs = [{ id: 'c1', name: 'North Club', address: '1 Main St' }]
const tournamentTypes = [{ id: 'ty1', name: 'Outdoor 70m' }]
const base = { venueMode: 'club', customAddress: '', discipline: 'Field', categoryIds: [] }
const tournaments = [
  {
    ...base,
    id: 't-future',
    name: 'Future Open',
    dates: ['2099-05-01'],
    clubId: 'c1',
    tournamentTypeId: 'ty1',
    participantIds: ['a', 'b'],
  },
  {
    ...base,
    id: 't-later',
    name: 'Later Cup',
    dates: ['2099-08-01'],
    clubId: '',
    tournamentTypeId: '',
    participantIds: [],
    categoryIds: ['x'],
  },
  {
    ...base,
    id: 't-past',
    name: 'Old Cup',
    dates: ['2001-05-01'],
    clubId: 'c1',
    tournamentTypeId: '',
    participantIds: [],
  },
]

function mountPage(props = {}) {
  return mount(TournamentsPage, {
    props: { tournaments, tournamentTypes, clubs, canManage: true, canCreateTournament: true, ...props },
  })
}

function cardNames(wrapper) {
  return wrapper.findAll('.tournament-card').map((card) => card.attributes('aria-label'))
}

afterEach(() => vi.restoreAllMocks())

describe('TournamentsPage', () => {
  it('starts on upcoming tournaments, earliest first', () => {
    const wrapper = mountPage()
    expect(cardNames(wrapper)).toEqual(['Future Open', 'Later Cup'])
    expect(wrapper.find('.toolbar-count').text()).toContain('2')
  })

  it('switches to past tournaments', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.tournament-filters button')[1].trigger('click')
    expect(cardNames(wrapper)).toEqual(['Old Cup'])
    expect(wrapper.emitted('update:status')[0]).toEqual(['past'])
  })

  it('filters by name as the user types', async () => {
    const wrapper = mountPage()
    await wrapper.find('.search-box input').setValue('LATER')
    expect(cardNames(wrapper)).toEqual(['Later Cup'])
  })

  it('shows an empty state when nothing matches', async () => {
    const wrapper = mountPage()
    await wrapper.find('.search-box input').setValue('zzz')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('shows the type name, the venue, the counts, and the host', () => {
    const cards = mountPage().findAll('.tournament-card')
    expect(cards[0].find('.event-tag').text()).toBe('Outdoor 70m')
    expect(cards[0].text()).toContain('1 Main St')
    expect(cards[0].text()).toContain('2 archers')
    expect(cards[0].text()).toContain('North Club')
    expect(cards[1].find('.event-tag').text()).toBe('Field')
    expect(cards[1].text()).toContain('1 categories')
    expect(cards[1].text()).toContain('Independent')
  })

  it('opens a tournament by click and by keyboard, but not at the end of a text selection', async () => {
    const wrapper = mountPage()
    const card = wrapper.findAll('.tournament-card')[0]
    await card.trigger('click')
    await card.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('open-tournament')).toEqual([['t-future'], ['t-future']])

    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'copied' })
    await card.trigger('click')
    expect(wrapper.emitted('open-tournament')).toHaveLength(2)
  })

  it('offers create and the tournament types shortcut by role', async () => {
    const wrapper = mountPage()
    await wrapper.find('.button-primary').trigger('click')
    await wrapper.find('.type-shortcut .text-link').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
    expect(wrapper.emitted('open-types')).toHaveLength(1)

    const club = mountPage({ canManage: false, canCreateTournament: false, showPlanNotice: true })
    expect(club.find('.button-primary').exists()).toBe(false)
    expect(club.find('.type-shortcut').exists()).toBe(false)
    expect(club.find('.privacy-note').exists()).toBe(true)
  })

  it('keeps the filter and the search text it is given', () => {
    const wrapper = mountPage({ status: 'past', query: 'old' })
    expect(cardNames(wrapper)).toEqual(['Old Cup'])
    expect(wrapper.find('.search-box input').element.value).toBe('old')
  })
})
