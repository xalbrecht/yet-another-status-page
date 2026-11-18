/**
 * Darstellung beendeter Dienste im Gruppenblatt des Verfügbarkeitsberichts. Beide Werte stehen in den Website-Einstellungen.
 * Nur Typen und eine reine Funktion, damit auch Dateien sie nutzen können, die im Browser laufen.
 */

/** Wärmekarte: `label` färbt die Zeilenüberschrift grau und ergänzt „beendet am …“, `hatch` kennzeichnet nur durch die Schraffur. */
export type HeatEndedStyle = 'label' | 'hatch'

/** Balken: `marks` zeigt in jeder Zeile die zwei Aktiv-Felder, `hints` nur einen Hinweis bei Abweichung. */
export type SheetActiveStyle = 'marks' | 'hints'

export type ReportDisplay = { heatEnded: HeatEndedStyle; sheetActive: SheetActiveStyle }

export const DEFAULT_REPORT_DISPLAY: ReportDisplay = { heatEnded: 'label', sheetActive: 'marks' }

/** Liest die Darstellung aus den Einstellungen. Fehlende oder unbekannte Werte ergeben die Vorgabe. */
export function reportDisplayOf(
  settings: { reportHeatEndedStyle?: string | null; reportSheetActiveStyle?: string | null } | null | undefined,
): ReportDisplay {
  return {
    heatEnded: settings?.reportHeatEndedStyle === 'hatch' ? 'hatch' : DEFAULT_REPORT_DISPLAY.heatEnded,
    sheetActive: settings?.reportSheetActiveStyle === 'hints' ? 'hints' : DEFAULT_REPORT_DISPLAY.sheetActive,
  }
}
