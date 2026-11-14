"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from '@/lib/i18n/client'

export type ServiceStatus = "operational" | "degraded" | "partial" | "major" | "maintenance";

interface StatusIndicatorProps {
  status: ServiceStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const statusConfig = {
  operational: {
    labelKey: "status.operational" as const,
    dotClass: "bg-status-operational",
    textClass: "text-status-operational",
  },
  degraded: {
    labelKey: "status.degraded" as const,
    dotClass: "bg-status-degraded",
    textClass: "text-status-degraded",
  },
  partial: {
    labelKey: "status.partial" as const,
    dotClass: "bg-status-partial",
    textClass: "text-status-partial",
  },
  major: {
    labelKey: "status.major" as const,
    dotClass: "bg-status-major",
    textClass: "text-status-major",
  },
  maintenance: {
    labelKey: "status.maintenance" as const,
    dotClass: "bg-status-maintenance",
    textClass: "text-status-maintenance",
  },
};

export function StatusIndicator({ status, showLabel = true, size = "md" }: StatusIndicatorProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className={cn("font-medium", config.textClass, size === "sm" ? "text-xs" : "text-sm")}>
          {t(config.labelKey)}
        </span>
      )}
      <span
        className={cn(
          "rounded-full status-pulse",
          config.dotClass,
          size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
        )}
      />
    </div>
  );
}
