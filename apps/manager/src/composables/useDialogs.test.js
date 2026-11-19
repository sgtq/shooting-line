import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDialogKit } from './dialogTestKit'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('opening dialogs', () => {
  it('opens a blank form for the chosen type and clears old errors', () => {
    const kit = buildDialogKit()
    kit.store.modalError = 'old'
    kit.store.databaseError = 'old'
    kit.dialogs.openModal('club')
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.dialogs.modalType.value).toBe('club')
    expect(kit.dialogs.form.value).toMatchObject({ name: '', userEnabled: false })
    expect(kit.store.modalError).toBe('')
    expect(kit.store.databaseError).toBe('')
  })

  it('picks the first type and club in a new tournament form, or the own club for a club user', () => {
    const manager = buildDialogKit()
    manager.dialogs.openModal('tournament')
    expect(manager.dialogs.form.value).toMatchObject({ tournamentTypeId: 'ty1', clubId: 'c1' })

    const club = buildDialogKit({ role: 'club', clubId: 'c9' })
    club.dialogs.openModal('tournament')
    expect(club.dialogs.form.value.clubId).toBe('c9')
  })

  it('fixes the club of a new archer for a club user', () => {
    const club = buildDialogKit({ role: 'club', clubId: 'c9' })
    club.dialogs.openModal('participant')
    expect(club.dialogs.form.value.clubId).toBe('c9')
    const manager = buildDialogKit()
    manager.dialogs.openModal('participant')
    expect(manager.dialogs.form.value.clubId).toBe('')
  })

  it('opens the other types with their blank forms', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournamentType')
    expect(kit.dialogs.form.value).toMatchObject({ distanceUnit: 'm', targetType: '122 cm face' })
    kit.dialogs.openModal('category')
    expect(kit.dialogs.form.value).toMatchObject({ levelExempt: false, sortOrder: '' })
    kit.dialogs.openModal('userRole')
    expect(kit.dialogs.form.value).toEqual({ email: '', role: 'manager', displayName: '' })
    kit.dialogs.openModal('profile')
    expect(kit.dialogs.form.value).toEqual({ displayName: 'Ana' })
  })

  it('forgets what it was editing and the archer matches when a new dialog opens', () => {
    const kit = buildDialogKit()
    kit.dialogs.editClub({ id: 'c1', name: 'North', logoUrl: '' })
    kit.dialogs.archerMatches.value = [{ token: 'x' }]
    kit.dialogs.selectedMatchToken.value = 'x'
    kit.dialogs.openModal('club')
    expect(kit.dialogs.editingClubId.value).toBe('')
    expect(kit.dialogs.archerMatches.value).toEqual([])
    expect(kit.dialogs.selectedMatchToken.value).toBe('')
  })

  it('remembers whether a new archer joins the open tournament', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant', true)
    expect(kit.dialogs.assignNewParticipant.value).toBe(true)
    kit.dialogs.openModal('participant')
    expect(kit.dialogs.assignNewParticipant.value).toBe(false)
  })
})

describe('editing', () => {
  it('opens a copy of the record so edits are not saved until the user saves', () => {
    const kit = buildDialogKit()
    const club = { id: 'c1', name: 'North', logoUrl: 'https://logo.test/a.png' }
    kit.dialogs.editClub(club)
    expect(kit.dialogs.editingClubId.value).toBe('c1')
    expect(kit.dialogs.form.value).toMatchObject({ name: 'North', logoFile: null, logoPreview: club.logoUrl })
    kit.dialogs.form.value.name = 'Changed'
    expect(club.name).toBe('North')
  })

  it('opens an archer, a tournament type, and a category for editing', () => {
    const kit = buildDialogKit()
    kit.dialogs.editParticipant({ id: 'p1', firstName: 'Ana' })
    expect([kit.dialogs.modalType.value, kit.dialogs.editingParticipantId.value]).toEqual(['participant', 'p1'])
    kit.dialogs.editTournamentType({ id: 'ty1', name: 'Outdoor' })
    expect([kit.dialogs.modalType.value, kit.dialogs.editingTournamentTypeId.value]).toEqual(['tournamentType', 'ty1'])
    kit.dialogs.editCategory({ id: 'cat', name: 'Open' })
    expect([kit.dialogs.modalType.value, kit.dialogs.editingCategoryId.value]).toEqual(['category', 'cat'])
    expect(kit.dialogs.showModal.value).toBe(true)
  })

  it('opens the dates dialog with the dates of the tournament', () => {
    const kit = buildDialogKit()
    kit.dialogs.openTournamentDatesModal({ dates: ['2026-06-01', '2026-06-02'] })
    expect(kit.dialogs.modalType.value).toBe('tournamentDates')
    expect(kit.dialogs.form.value).toMatchObject({ dateMode: 'range', startDate: '2026-06-01', endDate: '2026-06-02' })
  })

  it('presets the club when adding an archer from a club or from the tournament club filter', () => {
    const kit = buildDialogKit()
    kit.dialogs.addParticipantToClub('c1')
    expect(kit.dialogs.form.value.clubId).toBe('c1')

    kit.participantClubFilter.value = 'c1'
    kit.dialogs.addParticipantToTournament()
    expect(kit.dialogs.assignNewParticipant.value).toBe(true)
    expect(kit.dialogs.form.value.clubId).toBe('c1')

    kit.participantClubFilter.value = '__unassigned__'
    kit.dialogs.addParticipantToTournament()
    expect(kit.dialogs.form.value.clubId).toBe('')
  })
})

describe('closing and the dialog on top of the tournament form', () => {
  it('closes the dialog and forgets what it edited', () => {
    const kit = buildDialogKit()
    kit.dialogs.editClub({ id: 'c1', name: 'North' })
    kit.store.modalError = 'oops'
    kit.dialogs.closeModal()
    expect(kit.dialogs.showModal.value).toBe(false)
    expect(kit.dialogs.editingClubId.value).toBe('')
    expect(kit.store.modalError).toBe('')
  })

  it('opens a club on top of the tournament form and goes back to the form when closed', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournament')
    kit.dialogs.form.value.name = 'Spring'
    kit.dialogs.openTournamentChildModal('club')
    expect(kit.dialogs.modalType.value).toBe('club')
    expect(kit.dialogs.form.value.name).toBe('')
    expect(kit.dialogs.modalText.value.cancel).toBe('Back')

    kit.dialogs.closeModal()
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.dialogs.modalType.value).toBe('tournament')
    expect(kit.dialogs.form.value.name).toBe('Spring')
  })

  it('chooses the new club or type in the tournament form when returning', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournament')
    kit.dialogs.openTournamentChildModal('club')
    expect(kit.dialogs.returnToParentModal({ id: 'c-new' })).toBe(true)
    expect(kit.dialogs.form.value.clubId).toBe('c-new')

    kit.dialogs.openTournamentChildModal('tournamentType')
    expect(kit.dialogs.form.value).toMatchObject({ distanceUnit: 'm' })
    kit.dialogs.returnToParentModal({ id: 'ty-new' })
    expect(kit.dialogs.form.value.tournamentTypeId).toBe('ty-new')
  })

  it('does nothing when there is no tournament form to go back to', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    expect(kit.dialogs.returnToParentModal({ id: 'x' })).toBe(false)
  })
})

describe('custom target type dialog', () => {
  it('opens empty and closes without an error', () => {
    const kit = buildDialogKit()
    kit.dialogs.targetTypeName.value = 'old'
    kit.store.targetTypeError = 'old'
    kit.dialogs.openTargetTypeModal()
    expect(kit.dialogs.showTargetTypeModal.value).toBe(true)
    expect(kit.dialogs.targetTypeName.value).toBe('')
    expect(kit.store.targetTypeError).toBe('')
    kit.dialogs.closeTargetTypeModal()
    expect(kit.dialogs.showTargetTypeModal.value).toBe(false)
  })

  it('offers the saved target types, plus a typed one that is not saved yet', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournamentType')
    expect(kit.dialogs.targetTypeOptions.value).toEqual(['122 cm face'])
    kit.dialogs.form.value.targetType = '40 cm spot'
    expect(kit.dialogs.targetTypeOptions.value).toEqual(['122 cm face', '40 cm spot'])
    kit.dialogs.form.value.targetType = '122 CM FACE'
    expect(kit.dialogs.targetTypeOptions.value).toEqual(['122 cm face'])
  })
})

describe('club logo', () => {
  function pick(file) {
    return { target: { files: [file], value: 'C:\\logo' } }
  }

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('keeps a valid image and shows a preview', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    const file = { type: 'image/png', size: 1000 }
    kit.dialogs.handleClubLogoSelection(pick(file))
    expect(kit.dialogs.form.value.logoFile).toEqual(file)
    expect(kit.dialogs.form.value.logoPreview).toBe('blob:preview')
  })

  it('refuses a wrong type or a file over 2 MB and empties the input', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    for (const file of [
      { type: 'image/gif', size: 10 },
      { type: 'image/png', size: 2_000_001 },
    ]) {
      const event = pick(file)
      kit.dialogs.handleClubLogoSelection(event)
      expect(kit.store.modalError).toBe('Choose a JPG, PNG, or WebP logo smaller than 2 MB.')
      expect(event.target.value).toBe('')
      expect(kit.dialogs.form.value.logoFile).toBeNull()
    }
  })

  it('accepts a file of exactly 2 MB', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    kit.dialogs.handleClubLogoSelection(pick({ type: 'image/webp', size: 2_000_000 }))
    expect(kit.dialogs.form.value.logoFile).not.toBeNull()
  })

  it('ignores the event when no file was chosen', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    kit.dialogs.handleClubLogoSelection({ target: { files: [] } })
    expect(kit.dialogs.form.value.logoFile).toBeNull()
  })

  it('frees the old preview when another file replaces it or the dialog closes', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    kit.dialogs.handleClubLogoSelection(pick({ type: 'image/png', size: 1 }))
    kit.dialogs.handleClubLogoSelection(pick({ type: 'image/png', size: 2 }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    kit.dialogs.closeModal()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})

describe('modal texts', () => {
  it('follows the open dialog and whether a record is being edited', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('club')
    expect(kit.dialogs.modalText.value).toMatchObject({ title: 'Add a club', submit: 'Save club' })
    kit.dialogs.editClub({ id: 'c1', name: 'North' })
    expect(kit.dialogs.modalText.value).toMatchObject({ title: 'Edit club', submit: 'Save changes' })
  })

  it('offers to add to the tournament once an existing archer is picked', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant', true)
    kit.dialogs.archerMatches.value = [{ token: 'tok', firstName: 'Fay', lastName: 'Found' }]
    kit.dialogs.selectedMatchToken.value = 'tok'
    expect(kit.dialogs.selectedMatch.value.firstName).toBe('Fay')
    expect(kit.dialogs.modalText.value.submit).toBe('Add to tournament')
  })

  it('has no selected match for an unknown token', () => {
    const kit = buildDialogKit()
    kit.dialogs.selectedMatchToken.value = 'nope'
    expect(kit.dialogs.selectedMatch.value).toBeNull()
  })
})

describe('clearing the archer form', () => {
  it('empties the names and matches but keeps the club', () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant')
    Object.assign(kit.dialogs.form.value, { firstName: 'Ana', lastName: 'Archer', clubId: 'c1' })
    kit.dialogs.archerMatches.value = [{ token: 'x' }]
    kit.dialogs.selectedMatchToken.value = 'x'
    kit.store.modalError = 'oops'
    kit.dialogs.clearArcherForm()
    expect(kit.dialogs.form.value).toMatchObject({ firstName: '', lastName: '', clubId: 'c1' })
    expect(kit.dialogs.archerMatches.value).toEqual([])
    expect(kit.dialogs.selectedMatchToken.value).toBe('')
    expect(kit.store.modalError).toBe('')
  })
})

describe('archer search while typing', () => {
  async function typeLastName(kit, value) {
    kit.dialogs.form.value.lastName = value
    await Promise.resolve()
    await Promise.resolve()
  }

  beforeEach(() => vi.useFakeTimers())

  it('searches 300 ms after the user stops typing, once there are 3 letters', async () => {
    const kit = buildDialogKit()
    kit.repository.searchArchers.mockResolvedValue([{ token: 'tok' }])
    kit.dialogs.openModal('participant', true)
    await typeLastName(kit, 'Arc')
    expect(kit.repository.searchArchers).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(kit.repository.searchArchers).toHaveBeenCalledWith({
      affiliationId: '',
      lastName: 'Arc',
      firstName: '',
      tournamentId: 't1',
    })
    expect(kit.dialogs.archerMatches.value).toEqual([{ token: 'tok' }])
  })

  it('does not search for fewer than 3 letters of a name', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant')
    await typeLastName(kit, 'Ar')
    await vi.advanceTimersByTimeAsync(500)
    expect(kit.repository.searchArchers).not.toHaveBeenCalled()
  })

  it('searches for a single affiliation id, preferring the World Archery id', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant')
    kit.dialogs.form.value.aetayId = 'AE-7'
    kit.dialogs.form.value.waId = 'WA-1'
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(300)
    expect(kit.repository.searchArchers).toHaveBeenCalledWith(expect.objectContaining({ affiliationId: 'WA-1' }))
  })

  it('does not search for someone who may not change data, when editing, or in another dialog', async () => {
    const noSearch = buildDialogKit()
    noSearch.canSearchArchers.value = false
    noSearch.dialogs.openModal('participant')
    await typeLastName(noSearch, 'Archer')
    await vi.advanceTimersByTimeAsync(500)
    expect(noSearch.repository.searchArchers).not.toHaveBeenCalled()

    const editing = buildDialogKit()
    editing.dialogs.editParticipant({ id: 'p1', lastName: '' })
    await typeLastName(editing, 'Archer')
    await vi.advanceTimersByTimeAsync(500)
    expect(editing.repository.searchArchers).not.toHaveBeenCalled()

    const club = buildDialogKit()
    club.dialogs.openModal('club')
    await typeLastName(club, 'Archer')
    await vi.advanceTimersByTimeAsync(500)
    expect(club.repository.searchArchers).not.toHaveBeenCalled()
  })

  it('only searches for the last thing typed', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant')
    await typeLastName(kit, 'Arch')
    await vi.advanceTimersByTimeAsync(100)
    await typeLastName(kit, 'Archer')
    await vi.advanceTimersByTimeAsync(300)
    expect(kit.repository.searchArchers).toHaveBeenCalledTimes(1)
    expect(kit.repository.searchArchers).toHaveBeenCalledWith(expect.objectContaining({ lastName: 'Archer' }))
  })

  it('clears the picked match when the user types again', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant')
    kit.dialogs.selectedMatchToken.value = 'tok'
    await typeLastName(kit, 'Arc')
    expect(kit.dialogs.selectedMatchToken.value).toBe('')
  })

  it('shows an error and no matches when the search fails', async () => {
    const kit = buildDialogKit()
    kit.repository.searchArchers.mockRejectedValue(new Error('offline'))
    kit.dialogs.openModal('participant')
    await typeLastName(kit, 'Archer')
    await vi.advanceTimersByTimeAsync(300)
    expect(kit.dialogs.archerMatches.value).toEqual([])
    expect(kit.store.modalError).toBe('Archer search failed: offline')
  })

  it('ignores an answer that arrives after the dialog was reopened', async () => {
    const kit = buildDialogKit()
    let finish
    kit.repository.searchArchers.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    kit.dialogs.openModal('participant')
    await typeLastName(kit, 'Archer')
    await vi.advanceTimersByTimeAsync(300)
    kit.dialogs.openModal('participant')
    finish([{ token: 'late' }])
    await Promise.resolve()
    await Promise.resolve()
    expect(kit.dialogs.archerMatches.value).toEqual([])
  })
})
