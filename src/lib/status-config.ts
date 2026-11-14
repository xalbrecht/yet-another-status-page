import { CheckCircle2, AlertTriangle, Search, AlertCircle, Wrench, Clock } from "lucide-react"

/**
 * Shared status configuration for incident and maintenance updates
 * Used across timeline components for consistent styling.
 * `labelKey` is the translation key; the caller translates it (this file also runs in the browser).
 */

export const incidentStatusConfig = {
  investigating: {
    icon: Search,
    color: "text-status-major",
    bgColor: "bg-status-major",
    labelKey: "incident.investigating" as const,
  },
  identified: {
    icon: AlertTriangle,
    color: "text-status-degraded",
    bgColor: "bg-status-degraded",
    labelKey: "incident.identified" as const,
  },
  monitoring: {
    icon: AlertCircle,
    color: "text-status-maintenance",
    bgColor: "bg-status-maintenance",
    labelKey: "incident.monitoring" as const,
  },
  resolved: {
    icon: CheckCircle2,
    color: "text-status-operational",
    bgColor: "bg-status-operational",
    labelKey: "incident.resolved" as const,
  },
} as const

export type IncidentUpdateStatus = keyof typeof incidentStatusConfig

export const maintenanceStatusConfig = {
  upcoming: {
    icon: Clock,
    color: "text-status-maintenance",
    bgColor: "bg-status-maintenance",
    labelKey: "maintenance.upcoming" as const,
  },
  in_progress: {
    icon: Wrench,
    color: "text-status-degraded",
    bgColor: "bg-status-maintenance",
    labelKey: "maintenance.in_progress" as const,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-status-operational",
    bgColor: "bg-status-operational",
    labelKey: "maintenance.completed" as const,
  },
  cancelled: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    labelKey: "maintenance.cancelled" as const,
  },
} as const

export type MaintenanceUpdateStatus = keyof typeof maintenanceStatusConfig
