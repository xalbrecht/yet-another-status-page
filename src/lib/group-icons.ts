import { ta } from '@/lib/i18n/admin'

/**
 * Icons für Dienstgruppen (Namen aus lucide-react).
 * Diese Datei enthält nur die Auswahl für den Admin-Bereich. Die Zuordnung zu den
 * React-Komponenten steht in src/components/status/lagebild/GroupIcon.tsx.
 */
export const GROUP_ICON_NAMES = [
  'LayoutGrid',
  'Server',
  'Database',
  'HardDrive',
  'Cpu',
  'Cloud',
  'Network',
  'Wifi',
  'Globe',
  'Mail',
  'Phone',
  'Smartphone',
  'Monitor',
  'Printer',
  'ShieldCheck',
  'Lock',
  'Users',
  'FileText',
  'Landmark',
  'Building2',
] as const

export type GroupIconName = (typeof GROUP_ICON_NAMES)[number]

export const DEFAULT_GROUP_ICON: GroupIconName = 'LayoutGrid'

export const groupIconOptions = [
  { label: ta('Generic', 'Allgemein'), value: 'LayoutGrid' },
  { label: ta('Server', 'Server'), value: 'Server' },
  { label: ta('Database', 'Datenbank'), value: 'Database' },
  { label: ta('Storage', 'Speicher'), value: 'HardDrive' },
  { label: ta('Processor', 'Prozessor'), value: 'Cpu' },
  { label: ta('Cloud', 'Cloud'), value: 'Cloud' },
  { label: ta('Network', 'Netzwerk'), value: 'Network' },
  { label: ta('Wireless network', 'WLAN'), value: 'Wifi' },
  { label: ta('Internet / portal', 'Internet / Portal'), value: 'Globe' },
  { label: ta('Email', 'E-Mail'), value: 'Mail' },
  { label: ta('Telephony', 'Telefonie'), value: 'Phone' },
  { label: ta('Mobile devices', 'Mobilgeräte'), value: 'Smartphone' },
  { label: ta('Workstation', 'Arbeitsplatz'), value: 'Monitor' },
  { label: ta('Printing', 'Drucken'), value: 'Printer' },
  { label: ta('Security', 'Sicherheit'), value: 'ShieldCheck' },
  { label: ta('Access / login', 'Zugang / Anmeldung'), value: 'Lock' },
  { label: ta('Users / directory', 'Benutzer / Verzeichnis'), value: 'Users' },
  { label: ta('Documents / specialist applications', 'Dokumente / Fachverfahren'), value: 'FileText' },
  { label: ta('Administration', 'Verwaltung'), value: 'Landmark' },
  { label: ta('Buildings / locations', 'Gebäude / Standorte'), value: 'Building2' },
] as const
