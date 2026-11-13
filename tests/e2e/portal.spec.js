import { expect, test } from '@playwright/test'

test('shows the sign-in form without an authenticated session', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sign in to ShootingLine' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
