import { test, expect } from '@playwright/test'
import { ADMIN_STORAGE_STATE, warmUpAdmin } from '../utils/admin-auth'

/**
 * Eigene Admin-Komponente „Dienste nach der Behebung“ (Issue #237, Feld aus Issue #210).
 * Der Test läuft angemeldet (storageState aus `global-setup.ts`).
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

test.describe('Admin: Dienste nach der Behebung', { tag: ['@admin', '@stoerungen', '@dienste'] }, () => {
  // Der erste Aufruf kompiliert die Admin-Seiten im Dev-Server und dauert lange.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000)
    const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE })
    await warmUpAdmin(page)
    await page.close()
  })

  test('Admin-Panel öffnet angemeldet', async ({ page }) => {
    await page.goto('/admin/collections/incidents')
    await expect(page).not.toHaveURL(/\/admin\/(login|create-first-user)/)
  })
})
