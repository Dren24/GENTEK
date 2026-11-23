// Runs once before the tests: makes the screenshot folder and the local test account.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export default async function globalSetup() {
  mkdirSync('e2e/evidence/shots', { recursive: true })
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  execFileSync(python, [path.resolve('e2e/test_account.py'), 'ensure'], { stdio: 'inherit' })
}
