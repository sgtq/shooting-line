import { describe, expect, it } from 'vitest'

describe('shared test setup', () => {
  it('gives tests a working localStorage', () => {
    localStorage.setItem('key', 'value')

    expect(localStorage.getItem('key')).toBe('value')
    localStorage.removeItem('key')
    expect(localStorage.getItem('key')).toBeNull()
  })

  it('starts each test with empty storage', () => {
    expect(localStorage.length).toBe(0)
    localStorage.setItem('leftover', '1')
  })

  it('does not carry values over from the previous test', () => {
    expect(localStorage.getItem('leftover')).toBeNull()
  })
})
