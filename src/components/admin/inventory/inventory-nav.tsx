import Link from "next/link";

import { t, type MessageKey } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { cn } from "@/lib/admin/utils";
import type { Permission } from "@/lib/auth/permissions";

const base = adminModules.apartments.href;

/** The import adds, updates and removes apartments, so it needs all three. */
export const importPermission = {
  inventory: ["create", "update", "delete"],
} satisfies Permission;

export const inventoryPages = {
  apartments: { href: base, label: "inventory.nav.apartments" },
  layouts: { href: `${base}/planlar`, label: "inventory.nav.layouts" },
  structure: { href: `${base}/struktur`, label: "inventory.nav.structure" },
  import: { href: `${base}/idxal`, label: "inventory.nav.import" },
} as const satisfies Record<string, { href: string; label: MessageKey }>;

export type InventoryPage = keyof typeof inventoryPages;

/** The inventory module's own pages, below the page title. */
export function InventoryNav({
  current,
  canImport,
}: {
  current: InventoryPage;
  canImport: boolean;
}) {
  const pages = (Object.keys(inventoryPages) as InventoryPage[]).filter(
    (page) => page !== "import" || canImport,
  );
  return (
    <nav aria-label={t("inventory.nav")} className="-mt-2 overflow-x-auto">
      <ul className="flex gap-1 border-b">
        {pages.map((page) => (
          <li key={page}>
            <Link
              href={inventoryPages[page].href}
              aria-current={page === current ? "page" : undefined}
              className={cn(
                "text-sm inline-flex min-h-target items-center border-b-2 px-3 whitespace-nowrap",
                page === current
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t(inventoryPages[page].label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
