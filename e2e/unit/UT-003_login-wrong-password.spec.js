/* UT-003  Login (Authentication)
   Test description: User enters a registered email with a wrong password.
   Expected result:  Login is refused with "Invalid email or password" and the login window stays open. */
import { test, expect } from '@playwright/test'
import { openLogin, wait, shot, actual, TEST_USER } from '../support.js'

test.describe('Test Case ID: UT-003', () => {
  test('User enters a wrong password', async ({ page }) => {
    const modal = await openLogin(page)
    await modal.getByPlaceholder('Email address').fill(TEST_USER.email)
    await modal.getByPlaceholder('Password').fill('WrongPass999')
    await modal.locator('button[type=submit]').click()
    await expect(modal.getByText('Invalid email or password')).toBeVisible({ timeout: 15000 })
    await expect(modal).toBeVisible()
    await wait(page, 1000); await shot(page, 'UT-003_login-wrong-password')
    actual('Login was refused with "Invalid email or password" and the user stayed logged out.')
  })
})
