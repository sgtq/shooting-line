import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import UserRoleForm from './UserRoleForm.vue'

describe('UserRoleForm', () => {
  it('writes the email and the optional display name', async () => {
    const form = reactive({ email: '', displayName: '', role: 'manager' })
    const wrapper = mount(UserRoleForm, { props: { form } })
    await wrapper.find('input[type="email"]').setValue('boss@example.com')
    await wrapper.findAll('input')[1].setValue('The Boss')
    expect(form.email).toBe('boss@example.com')
    expect(form.displayName).toBe('The Boss')
    expect(form.role).toBe('manager')
  })

  it('requires the email but not the display name', () => {
    const wrapper = mount(UserRoleForm, { props: { form: reactive({ email: '', displayName: '' }) } })
    expect(wrapper.find('input[type="email"]').attributes('required')).toBeDefined()
    expect(wrapper.findAll('input')[1].attributes('required')).toBeUndefined()
  })

  it('warns that the account must already exist', () => {
    const wrapper = mount(UserRoleForm, { props: { form: reactive({ email: '', displayName: '' }) } })
    expect(wrapper.text()).toContain('must already exist')
  })
})
