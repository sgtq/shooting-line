import { describe, expect, it } from 'vitest'
import { dayOfMonth, formatMonth } from './dateFormat'

describe('dayOfMonth', () => {
  it('reads the day without shifting it by the time zone', () => {
    expect(dayOfMonth('2026-12-01')).toBe(1)
    expect(dayOfMonth('2026-12-31')).toBe(31)
  })

  it('returns an empty string for no date', () => {
    expect(dayOfMonth('')).toBe('')
  })
})

describe('formatMonth', () => {
  it('names the month in the given language', () => {
    expect(formatMonth('2026-12-05', 'en').toLowerCase()).toBe('dec')
    expect(formatMonth('2026-12-05', 'es-419').toLowerCase()).toContain('dic')
  })

  it('returns an empty string for no date', () => {
    expect(formatMonth('', 'en')).toBe('')
  })
})
