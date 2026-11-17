import { afterEach, describe, expect, it, vi } from 'vitest'
import { language, setLanguage, t } from './index.js'

afterEach(() => {
  setLanguage('en')
  localStorage.clear()
})

describe('shared language preference', () => {
  it('translates interpolated messages and persists the selection', () => {
    setLanguage('es-419')
    expect(t('Add {name} to tournament', { name: 'Alex' })).toBe('Agregar a Alex al torneo')
    expect(document.documentElement.lang).toBe('es-419')
    expect(localStorage.getItem('shooting-line-language')).toBe('es-419')
    setLanguage('en')
    expect(t('Add {name} to tournament', { name: 'Alex' })).toBe('Add Alex to tournament')
  })

  it('updates from other tabs and resets to English when the preference is removed', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'shooting-line-language', newValue: 'es-419' }))
    expect(language.value).toBe('es-419')
    window.dispatchEvent(new StorageEvent('storage', { key: 'shooting-line-language', newValue: null }))
    expect(language.value).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('reports missing translations and rejects unsupported languages', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setLanguage('es-419')
    expect(t('Missing message')).toBe('Missing message')
    expect(warning).toHaveBeenCalled()
    expect(() => setLanguage('invalid')).toThrow('Unsupported language')
  })
})
