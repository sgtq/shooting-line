import { expect, test } from '@playwright/test'

const projectUrl = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co'
const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`

const recurve = (id, name, sortOrder) => ({
  id,
  name,
  min_age: null,
  max_age: null,
  bow_type: 'Recurve',
  sort_order: sortOrder,
  level_exempt: false,
})

const tournament = (id, name, date) => ({
  id,
  name,
  date,
  discipline: 'Outdoor target',
  tournament_type_id: null,
  club_id: 'club-1',
  venue_mode: 'club',
  custom_address: '',
})

const archer = (id, firstName, lastName) => ({
  id,
  first_name: firstName,
  last_name: lastName,
  birth_date: '1990-01-01',
  wa_id: '',
  aetay_id: '',
  club_id: 'club-1',
})

// Alex entered Open in an earlier tournament, so Youth is a lower level for Alex. Spring Open has no archers yet.
const tables = {
  app_access: { app_id: 'manager' },
  user_roles: [{ role: 'manager', club_id: null, participant_id: null }],
  user_profiles: null,
  clubs: [{ id: 'club-1', name: 'Test Club', logo_url: '' }],
  participants: [archer('archer-alex', 'Alex', 'Archer'), archer('archer-sam', 'Sam', 'Shooter')],
  categories: [recurve('rec-youth', 'Youth', 0), recurve('rec-open', 'Open', 1), recurve('rec-pro', 'Pro', 2)],
  tournaments: [tournament('spring', 'Spring Open', '2099-05-01'), tournament('winter', 'Winter Open', '2098-01-01')],
  tournament_rounds: [
    { id: 'round-spring', tournament_id: 'spring', name: 'Qualification', position: 0 },
    { id: 'round-winter', tournament_id: 'winter', name: 'Qualification', position: 0 },
  ],
  tournament_categories: [
    { tournament_id: 'spring', category_id: 'rec-youth' },
    { tournament_id: 'spring', category_id: 'rec-open' },
    { tournament_id: 'spring', category_id: 'rec-pro' },
    { tournament_id: 'winter', category_id: 'rec-open' },
  ],
  tournament_participants: [{ tournament_id: 'winter', participant_id: 'archer-alex', category_id: 'rec-open' }],
}

/** Signs in as a manager and fakes the REST API. Returns the writes the app sends, in order. */
async function openSpringArchers(page) {
  const writes = []
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'test-user', email: 'manager@example.test', user_metadata: {} },
      }),
    )
  }, storageKey)
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const rpcName = new URL(request.url()).pathname.startsWith('/rest/v1/rpc/')
      ? new URL(request.url()).pathname.split('/').pop()
      : ''
    if (rpcName === 'visible_participant_names') {
      await route.fulfill({ json: [] })
      return
    }
    if (rpcName === 'search_archers') {
      await route.fulfill({
        json: [{ token: 'token-alex', first_name: 'Alex', last_name: 'Archer', club_id: 'club-1' }],
      })
      return
    }
    if (rpcName === 'add_archer_by_token') {
      writes.push({ method: request.method(), url: request.url(), body: request.postDataJSON() })
      await route.fulfill({ json: [{ id: 'archer-alex', first_name: 'Alex', last_name: 'Archer', club_id: 'club-1' }] })
      return
    }
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), url: request.url(), body: request.postDataJSON() })
      await route.fulfill({ status: request.method() === 'DELETE' ? 204 : 201 })
      return
    }
    const table = new URL(request.url()).pathname.split('/').pop()
    await route.fulfill({ json: tables[table] ?? [] })
  })

  await page.goto('/manager/')
  await page.getByRole('button', { name: 'Tournaments', exact: true }).click()
  await page.getByRole('button', { name: 'Spring Open' }).click()
  return writes
}

const addDialog = (page) => page.locator('form.modal')

// The form searches as the user types. A match is clicked to add that archer instead of creating a new one.
async function chooseAlexAsRecurve(page) {
  await page.getByRole('button', { name: '＋ Add archer' }).click()
  await addDialog(page).getByPlaceholder('Last name').fill('Arc')
  await addDialog(page)
    .getByRole('radio', { name: /Archer, Alex/ })
    .check()
  await addDialog(page).getByLabel('Bow type').selectOption('Recurve')
}

test('adds an archer from the database with a category and removes them again', async ({ page }) => {
  const writes = await openSpringArchers(page)
  await expect(page.getByText('No archers in this tournament')).toBeVisible()

  await chooseAlexAsRecurve(page)
  await addDialog(page).getByLabel('Category').selectOption('rec-open')
  await addDialog(page).getByRole('button', { name: 'Add to tournament' }).click()

  const row = page.locator('.roster-row', { hasText: 'Archer, Alex' })
  await expect(row.locator('.roster-category')).toHaveText('Open')
  await expect(page.locator('.roster-head')).toContainText('CATEGORY')
  expect(writes).toHaveLength(1)
  expect(writes[0].method).toBe('POST')
  expect(writes[0].url).toContain('/rpc/add_archer_by_token')
  expect(writes[0].body).toEqual({
    p_tournament_id: 'spring',
    p_token: 'token-alex',
    p_category_id: 'rec-open',
  })

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Remove Alex Archer from this tournament?')
    return dialog.accept()
  })
  await page.getByRole('button', { name: 'Remove Alex Archer from tournament' }).click()

  await expect(page.getByText('No archers in this tournament')).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1].method).toBe('DELETE')
  expect(writes[1].url).toContain('participant_id=eq.archer-alex')

  // The archer stays in the database, so they can be found and added again.
  await page.getByRole('button', { name: '＋ Add archer' }).click()
  await addDialog(page).getByPlaceholder('Last name').fill('Arc')
  await expect(addDialog(page).getByRole('radio', { name: /Archer, Alex/ })).toBeVisible()
})

test('keeps the archer when the removal prompt is cancelled', async ({ page }) => {
  const writes = await openSpringArchers(page)
  await chooseAlexAsRecurve(page)
  await addDialog(page).getByLabel('Category').selectOption('rec-pro')
  await addDialog(page).getByRole('button', { name: 'Add to tournament' }).click()

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Remove Alex Archer from tournament' }).click()

  await expect(page.locator('.roster-row', { hasText: 'Archer, Alex' }).locator('.roster-category')).toHaveText('Pro')
  expect(writes.map((write) => write.method)).toEqual(['POST'])
})

test('has one add-archer form that starts with the affiliation IDs and can be cleared', async ({ page }) => {
  await openSpringArchers(page)
  await page.getByRole('button', { name: '＋ Add archer' }).click()

  await expect(addDialog(page).getByRole('button', { name: 'Existing archer' })).toHaveCount(0)
  await expect(addDialog(page).getByRole('button', { name: 'New archer' })).toHaveCount(0)
  await expect(addDialog(page).locator('input').first()).toHaveAttribute('placeholder', 'Affiliation number')

  await addDialog(page).getByPlaceholder('Last name').fill('Arc')
  await addDialog(page)
    .getByRole('radio', { name: /Archer, Alex/ })
    .check()
  await expect(addDialog(page)).toContainText('Adding Alex Archer')

  await addDialog(page).getByRole('button', { name: 'Clear form' }).click()
  await expect(addDialog(page).getByPlaceholder('Last name')).toHaveValue('')
  await expect(addDialog(page).getByRole('radio')).toHaveCount(0)
  await expect(addDialog(page)).not.toContainText('Adding Alex Archer')
})

test('styles the archer search field like the other filter fields', async ({ page }) => {
  await openSpringArchers(page)

  const style = (locator) =>
    locator.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderWidth: computed.borderTopWidth,
        borderStyle: computed.borderTopStyle,
        borderRadius: computed.borderTopLeftRadius,
        height: computed.height,
        fontSize: computed.fontSize,
        backgroundColor: computed.backgroundColor,
      }
    })
  const search = await style(page.getByLabel('Search archers by last name or affiliation'))
  const clubFilter = await style(page.getByLabel('Filter archers by club'))

  expect(search).toEqual(clubFilter)
  expect(search.borderStyle).toBe('solid')
  expect(search.borderWidth).toBe('1px')
})
