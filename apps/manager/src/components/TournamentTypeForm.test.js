import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import TournamentTypeForm from './TournamentTypeForm.vue'

function blank() {
  return reactive({ name: '', distance: '', distanceUnit: 'm', targetType: '', ends: '', arrowsPerEnd: '' })
}

function mountForm(props = {}) {
  return mount(TournamentTypeForm, {
    props: { form: blank(), targetTypeOptions: ['122 cm face', '80 cm face'], canManage: true, ...props },
  })
}

describe('TournamentTypeForm', () => {
  it('writes the typed values into the form, numbers as numbers', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    await wrapper.find('input').setValue('Outdoor 70m')
    await wrapper.find('input[placeholder="70"]').setValue('70')
    await wrapper.find('input[placeholder="12"]').setValue('12')
    expect(form.name).toBe('Outdoor 70m')
    expect(form.distance).toBe(70)
    expect(form.ends).toBe(12)
  })

  it('offers meters and yards', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    const unit = wrapper.findAll('select')[0]
    expect(unit.findAll('option').map((option) => option.attributes('value'))).toEqual(['m', 'yd'])
    await unit.setValue('yd')
    expect(form.distanceUnit).toBe('yd')
  })

  it('lists the target types it is given and writes the choice', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    const select = wrapper.findAll('select')[1]
    expect(select.findAll('option').map((option) => option.text())).toContain('80 cm face')
    await select.setValue('80 cm face')
    expect(form.targetType).toBe('80 cm face')
  })

  it('asks to add a custom target type, for a manager only', async () => {
    const wrapper = mountForm()
    await wrapper.find('.target-type-add').trigger('click')
    expect(wrapper.emitted('add-target-type')).toHaveLength(1)
    expect(mountForm({ canManage: false }).find('.target-type-add').exists()).toBe(false)
  })

  it('requires the number fields to be positive', () => {
    const wrapper = mountForm()
    expect(wrapper.find('input[placeholder="70"]').attributes('min')).toBe('0.1')
    expect(wrapper.find('input[placeholder="12"]').attributes('min')).toBe('1')
    expect(wrapper.find('input[placeholder="6"]').attributes('min')).toBe('1')
  })
})
