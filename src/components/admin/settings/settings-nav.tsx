"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { t } from "@/lib/admin/messages";
import { settingsSections } from "@/lib/admin/settings-sections";
import { cn } from "@/lib/admin/utils";

import { usePlaceholders } from "./placeholders";

/**
 * The settings screen's sections: wrapped pills under `lg`, a column beside
 * the form from `lg`. Each section with stand-in values says how many, in
 * words, so the owner sees where to look.
 */
export function SettingsNav() {
  const pathname = usePathname();
  const paths = usePlaceholders();

  return (
    <nav aria-label={t("settings.nav.label")} className="lg:sticky lg:top-4 lg:self-start">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {settingsSections.map((section) => {
          const current = pathname === section.href;
          const flagged = paths.filter((path) => path.split(".", 1)[0] === section.scope).length;
          return (
            <li key={section.id}>
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "text-sm flex min-h-(--spacing-target) items-center justify-between gap-2 rounded-md border px-3 py-2 font-medium hover:bg-accent",
                  current ? "border-input bg-card" : "border-transparent",
                )}
              >
                <span>{t(section.label)}</span>
                {flagged ? (
                  <span className="text-xs rounded-full border border-accent px-1.5 text-text-accent tabular-nums">
                    {flagged}
                    <span className="sr-only"> {t("settings.nav.flagged")}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
