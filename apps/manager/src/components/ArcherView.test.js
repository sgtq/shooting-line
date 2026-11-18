import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import ArcherView from './ArcherView.vue'

const ME = 'me'

const data = {
  tournamentTypes: [{ id: 'ty', ends: 10 }],
  categories: [{ id: 'c1', name: 'Recurve Open' }],
  tournaments: [
    {
      id: 't1',
      name: 'Spring Open',
      dates: ['2026-03-01'],
      tournamentTypeId: 'ty',
      participantIds: [ME],
      categoryAssignments: { [ME]: 'c1' },
    },
    {
      id: 't2',
      name: 'Autumn Cup',
      dates: ['2026-09-01'],
      tournamentTypeId: 'ty',
      participantIds: [ME],
      categoryAssignments: { [ME]: 'c1' },
    },
  ],
  scores: [
    { tournamentId: 't1', participantId: ME, round: 'Qualification', score: 600 },
    { tournamentId: 't2', participantId: ME, round: 'Qualification', score: 500 },
  ],
  matches: [{ tournamentId: 't1', round: 'Final', seed1Id: ME, seed2Id: 'rival', score1: 140, score2: 9999 }],
}

const upcoming = [
  {
    id: 'u1',
    name: 'Winter Classic',
    days: ['2026-12-05', '2026-12-06'],
    tournamentType: 'Indoor 18m',
    typeDetails: { distance: 18, distanceUnit: 'm', target: '40 cm', ends: 10, arrowsPerEnd: 3 },
    hostClub: 'Club A',
    address: 'Main street 1',
    mapUrl: 'https://maps.example.com/club-a',
    categories: [
      { name: 'Open', bowType: 'Recurve' },
      { name: 'Open', bowType: 'Compound' },
    ],
    isEntered: true,
  },
  {
    id: 'u2',
    name: 'Bare Cup',
    days: ['2026-12-20'],
    tournamentType: '',
    typeDetails: null,
    hostClub: '',
    address: '',
    mapUrl: 'javascript:alert(1)',
    categories: [],
    isEntered: false,
  },
]

function mountView(overrides = {}) {
  return mount(ArcherView, {
    props: { data, upcoming, participantId: ME, userName: 'Alex', today: '2026-10-01', ...overrides },
  })
}

async function openScores(wrapper) {
  await wrapper.findAll('.nav-link')[1].trigger('click')
}

describe('ArcherView', () => {
  afterEach(() => setLanguage('en'))

  it('lists only the name, dates, and type until a tournament is opened', () => {
    const list = mountView().find('[data-testid="upcoming-list"]')

    expect(list.text()).toContain('Winter Classic')
    expect(list.text()).toContain('2026-12-05 - 2026-12-06')
    expect(list.text()).toContain('Indoor 18m')
    expect(list.text()).toContain('You are entered')
    expect(list.text()).not.toContain('Club A')
    expect(list.text()).not.toContain('Main street 1')
    expect(list.find('.archer-details').exists()).toBe(false)
  })

  it('uses the dashboard event row with a date tile for the first day', () => {
    const row = mountView().find('.event-row')

    expect(row.find('.date-tile strong').text()).toBe('5')
    expect(row.find('.date-tile span').text().toLowerCase()).toBe('dec')
    expect(row.find('.event-info strong').text()).toBe('Winter Classic')
  })

  it('opens the host, location, map link, format, and categories by bow type', async () => {
    const wrapper = mountView()
    const toggle = wrapper.find('.archer-tournament-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')

    const details = wrapper.find('.archer-details')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(details.text()).toContain('Club A')
    expect(details.text()).toContain('Main street 1')
    expect(details.text()).toContain('18 m, 40 cm, 10 ends of 3 arrows')
    expect(details.text()).toContain('Compound: Open')
    expect(details.text()).toContain('Recurve: Open')
    const link = details.find('a')
    expect(link.attributes('href')).toBe('https://maps.example.com/club-a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('closes the details again and keeps other tournaments closed', async () => {
    const wrapper = mountView()
    const [first, second] = wrapper.findAll('.archer-tournament-toggle')
    await first.trigger('click')
    expect(wrapper.findAll('.archer-details')).toHaveLength(1)
    expect(second.attributes('aria-expanded')).toBe('false')

    await first.trigger('click')
    expect(wrapper.find('.archer-details').exists()).toBe(false)
  })

  it('shows dashes for missing details and never links an unsafe map address', async () => {
    const wrapper = mountView()
    await wrapper.findAll('.archer-tournament-toggle')[1].trigger('click')

    const details = wrapper.find('.archer-details')
    expect(details.find('a').exists()).toBe(false)
    expect(details.text()).not.toContain('Format')
    expect(details.text()).toContain('—')
  })

  it('has no sign-up action', () => {
    const buttons = mountView().find('[data-testid="upcoming-list"]').findAll('button')
    expect(buttons.every((button) => button.classes().includes('archer-tournament-toggle'))).toBe(true)
  })

  it('says so when there are no upcoming tournaments', () => {
    expect(mountView({ upcoming: [] }).text()).toContain('No upcoming tournaments.')
  })

  it('shows scores with the own match score only, never the opponent', async () => {
    const wrapper = mountView()
    await openScores(wrapper)
    const scores = wrapper.find('[data-testid="scores"]')

    expect(scores.text()).toContain('Spring Open')
    expect(scores.text()).toContain('Qualification: 600')
    expect(scores.text()).toContain('Final: 140')
    expect(scores.text()).not.toContain('9999')
    expect(scores.text()).toContain('Recurve Open')
  })

  it('shows the average per round and updates it with the date range', async () => {
    const wrapper = mountView()
    await openScores(wrapper)
    expect(wrapper.find('[data-testid="averages"]').text()).toContain('Average round score by category')
    expect(wrapper.find('[data-testid="averages"]').text()).toContain('Recurve Open: 550 (2 rounds)')

    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-08-01')
    await to.setValue('2026-12-31')

    expect(wrapper.find('[data-testid="averages"]').text()).toContain('500')
    expect(wrapper.text()).not.toContain('Spring Open')
  })

  it('labels scores of a tournament with no category and shows the label in Spanish', async () => {
    setLanguage('es-419')
    const noCategory = { ...data, tournaments: data.tournaments.map((item) => ({ ...item, categoryAssignments: {} })) }
    const wrapper = mountView({ data: noCategory })
    await openScores(wrapper)

    expect(wrapper.find('[data-testid="averages"]').text()).toContain('Sin categoría')
  })

  it('shows an empty state and no average when the range has no scores', async () => {
    const wrapper = mountView()
    await openScores(wrapper)
    await wrapper.findAll('input[type="date"]')[0].setValue('2027-01-01')

    expect(wrapper.text()).toContain('No scores yet.')
    expect(wrapper.find('[data-testid="averages"]').exists()).toBe(false)
  })

  it('clears the date range', async () => {
    const wrapper = mountView()
    await openScores(wrapper)
    await wrapper.findAll('input[type="date"]')[0].setValue('2027-01-01')
    await wrapper.find('.text-link').trigger('click')

    expect(wrapper.text()).toContain('Spring Open')
  })

  it('uses the app sidebar with the two archer pages and no club pages', () => {
    const wrapper = mountView()

    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.findAll('.nav-link').map((link) => link.text())).toEqual(['Upcoming tournaments', 'Scores'])
    expect(wrapper.find('.nav-link.active').text()).toBe('Upcoming tournaments')
  })

  it('moves to the Scores page from the sidebar and shows it in the breadcrumb', async () => {
    const wrapper = mountView()
    await openScores(wrapper)

    expect(wrapper.find('.nav-link.active').text()).toBe('Scores')
    expect(wrapper.find('.breadcrumbs strong').text()).toBe('Scores')
    expect(wrapper.find('[data-testid="upcoming-list"]').exists()).toBe(false)
  })

  it('has a launcher link and a theme toggle', async () => {
    const wrapper = mountView()
    expect(wrapper.find('a.portal-link').attributes('href')).toBe('../')

    await wrapper.find('.theme-toggle').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('dark')
    await wrapper.find('.theme-toggle').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('shows the Scores page in Spanish', () => {
    setLanguage('es-419')
    expect(mountView().text()).toContain('Puntuaciones')
  })
})
