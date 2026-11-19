import { Wrench } from "lucide-react";

interface MaintenanceBarProps {
  text: string;
}

/** Zweite Leiste unter dem Statusbanner: laufende Wartungen mit Zahlen. Das Banner selbst bleibt unverändert. */
export function MaintenanceBar({ text }: MaintenanceBarProps) {
  return (
    <div
      data-testid="maintenance-bar"
      className="mt-2 flex items-center gap-2 rounded-lg bg-status-banner-maintenance px-6 py-2.5 text-sm font-medium text-white"
    >
      <Wrench className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
