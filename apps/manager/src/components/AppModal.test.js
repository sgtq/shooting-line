import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppModal from './AppModal.vue'
import TargetTypeModal from './TargetTypeModal.vue'

function mountModal(props = {}, slots = {}) {
  return mount(AppModal, {
    props: {
      eyebrow: 'CLUB DIRECTORY',
      title: 'Add a club',
      submitLabel: 'Save club',
      cancelLabel: 'Cancel',
      ...props,
    },
    slots: { default: '<input class="body-input" />', ...slots },
  })
}

describe('AppModal', () => {
  it('shows the heading, the body, and the buttons', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.eyebrow').text()).toBe('CLUB DIRECTORY')
    expect(wrapper.find('h2').text()).toBe('Add a club')
    expect(wrapper.find('.body-input').exists()).toBe(true)
    expect(wrapper.find('.button-primary').text()).toBe('Save club')
    expect(wrapper.find('.button-outline').text()).toBe('Cancel')
  })

  it('submits without reloading the page', async () => {
    const wrapper = mountModal()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('closes from the cancel button, the x button, and a click outside the dialog', async () => {
    const wrapper = mountModal()
    await wrapper.find('.button-outline').trigger('click')
    await wrapper.find('.modal-close').trigger('click')
    await wrapper.find('.modal-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)
  })

  it('does not close when the click is inside the dialog', async () => {
    const wrapper = mountModal()
    await wrapper.find('.modal').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('shows an error only when there is one', () => {
    expect(mountModal().find('.modal-error').exists()).toBe(false)
    expect(mountModal({ error: 'Save failed: nope' }).find('.modal-error').text()).toBe('Save failed: nope')
  })

  it('renders the after slot next to the form for a nested dialog', () => {
    const wrapper = mountModal({}, { after: '<div class="nested">nested</div>' })
    expect(wrapper.find('.modal-backdrop > .nested').exists()).toBe(true)
  })
})

describe('TargetTypeModal', () => {
  it('reports the typed name and saves from the button and the Enter key', async () => {
    const wrapper = mount(TargetTypeModal, { props: { name: '' } })
    const input = wrapper.find('input')
    await input.setValue('40 cm triple-spot')
    expect(wrapper.emitted('update:name')[0]).toEqual(['40 cm triple-spot'])
    await input.trigger('keydown', { key: 'Enter' })
    await wrapper.find('.button-primary').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(2)
  })

  it('closes from cancel, the x button, and a click outside', async () => {
    const wrapper = mount(TargetTypeModal)
    await wrapper.find('.button-outline').trigger('click')
    await wrapper.find('.modal-close').trigger('click')
    await wrapper.find('.modal-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)
  })

  it('shows its own error', () => {
    expect(
      mount(TargetTypeModal, { props: { error: 'Save failed: dup' } })
        .find('.modal-error')
        .text(),
    ).toBe('Save failed: dup')
    expect(mount(TargetTypeModal).find('.modal-error').exists()).toBe(false)
  })
})
