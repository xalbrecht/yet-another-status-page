import { Wrench } from "lucide-react";

interface MaintenanceBarProps {
  text: string;
  /** Das Banner darüber ist selbst blau (Wartungsmodus oder Dienst von Hand „In Wartung“): Leiste nur umrandet, kein zweiter Balken */
  outlined?: boolean;
}

/** Zweite Leiste unter dem Statusbanner: laufende Wartungen mit Zahlen. Das Banner selbst bleibt unverändert. */
export function MaintenanceBar({ text, outlined = false }: MaintenanceBarProps) {
  return (
    <div
      data-testid="maintenance-bar"
      data-variant={outlined ? "outline" : "solid"}
      className={
        outlined
          ? "mt-2 flex items-center gap-2 rounded-lg border border-status-bar-maintenance-text bg-card px-6 py-2.5 text-sm font-medium text-status-bar-maintenance-text"
          : "mt-2 flex items-center gap-2 rounded-lg bg-status-bar-maintenance px-6 py-2.5 text-sm font-medium text-white"
      }
    >
      <Wrench className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
