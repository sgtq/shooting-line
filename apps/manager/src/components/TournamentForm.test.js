import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import TournamentForm from './TournamentForm.vue'

const clubs = [
  { id: 'c1', name: 'North Club', address: '1 Main St' },
  { id: 'c2', name: 'South Club', address: '' },
]
const tournamentTypes = [{ id: 'ty1', name: 'Outdoor 70m', distance: 70, distanceUnit: 'm', targetType: '122 cm' }]

function blank(overrides = {}) {
  return reactive({
    name: '',
    dateMode: 'range',
    startDate: '',
    endDate: '',
    days: [''],
    discipline: 'Outdoor target',
    tournamentTypeId: '',
    clubId: '',
    venueMode: 'club',
    customAddress: '',
    ...overrides,
  })
}

function mountForm(props = {}) {
  return mount(TournamentForm, {
    props: { form: blank(), modalType: 'tournament', tournamentTypes, clubs, clubId: '', canManage: true, ...props },
  })
}

describe('TournamentForm', () => {
  it('writes the name and the dates of a range', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    await wrapper.find('input:not([type])').setValue('Spring Open')
    const dates = wrapper.findAll('input[type="date"]')
    await dates[0].setValue('2026-05-01')
    await dates[1].setValue('2026-05-03')
    expect(form.name).toBe('Spring Open')
    expect(form.startDate).toBe('2026-05-01')
    expect(form.endDate).toBe('2026-05-03')
    expect(dates[1].attributes('min')).toBe('2026-05-01')
  })

  it('switches to separate dates, adds one, and removes one', async () => {
    const form = blank({ dateMode: 'days', days: ['2026-05-01'] })
    const wrapper = mountForm({ form })
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Remove date')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Add date')
      .trigger('click')
    expect(form.days).toEqual(['2026-05-01', ''])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Remove date')
      .trigger('click')
    expect(form.days).toHaveLength(1)
  })

  it('stops adding dates at the limit', () => {
    const form = blank({ dateMode: 'days', days: Array.from({ length: 31 }, () => '2026-05-01') })
    const add = mountForm({ form })
      .findAll('button')
      .find((button) => button.text() === 'Add date')
    expect(add.attributes('disabled')).toBeDefined()
  })

  it('shows only the dates for the edit dates dialog', () => {
    const wrapper = mountForm({ modalType: 'tournamentDates' })
    expect(wrapper.text()).not.toContain('TOURNAMENT NAME')
    expect(wrapper.text()).not.toContain('DISCIPLINE')
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
  })

  it('lists the tournament types and the clubs, and writes the choices', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    await wrapper.find('select[aria-label="Tournament type"]').setValue('ty1')
    await wrapper.find('select[aria-label="Host club"]').setValue('c1')
    expect(form.tournamentTypeId).toBe('ty1')
    expect(form.clubId).toBe('c1')
    expect(
      wrapper
        .find('select[aria-label="Host club"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['No club / independent event', 'North Club', 'South Club'])
  })

  it('limits a club user to their own club', () => {
    const wrapper = mountForm({ canManage: false, clubId: 'c2' })
    const select = wrapper.find('select[aria-label="Host club"]')
    expect(select.attributes('disabled')).toBeDefined()
    expect(select.findAll('option').map((option) => option.text())).toEqual(['South Club'])
    expect(wrapper.find('.target-type-add').exists()).toBe(false)
  })

  it('asks to add a type or a club from the plus buttons', async () => {
    const wrapper = mountForm()
    const [addType, addClub] = wrapper.findAll('.target-type-add')
    await addType.trigger('click')
    await addClub.trigger('click')
    expect(wrapper.emitted('add-type')).toHaveLength(1)
    expect(wrapper.emitted('add-club')).toHaveLength(1)
  })

  it('previews the club address, or says there is none', () => {
    expect(
      mountForm({ form: blank({ clubId: 'c1' }) })
        .find('.address-preview')
        .text(),
    ).toContain('1 Main St')
    expect(
      mountForm({ form: blank({ clubId: 'c2' }) })
        .find('.address-preview')
        .text(),
    ).toContain('This club has no address yet.')
    expect(mountForm().find('.address-preview').exists()).toBe(false)
  })

  it('asks for a custom address when the venue is custom', async () => {
    const form = blank({ venueMode: 'custom', clubId: 'c1' })
    const wrapper = mountForm({ form })
    expect(wrapper.find('.address-preview').exists()).toBe(false)
    const input = wrapper.find('input[placeholder="Street, city, state, ZIP"]')
    expect(input.attributes('required')).toBeDefined()
    await input.setValue('Field 9')
    expect(form.customAddress).toBe('Field 9')
  })
})
