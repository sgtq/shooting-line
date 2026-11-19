import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import ArcherForm from './ArcherForm.vue'

const clubs = [
  { id: 'c1', name: 'North Club' },
  { id: 'c2', name: 'South Club' },
]
const categories = [
  { id: 'open', name: 'Recurve Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null },
  { id: 'comp', name: 'Compound Open', bowType: 'Compound', sortOrder: 1, minAge: null, maxAge: null },
]
const tournament = { id: 't1', dates: ['2026-06-01'], categoryIds: ['open', 'comp'], categoryAssignments: {} }
const match = { token: 'tok-1', firstName: 'Ana', lastName: 'Archer', clubId: 'c1' }

function blank(overrides = {}) {
  return reactive({
    firstName: '',
    lastName: '',
    birthDate: '',
    waId: '',
    aetayId: '',
    email: '',
    clubId: '',
    bowType: '',
    categoryId: '',
    ...overrides,
  })
}

function mountForm(props = {}) {
  return mount(ArcherForm, {
    props: {
      form: blank(),
      matchToken: '',
      selectedMatch: null,
      archerMatches: [],
      assignNewParticipant: false,
      editingParticipantId: '',
      selectedTournament: undefined,
      clubs,
      categories,
      tournaments: [tournament],
      clubId: '',
      canManage: true,
      ...props,
    },
  })
}

describe('ArcherForm', () => {
  it('writes the typed values into the form', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    await wrapper.find('input[placeholder="Last name"]').setValue('Archer')
    await wrapper.find('input[placeholder="First name"]').setValue('Ana')
    await wrapper.find('input[type="date"]').setValue('2000-01-01')
    await wrapper.find('input[type="email"]').setValue('ana@example.com')
    expect(form).toMatchObject({
      lastName: 'Archer',
      firstName: 'Ana',
      birthDate: '2000-01-01',
      email: 'ana@example.com',
    })
  })

  it('requires the names and birth date for a new archer', () => {
    const wrapper = mountForm()
    expect(wrapper.find('input[placeholder="Last name"]').attributes('required')).toBeDefined()
    expect(wrapper.find('input[type="date"]').attributes('required')).toBeDefined()
  })

  it('offers every club to a manager, with no club as an option', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    const select = wrapper.find('select')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'No club / independent archer',
      'North Club',
      'South Club',
    ])
    await select.setValue('c2')
    expect(form.clubId).toBe('c2')
  })

  it('limits a club user to their own club and marks the club as required', () => {
    const wrapper = mountForm({ canManage: false, clubId: 'c1' })
    const select = wrapper.find('select')
    expect(select.attributes('disabled')).toBeDefined()
    expect(select.findAll('option').map((option) => option.text())).toEqual(['North Club'])
    const clubLabel = wrapper.find('select').element.closest('label')
    expect(clubLabel.querySelector('b')).not.toBeNull()
    expect(clubLabel.querySelector('small')).toBeNull()

    const managerLabel = mountForm().find('select').element.closest('label')
    expect(managerLabel.querySelector('small')).not.toBeNull()
    expect(managerLabel.querySelector('b')).toBeNull()
  })

  it('lists archers already in the database and lets a picker choose one only when adding to a tournament', async () => {
    const adding = mountForm({ archerMatches: [match], assignNewParticipant: true })
    expect(adding.find('.archer-pick').text()).toContain('Archer, Ana')
    expect(adding.find('.archer-pick').text()).toContain('North Club')
    await adding.find('input[type="radio"]').setValue()
    expect(adding.emitted('update:matchToken')[0]).toEqual(['tok-1'])
    expect(adding.find('.privacy-note').text()).toContain('Click one to add them')

    const browsing = mountForm({ archerMatches: [match] })
    expect(browsing.find('input[type="radio"]').attributes('disabled')).toBeDefined()
    expect(browsing.find('.privacy-note').text()).toContain('not creating a duplicate')
  })

  it('hides the new archer fields and the names requirement once a match is picked', async () => {
    const wrapper = mountForm({ selectedMatch: match, matchToken: 'tok-1' })
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="Last name"]').attributes('required')).toBeUndefined()
    expect(wrapper.text()).toContain('Adding Ana Archer')
    await wrapper.find('.address-preview .text-link').trigger('click')
    expect(wrapper.emitted('update:matchToken')[0]).toEqual([''])
  })

  it('clears the form from the link, but not while editing', async () => {
    const wrapper = mountForm()
    await wrapper.find('.text-link').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(mountForm({ editingParticipantId: 'p1' }).text()).not.toContain('Clear form')
  })

  it('asks for a bow type and a category when adding to a tournament that has categories', async () => {
    const form = blank()
    const wrapper = mountForm({ form, assignNewParticipant: true, selectedTournament: tournament })
    const selects = wrapper.findAll('select')
    const bow = selects.find((select) => select.attributes('aria-label') === 'Bow type')
    expect(bow.findAll('option').map((option) => option.text())).toEqual(['Choose bow type', 'Recurve', 'Compound'])
    await bow.setValue('Recurve')
    expect(form.bowType).toBe('Recurve')
    const category = wrapper.findAll('select').find((select) => select.attributes('aria-label') === 'Category')
    expect(category.findAll('option').map((option) => option.text())).toEqual(['Choose category', 'Recurve Open'])
  })

  it('resets the category when the bow type changes', async () => {
    const form = blank({ bowType: 'Recurve', categoryId: 'open' })
    const wrapper = mountForm({ form, assignNewParticipant: true, selectedTournament: tournament })
    const bow = wrapper.findAll('select').find((select) => select.attributes('aria-label') === 'Bow type')
    await bow.setValue('Compound')
    expect(form.categoryId).toBe('')
  })

  it('disables a category the archer is too young for', () => {
    const form = blank({ bowType: 'Recurve', birthDate: '2015-01-01' })
    const wrapper = mountForm({ form, assignNewParticipant: true, selectedTournament: tournament })
    const option = wrapper.find('option[value="open"]')
    expect(option.attributes('disabled')).toBeDefined()
  })

  it('does not ask for a category when not adding to a tournament, when editing, or without categories', () => {
    const notAdding = mountForm({ selectedTournament: tournament })
    const editing = mountForm({
      assignNewParticipant: true,
      editingParticipantId: 'p1',
      selectedTournament: tournament,
    })
    const bare = mountForm({
      assignNewParticipant: true,
      selectedTournament: { ...tournament, categoryIds: [] },
    })
    for (const wrapper of [notAdding, editing, bare]) {
      expect(wrapper.find('select[aria-label="Bow type"]').exists()).toBe(false)
    }
  })
})
