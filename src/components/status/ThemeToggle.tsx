"use client";

import { Moon, Sun } from "lucide-react";
import { t } from '@/lib/i18n'
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-border",
        "bg-card text-muted-foreground transition-all duration-200",
        "hover:bg-accent hover:text-foreground"
      )}
      aria-label={isDark ? t("common.themeLight") : t("common.themeDark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
