import { AlertTriangle, CheckCircle2, Wrench, XCircle, type LucideIcon } from 'lucide-react'
import type { LagebildStatus } from '@/lib/lagebild'

// Klassen stehen vollständig im Quelltext, damit Tailwind sie findet.
export const statusBg: Record<LagebildStatus, string> = {
  operational: 'bg-status-operational',
  degraded: 'bg-status-degraded',
  partial: 'bg-status-partial',
  major: 'bg-status-major',
  maintenance: 'bg-status-maintenance',
}

export const statusText: Record<LagebildStatus, string> = {
  operational: 'text-status-operational',
  degraded: 'text-status-degraded',
  partial: 'text-status-partial',
  major: 'text-status-major',
  maintenance: 'text-status-maintenance',
}

export const statusBorder: Record<LagebildStatus, string> = {
  operational: 'border-status-operational',
  degraded: 'border-status-degraded',
  partial: 'border-status-partial',
  major: 'border-status-major',
  maintenance: 'border-status-maintenance',
}

export const statusSoftBg: Record<LagebildStatus, string> = {
  operational: 'bg-status-operational/10',
  degraded: 'bg-status-degraded/10',
  partial: 'bg-status-partial/10',
  major: 'bg-status-major/10',
  maintenance: 'bg-status-maintenance/10',
}

export const statusBadgeIcon: Record<LagebildStatus, LucideIcon> = {
  operational: CheckCircle2,
  degraded: AlertTriangle,
  partial: AlertTriangle,
  major: XCircle,
  maintenance: Wrench,
}
