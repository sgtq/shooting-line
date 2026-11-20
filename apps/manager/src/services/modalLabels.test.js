import { describe, expect, it } from 'vitest'
import { modalLabels } from './modalLabels'

describe('modalLabels', () => {
  it('groups the event dialogs under one heading', () => {
    for (const type of ['tournament', 'tournamentDates', 'tournamentType']) {
      expect(modalLabels(type).eyebrow).toBe('EVENT MANAGEMENT')
    }
  })

  it('labels each dialog by its kind', () => {
    expect(modalLabels('club').eyebrow).toBe('CLUB DIRECTORY')
    expect(modalLabels('category').eyebrow).toBe('CATEGORY DIRECTORY')
    expect(modalLabels('userRole').eyebrow).toBe('SYSTEM SETTINGS')
    expect(modalLabels('profile').eyebrow).toBe('ACCOUNT PROFILE')
    expect(modalLabels('participant').eyebrow).toBe('ARCHER DIRECTORY')
  })

  it('switches between create and edit titles and buttons', () => {
    expect(modalLabels('club').title).toBe('Add a club')
    expect(modalLabels('club').submit).toBe('Save club')
    expect(modalLabels('club', { editing: true }).title).toBe('Edit club')
    expect(modalLabels('club', { editing: true }).submit).toBe('Save changes')

    expect(modalLabels('tournamentType').submit).toBe('Create type')
    expect(modalLabels('tournamentType', { editing: true }).submit).toBe('Save type')
    expect(modalLabels('category').title).toBe('Create category')
    expect(modalLabels('category', { editing: true }).submit).toBe('Save category')
  })

  it('has fixed texts for dialogs that cannot be edited', () => {
    expect(modalLabels('tournament')).toMatchObject({ title: 'Create tournament', submit: 'Create tournament' })
    expect(modalLabels('tournamentDates')).toMatchObject({ title: 'Edit tournament dates', submit: 'Save dates' })
    expect(modalLabels('userRole')).toMatchObject({ title: 'Add manager', submit: 'Add manager' })
    expect(modalLabels('profile')).toMatchObject({ title: 'Edit profile', submit: 'Save profile' })
  })

  it('labels the archer dialog for create, edit, and adding an existing archer', () => {
    expect(modalLabels('participant')).toMatchObject({ title: 'Add archer', submit: 'Save archer' })
    expect(modalLabels('participant', { hasMatch: true }).submit).toBe('Add to tournament')
    expect(modalLabels('participant', { editing: true })).toMatchObject({
      title: 'Edit archer',
      submit: 'Save changes',
    })
    expect(modalLabels('participant', { editing: true, hasMatch: true }).submit).toBe('Save changes')
  })

  it('shows Back instead of Cancel when opened from another dialog', () => {
    expect(modalLabels('club').cancel).toBe('Cancel')
    expect(modalLabels('club', { hasParentForm: true }).cancel).toBe('Back')
  })
})
