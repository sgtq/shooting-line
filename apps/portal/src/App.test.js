import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import App from './App.vue'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAppAccess: vi.fn(),
  onAuthStateChange: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

vi.mock('@shooting-line/auth', () => ({
  APP_IDS: { manager: 'manager', ianseoDashboard: 'ianseo-dashboard', scorecard: 'scorecard' },
  createSupabaseClient: () => ({ auth }),
  listAppAccess: auth.listAppAccess,
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

describe('portal launcher icons', () => {
  const signedIn = { user: { id: 'u1', email: 'archer@example.test' } }

  async function openLauncher(access) {
    auth.getSession.mockResolvedValue({ data: { session: signedIn }, error: null })
    auth.listAppAccess.mockResolvedValue({ data: access, error: null })
    const wrapper = mount(App)
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() })
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('gives every option a decorative inline icon', async () => {
    const wrapper = await openLauncher(['manager'])
    const cards = wrapper.findAll('.app-card')

    expect(cards).toHaveLength(3)
    for (const card of cards) {
      const icon = card.get('svg.app-icon')
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(icon.attributes('focusable')).toBe('false')
      expect(icon.find('title').exists()).toBe(false)
    }
  })

  it('draws a different icon for each app', async () => {
    const wrapper = await openLauncher(['manager'])
    const shapes = wrapper.findAll('.app-card svg.app-icon').map((icon) => icon.html())

    expect(new Set(shapes).size).toBe(3)
  })

  it('keeps the name readable as text and the icon out of the link name', async () => {
    const wrapper = await openLauncher(['manager'])
    const link = wrapper.get('a.app-card')

    expect(link.get('h2').text()).toBe('Tournament Manager')
    expect(link.text()).toContain('Tournament Manager')
    expect(link.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('keeps the icon on coming-soon and no-access tiles', async () => {
    const wrapper = await openLauncher([])
    const cards = wrapper.findAll('.app-card-disabled')

    expect(cards).toHaveLength(3)
    for (const card of cards) expect(card.find('svg.app-icon').exists()).toBe(true)
    expect(wrapper.find('.coming-soon-status').exists()).toBe(true)
  })
})

describe('portal dark theme', () => {
  const styles = readFileSync('apps/portal/src/style.css', 'utf8')
  const darkBlock = styles.slice(styles.indexOf('@media (prefers-color-scheme: dark)'))

  it('follows the system setting with a dark block', () => {
    expect(darkBlock.startsWith('@media (prefers-color-scheme: dark)')).toBe(true)
    expect(darkBlock).toContain('color-scheme: dark')
  })

  it.each([
    '.portal-panel',
    '.app-card',
    '.app-card-disabled',
    '.card-icon',
    '.coming-soon-status',
    '.sign-in-form input',
    '.primary-button',
    '.secondary-button',
    '.error-message',
  ])('restyles %s in dark mode', (selector) => {
    expect(darkBlock).toContain(selector)
  })

  it('sets the properties the shared language switcher reads', () => {
    for (const name of ['--text-primary', '--text-secondary', '--border-subtle', '--bg-surface']) {
      expect(darkBlock).toContain(name)
    }
  })
})
