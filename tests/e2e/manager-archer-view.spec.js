import { expect, test } from '@playwright/test'

const projectUrl = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co'
const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`

const tables = {
  app_access: { app_id: 'manager' },
  user_roles: [{ role: 'archer', club_id: null, participant_id: 'archer-alex' }],
  user_profiles: null,
  clubs: [{ id: 'club-1', name: 'Test Club', logo_url: '' }],
  participants: [
    { id: 'archer-alex', first_name: 'Alex', last_name: 'Archer', birth_date: '1990-01-01', club_id: 'club-1' },
  ],
  tournament_types: [
    {
      id: 'indoor',
      name: 'Indoor 18m',
      distance: 18,
      distance_unit: 'm',
      target_type: '40cm',
      ends: 10,
      arrows_per_end: 3,
    },
  ],
  categories: [
    {
      id: 'rec-open',
      name: 'Open',
      min_age: null,
      max_age: null,
      bow_type: 'Recurve',
      sort_order: 1,
      level_exempt: false,
    },
  ],
  tournaments: [
    {
      id: 'winter',
      name: 'Winter Open',
      discipline: 'Indoor',
      tournament_type_id: 'indoor',
      club_id: 'club-1',
      venue_mode: 'club',
      custom_address: '',
    },
  ],
  tournament_dates: [{ tournament_id: 'winter', day: '2020-01-10' }],
  tournament_rounds: [{ id: 'round-1', tournament_id: 'winter', name: 'Qualification', position: 0 }],
  tournament_participants: [{ tournament_id: 'winter', participant_id: 'archer-alex', category_id: 'rec-open' }],
  round_scores: [
    {
      tournament_id: 'winter',
      round_id: 'round-1',
      participant_id: 'archer-alex',
      category_id: 'rec-open',
      score: 580,
    },
  ],
}

const upcoming = [
  {
    id: 'future',
    name: 'Autumn Cup',
    days: ['2099-10-01', '2099-10-02'],
    discipline: 'Indoor',
    tournament_type: 'Indoor 18m',
    host_club: 'Other Club',
    address: 'Range road 5',
    categories: ['Open'],
    is_entered: false,
  },
]

async function openAsArcher(page, { locked = false } = {}) {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'archer-user', email: 'alex@example.test', user_metadata: {} },
      }),
    )
  }, storageKey)
  await page.route('**/rest/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const name = path.split('/').pop()
    if (path.startsWith('/rest/v1/rpc/')) {
      const rpcResults = {
        user_without_plan: locked,
        upcoming_tournaments: upcoming,
        visible_participant_names: [],
      }
      await route.fulfill({ json: rpcResults[name] ?? [] })
      return
    }
    await route.fulfill({ json: tables[name] ?? [] })
  })
  await page.goto('/manager/')
}

test('shows an enabled archer the calendar and their own scores, not the club screens', async ({ page }) => {
  await openAsArcher(page)

  await expect(page.getByTestId('upcoming-list')).toContainText('Autumn Cup')
  await expect(page.getByTestId('upcoming-list')).toContainText('Other Club')
  await expect(page.getByRole('button', { name: 'Tournaments', exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Scores' }).click()
  await expect(page.getByTestId('scores')).toContainText('Winter Open')
  await expect(page.getByTestId('scores')).toContainText('Qualification: 580')
  await expect(page.getByTestId('averages')).toContainText('580')

  await page.getByLabel('From').fill('2021-01-01')
  await expect(page.getByTestId('scores')).toContainText('No scores yet.')
})

test('shows a disabled archer only the not-enabled screen', async ({ page }) => {
  await openAsArcher(page, { locked: true })

  await expect(page.getByRole('heading', { name: 'Your user is not enabled' })).toBeVisible()
  await expect(page.getByTestId('upcoming-list')).toHaveCount(0)
})
