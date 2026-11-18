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
    hostClub: 'Club A',
    address: 'Main street 1',
    categories: ['Recurve Open', 'Compound Open'],
    isEntered: true,
  },
]

function mountView(overrides = {}) {
  return mount(ArcherView, {
    props: { data, upcoming, participantId: ME, userName: 'Alex', today: '2026-10-01', ...overrides },
  })
}

async function openScores(wrapper) {
  await wrapper.findAll('[role="tab"]')[1].trigger('click')
}

describe('ArcherView', () => {
  afterEach(() => setLanguage('en'))

  it('lists upcoming tournaments with their details and no sign-up action', () => {
    const wrapper = mountView()
    const list = wrapper.find('[data-testid="upcoming-list"]')

    expect(list.text()).toContain('Winter Classic')
    expect(list.text()).toContain('2026-12-05 - 2026-12-06')
    expect(list.text()).toContain('Indoor 18m')
    expect(list.text()).toContain('Club A')
    expect(list.text()).toContain('Main street 1')
    expect(list.text()).toContain('Recurve Open, Compound Open')
    expect(list.text()).toContain('You are entered')
    expect(list.find('button').exists()).toBe(false)
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
    expect(wrapper.find('[data-testid="averages"]').text()).toContain('550')

    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-08-01')
    await to.setValue('2026-12-31')

    expect(wrapper.find('[data-testid="averages"]').text()).toContain('500')
    expect(wrapper.text()).not.toContain('Spring Open')
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

  it('shows the Scores tab in Spanish', () => {
    setLanguage('es-419')
    expect(mountView().text()).toContain('Puntuaciones')
  })
})
