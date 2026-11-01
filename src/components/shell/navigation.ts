import type { Messages } from "next-intl";

import type { pathnames } from "@/i18n/routing";

export type NavKey = Exclude<keyof Messages["Navigation"], "label" | "footer">;
/** Paths without route parameters, which a menu can link to directly. */
export type StaticPath = Exclude<keyof typeof pathnames, `${string}[${string}`>;
export type NavItem = { key: NavKey; href: StaticPath };

const item = (key: NavKey, href: NavItem["href"]): NavItem => ({ key, href });

/** The header's links, from `lg`. The menu and the footer list every page. */
export const primaryNav: NavItem[] = [
  item("apartments", "/menziller"),
  item("complex", "/kompleks"),
  item("about", "/haqqimizda"),
  item("construction", "/tikinti"),
  item("contact", "/elaqe"),
];

/** Every public page, in the order the mobile menu shows them. */
export const fullNav: NavItem[] = [
  item("apartments", "/menziller"),
  item("complex", "/kompleks"),
  item("about", "/haqqimizda"),
  item("location", "/yerlesme"),
  item("construction", "/tikinti"),
  item("gallery", "/qalereya"),
  item("news", "/xeberler"),
  item("contact", "/elaqe"),
];

/** The footer's two columns. */
export const footerNav = {
  complex: fullNav.slice(0, 4),
  updates: fullNav.slice(4),
} as const;

export const privacyLink = item("privacy", "/mexfilik-siyaseti");

/** Whether a link points at the current page or one of its children. */
export function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
