// Quelle der Wahrheit für alle Schlüssel. Neue Texte zuerst hier anlegen.
export const en = {
  'incident.investigating': 'Investigating',
  'incident.identified': 'Identified',
  'incident.monitoring': 'Monitoring',
  'incident.resolved': 'Resolved',
  'maintenance.upcoming': 'Scheduled',
  'maintenance.in_progress': 'In Progress',
  'maintenance.completed': 'Completed',
  'maintenance.cancelled': 'Cancelled',
  'banner.operational': 'All systems are operational',
  'banner.degraded': 'Some systems are experiencing degraded performance',
  'banner.partial': 'Some systems are experiencing partial outages',
  'banner.major': 'Major system outage in progress',
  'banner.maintenance': 'Scheduled maintenance in progress',
  'home.scheduledMaintenance': 'Scheduled Maintenance',
  'home.pastIncidents': 'Past Incidents',
} as const

export type TranslationKey = keyof typeof en
