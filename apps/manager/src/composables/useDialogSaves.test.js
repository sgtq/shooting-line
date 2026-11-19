import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { buildDialogKit } from './dialogTestKit'

afterEach(() => vi.restoreAllMocks())

describe('saveClub', () => {
  function fill(kit, values = {}) {
    kit.dialogs.openModal('club')
    Object.assign(kit.dialogs.form.value, { name: 'South', address: '2 Side St', email: 'south@x.test', ...values })
  }

  it('adds a club at the top of the list, closes the dialog, and tells the user', async () => {
    const kit = buildDialogKit()
    fill(kit)
    await kit.saves.submitModal()
    const saved = kit.repository.saveClub.mock.calls[0][0]
    expect(saved).toMatchObject({ name: 'South', userEmail: 'south@x.test' })
    expect(saved.id).toBeTruthy()
    expect(saved).not.toHaveProperty('logoFile')
    expect(saved).not.toHaveProperty('logoPreview')
    expect(kit.store.data.clubs[0].name).toBe('South')
    expect(kit.dialogs.showModal.value).toBe(false)
    expect(kit.notify).toHaveBeenCalledWith('Club added')
  })

  it('lets a manager change user access and others not', async () => {
    const manager = buildDialogKit()
    fill(manager)
    await manager.saves.submitModal()
    expect(manager.repository.saveClub.mock.calls[0][1]).toEqual({ syncUserAccess: true, hadUserEnabled: false })

    const club = buildDialogKit({ role: 'club', clubId: 'c1' })
    club.dialogs.editClub(club.store.data.clubs[0])
    await club.saves.submitModal()
    expect(club.repository.saveClub.mock.calls[0][1]).toMatchObject({ syncUserAccess: false })
  })

  it('turns user access off when the club has no email at all', async () => {
    const kit = buildDialogKit()
    fill(kit, { email: '   ', userEmail: '', userEnabled: true })
    await kit.saves.submitModal()
    expect(kit.repository.saveClub.mock.calls[0][0]).toMatchObject({ email: '', userEmail: '', userEnabled: false })
  })

  it('keeps the old user email when the contact email is empty', async () => {
    const kit = buildDialogKit()
    fill(kit, { email: '', userEmail: ' user@x.test ' })
    await kit.saves.submitModal()
    expect(kit.repository.saveClub.mock.calls[0][0].userEmail).toBe('user@x.test')
  })

  it('updates the club in place when editing', async () => {
    const kit = buildDialogKit()
    const club = kit.store.data.clubs[0]
    kit.dialogs.editClub(club)
    kit.dialogs.form.value.name = 'North renamed'
    await kit.saves.submitModal()
    expect(kit.store.data.clubs).toHaveLength(1)
    expect(club.name).toBe('North renamed')
    expect(kit.notify).toHaveBeenCalledWith('Club details updated')
  })

  it('uploads a chosen logo first and saves its address', async () => {
    const kit = buildDialogKit()
    fill(kit, { logoFile: { name: 'logo.png' } })
    await kit.saves.submitModal()
    expect(kit.repository.uploadClubLogo).toHaveBeenCalledTimes(1)
    expect(kit.repository.saveClub.mock.calls[0][0].logoUrl).toBe('https://logo.test/logo.png')
  })

  it('keeps the dialog open with the error and changes nothing when the save fails', async () => {
    const kit = buildDialogKit()
    kit.repository.saveClub.mockRejectedValue(new Error('denied'))
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.store.data.clubs).toHaveLength(1)
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.store.modalError).toBe('Save failed: denied')
    expect(kit.notify).not.toHaveBeenCalled()
  })

  it('goes back to the tournament form and chooses the new club when opened from it', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournament')
    kit.dialogs.openTournamentChildModal('club')
    Object.assign(kit.dialogs.form.value, { name: 'South', address: '2 Side St', email: 's@x.test' })
    await kit.saves.submitModal()
    expect(kit.dialogs.modalType.value).toBe('tournament')
    expect(kit.dialogs.form.value.clubId).toBe(kit.store.data.clubs[0].id)
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.notify).toHaveBeenCalledWith('Club added')
  })
})

describe('saveTournament', () => {
  function fill(kit, values = {}) {
    kit.dialogs.openModal('tournament')
    Object.assign(kit.dialogs.form.value, { name: 'Spring', startDate: '2026-07-01', endDate: '2026-07-02', ...values })
  }

  it('creates the tournament, opens it, and tells the user', async () => {
    const kit = buildDialogKit()
    fill(kit)
    await kit.saves.submitModal()
    const saved = kit.repository.saveTournament.mock.calls[0][0]
    expect(saved).toMatchObject({
      name: 'Spring',
      dates: ['2026-07-01', '2026-07-02'],
      clubId: 'c1',
      rounds: ['Qualification'],
      participantIds: [],
      categoryIds: [],
      categoryAssignments: {},
    })
    expect(saved).not.toHaveProperty('startDate')
    expect(saved).not.toHaveProperty('dateMode')
    expect(kit.store.data.tournaments[0].id).toBe(saved.id)
    expect(kit.selectedTournamentId.value).toBe(saved.id)
    expect(kit.selectedTournamentTab.value).toBe('participants')
    expect(kit.activePage.value).toBe('tournament-detail')
    expect(kit.dialogs.showModal.value).toBe(false)
    expect(kit.notify).toHaveBeenCalledWith('Tournament created')
  })

  it('asks for an active plan when the user may not create tournaments', async () => {
    const kit = buildDialogKit({ canCreate: false })
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament).not.toHaveBeenCalled()
    expect(kit.notify).toHaveBeenCalledWith('An active plan is required to create tournaments')
  })

  it('needs a host club unless the address is custom', async () => {
    const kit = buildDialogKit()
    fill(kit, { clubId: '' })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament).not.toHaveBeenCalled()
    expect(kit.notify).toHaveBeenCalledWith('Select a host club or use a custom address')

    fill(kit, { clubId: '', venueMode: 'custom', customAddress: 'Field 9' })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament).toHaveBeenCalledTimes(1)
  })

  it('shows the date problem in the dialog without saving', async () => {
    const kit = buildDialogKit()
    fill(kit, { endDate: '2026-06-01' })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament).not.toHaveBeenCalled()
    expect(kit.store.modalError).toBe('The end date cannot be before the start date')
  })

  it('saves separate days as entered', async () => {
    const kit = buildDialogKit()
    fill(kit, { dateMode: 'days', days: ['2026-07-05', '2026-07-01'] })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament.mock.calls[0][0].dates).toEqual(['2026-07-01', '2026-07-05'])
  })

  it('always hosts a club user tournament for their own club, whatever the form holds', async () => {
    const kit = buildDialogKit({ role: 'club', clubId: 'c-own' })
    fill(kit, { clubId: 'c-other' })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournament.mock.calls[0][0].clubId).toBe('c-own')
  })

  it('stays open and keeps the list when the save fails', async () => {
    const kit = buildDialogKit()
    kit.repository.saveTournament.mockRejectedValue(new Error('denied'))
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.store.data.tournaments).toHaveLength(1)
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.activePage.value).toBe('dashboard')
  })
})

describe('saveTournamentDates', () => {
  it('saves the new days on the open tournament', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openTournamentDatesModal(kit.selectedTournament.value)
    Object.assign(kit.dialogs.form.value, { startDate: '2026-08-01', endDate: '2026-08-03' })
    await kit.saves.submitModal()
    expect(kit.repository.saveTournamentDates).toHaveBeenCalledWith('t1', ['2026-08-01', '2026-08-02', '2026-08-03'])
    expect(kit.selectedTournament.value.dates).toHaveLength(3)
    expect(kit.dialogs.showModal.value).toBe(false)
    expect(kit.notify).toHaveBeenCalledWith('Tournament dates updated')
  })

  it('does nothing for someone who may not edit the tournament', async () => {
    const kit = buildDialogKit({ canEdit: false })
    kit.dialogs.openTournamentDatesModal(kit.selectedTournament.value)
    await kit.saves.submitModal()
    expect(kit.repository.saveTournamentDates).not.toHaveBeenCalled()
  })

  it('shows a date problem in the dialog', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openTournamentDatesModal(kit.selectedTournament.value)
    kit.dialogs.form.value.startDate = ''
    await kit.saves.submitModal()
    expect(kit.repository.saveTournamentDates).not.toHaveBeenCalled()
    expect(kit.store.modalError).toBe('Add at least one tournament date')
  })
})

describe('saveTournamentType', () => {
  function fill(kit) {
    kit.dialogs.openModal('tournamentType')
    Object.assign(kit.dialogs.form.value, { name: 'Indoor 18m', distance: '18', ends: '20', arrowsPerEnd: '3' })
  }

  it('saves the numbers as numbers and adds the type', async () => {
    const kit = buildDialogKit()
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.repository.saveTournamentType.mock.calls[0][0]).toMatchObject({
      distance: 18,
      ends: 20,
      arrowsPerEnd: 3,
    })
    expect(kit.store.data.tournamentTypes).toHaveLength(2)
    expect(kit.notify).toHaveBeenCalledWith('Tournament type created')
  })

  it('updates the existing type when editing', async () => {
    const kit = buildDialogKit()
    kit.dialogs.editTournamentType(kit.store.data.tournamentTypes[0])
    Object.assign(kit.dialogs.form.value, { name: 'Renamed', distance: '70', ends: '12', arrowsPerEnd: '6' })
    await kit.saves.submitModal()
    expect(kit.store.data.tournamentTypes).toHaveLength(1)
    expect(kit.store.data.tournamentTypes[0].name).toBe('Renamed')
    expect(kit.notify).toHaveBeenCalledWith('Tournament type updated')
  })

  it('goes back to the tournament form and chooses the new type', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('tournament')
    kit.dialogs.openTournamentChildModal('tournamentType')
    Object.assign(kit.dialogs.form.value, { name: 'New', distance: '30', ends: '10', arrowsPerEnd: '6' })
    await kit.saves.submitModal()
    expect(kit.dialogs.modalType.value).toBe('tournament')
    expect(kit.dialogs.form.value.tournamentTypeId).toBe(kit.store.data.tournamentTypes[1].id)
    expect(kit.notify).toHaveBeenCalledWith('Tournament type added')
  })
})

describe('saveTargetType', () => {
  function open(kit) {
    kit.dialogs.openModal('tournamentType')
    kit.dialogs.openTargetTypeModal()
  }

  it('asks for a name', async () => {
    const kit = buildDialogKit()
    open(kit)
    kit.dialogs.targetTypeName.value = '   '
    await kit.saves.saveTargetType()
    expect(kit.store.targetTypeError).toBe('Enter a target type name.')
    expect(kit.repository.saveTargetType).not.toHaveBeenCalled()
  })

  it('chooses an existing target type of the same name without saving it again', async () => {
    const kit = buildDialogKit()
    open(kit)
    kit.dialogs.targetTypeName.value = '122 CM FACE'
    await kit.saves.saveTargetType()
    expect(kit.repository.saveTargetType).not.toHaveBeenCalled()
    expect(kit.dialogs.form.value.targetType).toBe('122 cm face')
    expect(kit.dialogs.showTargetTypeModal.value).toBe(false)
  })

  it('saves a new target type, chooses it, and closes the small dialog', async () => {
    const kit = buildDialogKit()
    open(kit)
    kit.dialogs.targetTypeName.value = ' 40 cm spot '
    await kit.saves.saveTargetType()
    expect(kit.store.data.targetTypes.map((type) => type.name)).toEqual(['122 cm face', '40 cm spot'])
    expect(kit.dialogs.form.value.targetType).toBe('40 cm spot')
    expect(kit.dialogs.showTargetTypeModal.value).toBe(false)
  })

  it('shows the error in the small dialog when the save fails', async () => {
    const kit = buildDialogKit()
    kit.repository.saveTargetType.mockRejectedValue(new Error('denied'))
    open(kit)
    kit.dialogs.targetTypeName.value = '40 cm spot'
    await kit.saves.saveTargetType()
    expect(kit.store.targetTypeError).toBe('Save failed: denied')
    expect(kit.dialogs.showTargetTypeModal.value).toBe(true)
    expect(kit.store.data.targetTypes).toHaveLength(1)
  })
})

describe('saveCategory', () => {
  function fill(kit, values = {}) {
    kit.dialogs.openModal('category')
    Object.assign(kit.dialogs.form.value, {
      name: 'Junior',
      minAge: '',
      maxAge: '',
      bowType: 'Recurve',
      sortOrder: '1',
      ...values,
    })
  }

  it('saves empty ages as no limit and the order as a number', async () => {
    const kit = buildDialogKit()
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.repository.saveCategory.mock.calls[0][0]).toMatchObject({
      minAge: null,
      maxAge: null,
      sortOrder: 1,
      levelExempt: false,
    })
    expect(kit.notify).toHaveBeenCalledWith('Category created')
  })

  it('keeps an age of zero as a limit', async () => {
    const kit = buildDialogKit()
    fill(kit, { minAge: '0', maxAge: '10' })
    await kit.saves.submitModal()
    expect(kit.repository.saveCategory.mock.calls[0][0]).toMatchObject({ minAge: 0, maxAge: 10 })
  })

  it('stores an order of 0 for a category outside the level order', async () => {
    const kit = buildDialogKit()
    fill(kit, { levelExempt: true, sortOrder: '5' })
    await kit.saves.submitModal()
    expect(kit.repository.saveCategory.mock.calls[0][0]).toMatchObject({ levelExempt: true, sortOrder: 0 })
  })

  it('refuses a minimum age above the maximum', async () => {
    const kit = buildDialogKit()
    fill(kit, { minAge: '20', maxAge: '10' })
    await kit.saves.submitModal()
    expect(kit.repository.saveCategory).not.toHaveBeenCalled()
    expect(kit.notify).toHaveBeenCalledWith('Minimum age cannot be greater than maximum age')
  })

  it('updates the category when editing', async () => {
    const kit = buildDialogKit({
      data: { categories: [{ id: 'cat', name: 'Old', minAge: null, maxAge: null, sortOrder: 0 }] },
    })
    kit.dialogs.editCategory(kit.store.data.categories[0])
    kit.dialogs.form.value.name = 'New'
    kit.dialogs.form.value.sortOrder = '2'
    await kit.saves.submitModal()
    expect(kit.store.data.categories).toHaveLength(1)
    expect(kit.store.data.categories[0]).toMatchObject({ name: 'New', sortOrder: 2 })
    expect(kit.notify).toHaveBeenCalledWith('Category updated')
  })
})

describe('saveUserRole', () => {
  it('gives the manager role to the trimmed email and adds the account', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('userRole')
    Object.assign(kit.dialogs.form.value, { email: ' boss@x.test ', displayName: ' Boss ' })
    await kit.saves.submitModal()
    expect(kit.repository.assignUserRole).toHaveBeenCalledWith({
      email: 'boss@x.test',
      role: 'manager',
      displayName: 'Boss',
    })
    expect(kit.store.data.userRoles).toEqual([
      { userId: 'user-new', email: 'boss@x.test', role: 'manager', clubId: '', participantId: '' },
    ])
    expect(kit.notify).toHaveBeenCalledWith('Manager role assigned')
  })

  it('refreshes an account that already has the role instead of adding a copy', async () => {
    const kit = buildDialogKit({ data: { userRoles: [{ userId: 'user-new', role: 'manager', email: 'old@x.test' }] } })
    kit.dialogs.openModal('userRole')
    Object.assign(kit.dialogs.form.value, { email: 'new@x.test', displayName: '' })
    await kit.saves.submitModal()
    expect(kit.store.data.userRoles).toHaveLength(1)
    expect(kit.store.data.userRoles[0].email).toBe('new@x.test')
  })

  it('shows the error in the dialog when the account does not exist', async () => {
    const kit = buildDialogKit()
    kit.repository.assignUserRole.mockRejectedValue(new Error('No such user'))
    kit.dialogs.openModal('userRole')
    Object.assign(kit.dialogs.form.value, { email: 'x@x.test', displayName: '' })
    await kit.saves.submitModal()
    expect(kit.store.modalError).toBe('Save failed: No such user')
    expect(kit.store.data.userRoles).toEqual([])
  })
})

describe('profile', () => {
  it('saves the display name and shows it', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('profile')
    kit.dialogs.form.value.displayName = '  Ana B  '
    await kit.saves.submitModal()
    expect(kit.repository.saveUserProfile).toHaveBeenCalledWith('me', 'Ana B')
    expect(kit.userName.value).toBe('Ana B')
    expect(kit.notify).toHaveBeenCalledWith('Profile updated')
  })

  it('asks for a name', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('profile')
    kit.dialogs.form.value.displayName = '   '
    await kit.saves.submitModal()
    expect(kit.repository.saveUserProfile).not.toHaveBeenCalled()
    expect(kit.store.modalError).toBe('Enter a display name.')
  })

  it('sends a password reset link to the own email and says it may not exist', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('profile')
    await kit.saves.sendOwnPasswordReset()
    expect(kit.repository.sendOwnPasswordReset).toHaveBeenCalledWith('me@x.test')
    expect(kit.notify).toHaveBeenCalledWith('If the account exists, a password reset email will be sent')
  })

  it('shows the error in the dialog when the reset fails', async () => {
    const kit = buildDialogKit()
    kit.repository.sendOwnPasswordReset.mockRejectedValue(new Error('rate limit'))
    kit.dialogs.openModal('profile')
    await kit.saves.sendOwnPasswordReset()
    expect(kit.store.modalError).toBe('Save failed: rate limit')
    expect(kit.notify).not.toHaveBeenCalled()
  })
})

describe('saveParticipant', () => {
  function fill(kit, values = {}) {
    kit.dialogs.openModal('participant')
    Object.assign(kit.dialogs.form.value, { firstName: 'Ana', lastName: 'Archer', birthDate: '2000-01-01', ...values })
  }

  it('adds the archer at the top of the list', async () => {
    const kit = buildDialogKit()
    fill(kit, { clubId: 'c1' })
    await kit.saves.submitModal()
    const [saved, tournamentId, editing, categoryId] = kit.repository.saveParticipant.mock.calls[0]
    expect(saved).toMatchObject({ firstName: 'Ana', clubId: 'c1' })
    expect(saved).not.toHaveProperty('bowType')
    expect(saved).not.toHaveProperty('categoryId')
    expect([tournamentId, editing, categoryId]).toEqual(['', false, ''])
    expect(kit.store.data.participants[0].lastName).toBe('Archer')
    expect(kit.notify).toHaveBeenCalledWith('Archer saved')
  })

  it('always gives a club user archer the own club', async () => {
    const kit = buildDialogKit({ role: 'club', clubId: 'c-own' })
    fill(kit, { clubId: 'c-other' })
    await kit.saves.submitModal()
    expect(kit.repository.saveParticipant.mock.calls[0][0].clubId).toBe('c-own')
  })

  it('updates the archer when editing', async () => {
    const kit = buildDialogKit({
      data: { participants: [{ id: 'p1', firstName: 'Old', lastName: 'Name', clubId: '' }] },
    })
    kit.dialogs.editParticipant(kit.store.data.participants[0])
    kit.dialogs.form.value.firstName = 'New'
    await kit.saves.submitModal()
    expect(kit.store.data.participants).toHaveLength(1)
    expect(kit.store.data.participants[0].firstName).toBe('New')
    expect(kit.repository.saveParticipant.mock.calls[0][2]).toBe(true)
    expect(kit.notify).toHaveBeenCalledWith('Archer details updated')
  })

  it('enters a new archer in the open tournament with the chosen category', async () => {
    const kit = buildDialogKit({
      data: { categories: [{ id: 'open', name: 'Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null }] },
    })
    kit.store.data.tournaments[0].categoryIds = ['open']
    kit.dialogs.openModal('participant', true)
    Object.assign(kit.dialogs.form.value, {
      firstName: 'Ana',
      lastName: 'Archer',
      birthDate: '2000-01-01',
      bowType: 'Recurve',
      categoryId: 'open',
    })
    await kit.saves.submitModal()
    const [saved, tournamentId, , categoryId] = kit.repository.saveParticipant.mock.calls[0]
    expect([tournamentId, categoryId]).toEqual(['t1', 'open'])
    expect(kit.store.data.tournaments[0].participantIds).toEqual([saved.id])
    expect(kit.store.data.tournaments[0].categoryAssignments[saved.id]).toBe('open')
  })

  it('refuses a missing or blocked category without saving', async () => {
    const kit = buildDialogKit({
      data: { categories: [{ id: 'open', name: 'Open', bowType: 'Recurve', sortOrder: 1, minAge: 18, maxAge: null }] },
    })
    kit.store.data.tournaments[0].categoryIds = ['open']
    kit.dialogs.openModal('participant', true)
    Object.assign(kit.dialogs.form.value, {
      firstName: 'Kid',
      lastName: 'Archer',
      birthDate: '2015-01-01',
      categoryId: '',
    })
    await kit.saves.submitModal()
    expect(kit.notify).toHaveBeenLastCalledWith('Select a valid category')

    kit.dialogs.form.value.categoryId = 'open'
    await kit.saves.submitModal()
    expect(kit.notify).toHaveBeenLastCalledWith("Kid Archer is below this category's minimum age")
    expect(kit.repository.saveParticipant).not.toHaveBeenCalled()
  })

  it('does not ask for a category when the tournament has none', async () => {
    const kit = buildDialogKit()
    kit.dialogs.openModal('participant', true)
    Object.assign(kit.dialogs.form.value, { firstName: 'Ana', lastName: 'Archer', birthDate: '2000-01-01' })
    await kit.saves.submitModal()
    expect(kit.repository.saveParticipant).toHaveBeenCalledTimes(1)
    expect(kit.store.data.tournaments[0].participantIds).toHaveLength(1)
  })

  it('keeps the dialog open when the save fails', async () => {
    const kit = buildDialogKit()
    kit.repository.saveParticipant.mockRejectedValue(new Error('denied'))
    fill(kit)
    await kit.saves.submitModal()
    expect(kit.store.data.participants).toEqual([])
    expect(kit.dialogs.showModal.value).toBe(true)
    expect(kit.store.modalError).toBe('Save failed: denied')
  })
})

describe('adding an archer found in the database', () => {
  async function pick(kit, categoryIds = []) {
    kit.store.data.tournaments[0].categoryIds = categoryIds
    kit.dialogs.openModal('participant', true)
    // The search watcher resets the matches one tick after the form opens, so pick after that.
    await nextTick()
    kit.dialogs.archerMatches.value = [{ token: 'tok', firstName: 'Fay', lastName: 'Found' }]
    kit.dialogs.selectedMatchToken.value = 'tok'
  }

  it('adds them to the open tournament by token and closes the dialog', async () => {
    const kit = buildDialogKit()
    await pick(kit)
    await kit.saves.submitModal()
    expect(kit.repository.addArcherByToken).toHaveBeenCalledWith('t1', 'tok', '')
    expect(kit.repository.saveParticipant).not.toHaveBeenCalled()
    expect(kit.store.data.participants.map((person) => person.id)).toEqual(['found'])
    expect(kit.store.data.tournaments[0].participantIds).toEqual(['found'])
    expect(kit.dialogs.showModal.value).toBe(false)
    expect(kit.notify).toHaveBeenCalledWith('Archer added to this tournament')
  })

  it('does not add the archer to the directory twice', async () => {
    const kit = buildDialogKit({ data: { participants: [{ id: 'found', firstName: 'Fay', lastName: 'Found' }] } })
    await pick(kit)
    await kit.saves.submitModal()
    expect(kit.store.data.participants).toHaveLength(1)
  })

  it('needs a valid category when the tournament has categories, and assigns it', async () => {
    const kit = buildDialogKit({ data: { categories: [{ id: 'open', name: 'Open' }] } })
    await pick(kit, ['open'])
    kit.dialogs.form.value.categoryId = ''
    await kit.saves.submitModal()
    expect(kit.repository.addArcherByToken).not.toHaveBeenCalled()
    expect(kit.notify).toHaveBeenCalledWith('Select a valid category')

    kit.dialogs.form.value.categoryId = 'open'
    await kit.saves.submitModal()
    expect(kit.repository.addArcherByToken).toHaveBeenCalledWith('t1', 'tok', 'open')
    expect(kit.store.data.tournaments[0].categoryAssignments.found).toBe('open')
  })

  it('shows the refusal of the database in the dialog', async () => {
    const kit = buildDialogKit()
    kit.repository.addArcherByToken.mockRejectedValue(new Error('Below minimum age'))
    await pick(kit)
    await kit.saves.submitModal()
    expect(kit.store.modalError).toBe('Save failed: Below minimum age')
    expect(kit.store.data.tournaments[0].participantIds).toEqual([])
    expect(kit.dialogs.showModal.value).toBe(true)
  })
})
