// Every seed row uses a fixed id or a tagged email, so a run can be repeated and removal touches only seed data.
export const SEED_EMAIL_DOMAIN = 'seed.example.com'
export const BASIC_ARCHER_PLAN_NAME = 'Archer basic'

/**
 * @param {number} n
 * @returns {string}
 */
const id = (n) => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SEED_PLANS = [
  {
    id: id(901),
    key: 'club-monthly',
    name: 'Seed club monthly',
    userRole: 'club',
    durationKind: 'monthly',
    price: 200,
  },
  {
    id: id(902),
    key: 'archer-monthly',
    name: 'Seed archer monthly',
    userRole: 'archer',
    durationKind: 'monthly',
    price: 50,
  },
]

// A disabled club is one with no club account, so it never counts as active.
export const SEED_CLUBS = [
  { id: id(101), key: 'active', name: 'Seed Club Active' },
  { id: id(102), key: 'lapsed', name: 'Seed Club Lapsed' },
  { id: id(103), key: 'disabled', name: 'Seed Club Disabled' },
]

// subscription: 'club-active' | 'club-lapsed' | 'archer-paid' | 'archer-free' | null (no plan).
export const SEED_ACCOUNTS = [
  { localPart: 'admin', name: 'Seed Admin', roles: ['admin', 'manager'], subscription: null },
  { localPart: 'manager', name: 'Seed Manager', roles: ['manager'], subscription: null },
  { localPart: 'club-active', name: 'Seed Club Active', roles: ['club'], club: 'active', subscription: 'club-active' },
  { localPart: 'club-lapsed', name: 'Seed Club Lapsed', roles: ['club'], club: 'lapsed', subscription: 'club-lapsed' },
  {
    localPart: 'archer-paid',
    name: 'Seed Archer Paid',
    roles: ['archer'],
    participantId: id(201),
    club: 'disabled',
    subscription: 'archer-paid',
  },
  {
    localPart: 'archer-free-active-club',
    name: 'Seed Archer Free Active Club',
    roles: ['archer'],
    participantId: id(202),
    club: 'active',
    subscription: 'archer-free',
  },
  {
    localPart: 'archer-free-disabled-club',
    name: 'Seed Archer Free Disabled Club',
    roles: ['archer'],
    participantId: id(203),
    club: 'disabled',
    subscription: 'archer-free',
  },
  {
    localPart: 'archer-free-no-club',
    name: 'Seed Archer Free No Club',
    roles: ['archer'],
    participantId: id(204),
    subscription: 'archer-free',
  },
  {
    localPart: 'archer-no-plan',
    name: 'Seed Archer No Plan',
    roles: ['archer'],
    participantId: id(205),
    subscription: null,
  },
]

/**
 * @param {{ localPart: string }} account
 * @returns {string}
 */
export function emailFor(account) {
  return `seed-${account.localPart}@${SEED_EMAIL_DOMAIN}`
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {string} A YYYY-MM-DD date, counted in UTC to match the database's date columns.
 */
export function shiftDate(date, days) {
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Describes the subscription a seed account holds. The plan is a catalogue key, or 'basic' for the free plan.
 * @param {string | null} kind
 * @param {Date} today
 * @returns {{ plan: string, startsOn: string, endsOn: string | null, pricePaid: number } | null}
 */
export function subscriptionFor(kind, today) {
  switch (kind) {
    case 'club-active':
      return { plan: 'club-monthly', startsOn: shiftDate(today, -1), endsOn: shiftDate(today, 364), pricePaid: 200 }
    case 'club-lapsed':
      return { plan: 'club-monthly', startsOn: shiftDate(today, -60), endsOn: shiftDate(today, -30), pricePaid: 200 }
    case 'archer-paid':
      return { plan: 'archer-monthly', startsOn: shiftDate(today, -1), endsOn: shiftDate(today, 364), pricePaid: 50 }
    case 'archer-free':
      return { plan: 'basic', startsOn: shiftDate(today, -1), endsOn: null, pricePaid: 0 }
    default:
      return null
  }
}

export const SEED_TOURNAMENT_TYPE = {
  id: id(801),
  name: 'Seed Indoor 18m',
  distance: 18,
  distanceUnit: 'm',
  targetType: '40 cm',
  ends: 10,
  arrowsPerEnd: 3,
}

// No age limits, so the age check never needs a birth date.
export const SEED_CATEGORY = { id: id(701), name: 'Seed Recurve Open', bowType: 'Recurve' }

const PAID = id(201)
const FREE_ACTIVE_CLUB = id(202)

/**
 * Tournaments that cover what an archer can see: past scores, one under way that the archer is in, one under way
 * that the archer is not in (hidden from them), and one that has not started (listed for everyone).
 * Days count from today, so a repeat run keeps the cases true.
 * @param {Date} today
 * @returns {Array<{
 *   id: string, name: string, club: string, days: string[], started: boolean,
 *   entries: string[], scores: Array<{ participantId: string, round: string, score: number }>,
 *   matches: Array<{ round: string, seed1Id: string, seed2Id: string, score1: number, score2: number }>
 * }>}
 */
export function seedTournaments(today) {
  const todayDay = shiftDate(today, 0)
  return [
    {
      id: id(301),
      name: 'Seed Autumn Indoor',
      club: 'active',
      days: [shiftDate(today, -90)],
      started: true,
      entries: [PAID],
      scores: [{ participantId: PAID, round: 'Qualification 1', score: 590 }],
      matches: [],
    },
    {
      id: id(302),
      name: 'Seed Winter Indoor',
      club: 'active',
      days: [shiftDate(today, -30)],
      started: true,
      entries: [PAID, FREE_ACTIVE_CLUB],
      scores: [
        { participantId: PAID, round: 'Qualification 1', score: 560 },
        { participantId: PAID, round: 'Qualification 2', score: 575 },
        { participantId: FREE_ACTIVE_CLUB, round: 'Qualification 1', score: 540 },
        { participantId: FREE_ACTIVE_CLUB, round: 'Qualification 2', score: 552 },
      ],
      matches: [{ round: 'Semifinal', seed1Id: PAID, seed2Id: FREE_ACTIVE_CLUB, score1: 140, score2: 132 }],
    },
    {
      id: id(303),
      name: 'Seed Weekend Cup',
      club: 'active',
      days: [shiftDate(today, -1), todayDay, shiftDate(today, 1)],
      started: true,
      entries: [PAID],
      scores: [{ participantId: PAID, round: 'Qualification 1', score: 548 }],
      matches: [],
    },
    {
      id: id(304),
      name: 'Seed Closed Cup',
      club: 'lapsed',
      days: [shiftDate(today, -1), todayDay],
      started: true,
      entries: [FREE_ACTIVE_CLUB],
      scores: [],
      matches: [],
    },
    {
      id: id(305),
      name: 'Seed Spring Open',
      club: 'active',
      days: [shiftDate(today, 30), shiftDate(today, 31)],
      started: false,
      entries: [],
      scores: [],
      matches: [],
    },
  ]
}
