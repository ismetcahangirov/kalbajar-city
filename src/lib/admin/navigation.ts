import type { Permission } from "@/lib/auth/permissions";
import { adminPaths, isUnder } from "@/lib/auth/paths";

import { t, type MessageKey } from "./messages";

export type ModuleSpec = { href: string; label: MessageKey; permission?: Permission };

/**
 * The console's modules. Routes are Azerbaijani like the public site's
 * (`CLAUDE.md` §3); each page calls `requireUser(permission)` with the same
 * permission its menu item is shown for.
 */
export const adminModules = {
  dashboard: { href: adminPaths.home, label: "nav.dashboard" },
  apartments: {
    href: "/admin/menziller",
    label: "nav.apartments",
    permission: { inventory: ["read"] },
  },
  leads: {
    href: "/admin/muracietler",
    label: "nav.leads",
    permission: { leads: ["read"] },
  },
  news: {
    href: "/admin/xeberler",
    label: "nav.news",
    permission: { content: ["read"] },
  },
  media: {
    href: "/admin/media",
    label: "nav.media",
    permission: { media: ["read"] },
  },
  settings: {
    href: "/admin/ayarlar",
    label: "nav.settings",
    permission: { settings: ["read"] },
  },
  users: {
    href: "/admin/istifadeciler",
    label: "nav.users",
    permission: { user: ["list"] },
  },
  audit: {
    href: "/admin/audit",
    label: "nav.audit",
    permission: { audit: ["read"] },
  },
} satisfies Record<string, ModuleSpec>;

export type AdminModule = keyof typeof adminModules;

/** A menu entry; the sidebar picks the module's icon on the client. */
export type NavItem = { module: AdminModule; href: string; label: string };

export type NavGroup = { label: string | null; items: NavItem[] };

/** The module a console path belongs to, or `null` outside the menu's modules. */
export function moduleOf(pathname: string): AdminModule | null {
  const modules = Object.keys(adminModules) as AdminModule[];
  // The dashboard is `/admin` itself; every other module owns its subtree.
  const match = modules.find(
    (module) => module !== "dashboard" && isUnder(pathname, adminModules[module].href),
  );
  if (match) return match;
  return pathname === adminPaths.home ? "dashboard" : null;
}

/** Whether a menu item is the current page or one of its sub-pages. */
export function isCurrent(pathname: string, href: string): boolean {
  return href === adminPaths.home ? pathname === href : isUnder(pathname, href);
}

export type Crumb = { label: string; href?: string };

/**
 * The top bar's breadcrumbs: the console home, then the module. The last
 * crumb is the current page and has no link.
 */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const current = moduleOf(pathname);
  if (!current || current === "dashboard") return [{ label: t("nav.dashboard") }];
  const { href, label } = adminModules[current];
  return [
    { label: t("nav.dashboard"), href: adminPaths.home },
    pathname === href ? { label: t(label) } : { label: t(label), href },
  ];
}
