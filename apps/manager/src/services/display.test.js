import { language } from '@shooting-line/i18n'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ageAtTournament,
  categoryDescription,
  displayChoice,
  formatDate,
  formatDates,
  fullName,
  greetingFor,
  today,
  venueFor,
} from './display'

afterEach(() => {
  language.value = 'en'
})

describe('today', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatDate', () => {
  it('formats a date without shifting it by the time zone', () => {
    expect(formatDate('2026-12-01')).toBe('Dec 1, 2026')
  })

  it('shows a placeholder when there is no date', () => {
    expect(formatDate('')).toBe('Date to be confirmed')
  })

  it('follows the current language', () => {
    language.value = 'es-419'
    expect(formatDate('2026-12-01')).not.toBe('Dec 1, 2026')
  })
})

describe('formatDates', () => {
  it('shows one day on its own', () => {
    expect(formatDates({ dates: ['2026-12-01'] })).toBe('Dec 1, 2026')
  })

  it('shows consecutive days as a range', () => {
    expect(formatDates({ dates: ['2026-12-01', '2026-12-02', '2026-12-03'] })).toBe('Dec 1, 2026 to Dec 3, 2026')
  })

  it('shows separate days as the first day with a count', () => {
    expect(formatDates({ dates: ['2026-12-01', '2026-12-05'] })).toBe('Dec 1, 2026 (2 days)')
  })
})

describe('displayChoice', () => {
  it('translates a known choice', () => {
    language.value = 'es-419'
    expect(displayChoice('Recurve')).not.toBe('Recurve')
  })

  it('keeps user text as typed', () => {
    language.value = 'es-419'
    expect(displayChoice('My own bow')).toBe('My own bow')
  })
})

describe('fullName', () => {
  it('joins first and last name', () => {
    expect(fullName({ firstName: 'Ana', lastName: 'Perez' })).toBe('Ana Perez')
  })
})

describe('categoryDescription', () => {
  it('describes a closed age range and a bow type', () => {
    expect(categoryDescription({ minAge: 10, maxAge: 14, bowType: 'Recurve' })).toBe('Age 10–14 · Recurve')
  })

  it('describes an open ended minimum age', () => {
    expect(categoryDescription({ minAge: 18, maxAge: null, bowType: '' })).toBe('Age 18+ · Any bow type')
  })

  it('describes a maximum age only', () => {
    expect(categoryDescription({ minAge: '', maxAge: 12, bowType: 'Compound' })).toBe('Up to age 12 · Compound')
  })

  it('describes a category with no age limits', () => {
    expect(categoryDescription({ minAge: null, maxAge: null, bowType: '' })).toBe('All ages · Any bow type')
  })

  it('treats an age of zero as a real limit', () => {
    expect(categoryDescription({ minAge: 0, maxAge: 10, bowType: '' })).toBe('Age 0–10 · Any bow type')
  })
})

describe('ageAtTournament', () => {
  const tournament = { dates: ['2026-06-15'] }

  it('counts the birthday when it falls on the first day', () => {
    expect(ageAtTournament({ birthDate: '2010-06-15' }, tournament)).toBe(16)
  })

  it('subtracts a year when the birthday has not passed', () => {
    expect(ageAtTournament({ birthDate: '2010-06-16' }, tournament)).toBe(15)
  })

  it('returns null without a birth date or a tournament day', () => {
    expect(ageAtTournament({ birthDate: '' }, tournament)).toBeNull()
    expect(ageAtTournament({ birthDate: '2010-01-01' }, { dates: [] })).toBeNull()
  })
})

describe('greetingFor', () => {
  it('changes with the time of day', () => {
    expect(greetingFor('Ana', 8)).toBe('Good morning, Ana')
    expect(greetingFor('Ana', 12)).toBe('Good afternoon, Ana')
    expect(greetingFor('Ana', 16)).toBe('Good afternoon, Ana')
    expect(greetingFor('Ana', 17)).toBe('Good evening, Ana')
    expect(greetingFor('Ana', 0)).toBe('Good morning, Ana')
  })

  it('addresses someone with no name as there', () => {
    expect(greetingFor('', 9)).toBe('Good morning, there')
  })
})

describe('venueFor', () => {
  const clubs = [
    { id: 'c1', address: '1 Main St' },
    { id: 'c2', address: '' },
  ]

  it('uses the custom address when the venue is custom', () => {
    expect(venueFor({ venueMode: 'custom', customAddress: 'Field 9', clubId: 'c1' }, clubs)).toBe('Field 9')
  })

  it('uses the hosting club address', () => {
    expect(venueFor({ venueMode: 'club', customAddress: '', clubId: 'c1' }, clubs)).toBe('1 Main St')
  })

  it('says the address is not set when the club has none or there is no club', () => {
    expect(venueFor({ venueMode: 'club', customAddress: '', clubId: 'c2' }, clubs)).toBe('Club address not set')
    expect(venueFor({ venueMode: 'club', customAddress: '', clubId: '' }, clubs)).toBe('Club address not set')
  })

  it('returns an empty string without a tournament', () => {
    expect(venueFor(undefined, clubs)).toBe('')
  })
})
