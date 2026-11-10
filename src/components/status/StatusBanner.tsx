"use client";

import { CheckCircle2, AlertTriangle, AlertCircle, XCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export type OverallStatus = "operational" | "degraded" | "partial" | "major" | "maintenance";

interface StatusBannerProps {
  status: OverallStatus;
  message?: string;
}

const statusConfig = {
  operational: {
    icon: CheckCircle2,
    text: t("banner.operational"),
    className: "bg-status-banner-operational",
  },
  degraded: {
    icon: AlertTriangle,
    text: t("banner.degraded"),
    className: "bg-status-banner-degraded",
  },
  partial: {
    icon: AlertCircle,
    text: t("banner.partial"),
    className: "bg-status-banner-partial",
  },
  major: {
    icon: XCircle,
    text: t("banner.major"),
    className: "bg-status-banner-major",
  },
  maintenance: {
    icon: Wrench,
    text: t("banner.maintenance"),
    className: "bg-status-banner-maintenance",
  },
};

export function StatusBanner({ status, message }: StatusBannerProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const text = message?.trim() || config.text;

  return (
    <div
      className={cn(
        "rounded-lg px-6 py-4 text-white transition-all duration-300",
        config.className
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="text-base font-medium">{text}</span>
      </div>
    </div>
  );
}
