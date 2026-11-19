import { describe, expect, it } from 'vitest'
import {
  blankCategory,
  blankClub,
  blankParticipant,
  blankTournament,
  blankTournamentType,
  blankUserRole,
} from './blankForms'

describe('blank forms', () => {
  it('gives a new object each time so one dialog never edits another', () => {
    expect(blankClub()).not.toBe(blankClub())
    expect(blankTournament({ tournamentTypes: [], clubs: [], ownClubId: null }).days).not.toBe(
      blankTournament({ tournamentTypes: [], clubs: [], ownClubId: null }).days,
    )
  })

  it('starts a club with no logo and no user access', () => {
    expect(blankClub()).toMatchObject({ logoFile: null, logoPreview: '', userEnabled: false })
  })

  it('picks the first tournament type and club for a manager', () => {
    const form = blankTournament({
      tournamentTypes: [{ id: 'ty1' }, { id: 'ty2' }],
      clubs: [{ id: 'c1' }, { id: 'c2' }],
      ownClubId: null,
    })
    expect(form).toMatchObject({ tournamentTypeId: 'ty1', clubId: 'c1', dateMode: 'range', venueMode: 'club' })
    expect(form.days).toEqual([''])
  })

  it('fixes the host club of a club user, even when it is empty', () => {
    const clubs = [{ id: 'c1' }]
    expect(blankTournament({ tournamentTypes: [], clubs, ownClubId: 'c9' }).clubId).toBe('c9')
    expect(blankTournament({ tournamentTypes: [], clubs, ownClubId: '' }).clubId).toBe('')
  })

  it('leaves the type and club empty when there are none', () => {
    const form = blankTournament({ tournamentTypes: [], clubs: [], ownClubId: null })
    expect(form.tournamentTypeId).toBe('')
    expect(form.clubId).toBe('')
  })

  it('picks the first target type, or none', () => {
    expect(blankTournamentType([{ name: '122 cm' }]).targetType).toBe('122 cm')
    expect(blankTournamentType([]).targetType).toBe('')
    expect(blankTournamentType([]).distanceUnit).toBe('m')
  })

  it('starts a category with no limits and in the level order', () => {
    expect(blankCategory()).toMatchObject({ minAge: '', maxAge: '', bowType: '', levelExempt: false })
  })

  it('fixes the club of a new archer for a club user only', () => {
    expect(blankParticipant(null).clubId).toBe('')
    expect(blankParticipant('c1').clubId).toBe('c1')
    expect(blankParticipant('').clubId).toBe('')
    expect(blankParticipant(null)).toMatchObject({ bowType: '', categoryId: '', email: '' })
  })

  it('starts a manager role form as the manager role', () => {
    expect(blankUserRole()).toEqual({ email: '', role: 'manager', displayName: '' })
  })
})
