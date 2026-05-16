"use client";

import Link from "next/link";
import { Wrench, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { maintenanceStatusConfig, type MaintenanceUpdateStatus } from "@/lib/status-config";

export type MaintenanceItemStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

export interface MaintenanceUpdate {
  id: string;
  status: MaintenanceUpdateStatus;
  message: string;
  timestamp: string;
}

export interface MaintenanceItem {
  id: string;
  shortId: string;
  title: string;
  description: unknown; // Lexical richText object
  scheduledAt: string;
  duration: string;
  affectedServices: string[];
  status: MaintenanceItemStatus;
  updates: MaintenanceUpdate[];
}

interface MaintenanceCardProps {
  maintenance: MaintenanceItem;
}

const badgeStyles: Record<MaintenanceItemStatus, string> = {
  upcoming: "bg-status-maintenance/10 text-status-maintenance",
  in_progress: "bg-status-degraded/10 text-status-degraded",
  completed: "bg-status-operational/10 text-status-operational",
  cancelled: "bg-muted text-muted-foreground",
};

const badgeLabels: Record<MaintenanceItemStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function MaintenanceCard({ maintenance }: MaintenanceCardProps) {
  const isTerminal =
    maintenance.status === "completed" || maintenance.status === "cancelled";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:shadow-md",
        isTerminal && "opacity-75"
      )}
    >
      <div className="p-5">
        {/* Mobile: stacked layout, Desktop: horizontal layout */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          {/* Icon and status badge row on mobile, icon only on desktop */}
          <div className="flex items-center justify-between sm:block">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-status-maintenance/10">
              <Wrench className="h-4 w-4 text-status-maintenance" />
            </div>
            {/* Status badge - visible only on mobile */}
            <span
              className={cn(
                "flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:hidden",
                badgeStyles[maintenance.status]
              )}
            >
              {badgeLabels[maintenance.status]}
            </span>
          </div>

          {/* Content - full width on mobile */}
          <div className="flex flex-1 flex-col gap-2">
            {maintenance.shortId ? (
              <Link
                href={`/m/${maintenance.shortId}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {maintenance.title}
              </Link>
            ) : (
              <h4 className="font-semibold text-foreground">{maintenance.title}</h4>
            )}
            <div className="text-sm text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_u]:underline [&_s]:line-through [&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary/80">
              <RichText content={maintenance.description} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {maintenance.scheduledAt}
              </span>
              {maintenance.duration && <span>Duration: {maintenance.duration}</span>}
            </div>
            {maintenance.affectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {maintenance.affectedServices.map((service) => (
                  <span
                    key={service}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {service}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status badge - visible only on desktop */}
          <span
            className={cn(
              "hidden flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:block",
              badgeStyles[maintenance.status]
            )}
          >
            {badgeLabels[maintenance.status]}
          </span>
        </div>
      </div>

      {maintenance.updates.length > 0 && (
        <div className="border-t border-border bg-card p-5">
          <div className="relative space-y-4">
            {maintenance.updates.map((update, index) => {
              const config =
                maintenanceStatusConfig[update.status] || maintenanceStatusConfig.upcoming;
              const UpdateIcon = config.icon;
              const isLast = index === maintenance.updates.length - 1;

              return (
                <div key={update.id} className="relative flex gap-4">
                  {!isLast && (
                    <div className="absolute left-[11px] top-7 h-[calc(100%+8px)] w-0.5 bg-border" />
                  )}
                  <div
                    className={cn(
                      "relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                      config.bgColor
                    )}
                  >
                    <UpdateIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className={cn("text-sm font-semibold", config.color)}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{update.timestamp}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{update.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
