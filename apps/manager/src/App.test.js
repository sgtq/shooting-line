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
    searchArchers: vi.fn().mockResolvedValue([]),
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

  it('filters tournament archers by club and lists only archers in the tournament', async () => {
    const initialData = createWorkspace()
    initialData.participants.push({
      id: 'participant-outside',
      firstName: 'Olga',
      lastName: 'Outside',
      birthDate: '1999-01-01',
      waId: '',
      aetayId: '',
      clubId: 'club-north',
    })
    initialData.tournaments[0].participantIds = ['participant-club', 'participant-independent']
    const wrapper = mountApp(createRepository(), { initialData })
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    await wrapper.get('.tournament-card').trigger('click')
    await wrapper.get('select[aria-label="Filter archers by club"]').setValue('club-north')

    const roster = wrapper.get('.roster-list').text()
    expect(roster).toContain('Archer, Alex')
    expect(roster).not.toContain('Shooter, Sam')
    expect(roster).not.toContain('Outside, Olga')
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
    expect(wrapper.find('.roster-panel').exists()).toBe(true)
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
      expect(wrapper.find('.roster-panel').exists()).toBe(true)
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
    ['.event-row', '.roster-panel'],
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

  describe('tournament archers and categories', () => {
    const hint = "Limited by the archer's age and the categories they have already entered"

    // Alex has entered `pastCategoryId` in an earlier tournament. The open tournament has no archers yet.
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

    // Alex is already entered in the open tournament with `categoryId` (or none).
    function createEnteredWorkspace(categoryId = 'rec-open') {
      const initialData = createLevelWorkspace('')
      initialData.tournaments[0].participantIds = ['participant-club']
      initialData.tournaments[0].categoryAssignments = categoryId ? { 'participant-club': categoryId } : {}
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

    const openAddDialog = (wrapper) => wrapper.get('.panel-heading .button-outline').trigger('click')
    const bowSelect = (wrapper) => wrapper.get('form.modal select[aria-label="Bow type"]')
    const categorySelect = (wrapper) => wrapper.get('form.modal select[aria-label="Category"]')

    describe('listing archers', () => {
      it('shows only archers in the tournament, with column headers and no state labels', async () => {
        const wrapper = await openArchers(createRepository(), createEnteredWorkspace('rec-open'))

        expect(wrapper.findAll('.roster-head span').map((cell) => cell.text())).toEqual([
          'ARCHER',
          'CATEGORY',
          'ACTIONS',
        ])
        const rows = wrapper.findAll('.roster-row:not(.roster-head)')
        expect(rows).toHaveLength(1)
        expect(rows[0].text()).toContain('Archer, Alex')
        expect(wrapper.text()).not.toContain('Shooter, Sam')
        expect(wrapper.text()).not.toContain('Directory')
        expect(wrapper.text()).not.toContain('Added')
        expect(wrapper.find('.roster-row input[type="checkbox"]').exists()).toBe(false)
      })

      it('shows an empty state with an Add archer button when nobody is entered', async () => {
        const wrapper = await openArchers(createRepository(), createLevelWorkspace())

        expect(wrapper.find('.roster-list').exists()).toBe(false)
        expect(wrapper.get('.empty-state').text()).toContain('No archers in this tournament')
        expect(wrapper.get('.empty-state button').text()).toBe('Add archer')
      })
    })

    describe('adding an archer found in the database', () => {
      const match = { token: 'tok-1', firstName: 'Riley', lastName: 'Shooter', clubId: 'club-north' }
      const found = {
        id: 'participant-found',
        firstName: 'Riley',
        lastName: 'Shooter',
        birthDate: '',
        waId: '',
        aetayId: '',
        clubId: 'club-north',
        nameOnly: true,
      }

      async function typeLastName(wrapper, value) {
        await wrapper.get('input[autocomplete="family-name"]').setValue(value)
        await new Promise((resolve) => setTimeout(resolve, 350))
        await flushPromises()
      }

      it('searches as the name is typed and adds the archer clicked with the chosen category', async () => {
        const searchArchers = vi.fn().mockResolvedValue([match])
        const addArcherByToken = vi.fn().mockResolvedValue(found)
        const wrapper = await openArchers(createRepository({ searchArchers, addArcherByToken }), createLevelWorkspace())
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sho')

        expect(searchArchers).toHaveBeenLastCalledWith({
          affiliationId: '',
          lastName: 'Sho',
          firstName: '',
          tournamentId: 'tournament-open',
        })
        await wrapper.get('input[name="archer-match"]').setValue()
        expect(wrapper.find('input[type="date"]').exists()).toBe(false)
        await bowSelect(wrapper).setValue('Recurve')
        await categorySelect(wrapper).setValue('rec-pro')
        await wrapper.get('form.modal').trigger('submit')
        await flushPromises()

        expect(addArcherByToken).toHaveBeenCalledWith('tournament-open', 'tok-1', 'rec-pro')
        expect(wrapper.get('.roster-row:not(.roster-head)').text()).toContain('Shooter, Riley')
        expect(wrapper.get('.roster-category').text()).toBe('Pro')
        expect(wrapper.find('form.modal').exists()).toBe(false)
        expect(wrapper.vm.$props.repository.saveParticipant).not.toHaveBeenCalled()
      })

      it('creates a new archer when no match is clicked', async () => {
        const searchArchers = vi.fn().mockResolvedValue([match])
        const addArcherByToken = vi.fn()
        const repository = createRepository({ searchArchers, addArcherByToken })
        const wrapper = await openArchers(repository, createLevelWorkspace(''))
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Shooter')
        await wrapper.get('input[autocomplete="given-name"]').setValue('Other')
        await wrapper.get('input[type="date"]').setValue('2000-05-05')
        await bowSelect(wrapper).setValue('Recurve')
        await categorySelect(wrapper).setValue('rec-open')
        await wrapper.get('form.modal').trigger('submit')
        await flushPromises()

        expect(addArcherByToken).not.toHaveBeenCalled()
        expect(repository.saveParticipant).toHaveBeenCalledTimes(1)
      })

      it('searches by affiliation ID without needing a name', async () => {
        const searchArchers = vi.fn().mockResolvedValue([match])
        const wrapper = await openArchers(createRepository({ searchArchers }), createLevelWorkspace())
        await openAddDialog(wrapper)
        await wrapper.get('input[placeholder="Affiliation number"]').setValue('WA-77')
        await new Promise((resolve) => setTimeout(resolve, 350))
        await flushPromises()

        expect(searchArchers).toHaveBeenLastCalledWith(
          expect.objectContaining({ affiliationId: 'WA-77', lastName: '' }),
        )
        expect(wrapper.findAll('input[name="archer-match"]')).toHaveLength(1)
      })

      it('does not search before 3 letters of a last name', async () => {
        const searchArchers = vi.fn().mockResolvedValue([])
        const wrapper = await openArchers(createRepository({ searchArchers }), createLevelWorkspace())
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sh')

        expect(searchArchers).not.toHaveBeenCalled()
      })

      it('asks for a category before adding a found archer to a tournament that has categories', async () => {
        const addArcherByToken = vi.fn()
        const wrapper = await openArchers(
          createRepository({ searchArchers: vi.fn().mockResolvedValue([match]), addArcherByToken }),
          createLevelWorkspace(),
        )
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sho')
        await wrapper.get('input[name="archer-match"]').setValue()
        await wrapper.get('form.modal').trigger('submit')
        await flushPromises()

        expect(addArcherByToken).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain('Select a valid category')
      })

      it('adds without a category when the tournament has none', async () => {
        const addArcherByToken = vi.fn().mockResolvedValue(found)
        const initialData = createLevelWorkspace()
        initialData.tournaments[0].categoryIds = []
        const wrapper = await openArchers(
          createRepository({ searchArchers: vi.fn().mockResolvedValue([match]), addArcherByToken }),
          initialData,
        )
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sho')
        await wrapper.get('input[name="archer-match"]').setValue()
        expect(wrapper.find('form.modal select[aria-label="Bow type"]').exists()).toBe(false)
        await wrapper.get('form.modal').trigger('submit')
        await flushPromises()

        expect(addArcherByToken).toHaveBeenCalledWith('tournament-open', 'tok-1', '')
      })

      it('lets the user go back to creating a new archer after clicking a match', async () => {
        const wrapper = await openArchers(
          createRepository({ searchArchers: vi.fn().mockResolvedValue([match]) }),
          createLevelWorkspace(),
        )
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sho')
        await wrapper.get('input[name="archer-match"]').setValue()
        expect(wrapper.text()).toContain('Adding Riley Shooter')

        await wrapper
          .findAll('button')
          .find((button) => button.text() === 'Create a new archer instead')
          .trigger('click')
        expect(wrapper.find('input[type="date"]').exists()).toBe(true)
      })

      it('shows a failed search and leaves the form open', async () => {
        const searchArchers = vi.fn().mockRejectedValue(new Error('search down'))
        const wrapper = await openArchers(createRepository({ searchArchers }), createLevelWorkspace())
        await openAddDialog(wrapper)
        await typeLastName(wrapper, 'Sho')

        expect(wrapper.text()).toContain('Archer search failed: search down')
        expect(wrapper.find('form.modal').exists()).toBe(true)
      })
    })

    describe('adding a new archer', () => {
      it('asks for bow type and category and saves the archer into the tournament', async () => {
        const repository = createRepository()
        const wrapper = await openArchers(repository, createLevelWorkspace(''))
        await openAddDialog(wrapper)
        await wrapper.get('input[autocomplete="family-name"]').setValue('Newman')
        await wrapper.get('input[autocomplete="given-name"]').setValue('Nia')
        await wrapper.get('input[type="date"]').setValue('2000-05-05')

        expect(categorySelect(wrapper).findAll('option:not([disabled])')).toHaveLength(0)
        await bowSelect(wrapper).setValue('Recurve')
        expect(
          categorySelect(wrapper)
            .findAll('option:not([disabled])')
            .map((item) => item.element.value),
        ).toEqual(['rec-youth', 'rec-open', 'rec-pro'])
        await categorySelect(wrapper).setValue('rec-open')
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
    })

    describe('the category dropdown in the add dialog', () => {
      it('explains that categories are limited by age and known categories', async () => {
        const wrapper = await openArchers(createRepository(), createEnteredWorkspace(''))
        expect(wrapper.get('.roster-category-cell select').attributes('title')).toBe(hint)

        await openAddDialog(wrapper)
        expect(categorySelect(wrapper).attributes('title')).toBe(hint)
      })
    })

    describe('changing and removing a category', () => {
      it('lets an entered archer move up but never down', async () => {
        const repository = createRepository()
        const wrapper = await openArchers(repository, createEnteredWorkspace('rec-open'))
        const changeSelector = 'select[aria-label="Change category of Alex Archer"]'
        expect(wrapper.find(changeSelector).exists()).toBe(false)
        expect(wrapper.get('.roster-category').text()).toBe('Open')

        await wrapper.get('button[aria-label="Change category of Alex Archer"]').trigger('click')
        const changer = wrapper.get(changeSelector)
        expect(changer.findAll('option').map((item) => item.element.value)).toEqual(['', 'rec-pro', 'comp-youth'])
        await changer.setValue('rec-pro')
        await flushPromises()

        expect(repository.setTournamentParticipant).toHaveBeenCalledWith(
          'tournament-open',
          'participant-club',
          true,
          'rec-pro',
        )
        expect(wrapper.find(changeSelector).exists()).toBe(false)
        expect(wrapper.get('.roster-category').text()).toBe('Pro')
      })

      it('closes the change picker with Cancel without saving', async () => {
        const repository = createRepository()
        const wrapper = await openArchers(repository, createEnteredWorkspace('rec-open'))
        await wrapper.get('button[aria-label="Change category of Alex Archer"]').trigger('click')
        await wrapper.get('button[aria-label="Cancel changing the category of Alex Archer"]').trigger('click')

        expect(wrapper.find('select[aria-label="Change category of Alex Archer"]').exists()).toBe(false)
        expect(wrapper.get('.roster-category').text()).toBe('Open')
        expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
      })

      it('offers no category change to an archer already at the top level', async () => {
        const initialData = createEnteredWorkspace('rec-pro')
        initialData.tournaments[0].categoryIds = ['rec-youth', 'rec-open', 'rec-pro']
        const wrapper = await openArchers(createRepository(), initialData)

        expect(wrapper.find('button[aria-label="Change category of Alex Archer"]').exists()).toBe(false)
      })

      it('removes only the category and brings the picker back', async () => {
        const repository = createRepository({ setParticipantCategory: vi.fn().mockResolvedValue(undefined) })
        const wrapper = await openArchers(repository, createEnteredWorkspace('rec-open'))
        await wrapper.get('button[aria-label="Remove the category of Alex Archer"]').trigger('click')
        await flushPromises()

        expect(repository.setParticipantCategory).toHaveBeenCalledWith('tournament-open', 'participant-club', '')
        expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
        expect(wrapper.find('.roster-category').exists()).toBe(false)
        const picker = wrapper.get('select[aria-label="Choose category of Alex Archer"]')
        expect(picker.get('option').text()).toBe('Choose category')
        expect(wrapper.get('.roster-row:not(.roster-head)').text()).toContain('Archer, Alex')
      })

      it('keeps the category icons apart from the archer action', async () => {
        const wrapper = await openArchers(createRepository(), createEnteredWorkspace('rec-open'))

        expect(wrapper.get('.roster-category-cell').findAll('button')).toHaveLength(2)
        expect(wrapper.get('.roster-actions').text()).toBe('Remove from tournament')
      })
    })

    describe('removing an archer from the tournament', () => {
      const removeButton = 'button[aria-label="Remove Alex Archer from tournament"]'

      it('removes the archer from the list after confirming, but keeps them in the database', async () => {
        const confirm = vi.fn().mockReturnValue(true)
        vi.stubGlobal('confirm', confirm)
        const repository = createRepository()
        const wrapper = await openArchers(repository, createEnteredWorkspace('rec-open'))
        await wrapper.get(removeButton).trigger('click')
        await flushPromises()

        expect(confirm).toHaveBeenCalledWith('Remove Alex Archer from this tournament?')
        expect(repository.setTournamentParticipant).toHaveBeenCalledWith('tournament-open', 'participant-club', false)
        expect(wrapper.text()).not.toContain('Archer, Alex')
        expect(repository.saveParticipant).not.toHaveBeenCalled()
      })

      it('keeps the archer when the removal is not confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
        const repository = createRepository()
        const wrapper = await openArchers(repository, createEnteredWorkspace('rec-open'))
        await wrapper.get(removeButton).trigger('click')
        await flushPromises()

        expect(repository.setTournamentParticipant).not.toHaveBeenCalled()
        expect(wrapper.get('.roster-category').text()).toBe('Open')
      })
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

  it('lets club users with a plan create and edit archers for their own club only, and create tournaments but not clubs', async () => {
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

    initialData.subscriptions = [
      { id: 's1', userId: 'club-user', planId: 'p1', startsOn: '2000-01-01', endsOn: '2999-01-01' },
    ]
    const repository = createRepository()
    const wrapper = mountApp(repository, {
      initialData,
      userRole: 'club',
      userRoles: ['club'],
      userId: 'club-user',
      userScope: { clubId: 'club-north' },
    })

    expect(wrapper.find('button[aria-label="User access"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
    expect(wrapper.find('.page-heading .button-primary').exists()).toBe(true)
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

describe('plans and club tournament creation', () => {
  const today = new Date().toISOString().slice(0, 10)
  const clubProps = { userRole: 'club', userRoles: ['club'], userId: 'club-user', userScope: { clubId: 'club-north' } }

  function clubWorkspace(subscriptions) {
    return { ...createWorkspace(), plans: [], planPrices: [], subscriptions }
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() })
    vi.stubGlobal('crypto', { randomUUID: () => 'new-id' })
  })

  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('hides tournament creation and explains why for a club without an active plan', () => {
    const expired = { id: 's1', userId: 'club-user', planId: 'p1', startsOn: '2000-01-01', endsOn: '2000-02-01' }
    const wrapper = mountApp(createRepository(), { ...clubProps, initialData: clubWorkspace([expired]) })

    expect(wrapper.text()).not.toContain('Create tournament')
    expect(wrapper.text()).toContain('Your club needs an active plan to create tournaments')
  })

  it('does not count another user plan toward the club', () => {
    const other = { id: 's1', userId: 'someone-else', planId: 'p1', startsOn: '2000-01-01', endsOn: '2999-01-01' }
    const wrapper = mountApp(createRepository(), { ...clubProps, initialData: clubWorkspace([other]) })

    expect(wrapper.text()).not.toContain('Create tournament')
  })

  it('lets a club with an active plan create a tournament for its own club only', async () => {
    const active = { id: 's1', userId: 'club-user', planId: 'p1', startsOn: '2000-01-01', endsOn: '2999-01-01' }
    const repository = createRepository({ saveTournament: vi.fn().mockResolvedValue(undefined) })
    const wrapper = mountApp(repository, { ...clubProps, initialData: clubWorkspace([active]) })

    expect(wrapper.text()).not.toContain('Your club needs an active plan')
    await wrapper.get('.page-heading .button-primary').trigger('click')
    const hostClub = wrapper.get('select[aria-label="Host club"]')
    expect(hostClub.element.disabled).toBe(true)
    expect(hostClub.element.value).toBe('club-north')

    await wrapper.get('input[required]').setValue('Club Cup')
    await wrapper.get('input[type="date"]').setValue('2099-05-05')
    await wrapper.get('select[aria-label="Tournament type"]').setValue('type-outdoor')
    await wrapper.get('form.modal').trigger('submit')
    await flushPromises()

    expect(repository.saveTournament).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Club Cup', clubId: 'club-north' }),
    )
  })

  it('keeps the Plans page for managers', () => {
    const wrapper = mountApp(createRepository(), { initialData: clubWorkspace([]) })
    expect(wrapper.find('button[aria-label="Plans"]').exists()).toBe(true)

    const club = mountApp(createRepository(), { ...clubProps, initialData: clubWorkspace([]) })
    expect(club.find('button[aria-label="Plans"]').exists()).toBe(false)
  })

  it('assigns a plan with the dates the manager picks and reports a failed save', async () => {
    const initialData = {
      ...createWorkspace(),
      userRoles: [{ userId: 'club-user', email: 'club@example.test', role: 'club' }],
      plans: [{ id: 'plan-custom', name: 'Season', userRole: 'club', durationKind: 'custom', isActive: true }],
      planPrices: [
        { id: 'price-1', planId: 'plan-custom', amount: 50, currency: 'MXN', startsAt: '2000-01-01', endsAt: '' },
      ],
      subscriptions: [],
    }
    const saveSubscription = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
    const wrapper = mountApp(createRepository({ saveSubscription }), { initialData })
    await wrapper.get('button[aria-label="Plans"]').trigger('click')

    const form = wrapper.findAll('form.plan-form')[2]
    const [account, plan] = form.findAll('select')
    await account.setValue('club-user')
    await plan.setValue('plan-custom')
    const [starts, ends] = form.findAll('input[type="date"]')
    await starts.setValue(today)
    await ends.setValue('2999-12-31')
    expect(form.get('input[type="number"]').element.value).toBe('50')

    await form.trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Save failed: denied')
    expect(wrapper.text()).toContain('No club has a plan yet.')

    await form.trigger('submit')
    await flushPromises()
    expect(saveSubscription).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: 'club-user',
        planId: 'plan-custom',
        startsOn: today,
        endsOn: '2999-12-31',
        pricePaid: 50,
        currency: 'MXN',
      }),
    )
    expect(wrapper.text()).toContain('club@example.test')
  })

  it('blocks a plan that overlaps another one for the same club account', async () => {
    const initialData = {
      ...createWorkspace(),
      userRoles: [{ userId: 'club-user', email: 'club@example.test', role: 'club' }],
      plans: [{ id: 'plan-custom', name: 'Season', userRole: 'club', durationKind: 'custom', isActive: true }],
      planPrices: [],
      subscriptions: [
        { id: 's1', userId: 'club-user', planId: 'plan-custom', startsOn: '2030-01-01', endsOn: '2030-01-31' },
      ],
    }
    const saveSubscription = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountApp(createRepository({ saveSubscription }), { initialData })
    await wrapper.get('button[aria-label="Plans"]').trigger('click')

    const form = wrapper.findAll('form.plan-form')[2]
    const [account, plan] = form.findAll('select')
    await account.setValue('club-user')
    await plan.setValue('plan-custom')
    const [starts, ends] = form.findAll('input[type="date"]')
    await form.get('input[type="number"]').setValue('10')
    await starts.setValue('2030-01-31')
    await ends.setValue('2030-02-15')
    await form.trigger('submit')
    await flushPromises()
    expect(saveSubscription).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('This club account already has a plan during these dates')

    await starts.setValue('2030-02-01')
    await form.trigger('submit')
    await flushPromises()
    expect(saveSubscription).toHaveBeenCalledTimes(1)
  })

  describe('club roster access', () => {
    const active = { id: 's1', userId: 'club-user', planId: 'p1', startsOn: '2000-01-01', endsOn: '2999-01-01' }

    function rosterWorkspace(subscriptions, tournamentClubId = 'club-north') {
      const workspace = clubWorkspace(subscriptions)
      workspace.tournaments[0].clubId = tournamentClubId
      return workspace
    }

    async function openTournament(wrapper) {
      await wrapper.get('button[aria-label="Tournaments"]').trigger('click')
      await wrapper.get('.tournament-card').trigger('click')
      await flushPromises()
    }

    it('shows the add archer button for a club with a plan on its own tournament', async () => {
      const wrapper = mountApp(createRepository(), { ...clubProps, initialData: rosterWorkspace([active]) })
      await openTournament(wrapper)

      expect(wrapper.text()).toContain('Add archer')
    })

    it('hides it without an active plan', async () => {
      const wrapper = mountApp(createRepository(), { ...clubProps, initialData: rosterWorkspace([]) })
      await openTournament(wrapper)

      expect(wrapper.text()).not.toContain('Add archer')
    })

    function withCategory(workspace, startedAt = '') {
      workspace.categories = [{ id: 'cat-1', name: 'Open', minAge: null, maxAge: null, bowType: '', sortOrder: 0 }]
      workspace.tournaments[0].startedAt = startedAt
      return workspace
    }

    async function openCategories(wrapper) {
      await openTournament(wrapper)
      const tab = wrapper.findAll('.tournament-tabs button').find((button) => button.text() === 'Categories')
      await tab.trigger('click')
    }

    it('lets a club change categories and start its own unstarted tournament', async () => {
      const setTournamentStarted = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const wrapper = mountApp(createRepository({ setTournamentStarted }), {
        ...clubProps,
        initialData: withCategory(rosterWorkspace([active])),
      })
      await openCategories(wrapper)
      expect(wrapper.get('.category-roster-row input').element.disabled).toBe(false)

      const start = wrapper.findAll('button').find((button) => button.text() === 'Start tournament')
      await start.trigger('click')
      await flushPromises()

      expect(setTournamentStarted).toHaveBeenCalledWith('tournament-open', expect.stringMatching(/^\d{4}-\d\d-\d\dT/))
      expect(wrapper.text()).toContain('started and locked')
      expect(wrapper.get('.category-roster-row input').element.disabled).toBe(true)
      expect(wrapper.text()).not.toContain('Add archer')
      expect(wrapper.text()).not.toContain('Reopen tournament')
    })

    it('does not start the tournament when the club cancels the confirmation', async () => {
      const setTournamentStarted = vi.fn()
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
      const wrapper = mountApp(createRepository({ setTournamentStarted }), {
        ...clubProps,
        initialData: rosterWorkspace([active]),
      })
      await openTournament(wrapper)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Start tournament')
        .trigger('click')

      expect(setTournamentStarted).not.toHaveBeenCalled()
    })

    it('locks an already started tournament for its club', async () => {
      const wrapper = mountApp(createRepository(), {
        ...clubProps,
        initialData: withCategory(rosterWorkspace([active]), '2030-01-01T00:00:00Z'),
      })
      await openCategories(wrapper)

      expect(wrapper.get('.category-roster-row input').element.disabled).toBe(true)
      expect(wrapper.text()).not.toContain('Start tournament')
      expect(wrapper.text()).not.toContain('Reopen tournament')
    })

    it('shows another club the tournament info without any edit or start controls', async () => {
      const wrapper = mountApp(createRepository(), {
        ...clubProps,
        initialData: withCategory(rosterWorkspace([active], 'club-other')),
      })
      await openCategories(wrapper)

      expect(wrapper.text()).toContain('Open Tournament')
      expect(wrapper.get('.category-roster-row input').element.disabled).toBe(true)
      expect(wrapper.text()).not.toContain('Start tournament')
    })

    it('lets a manager reopen a started tournament', async () => {
      const setTournamentStarted = vi.fn().mockResolvedValue(undefined)
      const wrapper = mountApp(createRepository({ setTournamentStarted }), {
        initialData: withCategory(rosterWorkspace([]), '2030-01-01T00:00:00Z'),
      })
      await openTournament(wrapper)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Reopen tournament')
        .trigger('click')
      await flushPromises()

      expect(setTournamentStarted).toHaveBeenCalledWith('tournament-open', '')
      expect(wrapper.text()).toContain('Start tournament')
    })

    function withOtherClubArcher(workspace) {
      workspace.participants.push({
        id: 'participant-other',
        firstName: 'Morgan',
        lastName: 'Elsewhere',
        birthDate: '',
        waId: '',
        aetayId: '',
        clubId: 'club-other',
        nameOnly: true,
      })
      workspace.tournaments[0].participantIds = ['participant-other']
      return workspace
    }

    it('shows an archer of another club by name in a roster but not in the directory', async () => {
      const wrapper = mountApp(createRepository(), {
        ...clubProps,
        initialData: withOtherClubArcher(rosterWorkspace([active])),
      })
      await openTournament(wrapper)
      expect(wrapper.text()).toContain('Elsewhere')

      await wrapper.get('button[aria-label="Archers"]').trigger('click')
      expect(wrapper.text()).not.toContain('Elsewhere')
      expect(wrapper.text()).toContain('Archer')
    })

    function foundArcher(overrides = {}) {
      return {
        id: 'participant-found',
        firstName: 'Riley',
        lastName: 'Found',
        birthDate: '',
        waId: '',
        aetayId: '',
        clubId: 'club-other',
        nameOnly: true,
        ...overrides,
      }
    }
    const matchFor = (overrides = {}) => ({
      token: 'tok-1',
      firstName: 'Riley',
      lastName: 'Found',
      clubId: 'club-other',
      ...overrides,
    })

    async function openAddArcher(wrapper) {
      await openTournament(wrapper)
      await wrapper
        .findAll('button')
        .find((button) => button.text().includes('Add archer'))
        .trigger('click')
    }

    async function typeAndWait(wrapper, selector, value) {
      await wrapper.get(selector).setValue(value)
      await new Promise((resolve) => setTimeout(resolve, 350))
      await flushPromises()
    }

    it('has one add-archer form that starts with the affiliation ID', async () => {
      const wrapper = mountApp(createRepository(), { ...clubProps, initialData: rosterWorkspace([active]) })
      await openAddArcher(wrapper)

      for (const label of ['Existing archer', 'New archer', 'By affiliation ID', 'Search by name']) {
        expect(wrapper.get('form.modal').text()).not.toContain(label)
      }
      expect(wrapper.get('form.modal input').attributes('placeholder')).toBe('Affiliation number')
    })

    it('finds an archer of another club by affiliation ID and adds them without revealing their record', async () => {
      const searchArchers = vi.fn().mockResolvedValue([matchFor()])
      const addArcherByToken = vi.fn().mockResolvedValue(foundArcher())
      const wrapper = mountApp(createRepository({ searchArchers, addArcherByToken }), {
        ...clubProps,
        initialData: rosterWorkspace([active]),
      })
      await openAddArcher(wrapper)
      await typeAndWait(wrapper, 'input[placeholder="Affiliation number"]', 'WA-99')

      expect(searchArchers).toHaveBeenLastCalledWith({
        affiliationId: 'WA-99',
        lastName: '',
        firstName: '',
        tournamentId: 'tournament-open',
      })
      const result = wrapper.get('.archer-pick')
      expect(result.text()).toContain('Found, Riley')
      expect(result.text()).not.toMatch(/WA|AETAY|\d{4}/)

      await wrapper.get('input[name="archer-match"]').setValue()
      await wrapper.get('form.modal').trigger('submit')
      await flushPromises()

      expect(addArcherByToken).toHaveBeenCalledWith('tournament-open', 'tok-1', '')
      expect(wrapper.text()).toContain('Found')
      await wrapper.get('button[aria-label="Archers"]').trigger('click')
      expect(wrapper.text()).not.toContain('Riley')
    })

    it('creates a new archer when no match is clicked', async () => {
      const saveParticipant = vi.fn().mockResolvedValue(undefined)
      const addArcherByToken = vi.fn()
      const wrapper = mountApp(
        createRepository({ searchArchers: vi.fn().mockResolvedValue([matchFor()]), saveParticipant, addArcherByToken }),
        { ...clubProps, initialData: rosterWorkspace([active]) },
      )
      await openAddArcher(wrapper)
      await typeAndWait(wrapper, 'input[autocomplete="family-name"]', 'Found')
      await wrapper.get('input[autocomplete="given-name"]').setValue('Different')
      await wrapper.get('input[type="date"]').setValue('2001-01-01')
      await wrapper.get('form.modal').trigger('submit')
      await flushPromises()

      expect(addArcherByToken).not.toHaveBeenCalled()
      expect(saveParticipant).toHaveBeenCalledTimes(1)
    })

    it('shows the refusal and keeps the form when the database rejects the archer', async () => {
      const addArcherByToken = vi
        .fn()
        .mockRejectedValue(new Error('This archer is below the minimum age for the category Masters'))
      const wrapper = mountApp(
        createRepository({ searchArchers: vi.fn().mockResolvedValue([matchFor()]), addArcherByToken }),
        { ...clubProps, initialData: rosterWorkspace([active]) },
      )
      await openAddArcher(wrapper)
      await typeAndWait(wrapper, 'input[autocomplete="family-name"]', 'Fou')
      await wrapper.get('input[name="archer-match"]').setValue()
      await wrapper.get('form.modal').trigger('submit')
      await flushPromises()

      expect(wrapper.text()).toContain('below the minimum age for the category Masters')
      expect(wrapper.find('form.modal').exists()).toBe(true)
    })

    it('lists matches but does not let them be picked when adding from the archers directory', async () => {
      const saveParticipant = vi.fn().mockResolvedValue(undefined)
      const wrapper = mountApp(
        createRepository({ searchArchers: vi.fn().mockResolvedValue([matchFor()]), saveParticipant }),
        { ...clubProps, initialData: rosterWorkspace([active]) },
      )
      await wrapper.get('button[aria-label="Archers"]').trigger('click')
      await wrapper.get('.page-heading .button-primary').trigger('click')
      await typeAndWait(wrapper, 'input[autocomplete="family-name"]', 'Found')

      expect(wrapper.get('input[name="archer-match"]').element.disabled).toBe(true)
      await wrapper.get('input[autocomplete="given-name"]').setValue('Riley')
      await wrapper.get('input[type="date"]').setValue('2001-01-01')
      await wrapper.get('form.modal').trigger('submit')
      await flushPromises()
      expect(saveParticipant).toHaveBeenCalledTimes(1)
    })

    it('clears the form and the chosen match so a different archer can be saved', async () => {
      const searchArchers = vi.fn().mockResolvedValue([matchFor()])
      const wrapper = mountApp(createRepository({ searchArchers }), {
        ...clubProps,
        initialData: rosterWorkspace([active]),
      })
      await openAddArcher(wrapper)
      await typeAndWait(wrapper, 'input[autocomplete="family-name"]', 'Found')
      await wrapper.get('input[autocomplete="given-name"]').setValue('Riley')
      await wrapper.get('input[name="archer-match"]').setValue()
      expect(wrapper.text()).toContain('Adding Riley Found')

      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Clear form')
        .trigger('click')
      await flushPromises()

      expect(wrapper.get('input[autocomplete="family-name"]').element.value).toBe('')
      expect(wrapper.get('input[autocomplete="given-name"]').element.value).toBe('')
      expect(wrapper.get('input[placeholder="Affiliation number"]').element.value).toBe('')
      expect(wrapper.find('.archer-pick').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Adding Riley Found')
      expect(wrapper.find('input[type="date"]').exists()).toBe(true)
      expect(wrapper.find('form.modal').exists()).toBe(true)
    })

    it('keeps a club name and location fixed for club users but not for managers', async () => {
      const club = mountApp(createRepository(), { ...clubProps, initialData: rosterWorkspace([active]) })
      await club.get('button[aria-label="Clubs"]').trigger('click')
      await club.get('button[aria-label="Edit club"]').trigger('click')

      expect(club.get('input[placeholder="e.g. Northside Archery Club"]').element.disabled).toBe(true)
      expect(club.get('input[placeholder="Street, city, state, ZIP"]').element.disabled).toBe(true)
      expect(club.get('input[placeholder="https://maps.google.com/..."]').element.disabled).toBe(true)
      expect(club.get('input[placeholder="Full name"]').element.disabled).toBe(false)
      expect(club.text()).toContain('Only a manager can change the name and location of a club.')

      const manager = mountApp(createRepository(), { initialData: rosterWorkspace([]) })
      await manager.get('button[aria-label="Clubs"]').trigger('click')
      await manager.get('button[aria-label="Edit club"]').trigger('click')
      expect(manager.get('input[placeholder="e.g. Northside Archery Club"]').element.disabled).toBe(false)
      expect(manager.get('input[placeholder="Street, city, state, ZIP"]').element.disabled).toBe(false)
      expect(manager.text()).not.toContain('Only a manager can change the name')
    })

    describe('a club whose plan lapses while the app is open', () => {
      const expired = { id: 's1', userId: 'club-user', planId: 'p1', startsOn: '2000-01-01', endsOn: '2000-02-01' }

      function lockedWrapper(searchArchers = vi.fn()) {
        return mountApp(createRepository({ searchArchers }), {
          ...clubProps,
          initialData: rosterWorkspace([expired]),
        })
      }

      it('has no add or edit buttons for archers or its club, and no account editing', async () => {
        const wrapper = lockedWrapper()

        expect(wrapper.get('.profile-button').element.disabled).toBe(true)
        await wrapper.get('button[aria-label="Archers"]').trigger('click')
        expect(wrapper.find('.page-heading .button-primary').exists()).toBe(false)
        expect(wrapper.find('button[aria-label="Edit Alex Archer"]').exists()).toBe(false)
        await wrapper.get('button[aria-label="Clubs"]').trigger('click')
        expect(wrapper.find('button[aria-label="Edit club"]').exists()).toBe(false)
        expect(wrapper.find('form.modal').exists()).toBe(false)
      })

      it('never searches the archer database', async () => {
        const searchArchers = vi.fn()
        const wrapper = lockedWrapper(searchArchers)
        await openTournament(wrapper)

        expect(wrapper.find('form.modal').exists()).toBe(false)
        expect(searchArchers).not.toHaveBeenCalled()
      })
    })

    it('hides it on a tournament hosted by another club', async () => {
      const wrapper = mountApp(createRepository(), {
        ...clubProps,
        initialData: rosterWorkspace([active], 'club-other'),
      })
      await openTournament(wrapper)

      expect(wrapper.text()).not.toContain('Add archer')
    })
  })
})
