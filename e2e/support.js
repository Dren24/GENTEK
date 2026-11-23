// ── Shared helpers for the evidence tests ────────────────────────────────────
// Local test account (created automatically in the LOCAL database by
// e2e/test_account.py). Works on Mac and Windows. Never use real users here.
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const TEST_USER = { email: 'premiumtest@gentek.local', password: 'PremiumTest123!' }

// Windows uses "python", Mac uses "python3". Set PYTHON=... to override.
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
const testAccount = (...args) =>
  execFileSync(PYTHON, [path.resolve('e2e/test_account.py'), ...args], { stdio: 'pipe' }).toString().trim()

// Precondition: this browser was trusted before (the user ticked "Remember me"
// on an earlier login), so login goes straight in without the emailed code.
export async function trustBrowser(page) {
  const token = randomBytes(24).toString('hex')
  testAccount('trust', token)
  await page.goto('/')
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('gentek-device', t) }, token)
}

// Opens the login window as a guest and returns it
export async function openLogin(page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: 'Log in' }).first().click()
  return page.getByRole('dialog')
}

export async function signIn(page, email = TEST_USER.email, password = TEST_USER.password) {
  await trustBrowser(page)
  await page.reload()
  await page.getByRole('button', { name: 'Log in' }).first().click()
  const modal = page.getByRole('dialog')
  await modal.getByPlaceholder('Email address').fill(email)
  await modal.getByPlaceholder('Password').fill(password)
  await modal.locator('button[type=submit]').click()
}

export const wait = (page, ms) => page.waitForTimeout(ms)
export const shot = (page, name) => page.screenshot({ path: `e2e/evidence/shots/${name}.png` })
// Prints the line that goes in the "Actual Result" of the appendix
export const actual = (text) => console.log(`\nActual result: ${text}\n`)
