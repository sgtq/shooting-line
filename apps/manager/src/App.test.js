import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'new-participant' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    await wrapper.get('.tournament-card .button').trigger('click')
    await wrapper.get('select[aria-label="Filter archers by club"]').setValue('club-north')

    const roster = wrapper.get('.roster-list').text()
    expect(roster).toContain('Archer, Alex')
    expect(roster).not.toContain('Shooter, Sam')
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
    await wrapper.get('.tournament-card .button').trigger('click')
    await wrapper.get('.tournament-tabs button:nth-child(2)').trigger('click')

    expect(wrapper.get('.category-roster-row input').element.disabled).toBe(true)
    expect(wrapper.get('.category-roster-row input').element.checked).toBe(true)
  })

  it('restricts User access to admins for managing manager roles', async () => {
    const managerWrapper = mountApp(createRepository(), { userRole: 'manager', userRoles: ['manager'] })
    expect(managerWrapper.find('button[aria-label="User access"]').exists()).toBe(false)

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

  it('lets managers enable and disable a club user directly on the Clubs screen', async () => {
    const initialData = createWorkspace()
    initialData.clubs[0].email = 'club@example.test'
    const repository = createRepository()
    const wrapper = mountApp(repository, { initialData, userRole: 'manager', userRoles: ['manager'] })

    await wrapper.get('button[aria-label="Clubs"]').trigger('click')
    expect(wrapper.get('.club-user-row').text()).toContain('club@example.test')
    expect(wrapper.get('.club-user-row').text()).toContain('Disabled')

    await wrapper.get('.club-user-controls button').trigger('click')
    await flushPromises()

    expect(repository.setClubEnabled).toHaveBeenCalledWith('club-north', true)
    expect(wrapper.get('.club-user-row').text()).toContain('Enabled')
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
