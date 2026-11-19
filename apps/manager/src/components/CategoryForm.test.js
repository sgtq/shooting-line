import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import CategoryForm from './CategoryForm.vue'

function blank(overrides = {}) {
  return reactive({ name: '', minAge: '', maxAge: '', bowType: '', sortOrder: '', levelExempt: false, ...overrides })
}

function mountForm(form = blank()) {
  return mount(CategoryForm, { props: { form } })
}

describe('CategoryForm', () => {
  it('writes the name, ages as numbers, and the bow type', async () => {
    const form = blank()
    const wrapper = mountForm(form)
    await wrapper.find('input').setValue('Junior Recurve')
    await wrapper.find('input[placeholder="No minimum"]').setValue('10')
    await wrapper.find('input[placeholder="No maximum"]').setValue('17')
    await wrapper.find('select').setValue('Recurve')
    expect(form.name).toBe('Junior Recurve')
    expect(form.minAge).toBe(10)
    expect(form.maxAge).toBe(17)
    expect(form.bowType).toBe('Recurve')
  })

  it('asks for the level order and explains the rule', () => {
    const wrapper = mountForm()
    expect(wrapper.find('input[type="number"][required]').exists()).toBe(true)
    expect(wrapper.text()).toContain('LEVEL ORDER')
    expect(wrapper.text()).toContain('can never enter one with a lower level order')
  })

  it('writes the level order as a number, keeping zero', async () => {
    const form = blank()
    const wrapper = mountForm(form)
    await wrapper.find('input[type="number"][required]').setValue('0')
    expect(form.sortOrder).toBe(0)
  })

  it('hides the level order when the category is exempt', async () => {
    const form = blank()
    const wrapper = mountForm(form)
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(form.levelExempt).toBe(true)
    expect(wrapper.text()).not.toContain('LEVEL ORDER')
    expect(wrapper.find('input[type="number"][required]').exists()).toBe(false)
  })

  it('shows the age note either way', () => {
    expect(mountForm(blank({ levelExempt: true })).text()).toContain('Leave a field blank')
  })
})
