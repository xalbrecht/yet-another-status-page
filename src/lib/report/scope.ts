import { groupScope, type GroupScope, type RoleUser } from '@/lib/roles'

/**
 * Dienstgruppen, die ein Benutzer im Verfügbarkeitsbericht sieht: Admin alle, Produktmanager seinen Bereich.
 * Ohne Benutzer (anonyme Anfrage im Testmodus) gilt wie bisher alles.
 */
export const reportScopeOf = (user: RoleUser): GroupScope => (user ? groupScope(user, ['produktmanager']) : 'all')
