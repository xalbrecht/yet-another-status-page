import { ta } from '@/lib/i18n/admin'

/** Text „beendet am TT.MM.JJJJ“: der Tag des Endes in der Zeitzone der Installation (das Ende ist das Tagesende). */
export function endedLabel(endedAt: number, locale: string, timeZone: string): string {
  const date = new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(endedAt))
  return ta('ended on {{date}}').replace('{{date}}', date)
}
