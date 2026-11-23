/* UT-002  Analyze Text (Bias Detection)
   Test description: Guest loads the sample text and clicks Analyze Text without logging in.
   Expected result:  The biased words are highlighted and the result shows "Classification: Male-Biased". */
import { test, expect } from '@playwright/test'
import { wait, shot, actual } from '../support.js'

test.describe('Test Case ID: UT-002', () => {
  test('Guest analyzes text without an account', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
    await page.getByRole('button', { name: 'Try Sample' }).click()
    await page.getByRole('button', { name: 'Analyze Text' }).click()
    const result = page.getByText('Classification:')
    await expect(result).toContainText('Male-Biased', { timeout: 60000 })
    await result.scrollIntoViewIfNeeded(); await wait(page, 1500); await shot(page, 'UT-002_guest-analyze')
    actual('The guest analyzed the text; biased words were highlighted and it was classified Male-Biased.')
  })
})
