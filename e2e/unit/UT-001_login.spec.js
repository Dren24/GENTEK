/* UT-001  Login (Authentication)
   Test description: User enters a valid email and password.
   Expected result:  The login window closes and the user's sidebar (history and plan) opens. */
import { test, expect } from '@playwright/test'
import { signIn, wait, shot, actual, TEST_USER } from '../support.js'

test.describe('Test Case ID: UT-001', () => {
  test('User enters a valid email and password', async ({ page }) => {
    await signIn(page, TEST_USER.email, TEST_USER.password)
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'New Analysis' })).toBeVisible()
    await expect(page.getByText('Premium Account').first()).toBeVisible()
    await wait(page, 1500); await shot(page, 'UT-001_login')
    actual('The user was signed in and the sidebar with history and plan opened.')
  })
})
