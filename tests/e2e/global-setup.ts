import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { FullConfig } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE_STATE } from '../utils/admin-auth'

/**
 * Global setup for E2E tests
 * 
 * This runs once before all tests to verify the application is ready.
 * 
 * When using Docker (npm run test:e2e):
 * - Docker Compose starts the app and database
 * - Seed script populates test data
 * - This setup just verifies the app is responding
 * 
 * When using fast mode (npm run test:e2e:fast):
 * - Uses existing dev server
 * - No seeding (assumes data exists)
 */
/**
 * Legt den Testbenutzer an (`first-register`) oder meldet ihn an (`login`, wenn er schon existiert) und schreibt die
 * Sitzung als Playwright-`storageState` (Issue #237). Die Datenbank ist eine Wegwerf-Datenbank.
 */
async function prepareAdminSession(baseURL: string) {
  const body = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'E2E Admin' })
  const headers = { 'Content-Type': 'application/json' }
  let response = await fetch(`${baseURL}/api/users/first-register`, { method: 'POST', headers, body })
  if (!response.ok) {
    response = await fetch(`${baseURL}/api/users/login`, { method: 'POST', headers, body })
  }
  if (!response.ok) {
    throw new Error(`Admin-Anmeldung für die E2E-Tests fehlgeschlagen: HTTP ${response.status}`)
  }
  const { token } = (await response.json()) as { token?: string }
  if (!token) throw new Error('Admin-Anmeldung für die E2E-Tests lieferte kein Token')

  mkdirSync(dirname(ADMIN_STORAGE_STATE), { recursive: true })
  writeFileSync(
    ADMIN_STORAGE_STATE,
    JSON.stringify({
      cookies: [
        { name: 'payload-token', value: token, domain: new URL(baseURL).hostname, path: '/', httpOnly: true, secure: false, sameSite: 'Lax', expires: -1 },
      ],
      origins: [],
    }),
  )
  console.log(`   ✓ Admin-Sitzung gespeichert (${ADMIN_STORAGE_STATE})`)
}

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 
    config.projects[0]?.use?.baseURL || 
    'http://localhost:3000'

  console.log(`\n🔧 E2E Test Setup`)
  console.log(`   Base URL: ${baseURL}`)

  // Wait for the app to be ready
  const maxRetries = 30
  let retries = 0
  let isReady = false

  while (retries < maxRetries && !isReady) {
    try {
      const response = await fetch(`${baseURL}/api/health`)
      if (response.ok) {
        isReady = true
        console.log(`   ✓ Application is ready`)
      }
    } catch (_error) {
      retries++
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  if (!isReady) {
    throw new Error(`Application at ${baseURL} is not responding after ${maxRetries} attempts`)
  }

  await prepareAdminSession(baseURL)

  console.log(`   ✓ Global setup complete\n`)
}

export default globalSetup
