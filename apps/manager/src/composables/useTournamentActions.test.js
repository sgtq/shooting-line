import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useManagerStore } from '../stores/managerStore'
import { useTournamentActions } from './useTournamentActions'

const categories = [
  { id: 'open', name: 'Recurve Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null },
  { id: 'pro', name: 'Recurve Pro', bowType: 'Recurve', sortOrder: 2, minAge: null, maxAge: null },
]
const archer = { id: 'a', firstName: 'Ana', lastName: 'Archer', birthDate: '2000-01-01', clubId: 'c1' }

let store
let repository
let notify
let selectedCategoryId
let actions

function tournament(overrides = {}) {
  return {
    id: 't1',
    dates: ['2026-06-01'],
    participantIds: ['a'],
    categoryIds: ['open', 'pro'],
    categoryAssignments: { a: 'open' },
    startedAt: '',
    ...overrides,
  }
}

function pickerEvent(value) {
  return { target: { value } }
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useManagerStore()
  store.load({ categories, participants: [archer], tournaments: [], clubs: [] })
  repository = {
    setTournamentCategory: vi.fn().mockResolvedValue(),
    setTournamentParticipant: vi.fn().mockResolvedValue(),
    setParticipantCategory: vi.fn().mockResolvedValue(),
    setTournamentStarted: vi.fn().mockResolvedValue(),
    setParticipantClub: vi.fn().mockResolvedValue(),
    setClubEnabled: vi.fn().mockResolvedValue(),
  }
  notify = vi.fn()
  selectedCategoryId = ref('')
  actions = useTournamentActions({ repository, notify, selectedCategoryId })
})

afterEach(() => vi.restoreAllMocks())

describe('toggleTournamentCategory', () => {
  it('adds a category to the tournament', async () => {
    const current = tournament({ categoryIds: [], categoryAssignments: {} })
    await actions.toggleTournamentCategory(current, 'open')
    expect(repository.setTournamentCategory).toHaveBeenCalledWith('t1', 'open', true)
    expect(current.categoryIds).toEqual(['open'])
  })

  it('removes the category, the archers assignments to it, and the Olympic selection', async () => {
    const current = tournament({ categoryAssignments: { a: 'open', b: 'pro' } })
    selectedCategoryId.value = 'open'
    await actions.toggleTournamentCategory(current, 'open')
    expect(repository.setTournamentCategory).toHaveBeenCalledWith('t1', 'open', false)
    expect(current.categoryIds).toEqual(['pro'])
    expect(current.categoryAssignments).toEqual({ b: 'pro' })
    expect(selectedCategoryId.value).toBe('')
  })

  it('keeps the Olympic selection when another category is removed', async () => {
    selectedCategoryId.value = 'pro'
    await actions.toggleTournamentCategory(tournament(), 'open')
    expect(selectedCategoryId.value).toBe('pro')
  })

  it('changes nothing when the save fails', async () => {
    repository.setTournamentCategory.mockRejectedValue(new Error('denied'))
    const current = tournament()
    await actions.toggleTournamentCategory(current, 'open')
    expect(current.categoryIds).toEqual(['open', 'pro'])
    expect(store.databaseError).toBe('Save failed: denied')
  })
})

describe('addParticipantWithCategory', () => {
  it('enters the archer with the category and resets the picker', async () => {
    const current = tournament({ participantIds: [], categoryAssignments: {} })
    const event = pickerEvent('open')
    await actions.addParticipantWithCategory(current, archer, event)
    expect(repository.setTournamentParticipant).toHaveBeenCalledWith('t1', 'a', true, 'open')
    expect(current.participantIds).toEqual(['a'])
    expect(current.categoryAssignments).toEqual({ a: 'open' })
    expect(event.target.value).toBe('')
  })

  it('does not enter the same archer twice when changing category', async () => {
    const current = tournament()
    await actions.addParticipantWithCategory(current, archer, pickerEvent('pro'))
    expect(current.participantIds).toEqual(['a'])
    expect(current.categoryAssignments.a).toBe('pro')
  })

  it('refuses an unknown or empty category', async () => {
    await actions.addParticipantWithCategory(tournament(), archer, pickerEvent(''))
    await actions.addParticipantWithCategory(tournament(), archer, pickerEvent('missing'))
    expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Select a valid category')
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('explains why an archer cannot enter a category and does not call the database', async () => {
    const child = { ...archer, birthDate: '2015-01-01' }
    await actions.addParticipantWithCategory(tournament(), child, pickerEvent('open'))
    expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith("Ana Archer is below this category's minimum age")
  })

  it('refuses a lower level after a higher one was entered elsewhere', async () => {
    store.data.tournaments = [tournament({ id: 't0', categoryAssignments: { a: 'pro' } })]
    await actions.addParticipantWithCategory(tournament({ categoryAssignments: {} }), archer, pickerEvent('open'))
    expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Already entered Recurve Pro, a higher level')
  })

  it('keeps the tournament unchanged when the save fails', async () => {
    repository.setTournamentParticipant.mockRejectedValue(new Error('denied'))
    const current = tournament({ participantIds: [], categoryAssignments: {} })
    await actions.addParticipantWithCategory(current, archer, pickerEvent('open'))
    expect(current.participantIds).toEqual([])
    expect(current.categoryAssignments).toEqual({})
  })
})

describe('clearParticipantCategory', () => {
  it('removes only the category and keeps the archer', async () => {
    const current = tournament()
    await actions.clearParticipantCategory(current, archer)
    expect(repository.setParticipantCategory).toHaveBeenCalledWith('t1', 'a', '')
    expect(current.categoryAssignments).toEqual({})
    expect(current.participantIds).toEqual(['a'])
  })
})

describe('toggleTournamentStarted', () => {
  it('starts the tournament after the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const current = tournament()
    await actions.toggleTournamentStarted(current)
    expect(repository.setTournamentStarted).toHaveBeenCalledWith('t1', expect.any(String))
    expect(Number.isNaN(Date.parse(current.startedAt))).toBe(false)
    expect(notify).toHaveBeenCalledWith('Tournament started')
  })

  it('does nothing when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const current = tournament()
    await actions.toggleTournamentStarted(current)
    expect(repository.setTournamentStarted).not.toHaveBeenCalled()
    expect(current.startedAt).toBe('')
  })

  it('reopens a started tournament without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const current = tournament({ startedAt: '2026-01-01T00:00:00.000Z' })
    await actions.toggleTournamentStarted(current)
    expect(confirm).not.toHaveBeenCalled()
    expect(repository.setTournamentStarted).toHaveBeenCalledWith('t1', '')
    expect(current.startedAt).toBe('')
    expect(notify).toHaveBeenCalledWith('Tournament reopened')
  })

  it('stays quiet and unchanged when the save fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    repository.setTournamentStarted.mockRejectedValue(new Error('denied'))
    const current = tournament()
    await actions.toggleTournamentStarted(current)
    expect(current.startedAt).toBe('')
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('removeParticipantFromTournament', () => {
  it('removes the archer and their category after the user confirms', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const current = tournament()
    await actions.removeParticipantFromTournament(current, archer)
    expect(confirm).toHaveBeenCalledWith('Remove Ana Archer from this tournament?')
    expect(repository.setTournamentParticipant).toHaveBeenCalledWith('t1', 'a', false)
    expect(current.participantIds).toEqual([])
    expect(current.categoryAssignments).toEqual({})
  })

  it('keeps the archer when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const current = tournament()
    await actions.removeParticipantFromTournament(current, archer)
    expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
    expect(current.participantIds).toEqual(['a'])
  })

  it('keeps the archer when the save fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    repository.setTournamentParticipant.mockRejectedValue(new Error('denied'))
    const current = tournament()
    await actions.removeParticipantFromTournament(current, archer)
    expect(current.participantIds).toEqual(['a'])
  })
})

describe('setParticipantClub', () => {
  it('saves the chosen club', async () => {
    const person = { id: 'a', clubId: 'c1' }
    await actions.setParticipantClub(person, pickerEvent('c2'))
    expect(repository.setParticipantClub).toHaveBeenCalledWith('a', 'c2')
    expect(person.clubId).toBe('c2')
  })

  it('saves no club as an empty string', async () => {
    const person = { id: 'a', clubId: 'c1' }
    await actions.setParticipantClub(person, pickerEvent(''))
    expect(person.clubId).toBe('')
  })

  it('puts the picker back to the old club when the save fails', async () => {
    repository.setParticipantClub.mockRejectedValue(new Error('denied'))
    const person = { id: 'a', clubId: 'c1' }
    const event = pickerEvent('c2')
    await actions.setParticipantClub(person, event)
    expect(person.clubId).toBe('c1')
    expect(event.target.value).toBe('c1')
  })

  it('puts the picker back to empty for an archer who had no club', async () => {
    repository.setParticipantClub.mockRejectedValue(new Error('denied'))
    const person = { id: 'a' }
    const event = pickerEvent('c2')
    await actions.setParticipantClub(person, event)
    expect(event.target.value).toBe('')
  })
})

describe('toggleClub', () => {
  it('enables a club that has an email', async () => {
    const club = { id: 'c1', email: 'club@x.test', userEnabled: false }
    await actions.toggleClub(club)
    expect(repository.setClubEnabled).toHaveBeenCalledWith('c1', true)
    expect(club.userEnabled).toBe(true)
    expect(notify).toHaveBeenCalledWith('Club user enabled')
  })

  it('accepts the user email when the club has no contact email', async () => {
    const club = { id: 'c1', email: '', userEmail: 'user@x.test', userEnabled: false }
    await actions.toggleClub(club)
    expect(club.userEnabled).toBe(true)
  })

  it('refuses to enable a club with no email at all', async () => {
    const club = { id: 'c1', email: '', userEmail: '', userEnabled: false }
    await actions.toggleClub(club)
    expect(repository.setClubEnabled).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Add a club email before enabling access')
  })

  it('disables a club even when it has no email', async () => {
    const club = { id: 'c1', email: '', userEmail: '', userEnabled: true }
    await actions.toggleClub(club)
    expect(club.userEnabled).toBe(false)
    expect(notify).toHaveBeenCalledWith('Club user disabled')
  })

  it('keeps the club unchanged and stays quiet when the save fails', async () => {
    repository.setClubEnabled.mockRejectedValue(new Error('denied'))
    const club = { id: 'c1', email: 'club@x.test', userEnabled: false }
    await actions.toggleClub(club)
    expect(club.userEnabled).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })
})
