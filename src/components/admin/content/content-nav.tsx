import Link from "next/link";

import { t, type MessageKey } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { cn } from "@/lib/admin/utils";

const base = adminModules.news.href;

/** The content module's pages; they share the module's menu item and permission. */
export const contentPages = {
  news: { href: base, label: "content.nav.news" },
  gallery: { href: `${base}/qalereya`, label: "content.nav.gallery" },
  faq: { href: `${base}/suallar`, label: "content.nav.faq" },
  home: { href: `${base}/ana-sehife`, label: "content.nav.home" },
} as const satisfies Record<string, { href: string; label: MessageKey }>;

export type ContentPage = keyof typeof contentPages;

/** The content module's own pages, below the page title. */
export function ContentNav({ current }: { current: ContentPage }) {
  return (
    <nav aria-label={t("content.nav")} className="-mt-2 overflow-x-auto">
      <ul className="flex gap-1 border-b">
        {(Object.keys(contentPages) as ContentPage[]).map((page) => (
          <li key={page}>
            <Link
              href={contentPages[page].href}
              aria-current={page === current ? "page" : undefined}
              className={cn(
                "text-sm inline-flex min-h-target items-center border-b-2 px-3 whitespace-nowrap",
                page === current
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t(contentPages[page].label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
