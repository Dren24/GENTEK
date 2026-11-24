/* UT-015  Free-plan word limit (Analyzer Workspace)
   Test description: A Free user pastes 510 words and clicks Analyze Text.
   Expected result:  Only the first 500 words are analyzed; "Free limit reached" is shown; the counter says
                     "510 words · 500 will be analyzed"; the full text stays in the editor; Upgrade to Premium opens pricing. */
import { test, expect } from '@playwright/test'
import { signIn, wait, shot, actual, FREE_USER } from '../support.js'

test.describe('Test Case ID: UT-015', () => {
  test('Free user analyzes text over the 500-word limit', async ({ page }) => {
    // 51 sentences x 10 words = 510 words
    const text = Array(51).fill('The chairman thanked his staff for their work this week.').join(' ')
    expect(text.split(' ').length).toBe(510)
    await signIn(page, FREE_USER.email, FREE_USER.password)
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 })

    await page.locator('textarea').fill(text)
    await expect(page.getByText('510 words · 500 will be analyzed')).toBeVisible()
    await expect(page.getByText('Free limit reached').first()).toBeVisible()

    const request = page.waitForRequest((r) => r.url().endsWith('/analyze') && r.method() === 'POST')
    await page.getByRole('button', { name: 'Analyze Text' }).click()
    const sentWords = JSON.parse((await request).postData()).text.trim().split(/\s+/).length
    expect(sentWords).toBe(500)
    await expect(page.getByText('Classification:')).toBeVisible({ timeout: 60000 })
    await expect(page.getByText('Free limit reached').first()).toBeVisible()
    await expect(page.getByText(/^510 words/)).toBeVisible()   // nothing was deleted from the editor
    await page.getByText('Free limit reached').first().scrollIntoViewIfNeeded()   // show the lock in the screenshot
    await wait(page, 1500); await shot(page, 'UT-015_free-word-limit')

    await page.getByRole('button', { name: 'Upgrade to Premium →' }).click()
    await expect(page.getByText('Simple, honest pricing')).toBeVisible()
    actual(`The server received only ${sentWords} of 510 words; "Free limit reached" and "510 words · 500 will be ` +
           'analyzed" were shown; the full text stayed in the editor; Upgrade to Premium opened pricing.')
  })
})
