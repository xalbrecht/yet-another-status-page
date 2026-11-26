import { groupScope, hasAnyRole, type GroupScope, type RoleUser } from '@/lib/roles'

/** Art einer Meldung im Assistenten „Neu erstellen mit Vorlage“. */
export type WizardKind = 'incident' | 'maintenance'

/**
 * Was ein Konto im Assistenten anlegen darf (Issue #285). Die Rechte folgen den Sammlungen:
 * Störungen legen Admin und ServiceDesk an, Wartungen zusätzlich der Produktmanager.
 * Die Bereiche gelten je Art: Hat ein Konto beide Rollen, gilt für Störungen nur der Bereich des ServiceDesk.
 */
export function wizardAccess(user: RoleUser): { kinds: WizardKind[]; incidentScope: GroupScope; maintenanceScope: GroupScope } {
  const kinds: WizardKind[] = []
  if (hasAnyRole(user, ['admin', 'servicedesk'])) kinds.push('incident')
  if (hasAnyRole(user, ['admin', 'servicedesk', 'produktmanager'])) kinds.push('maintenance')
  return {
    kinds,
    incidentScope: groupScope(user, ['servicedesk']),
    maintenanceScope: groupScope(user, ['servicedesk', 'produktmanager']),
  }
}

/** Die gewünschte Art, wenn sie erlaubt ist, sonst die erste erlaubte. */
export function wizardKind(requested: unknown, allowed: readonly WizardKind[]): WizardKind {
  return allowed.find((kind) => kind === requested) ?? allowed[0]
}
