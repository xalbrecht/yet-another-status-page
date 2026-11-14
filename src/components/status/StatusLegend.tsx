"use client";

import { CheckCircle2, AlertTriangle, AlertCircle, XCircle, Wrench } from "lucide-react";
import { useTranslation } from '@/lib/i18n/client'

const legendItems = [
  { icon: CheckCircle2, labelKey: "status.operational" as const, colorClass: "text-status-operational" },
  { icon: AlertTriangle, labelKey: "status.legendDegraded" as const, colorClass: "text-status-degraded" },
  { icon: AlertCircle, labelKey: "status.partial" as const, colorClass: "text-status-partial" },
  { icon: XCircle, labelKey: "status.major" as const, colorClass: "text-status-major" },
  { icon: Wrench, labelKey: "status.maintenance" as const, colorClass: "text-status-maintenance" },
];

export function StatusLegend() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
      {legendItems.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.labelKey} className="flex items-center gap-1.5 min-w-0">
            <Icon className={`h-4 w-4 flex-shrink-0 ${item.colorClass}`} />
            <span className="truncate text-xs text-muted-foreground">{t(item.labelKey)}</span>
          </div>
        );
      })}
    </div>
  );
}
