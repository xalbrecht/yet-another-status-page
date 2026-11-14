/**
 * Icons für Dienstgruppen (Namen aus lucide-react).
 * Diese Datei enthält nur die Namen und den Standard. Die Auswahl mit Beschriftungen steht in group-icon-options.ts, die Zuordnung zu den
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
  'AppWindow',
  'Languages',
  'ClipboardCheck',
  'HardHat',
  'GraduationCap',
  'Receipt',
  'Lightbulb',
  'Wrench',
  'IdCard',
  'Trees',
  'Flower2',
  'Map',
  'Store',
  'Euro',
  'Waypoints',
  'Car',
  'Baby',
  'Heart',
  'FolderOpen',
  'School',
  'BookOpen',
  'Presentation',
  'HeartHandshake',
  'Leaf',
  'CalendarDays',
  'LayoutTemplate',
  'House',
] as const

export type GroupIconName = (typeof GROUP_ICON_NAMES)[number]

export const DEFAULT_GROUP_ICON: GroupIconName = 'LayoutGrid'
