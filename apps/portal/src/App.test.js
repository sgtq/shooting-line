import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import App from './App.vue'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

vi.mock('@shooting-line/auth', () => ({
  APP_IDS: { manager: 'manager', ianseoDashboard: 'ianseo-dashboard', scorecard: 'scorecard' },
  createSupabaseClient: () => ({ auth }),
  listAppAccess: vi.fn().mockResolvedValue({ data: [], error: null }),
  requestPasswordReset: auth.requestPasswordReset,
}))

async function openForgotPassword() {
  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('button.secondary-button').trigger('click')
  return wrapper
}

describe('portal forgot password', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() })
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    auth.requestPasswordReset.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('lets a signed-out user request a reset email without a password', async () => {
    const wrapper = await openForgotPassword()
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)

    await wrapper.get('input[type="email"]').setValue('archer@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auth.requestPasswordReset).toHaveBeenCalledWith(expect.anything(), 'archer@example.test')
    expect(wrapper.get('[role="status"]').text()).toContain('password reset email will be sent')
  })

  it('shows the service error and no confirmation when the request fails', async () => {
    auth.requestPasswordReset.mockResolvedValue({ error: new Error('Too many requests') })
    const wrapper = await openForgotPassword()

    await wrapper.get('input[type="email"]').setValue('archer@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Too many requests')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('clears an earlier confirmation when a later request fails', async () => {
    const wrapper = await openForgotPassword()
    await wrapper.get('input[type="email"]').setValue('archer@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)

    auth.requestPasswordReset.mockResolvedValue({ error: new Error('Too many requests') })
    await wrapper.get('input[type="email"]').setValue('other@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Too many requests')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('returns to the sign-in form', async () => {
    const wrapper = await openForgotPassword()
    await wrapper.findAll('button.secondary-button')[0].trigger('click')

    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })
})
