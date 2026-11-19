import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import ProfileForm from './ProfileForm.vue'

describe('ProfileForm', () => {
  it('writes the display name and requires it', async () => {
    const form = reactive({ displayName: '' })
    const wrapper = mount(ProfileForm, { props: { form, userEmail: 'me@example.com' } })
    const input = wrapper.find('input')
    expect(input.attributes('required')).toBeDefined()
    await input.setValue('Ana')
    expect(form.displayName).toBe('Ana')
  })

  it('offers a password reset link only when the user has an email', async () => {
    const withEmail = mount(ProfileForm, {
      props: { form: reactive({ displayName: '' }), userEmail: 'me@example.com' },
    })
    await withEmail.find('button').trigger('click')
    expect(withEmail.emitted('reset-password')).toHaveLength(1)

    const without = mount(ProfileForm, { props: { form: reactive({ displayName: '' }), userEmail: '' } })
    expect(without.find('button').exists()).toBe(false)
  })
})
