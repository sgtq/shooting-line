import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TournamentArchersTab from './TournamentArchersTab.vue'

const clubs = [{ id: 'c1', name: 'North Club' }]
const categories = [
  { id: 'open', name: 'Recurve Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null },
  { id: 'pro', name: 'Recurve Pro', bowType: 'Recurve', sortOrder: 2, minAge: null, maxAge: null },
  { id: 'youth', name: 'Recurve Youth', bowType: 'Recurve', sortOrder: 0, minAge: null, maxAge: 17 },
]
const ana = { id: 'a', firstName: 'Ana', lastName: 'Archer', birthDate: '2000-01-01', waId: 'WA-1', clubId: 'c1' }
const bo = { id: 'b', firstName: 'Bo', lastName: 'Bowman', birthDate: '', waId: '', aetayId: 'AE-2', clubId: '' }
const outsider = { id: 'z', firstName: 'Zed', lastName: 'Zeta', birthDate: '', waId: '', clubId: '' }

function makeTournament(overrides = {}) {
  return {
    id: 't1',
    dates: ['2026-06-01'],
    participantIds: ['a', 'b'],
    categoryIds: ['open', 'pro'],
    categoryAssignments: { a: 'open' },
    ...overrides,
  }
}

function mountTab(props = {}) {
  const tournament = props.tournament || makeTournament()
  return mount(TournamentArchersTab, {
    props: {
      tournament,
      participants: [ana, bo, outsider],
      clubs,
      categories,
      tournaments: [tournament],
      canEditTournament: true,
      ...props,
    },
  })
}

describe('TournamentArchersTab', () => {
  it('lists only the archers entered in the tournament', () => {
    const rows = mountTab().findAll('.roster-list .roster-row:not(.roster-head)')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Archer, Ana')
    expect(rows[0].text()).toContain('World Archery WA-1')
    expect(rows[0].text()).toContain('North Club')
    expect(rows[0].text()).toContain('26 at event')
    expect(rows[1].text()).toContain('AE-2')
    expect(rows[1].text()).toContain('No club')
    expect(rows[1].text()).toContain('Age unknown')
  })

  it('filters by club and by search text, and says when nothing matches', async () => {
    const wrapper = mountTab()
    await wrapper.find('select').setValue('__unassigned__')
    expect(wrapper.emitted('update:clubFilter')[0]).toEqual(['__unassigned__'])
    const filtered = mountTab({ clubFilter: '__unassigned__' })
    expect(filtered.findAll('.roster-row:not(.roster-head)')).toHaveLength(1)

    const searched = mountTab({ search: 'nobody' })
    expect(searched.find('.empty-state').text()).toContain('No archers match these filters')
  })

  it('suggests last names and ids while typing', () => {
    const values = mountTab()
      .findAll('datalist option')
      .map((option) => option.attributes('value'))
    expect(values).toEqual(['Archer', 'WA-1', 'Bowman', 'AE-2'])
  })

  it('shows the assigned category with change and remove buttons for an editor', async () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('.roster-row:not(.roster-head)')[0]
    expect(row.find('.roster-category').text()).toBe('Recurve Open')
    const [change, remove] = row.findAll('.roster-category-cell .button-icon')
    await remove.trigger('click')
    expect(wrapper.emitted('clear-category')[0]).toEqual([wrapper.props('tournament'), ana])
    await change.trigger('click')
    expect(row.find('select.category-select').exists()).toBe(true)
  })

  it('opens the change picker with only allowed categories, reports the choice, and closes it', async () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('.roster-row:not(.roster-head)')[0]
    await row.findAll('.roster-category-cell .button-icon')[0].trigger('click')
    const options = row.findAll('select option').map((option) => option.text())
    expect(options).toEqual(['Change category', 'Recurve Pro'])
    await row.find('select').setValue('pro')
    expect(wrapper.emitted('change-category')[0].slice(0, 2)).toEqual([wrapper.props('tournament'), ana])
    expect(row.find('select').exists()).toBe(false)
  })

  it('cancels the change picker', async () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('.roster-row:not(.roster-head)')[0]
    await row.findAll('.roster-category-cell .button-icon')[0].trigger('click')
    await row.find('.roster-category-cell .button').trigger('click')
    expect(row.find('select').exists()).toBe(false)
  })

  it('hides the change button when no other category is allowed', () => {
    const tournament = makeTournament({ categoryIds: ['open'] })
    const row = mountTab({ tournament }).findAll('.roster-row:not(.roster-head)')[0]
    expect(row.findAll('.roster-category-cell .button-icon')).toHaveLength(1)
  })

  it('offers a picker to an archer with no category and disables categories they cannot enter', async () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('.roster-row:not(.roster-head)')[1]
    await row.find('select').setValue('open')
    expect(wrapper.emitted('choose-category')[0].slice(0, 2)).toEqual([wrapper.props('tournament'), bo])

    const young = { ...bo, birthDate: '2015-01-01' }
    const tournament = makeTournament()
    const withKid = mountTab({ tournament, participants: [ana, young] })
    const open = withKid.findAll('.roster-row:not(.roster-head)')[1].find('option[value="open"]')
    expect(open.attributes('disabled')).toBeDefined()
    expect(open.attributes('title')).toContain('below this category')
  })

  it('shows a dash when the tournament has no categories', () => {
    const row = mountTab({ tournament: makeTournament({ categoryIds: [], categoryAssignments: {} }) }).findAll(
      '.roster-row:not(.roster-head)',
    )[1]
    expect(row.find('.roster-category').text()).toBe('—')
  })

  it('asks to add an archer and to remove one', async () => {
    const wrapper = mountTab()
    await wrapper.find('.panel-heading button').trigger('click')
    expect(wrapper.emitted('add-archer')).toHaveLength(1)
    await wrapper.findAll('.roster-actions button')[1].trigger('click')
    expect(wrapper.emitted('remove')[0]).toEqual([wrapper.props('tournament'), bo])
  })

  it('shows read only rows to someone who cannot edit', () => {
    const wrapper = mountTab({ canEditTournament: false })
    expect(wrapper.find('.panel-heading button').exists()).toBe(false)
    expect(wrapper.find('.roster-actions').exists()).toBe(false)
    expect(wrapper.findAll('.roster-category-cell .button-icon')).toHaveLength(0)
    expect(wrapper.findAll('.roster-category-cell select')).toHaveLength(0)
  })

  it('shows the empty state of an empty tournament with an add button for an editor only', async () => {
    const tournament = makeTournament({ participantIds: [] })
    const wrapper = mountTab({ tournament })
    expect(wrapper.find('.empty-state').text()).toContain('No archers in this tournament')
    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('add-archer')).toHaveLength(1)

    const viewer = mountTab({ tournament, canEditTournament: false })
    expect(viewer.find('.empty-state button').exists()).toBe(false)
    expect(viewer.text()).toContain('Archers entered in this tournament will appear here.')
  })
})
