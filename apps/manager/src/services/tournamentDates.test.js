import { describe, expect, it } from 'vitest'
import {
  expandRange,
  firstDay,
  lastDay,
  MAX_TOURNAMENT_DAYS,
  normalizeDays,
  validateDays,
  validateRange,
} from './tournamentDates.js'

describe('expandRange', () => {
  it('lists every day with both ends included', () => {
    expect(expandRange('2026-03-30', '2026-04-02')).toEqual(['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02'])
  })

  it('returns one day when start and end match', () => {
    expect(expandRange('2026-03-15', '2026-03-15')).toEqual(['2026-03-15'])
  })

  it('crosses a leap day', () => {
    expect(expandRange('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('returns nothing for an end before the start, a blank, or an invalid day', () => {
    expect(expandRange('2026-03-15', '2026-03-14')).toEqual([])
    expect(expandRange('', '2026-03-14')).toEqual([])
    expect(expandRange('2026-02-31', '2026-03-14')).toEqual([])
  })

  it('returns nothing past the day limit', () => {
    expect(expandRange('2026-01-01', '2026-01-31')).toHaveLength(MAX_TOURNAMENT_DAYS)
    expect(expandRange('2026-01-01', '2026-02-01')).toEqual([])
  })
})

describe('normalizeDays', () => {
  it('drops blanks and repeats and sorts oldest first', () => {
    expect(normalizeDays(['2026-05-02', '', '2026-05-01', '2026-05-02'])).toEqual(['2026-05-01', '2026-05-02'])
  })
})

describe('validateDays', () => {
  it('accepts one or more distinct valid days', () => {
    expect(validateDays(['2026-05-01'])).toBe('')
    expect(validateDays(['2026-05-03', '2026-05-01'])).toBe('')
  })

  it('requires at least one day, ignoring blank rows', () => {
    expect(validateDays([])).toBe('Add at least one tournament date')
    expect(validateDays(['', ''])).toBe('Add at least one tournament date')
  })

  it('rejects repeated days', () => {
    expect(validateDays(['2026-05-01', '2026-05-01'])).toBe('Tournament dates cannot repeat')
  })

  it('rejects invalid days', () => {
    expect(validateDays(['2026-13-01'])).toBe('Enter valid tournament dates')
  })

  it('rejects more days than the limit', () => {
    const days = [...expandRange('2026-01-01', '2026-01-31'), '2026-02-01']
    expect(validateDays(days)).toBe('A tournament can last at most 31 days')
  })
})

describe('validateRange', () => {
  it('accepts a valid range', () => {
    expect(validateRange('2026-05-01', '2026-05-03')).toBe('')
  })

  it('requires both ends', () => {
    expect(validateRange('2026-05-01', '')).toBe('Add at least one tournament date')
    expect(validateRange('', '2026-05-01')).toBe('Add at least one tournament date')
  })

  it('rejects an end before the start', () => {
    expect(validateRange('2026-05-03', '2026-05-01')).toBe('The end date cannot be before the start date')
  })

  it('rejects a range over the limit', () => {
    expect(validateRange('2026-01-01', '2026-03-01')).toBe('A tournament can last at most 31 days')
  })
})

describe('firstDay and lastDay', () => {
  it('return the ends of the list', () => {
    const tournament = { dates: ['2026-05-01', '2026-05-02', '2026-05-09'] }
    expect(firstDay(tournament)).toBe('2026-05-01')
    expect(lastDay(tournament)).toBe('2026-05-09')
  })

  it('return an empty string for no days', () => {
    expect(firstDay({ dates: [] })).toBe('')
    expect(lastDay({ dates: [] })).toBe('')
  })
})
