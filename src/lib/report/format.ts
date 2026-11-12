import { ta } from '@/lib/i18n/admin'

/** Dauer für die Berichtsseite, z. B. „2 Std. 5 Min.“. Gemeinsam genutzt von Bericht und Gruppenblatt. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 60_000)
  if (total <= 0) return `0 ${ta('min', 'Min.')}`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} ${ta('min', 'Min.')}`
  return `${hours} ${ta('h', 'Std.')}${minutes ? ` ${minutes} ${ta('min', 'Min.')}` : ''}`
}
