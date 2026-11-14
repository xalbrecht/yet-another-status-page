"use client";

import Image from "next/image";
import { useTranslation } from '@/lib/i18n/client'
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface HeaderProps {
  siteName: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  subtitle?: string;
  /** Marke neben dem Untertitel, z. B. „Testmodus“ */
  badge?: string;
  /** Hinweistext der Marke */
  badgeTitle?: string;
  children?: React.ReactNode;
}

export function Header({
  siteName,
  logoLightUrl,
  logoDarkUrl,
  subtitle,
  badge,
  badgeTitle,
  children,
}: HeaderProps) {
  const { t } = useTranslation();
  const subtitleText = subtitle ?? t("header.subtitle");
  const hasLogo = Boolean(logoLightUrl || logoDarkUrl);

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            {hasLogo ? (
              <>
                {logoLightUrl ? (
                  <Image
                    src={logoLightUrl}
                    alt={siteName}
                    width={150}
                    height={35}
                    className={cn("h-10 w-auto", logoDarkUrl && "dark:hidden")}
                    priority
                    unoptimized
                  />
                ) : null}
                {logoDarkUrl ? (
                  <Image
                    src={logoDarkUrl}
                    alt={logoLightUrl ? "" : siteName}
                    width={150}
                    height={35}
                    className={cn("h-10 w-auto", logoLightUrl && "hidden dark:block")}
                    priority
                    unoptimized
                    aria-hidden={Boolean(logoLightUrl)}
                  />
                ) : null}
              </>
            ) : (
              <span className="text-xl font-bold text-foreground">{siteName}</span>
            )}
          </Link>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <p className="hidden text-sm font-medium text-muted-foreground sm:block">{subtitleText}</p>
          {badge && (
            <span
              data-testid="test-badge"
              title={badgeTitle}
              className="hidden whitespace-nowrap rounded-full border border-dashed border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block"
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
