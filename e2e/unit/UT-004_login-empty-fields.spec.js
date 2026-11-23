/* UT-004  Login (Authentication)
   Test description: User clicks Log in without typing an email or password.
   Expected result:  The form asks the user to fill in the email field and nothing is sent to the server. */
import { test, expect } from '@playwright/test'
import { openLogin, wait, shot, actual } from '../support.js'

test.describe('Test Case ID: UT-004', () => {
  test('User submits the login form with empty fields', async ({ page }) => {
    const modal = await openLogin(page)
    let sent = false
    page.on('request', (r) => { if (r.url().includes('/auth/login')) sent = true })
    await modal.locator('button[type=submit]').click()
    const email = modal.getByPlaceholder('Email address')
    const message = await email.evaluate((el) => el.validationMessage)
    expect(message).not.toBe('')
    expect(sent).toBe(false)
    await expect(modal).toBeVisible()
    await wait(page, 800); await shot(page, 'UT-004_login-empty-fields')
    actual(`Login was blocked with the message "${message}" and nothing was sent to the server.`)
  })
})
