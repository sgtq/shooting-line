import { expect, test } from '@playwright/test'

test('manager shortcuts and date filters retain their styling in both themes', async ({ page }) => {
  const projectUrl = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co'
  const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`
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
    const table = new URL(route.request().url()).pathname.split('/').pop()
    const data =
      table === 'app_access'
        ? { app_id: 'manager' }
        : table === 'user_roles'
          ? [{ role: 'manager', club_id: null, participant_id: null }]
          : table === 'user_profiles'
            ? null
            : table === 'clubs'
              ? [
                  {
                    id: 'club-1',
                    name: 'Test Club',
                    logo_url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"/>',
                  },
                ]
              : []
    await route.fulfill({ json: data })
  })

  await page.goto('/manager/')
  const count = page.getByRole('button', { name: 'Open tournaments' })
  await expect(count).toBeVisible()
  await expect(count).toHaveCSS('border-top-style', 'none')
  await expect(count).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await count.click()

  const upcoming = page.getByRole('button', { name: 'Upcoming', exact: true })
  const past = page.getByRole('button', { name: 'Past', exact: true })
  await expect(upcoming).toHaveAttribute('aria-pressed', 'true')
  await expect(past).toHaveAttribute('aria-pressed', 'false')
  await expect(upcoming).toHaveCSS('border-top-style', 'none')
  await past.click()
  await expect(past).toHaveAttribute('aria-pressed', 'true')
  await expect(upcoming).toHaveAttribute('aria-pressed', 'false')
  await expect(past).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(past).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(upcoming).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await page.getByRole('button', { name: 'Clubs', exact: true }).click()
  const logo = page.getByRole('img', { name: 'Test Club logo' })
  await expect(logo).toBeVisible()
  const logoBox = await logo.boundingBox()
  expect(logoBox.width).toBeLessThanOrEqual(40)
  expect(logoBox.height).toBeLessThanOrEqual(40)
})
