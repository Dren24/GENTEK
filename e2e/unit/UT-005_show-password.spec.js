/* UT-005  Login (Authentication)
   Test description: User types a password and clicks the eye icon to show it, then clicks again to hide it.
   Expected result:  The password becomes readable, then hidden again. */
import { test, expect } from '@playwright/test'
import { openLogin, wait, shot, actual } from '../support.js'

test.describe('Test Case ID: UT-005', () => {
  test('User shows and hides the password', async ({ page }) => {
    const modal = await openLogin(page)
    const password = modal.getByPlaceholder('Password')
    await password.fill('MyPassword123')
    await expect(password).toHaveAttribute('type', 'password')
    await modal.getByRole('button', { name: 'Show password' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await wait(page, 800); await shot(page, 'UT-005_show-password')
    await modal.getByRole('button', { name: 'Hide password' }).click()
    await expect(password).toHaveAttribute('type', 'password')
    actual('The password was shown as "MyPassword123" after clicking the eye, then hidden again.')
  })
})
