import { t } from "@/lib/i18n"
import { CheckCircle2, AlertTriangle, Search, AlertCircle, Wrench, Clock } from "lucide-react"

/**
 * Shared status configuration for incident and maintenance updates
 * Used across timeline components for consistent styling
 */

export const incidentStatusConfig = {
  investigating: {
    icon: Search,
    color: "text-status-major",
    bgColor: "bg-status-major",
    label: t("incident.investigating"),
  },
  identified: {
    icon: AlertTriangle,
    color: "text-status-degraded",
    bgColor: "bg-status-degraded",
    label: t("incident.identified"),
  },
  monitoring: {
    icon: AlertCircle,
    color: "text-status-maintenance",
    bgColor: "bg-status-maintenance",
    label: t("incident.monitoring"),
  },
  resolved: {
    icon: CheckCircle2,
    color: "text-status-operational",
    bgColor: "bg-status-operational",
    label: t("incident.resolved"),
  },
} as const

export type IncidentUpdateStatus = keyof typeof incidentStatusConfig

export const maintenanceStatusConfig = {
  upcoming: {
    icon: Clock,
    color: "text-status-maintenance",
    bgColor: "bg-status-maintenance",
    label: t("maintenance.upcoming"),
  },
  in_progress: {
    icon: Wrench,
    color: "text-status-degraded",
    bgColor: "bg-status-maintenance",
    label: t("maintenance.in_progress"),
  },
  completed: {
    icon: CheckCircle2,
    color: "text-status-operational",
    bgColor: "bg-status-operational",
    label: t("maintenance.completed"),
  },
  cancelled: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: t("maintenance.cancelled"),
  },
} as const

export type MaintenanceUpdateStatus = keyof typeof maintenanceStatusConfig
