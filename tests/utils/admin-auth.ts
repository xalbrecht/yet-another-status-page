import type { Page } from '@playwright/test'

/**
 * Anmeldung für E2E-Tests der eigenen Admin-Komponenten (Issue #237).
 *
 * Die Testdatenbank ist eine Wegwerf-Datenbank, die Zugangsdaten sind Testwerte. `global-setup.ts` legt den Benutzer an
 * (oder meldet ihn an) und schreibt die Sitzung nach `ADMIN_STORAGE_STATE`. Admin-Spezifikationen laden sie mit
 * `test.use({ storageState: ADMIN_STORAGE_STATE })`.
 */
export const ADMIN_EMAIL = 'admin-e2e@example.com'
export const ADMIN_PASSWORD = 'e2e-admin-Passwort-1'
export const ADMIN_STORAGE_STATE = 'tests/.auth/admin.json'

/**
 * Öffnet das Admin-Panel einmal, damit der Dev-Server die Admin-Seiten kompiliert, bevor ein Test sie braucht.
 * Gibt die Dauer in Millisekunden zurück und schreibt sie ins Log (Messung für Issue #237).
 */
export async function warmUpAdmin(page: Page): Promise<number> {
  const start = Date.now()
  await page.goto('/admin', { waitUntil: 'networkidle', timeout: 180000 })
  const ms = Date.now() - start
  console.log(`   Admin-Seite angewärmt in ${ms} ms (Adresse: ${page.url()})`)
  return ms
}
