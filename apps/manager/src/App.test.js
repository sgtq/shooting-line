import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import App from './App.vue'

function createWorkspace() {
  return {
    clubs: [
      {
        id: 'club-north',
        name: 'North Archery Club',
        representative: 'Club Representative',
        phone: '',
        email: '',
        website: '',
        address: '',
        mapUrl: '',
        userEmail: '',
        userEnabled: false,
      },
    ],
    participants: [
      {
        id: 'participant-club',
        firstName: 'Alex',
        lastName: 'Archer',
        birthDate: '2000-01-01',
        waId: 'WA-1',
        aetayId: '',
        clubId: 'club-north',
      },
      {
        id: 'participant-independent',
        firstName: 'Sam',
        lastName: 'Shooter',
        birthDate: '2001-02-02',
        waId: '',
        aetayId: '',
        clubId: '',
      },
    ],
    tournamentTypes: [
      {
        id: 'type-outdoor',
        name: 'Outdoor round',
        distance: 70,
        distanceUnit: 'm',
        targetType: '122 cm face',
        ends: 12,
        arrowsPerEnd: 6,
      },
    ],
    targetTypes: [],
    categories: [],
    tournaments: [
      {
        id: 'tournament-open',
        name: 'Open Tournament',
        date: '2099-01-01',
        discipline: 'Outdoor target',
        tournamentTypeId: 'type-outdoor',
        clubId: 'club-north',
        venueMode: 'club',
        customAddress: '',
        rounds: ['Qualification'],
        participantIds: [],
        categoryIds: [],
        categoryAssignments: {},
      },
    ],
    scores: [],
    matches: [],
    userRoles: [],
  }
}

function createRepository(overrides = {}) {
  return {
    saveClub: vi.fn().mockResolvedValue(undefined),
    setClubEnabled: vi.fn().mockResolvedValue(undefined),
    assignUserRole: vi.fn().mockResolvedValue('user-manager'),
    saveParticipant: vi.fn().mockResolvedValue(undefined),
    saveTargetType: vi.fn().mockResolvedValue(undefined),
    setParticipantClub: vi.fn().mockResolvedValue(undefined),
    setTournamentParticipant: vi.fn().mockResolvedValue(undefined),
    sendAdminPasswordReset: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function mountApp(repository = createRepository(), overrides = {}) {
  return mount(App, {
    props: {
      initialData: overrides.initialData || createWorkspace(),
      repository,
      userEmail: 'archer@example.test',
      ...overrides,
    },
  })
}

describe('participant and club workflows', () => {
  beforeEach(() => {
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'new-participant' })
  })

  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('switches language without changing saved category values or user-entered names', async () => {
    const repository = createRepository({ saveCategory: vi.fn().mockResolvedValue(undefined) })
    const wrapper = mountApp(repository)
    await wrapper.get('.language-switcher select').setValue('es-419')
    expect(wrapper.get('button[aria-label="Categorías"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('North Archery Club')
    await wrapper.get('button[aria-label="Categorías"]').trigger('click')
    await wrapper.get('.page-heading .button-primary').trigger('click')
    await wrapper.get('input[required]').setValue('My custom name')
    const bowSelect = wrapper.get('form.modal select')
    expect(bowSelect.get('option[value="Recurve"]').text()).toBe('Recurvo')
    await bowSelect.setValue('Recurve')
    await wrapper.get('form.modal input[required][type="number"]').setValue(2)
    await wrapper.get('form.modal').trigger('submit')
    await flushPromises()
    expect(repository.saveCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My custom name', bowType: 'Recurve', sortOrder: 2 }),
    )
    expect(wrapper.text()).toContain('My custom name')
  })

  it('updates event month tiles when switching languages', async () => {
    const wrapper = mountApp()
    const month = wrapper.get('.date-tile span')
    expect(month.text()).toBe('Jan')
    await wrapper.get('.language-switcher select').setValue('es-419')
    expect(month.text()).toBe(
      new Intl.DateTimeFormat('es-419', { month: 'short', timeZone: 'UTC' }).format(new Date('2099-01-01T00:00:00Z')),
    )
  })

  it('preselects the club when adding a participant from a club card', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Clubs"]').trigger('click')
    await wrapper.get('.club-card-actions button').trigger('click')

    expect(wrapper.get('form.modal select').element.value).toBe('club-north')
  })

  it('filters tournament directory participants by club', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    await wrapper.get('.tournament-card').trigger('click')
    await wrapper.get('select[aria-label="Filter archers by club"]').setValue('club-north')

    const roster = wrapper.get('.roster-list').text()
    expect(roster).toContain('Archer, Alex')
    expect(roster).not.toContain('Shooter, Sam')
  })

  it('opens a tournament by clicking its card unless text is selected', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    expect(wrapper.find('.tournament-card .button').exists()).toBe(false)

    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'copied text' })
    await wrapper.get('.tournament-card').trigger('click')
    expect(wrapper.find('.tournament-card').exists()).toBe(true)

    selection.mockReturnValue({ toString: () => '' })
    await wrapper.get('.tournament-card').trigger('click')
    expect(wrapper.find('.tournament-card').exists()).toBe(false)
    expect(wrapper.find('.roster-list').exists()).toBe(true)
  })

  it.each([
    ['tournaments list', 'button[aria-label="Tournaments"]', '.tournament-card'],
    ['dashboard upcoming list', null, '.event-row'],
  ])('exposes the %s card as a named button that opens on Enter and Space', async (_name, nav, card) => {
    const keys = ['enter', 'space']
    for (const key of keys) {
      const wrapper = mountApp()
      if (nav) await wrapper.get(nav).trigger('click')
      const element = wrapper.get(card)
      expect(element.attributes('role')).toBe('button')
      expect(element.attributes('tabindex')).toBe('0')
      expect(element.attributes('aria-label')).toBe('Open Tournament')

      await element.trigger('keydown', { key: key === 'space' ? ' ' : 'Enter' })
      expect(wrapper.find('.roster-list').exists()).toBe(true)
    }
  })

  it('does not wrap native buttons in a second focusable control on dashboard cards', () => {
    const wrapper = mountApp()
    const cards = wrapper.findAll('.stat-card, .club-preview-item')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.attributes('tabindex')).toBeUndefined()
      expect(card.attributes('role')).toBeUndefined()
      expect(card.find('button').exists()).toBe(true)
    }
  })

  it('ignores other keys on a tournament card', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    await wrapper.get('.tournament-card').trigger('keydown', { key: 'a' })
    expect(wrapper.find('.tournament-card').exists()).toBe(true)
  })

  it.each([
    ['.stat-card:nth-child(1)', '.tournament-card'],
    ['.stat-card:nth-child(2)', '.clubs-grid'],
    ['.stat-card:nth-child(3)', '.table-wrap'],
    ['.event-row', '.roster-list'],
  ])('opens the section when clicking the dashboard item %s', async (item, destination) => {
    const wrapper = mountApp()
    await wrapper.get(item).trigger('click')
    expect(wrapper.find(destination).exists()).toBe(true)
  })

  it('assigns an existing participant to a club', async () => {
    const repository = createRepository()
    const wrapper = mountApp(repository)
    await wrapper.get('button[aria-label="Archers"]').trigger('click')
    await wrapper.get('select[aria-label="Sam Shooter club"]').setValue('club-north')
    await flushPromises()

    expect(repository.setParticipantClub).toHaveBeenCalledWith('participant-independent', 'club-north')
  })

  it('shows participant save failures in the modal, not on the page', async () => {
    const repository = createRepository({
      saveParticipant: vi.fn().mockRejectedValue(new Error('Permission denied')),
    })
    const wrapper = mountApp(repository)
    await wrapper.get('.quick-action').trigger('click')
    await wrapper.get('input[autocomplete="given-name"]').setValue('New')
    await wrapper.get('input[autocomplete="family-name"]').setValue('Archer')
    await wrapper.get('input[type="date"]').setValue('2002-03-04')
    await wrapper.get('form.modal').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.modal-error').text()).toContain('Permission denied')
    expect(wrapper.find('.main-content > .database-error').exists()).toBe(false)
  })

  it('adds and selects a custom target type without predefined options', async () => {
    const repository = createRepository()
    const wrapper = mountApp(repository)
    await wrapper.get('button[aria-label="Tournament types"]').trigger('click')
    await wrapper.get('.page-heading .button-primary').trigger('click')

    const targetTypeSelect = wrapper.get('select[aria-label="Target type"]')
    expect(targetTypeSelect.findAll('option')).toHaveLength(1)

    await wrapper.get('button[aria-label="Add custom target type"]').trigger('click')
    await wrapper.get('input[aria-label="Custom target type name"]').setValue('40 cm triple-spot')
    await wrapper.get('button[aria-label="Save custom target type"]').trigger('click')
    await flushPromises()

    expect(repository.saveTargetType).toHaveBeenCalledWith({
      id: 'new-participant',
      name: '40 cm triple-spot',
    })
    expect(wrapper.get('select[aria-label="Target type"]').element.value).toBe('40 cm triple-spot')
  })

  it.each(['club', 'archer'])('%s users cannot change tournament categories', async (userRole) => {
    const initialData = createWorkspace()
    initialData.categories = [
      {
        id: 'category-open',
        name: 'Open',
        minAge: null,
        maxAge: null,
        bowType: '',
      },
    ]
    initialData.tournaments[0].categoryIds = ['category-open']

    const wrapper = mountApp(createRepository(), {
      initialData,
      userRole,
      userRoles: [userRole],
    })
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    await wrapper.get('.tournament-card').trigger('click')
    await wrapper.get('.tournament-tabs button:nth-child(2)').trigger('click')

    expect(wrapper.get('.category-roster-row input').element.disabled).toBe(true)
    expect(wrapper.get('.category-roster-row input').element.checked).toBe(true)
  })

  describe('choosing a category when adding an archer', () => {
    function createLevelWorkspace(pastCategoryId = 'rec-open') {
      const initialData = createWorkspace()
      const recurve = (id, name, sortOrder) => ({ id, name, minAge: null, maxAge: null, bowType: 'Recurve', sortOrder })
      initialData.categories = [
        recurve('rec-youth', 'Youth', 0),
        recurve('rec-open', 'Open', 1),
        recurve('rec-pro', 'Pro', 2),
        { id: 'comp-youth', name: 'Compound Youth', minAge: null, maxAge: null, bowType: 'Compound', sortOrder: 0 },
      ]
      initialData.tournaments[0].categoryIds = ['rec-youth', 'rec-open', 'rec-pro', 'comp-youth']
      initialData.tournaments.push({
        ...initialData.tournaments[0],
        id: 'tournament-past',
        name: 'Past Tournament',
        date: '2098-01-01',
        participantIds: ['participant-club'],
        categoryIds: ['rec-open'],
        categoryAssignments: pastCategoryId ? { 'participant-club': pastCategoryId } : {},
      })
      return initialData
    }

    async function openArchers(repository, initialData) {
      const wrapper = mountApp(repository, { initialData })
      await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
      await wrapper
        .findAll('.tournament-card')
        .find((card) => card.text().includes('Open Tournament'))
        .trigger('click')
      return wrapper
    }

    const pickerFor = (wrapper) => wrapper.get('select[aria-label="Add Alex Archer to tournament"]')

    it('has no checkbox and adds the archer with the chosen category', async () => {
      const repository = createRepository()
      const wrapper = await openArchers(repository, createLevelWorkspace())

      expect(wrapper.find('.roster-row input[type="checkbox"]').exists()).toBe(false)
      await pickerFor(wrapper).setValue('rec-pro')
      await flushPromises()

      expect(repository.setTournamentParticipant).toHaveBeenCalledWith(
        'tournament-open',
        'participant-club',
        true,
        'rec-pro',
      )
      expect(wrapper.find('select[aria-label="Add Alex Archer to tournament"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Pro')
    })

    it('disables lower levels of the same bow type but not other bow types', async () => {
      const wrapper = await openArchers(createRepository(), createLevelWorkspace('rec-open'))
      const option = (value) => pickerFor(wrapper).get(`option[value="${value}"]`).element

      expect(option('rec-youth').disabled).toBe(true)
      expect(option('rec-open').disabled).toBe(false)
      expect(option('rec-pro').disabled).toBe(false)
      expect(option('comp-youth').disabled).toBe(false)
    })

    it('blocks every lower level after the highest one', async () => {
      const wrapper = await openArchers(createRepository(), createLevelWorkspace('rec-pro'))
      const option = (value) => pickerFor(wrapper).get(`option[value="${value}"]`).element

      expect(option('rec-youth').disabled).toBe(true)
      expect(option('rec-open').disabled).toBe(true)
      expect(option('rec-pro').disabled).toBe(false)
    })

    it('does not save when a blocked category is forced', async () => {
      const repository = createRepository()
      const wrapper = await openArchers(repository, createLevelWorkspace('rec-open'))
      await pickerFor(wrapper).setValue('rec-youth')
      await flushPromises()

      expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Already entered Open, a higher level')
    })

    it('lets an exempt category such as Masters be entered after any level', async () => {
      const initialData = createLevelWorkspace('rec-pro')
      initialData.categories.push({
        id: 'rec-master',
        name: 'Masters',
        minAge: 50,
        maxAge: null,
        bowType: 'Recurve',
        sortOrder: 0,
        levelExempt: true,
      })
      initialData.participants[0].birthDate = '1960-01-01'
      initialData.tournaments[0].categoryIds.push('rec-master')
      const repository = createRepository()
      const wrapper = await openArchers(repository, initialData)

      expect(pickerFor(wrapper).get('option[value="rec-master"]').element.disabled).toBe(false)
      expect(pickerFor(wrapper).get('option[value="rec-open"]').element.disabled).toBe(true)
      await pickerFor(wrapper).setValue('rec-master')
      await flushPromises()
      expect(repository.setTournamentParticipant).toHaveBeenCalledWith(
        'tournament-open',
        'participant-club',
        true,
        'rec-master',
      )
    })

    it('does not let an exempt entry block the levels', async () => {
      const initialData = createLevelWorkspace('rec-master')
      initialData.categories.push({
        id: 'rec-master',
        name: 'Masters',
        minAge: null,
        maxAge: null,
        bowType: 'Recurve',
        sortOrder: 0,
        levelExempt: true,
      })
      const wrapper = await openArchers(createRepository(), initialData)

      expect(pickerFor(wrapper).get('option[value="rec-youth"]').element.disabled).toBe(false)
      expect(pickerFor(wrapper).get('option[value="rec-pro"]').element.disabled).toBe(false)
    })

    it('lets an entered archer move up but never down', async () => {
      const repository = createRepository()
      const initialData = createLevelWorkspace('')
      initialData.tournaments[0].participantIds = ['participant-club']
      initialData.tournaments[0].categoryAssignments = { 'participant-club': 'rec-open' }
      const wrapper = await openArchers(repository, initialData)
      const changer = wrapper.get('select[aria-label="Change category of Alex Archer"]')
      const values = changer.findAll('option').map((option) => option.element.value)

      expect(values).toEqual(['', 'rec-pro', 'comp-youth'])
      await changer.setValue('rec-pro')
      await flushPromises()
      expect(repository.setTournamentParticipant).toHaveBeenCalledWith(
        'tournament-open',
        'participant-club',
        true,
        'rec-pro',
      )
      expect(wrapper.get('.roster-row .category-select').text()).toBe('Pro')
    })

    it('offers no category change to an archer already at the top level', async () => {
      const initialData = createLevelWorkspace('')
      initialData.tournaments[0].participantIds = ['participant-club']
      initialData.tournaments[0].categoryIds = ['rec-youth', 'rec-open', 'rec-pro']
      initialData.tournaments[0].categoryAssignments = { 'participant-club': 'rec-pro' }
      const wrapper = await openArchers(createRepository(), initialData)

      expect(wrapper.find('select[aria-label="Change category of Alex Archer"]').exists()).toBe(false)
    })

    it('asks for bow type and category when creating an archer from the tournament', async () => {
      const repository = createRepository()
      const wrapper = await openArchers(repository, createLevelWorkspace(''))
      await wrapper.get('.panel-heading .button-outline').trigger('click')
      await wrapper.get('input[autocomplete="family-name"]').setValue('Newman')
      await wrapper.get('input[autocomplete="given-name"]').setValue('Nia')
      await wrapper.get('input[type="date"]').setValue('2000-05-05')

      const category = () => wrapper.get('form.modal select[aria-label="Category"]')
      expect(category().findAll('option:not([disabled])')).toHaveLength(0)
      await wrapper.get('form.modal select[aria-label="Bow type"]').setValue('Recurve')
      expect(
        category()
          .findAll('option:not([disabled])')
          .map((option) => option.element.value),
      ).toEqual(['rec-youth', 'rec-open', 'rec-pro'])
      await category().setValue('rec-open')
      await wrapper.get('form.modal').trigger('submit')
      await flushPromises()

      expect(repository.saveParticipant).toHaveBeenCalledWith(
        expect.not.objectContaining({ bowType: expect.anything(), categoryId: expect.anything() }),
        'tournament-open',
        false,
        'rec-open',
      )
      expect(wrapper.text()).toContain('Newman, Nia')
    })

    it('removes an added archer with the Remove button', async () => {
      const repository = createRepository()
      const wrapper = await openArchers(repository, createLevelWorkspace(''))
      await pickerFor(wrapper).setValue('rec-open')
      await flushPromises()
      await wrapper.get('button[aria-label="Remove Alex Archer from tournament"]').trigger('click')
      await flushPromises()

      expect(repository.setTournamentParticipant).toHaveBeenLastCalledWith('tournament-open', 'participant-club', false)
      expect(pickerFor(wrapper).exists()).toBe(true)
    })
  })

  it('lets managers see User access but only admins change manager roles', async () => {
    const roles = [
      { userId: 'user-admin', email: 'admin@example.test', role: 'admin' },
      { userId: 'user-manager', email: 'manager@example.test', role: 'manager' },
    ]
    const managerRepository = createRepository()
    const managerWrapper = mountApp(managerRepository, {
      userRole: 'manager',
      userRoles: ['manager'],
      initialData: { ...createWorkspace(), userRoles: roles },
    })
    await managerWrapper.get('button[aria-label="User access"]').trigger('click')

    expect(managerWrapper.find('.heading-actions').exists()).toBe(false)
    expect(managerWrapper.findAll('.row-actions button')).toHaveLength(2)
    expect(managerWrapper.text()).not.toContain('Remove role')
    await managerWrapper.findAll('.row-actions button')[0].trigger('click')
    await flushPromises()
    expect(managerRepository.sendAdminPasswordReset).toHaveBeenCalledWith('admin@example.test')

    for (const userRole of ['club', 'archer']) {
      const wrapper = mountApp(createRepository(), { userRole, userRoles: [userRole] })
      expect(wrapper.find('button[aria-label="User access"]').exists()).toBe(false)
    }

    const repository = createRepository()
    const adminWrapper = mountApp(repository, { userRole: 'admin', userRoles: ['admin'] })
    await adminWrapper.get('button[aria-label="User access"]').trigger('click')
    await adminWrapper.get('.heading-actions .button-primary').trigger('click')

    expect(adminWrapper.find('form.modal select').exists()).toBe(false)
    await adminWrapper.get('form.modal input[type="email"]').setValue('manager@example.test')
    await adminWrapper.get('form.modal').trigger('submit')
    await flushPromises()

    expect(repository.assignUserRole).toHaveBeenCalledWith({
      email: 'manager@example.test',
      role: 'manager',
      displayName: '',
    })
  })

  it('sends a password reset from each manager row without a top-of-page form', async () => {
    const repository = createRepository()
    const wrapper = mountApp(repository, {
      userRole: 'admin',
      userRoles: ['admin'],
      initialData: {
        ...createWorkspace(),
        userRoles: [{ userId: 'user-manager', email: 'manager@example.test', role: 'manager' }],
      },
    })
    await wrapper.get('button[aria-label="User access"]').trigger('click')

    expect(wrapper.find('.heading-actions .button-outline').exists()).toBe(false)
    expect(wrapper.find('form.modal').exists()).toBe(false)

    await wrapper.get('.table-panel tbody .row-actions button').trigger('click')
    await flushPromises()

    expect(repository.sendAdminPasswordReset).toHaveBeenCalledWith('manager@example.test')
    expect(wrapper.get('.toast-message').text()).toContain('password reset email will be sent')
  })

  it('shows the save error on the page when a password reset fails', async () => {
    const repository = createRepository({
      sendAdminPasswordReset: vi.fn().mockRejectedValue(new Error('Rate limit reached')),
    })
    const wrapper = mountApp(repository, {
      userRole: 'admin',
      userRoles: ['admin'],
      initialData: {
        ...createWorkspace(),
        userRoles: [{ userId: 'user-manager', email: 'manager@example.test', role: 'manager' }],
      },
    })
    await wrapper.get('button[aria-label="User access"]').trigger('click')

    await wrapper.get('.table-panel tbody .row-actions button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.database-error').text()).toContain('Rate limit reached')
    expect(wrapper.find('.toast-message').exists()).toBe(false)
  })

  it('lets a signed-in user email themselves a password reset link from the profile dialog', async () => {
    const repository = createRepository({ sendOwnPasswordReset: vi.fn().mockResolvedValue(undefined) })
    const wrapper = mountApp(repository, { userRole: 'manager', userRoles: ['manager'] })
    await wrapper.get('.profile-button').trigger('click')
    await wrapper.get('form.modal button.button-outline').trigger('click')
    await flushPromises()

    expect(repository.sendOwnPasswordReset).toHaveBeenCalledWith('archer@example.test')
    expect(wrapper.get('.toast-message').text()).toContain('password reset email will be sent')
  })

  it('shows a failed self-service password reset inside the profile dialog', async () => {
    const repository = createRepository({
      sendOwnPasswordReset: vi.fn().mockRejectedValue(new Error('Email rate limit exceeded')),
    })
    const wrapper = mountApp(repository, { userRole: 'manager', userRoles: ['manager'] })
    await wrapper.get('.profile-button').trigger('click')
    await wrapper.get('form.modal button.button-outline').trigger('click')
    await flushPromises()

    expect(wrapper.get('form.modal .modal-error').text()).toContain('Email rate limit exceeded')
  })

  it('lets managers enable and disable a club user directly on the Clubs screen', async () => {
    const initialData = createWorkspace()
    initialData.clubs[0].email = 'club@example.test'
    const repository = createRepository()
    const wrapper = mountApp(repository, { initialData, userRole: 'manager', userRoles: ['manager'] })

    await wrapper.get('button[aria-label="Clubs"]').trigger('click')
    expect(wrapper.get('.club-user-row').text()).toContain('club@example.test')
    expect(wrapper.get('.club-user-row').text()).toContain('Disabled')

    await wrapper.get('.club-user-controls button.button-outline').trigger('click')
    await flushPromises()

    expect(repository.setClubEnabled).toHaveBeenCalledWith('club-north', true)
    expect(wrapper.get('.club-user-row').text()).toContain('Enabled')
  })

  it('opens club details from the dashboard row and toggles access from its status button', async () => {
    const initialData = createWorkspace()
    initialData.clubs[0].email = 'club@example.test'
    const repository = createRepository()
    const wrapper = mountApp(repository, { initialData, userRole: 'manager', userRoles: ['manager'] })

    await wrapper
      .get(
        '.club-preview-item .status-pill-button.status-active, .club-preview-item .status-pill-button.status-disabled',
      )
      .trigger('click')
    await flushPromises()
    expect(repository.setClubEnabled).toHaveBeenCalledWith('club-north', true)
    expect(wrapper.find('form.modal').exists()).toBe(false)

    await wrapper.get('.club-preview-item').trigger('click')
    expect(wrapper.get('form.modal').exists()).toBe(true)
  })

  it('lets club users create and edit archers for their own club only without creating tournaments or clubs', async () => {
    const initialData = createWorkspace()
    initialData.clubs.push({
      id: 'club-south',
      name: 'South Archery Club',
      representative: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      mapUrl: '',
      userEmail: '',
      userEnabled: false,
    })
    initialData.participants.push({
      id: 'participant-south',
      firstName: 'Pat',
      lastName: 'South',
      birthDate: '1999-05-05',
      waId: '',
      aetayId: '',
      clubId: 'club-south',
    })

    const repository = createRepository()
    const wrapper = mountApp(repository, {
      initialData,
      userRole: 'club',
      userRoles: ['club'],
      userScope: { clubId: 'club-north' },
    })

    expect(wrapper.find('button[aria-label="User access"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    expect(wrapper.find('.page-heading .button-primary').exists()).toBe(false)
    await wrapper.get('button[aria-label="Tournament types"]').trigger('click')
    expect(wrapper.find('.page-heading .button-primary').exists()).toBe(false)
    await wrapper.get('button[aria-label="Categories"]').trigger('click')
    expect(wrapper.find('.page-heading .button-primary').exists()).toBe(false)
    await wrapper.get('button[aria-label="Clubs"]').trigger('click')
    expect(wrapper.find('.page-heading .button-primary').exists()).toBe(false)

    await wrapper.get('button[aria-label="Archers"]').trigger('click')
    expect(wrapper.find('button[aria-label="Edit Alex Archer"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Edit Pat South"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="Edit Alex Archer"]').trigger('click')
    await wrapper.get('input[autocomplete="given-name"]').setValue('Alexis')
    await wrapper.get('form.modal').trigger('submit')
    await flushPromises()

    expect(repository.saveParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-club',
        firstName: 'Alexis',
        clubId: 'club-north',
      }),
      '',
      true,
      '',
    )

    await wrapper.get('.page-heading .button-primary').trigger('click')
    const clubSelect = wrapper.get('form.modal select')
    expect(clubSelect.element.disabled).toBe(true)
    expect(clubSelect.element.value).toBe('club-north')
  })

  it('does not expose reset or profile editing to archers', () => {
    const wrapper = mountApp(createRepository(), { userRole: 'archer', userRoles: ['archer'] })

    expect(wrapper.find('button[aria-label="User access"]').exists()).toBe(false)
    expect(wrapper.get('.profile-button').element.disabled).toBe(true)
  })
})
