"use client";

import { ChevronDown, Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { StatusIndicator, type ServiceStatus } from "./StatusIndicator";

export interface Service {
  name: string;
  status: ServiceStatus;
  description?: string;
  /** Wartung neben dem Zustand, z. B. „Wartung bis 22:00“ */
  maintenanceNotice?: string;
}

interface ServiceGroupProps {
  name: string;
  services: Service[];
  defaultExpanded?: boolean;
}

function getGroupStatus(services: Service[]): ServiceStatus {
  const priorities: ServiceStatus[] = ["major", "partial", "degraded", "maintenance", "operational"];
  for (const priority of priorities) {
    if (services.some((s) => s.status === priority)) {
      return priority;
    }
  }
  return "operational";
}

export function ServiceGroup({ name, services, defaultExpanded = true }: ServiceGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const groupStatus = getGroupStatus(services);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-all duration-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between bg-secondary/50 px-5 py-4 text-left transition-colors hover:bg-secondary/80"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
          <span className="font-semibold text-foreground">{name}</span>
        </div>
        <StatusIndicator status={groupStatus} showLabel={false} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="divide-y divide-border">
            {services.map((service) => (
              <div
                key={service.name}
                data-testid="service-row"
                className="flex items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{service.name}</span>
                  {service.description && (
                    <span className="text-xs text-justify text-muted-foreground">{service.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusIndicator status={service.status} />
                  {service.maintenanceNotice && (
                    <span
                      data-testid="service-maintenance"
                      className="inline-flex items-center gap-1 text-xs text-status-maintenance"
                    >
                      <Wrench className="h-3 w-3" aria-hidden="true" />
                      {service.maintenanceNotice}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
