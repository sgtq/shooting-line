import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useTheme } from './useTheme'

function stubStorage(store) {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value
    }),
  })
}

describe('useTheme', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme
  })

  afterEach(() => vi.unstubAllGlobals())

  it('starts light when nothing is saved and marks the page', () => {
    stubStorage({})
    const { theme } = useTheme()

    expect(theme.value).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('starts with the saved dark theme', () => {
    stubStorage({ 'shooting-line-theme': 'dark' })

    expect(useTheme().theme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggles, updates the page, and saves the choice', async () => {
    const store = {}
    stubStorage(store)
    const { theme, toggleTheme } = useTheme()

    toggleTheme()
    await nextTick()

    expect(theme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(store['shooting-line-theme']).toBe('dark')
  })

  it('still works when the storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { theme, toggleTheme } = useTheme()

    expect(theme.value).toBe('light')
    toggleTheme()
    await nextTick()
    expect(theme.value).toBe('dark')
  })
})
