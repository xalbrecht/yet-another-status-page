import {
  Building2,
  Cloud,
  Cpu,
  Database,
  FileText,
  Globe,
  HardDrive,
  Landmark,
  LayoutGrid,
  Lock,
  Mail,
  Monitor,
  Network,
  Phone,
  Printer,
  Server,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_GROUP_ICON } from '@/lib/group-icons'

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid,
  Server,
  Database,
  HardDrive,
  Cpu,
  Cloud,
  Network,
  Wifi,
  Globe,
  Mail,
  Phone,
  Smartphone,
  Monitor,
  Printer,
  ShieldCheck,
  Lock,
  Users,
  FileText,
  Landmark,
  Building2,
}

export function GroupIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? ICONS[DEFAULT_GROUP_ICON]
  return <Icon className={className} aria-hidden="true" />
}
