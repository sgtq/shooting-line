import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import ClubForm from './ClubForm.vue'

function blank() {
  return reactive({
    name: '',
    representative: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    mapUrl: '',
    logoPreview: '',
  })
}

function mountForm(props = {}) {
  return mount(ClubForm, { props: { form: blank(), canManage: true, ...props } })
}

describe('ClubForm', () => {
  it('writes what the user types into the form', async () => {
    const form = blank()
    const wrapper = mountForm({ form })
    const inputs = wrapper.findAll('input:not([type="file"])')
    await inputs[0].setValue('North Club')
    await inputs[1].setValue('Rita')
    expect(form.name).toBe('North Club')
    expect(form.representative).toBe('Rita')
  })

  it('shows the form as it is given', () => {
    const form = blank()
    form.name = 'South Club'
    expect(mountForm({ form }).find('input').element.value).toBe('South Club')
  })

  it('locks the name, address, and map for someone who cannot manage and explains why', () => {
    const wrapper = mountForm({ canManage: false })
    expect(wrapper.find('.privacy-note').exists()).toBe(true)
    const locked = wrapper.findAll('input[disabled]')
    expect(locked).toHaveLength(3)
    expect(wrapper.find('input[type="tel"]').attributes('disabled')).toBeUndefined()
  })

  it('does not show the lock note to a manager', () => {
    const wrapper = mountForm()
    expect(wrapper.find('.privacy-note').exists()).toBe(false)
    expect(wrapper.findAll('input[disabled]')).toHaveLength(0)
  })

  it('reports the chosen logo file', async () => {
    const wrapper = mountForm()
    await wrapper.find('input[type="file"]').trigger('change')
    expect(wrapper.emitted('logo-selected')).toHaveLength(1)
  })

  it('shows a preview only when there is one', () => {
    expect(mountForm().find('.club-logo-preview').exists()).toBe(false)
    const form = blank()
    form.logoPreview = 'blob:preview'
    form.name = 'North'
    const img = mountForm({ form }).find('.club-logo-preview')
    expect(img.attributes('src')).toBe('blob:preview')
    expect(img.attributes('alt')).toContain('North')
  })
})
