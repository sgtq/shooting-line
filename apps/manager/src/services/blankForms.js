/**
 * The empty values of each dialog form. A club user can only work for their own club, so `ownClubId` fixes the
 * club of new records. It is null for people who may pick any club.
 */

/** @returns {object} An empty club form. */
export function blankClub() {
  return {
    name: '',
    representative: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    mapUrl: '',
    logoUrl: '',
    logoFile: null,
    logoPreview: '',
    userEmail: '',
    userEnabled: false,
  }
}

/**
 * @param {{ tournamentTypes: { id: string }[], clubs: { id: string }[], ownClubId: string|null }} options
 * @returns {object} An empty tournament form with the first type and club chosen.
 */
export function blankTournament({ tournamentTypes, clubs, ownClubId }) {
  return {
    name: '',
    dateMode: 'range',
    startDate: '',
    endDate: '',
    days: [''],
    discipline: 'Outdoor target',
    tournamentTypeId: tournamentTypes[0]?.id || '',
    clubId: ownClubId !== null ? ownClubId : clubs[0]?.id || '',
    venueMode: 'club',
    customAddress: '',
  }
}

/**
 * @param {{ name: string }[]} targetTypes
 * @returns {object} An empty tournament type form with the first target type chosen.
 */
export function blankTournamentType(targetTypes) {
  return {
    name: '',
    distance: '',
    distanceUnit: 'm',
    targetType: targetTypes[0]?.name || '',
    ends: '',
    arrowsPerEnd: '',
  }
}

/** @returns {object} An empty category form. */
export function blankCategory() {
  return {
    name: '',
    minAge: '',
    maxAge: '',
    bowType: '',
    sortOrder: '',
    levelExempt: false,
  }
}

/**
 * @param {string|null} ownClubId
 * @returns {object} An empty archer form. The bow type and category only narrow the pickers when an archer is
 * created from a tournament roster, and are not saved on the archer.
 */
export function blankParticipant(ownClubId) {
  return {
    firstName: '',
    lastName: '',
    birthDate: '',
    waId: '',
    aetayId: '',
    email: '',
    clubId: ownClubId !== null ? ownClubId : '',
    bowType: '',
    categoryId: '',
  }
}

/** @returns {object} An empty form for giving someone the manager role. */
export function blankUserRole() {
  return { email: '', role: 'manager', displayName: '' }
}
