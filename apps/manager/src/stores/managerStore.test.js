import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ERROR_TARGETS, useManagerStore } from './managerStore'

function workspace() {
  return {
    clubs: [{ id: 'club-1', name: 'North' }],
    tournamentTypes: [{ id: 'type-1', name: 'Outdoor' }],
    categories: [{ id: 'cat-1', name: 'Open' }],
    participants: [{ id: 'p-1', firstName: 'Alex', lastName: 'Archer' }],
  }
}

describe('manager store', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useManagerStore()
    store.load(workspace())
  })

  it('looks records up by id and returns undefined for an unknown id', () => {
    expect(store.clubFor('club-1').name).toBe('North')
    expect(store.tournamentTypeFor('type-1').name).toBe('Outdoor')
    expect(store.categoryFor('cat-1').name).toBe('Open')
    expect(store.participantById('p-1').firstName).toBe('Alex')
    expect(store.clubFor('missing')).toBeUndefined()
    expect(store.participantById('')).toBeUndefined()
  })

  describe('persistChange', () => {
    it('applies the local update after the operation works and clears old errors', async () => {
      store.databaseError = 'old'
      store.modalError = 'old'
      store.targetTypeError = 'old'
      let applied = false

      const saved = await store.persistChange(
        async () => {},
        () => {
          applied = true
        },
      )

      expect(saved).toBe(true)
      expect(applied).toBe(true)
      expect([store.databaseError, store.modalError, store.targetTypeError]).toEqual(['', '', ''])
    })

    it('keeps local state unchanged and reports on the page when the operation fails', async () => {
      let applied = false

      const saved = await store.persistChange(
        async () => {
          throw new Error('denied')
        },
        () => {
          applied = true
        },
      )

      expect(saved).toBe(false)
      expect(applied).toBe(false)
      expect(store.databaseError).toBe('Save failed: denied')
      expect(store.modalError).toBe('')
    })

    it('reports a failure in the modal or the target type form when asked', async () => {
      const fail = async () => {
        throw new Error('nope')
      }

      await store.persistChange(fail, () => {}, ERROR_TARGETS.modal)
      expect(store.modalError).toBe('Save failed: nope')
      expect(store.databaseError).toBe('')

      await store.persistChange(fail, () => {}, ERROR_TARGETS.targetType)
      expect(store.targetTypeError).toBe('Save failed: nope')
    })

    it('reports a failure thrown by the local update', async () => {
      const saved = await store.persistChange(
        async () => {},
        () => {
          throw new Error('bad state')
        },
      )

      expect(saved).toBe(false)
      expect(store.databaseError).toBe('Save failed: bad state')
    })
  })
})
