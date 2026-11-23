// ── Playwright config — browser tests used as thesis evidence (Appendix) ──────
// Runs the REAL app in your installed Google Chrome against the local servers
// (start them first with: npm run dev). Screenshots go to e2e/evidence/shots/.
//
// Run one test:   npx playwright test e2e/unit/UT-001_login.spec.js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  timeout: 30000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.GENTEK_URL || 'http://localhost:5173',
    channel: 'chrome',            // use installed Google Chrome, no download
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
})
