import type { Messages } from "next-intl";

import type { DefaultSlot } from "@/content/defaults";
import type { pathnames } from "@/i18n/routing";

export type NavKey = Exclude<keyof Messages["Navigation"], "label" | "footer">;
/** Paths without route parameters, which a menu can link to directly. */
export type StaticPath = Exclude<keyof typeof pathnames, `${string}[${string}`>;
export type NavItem = { key: NavKey; href: StaticPath };

const item = (key: NavKey, href: NavItem["href"]): NavItem => ({ key, href });

/**
 * The chapters of the site, in reading order: the menu lists them, and each
 * chapter page's footer teases the next one (`NextChapter`). The last has
 * no next chapter.
 */
export const chapters = [
  item("apartments", "/menziller"),
  item("complex", "/kompleks"),
  item("about", "/haqqimizda"),
  item("location", "/yerlesme"),
  item("gallery", "/qalereya"),
  item("construction", "/tikinti"),
  item("news", "/xeberler"),
  item("contact", "/elaqe"),
] as const satisfies readonly NavItem[];

export type ChapterHref = (typeof chapters)[number]["href"];

/** The chapter after `href`, or undefined for the last one. */
export function nextChapter(href: ChapterHref): NavItem | undefined {
  const index = chapters.findIndex((chapter) => chapter.href === href);
  return chapters[index + 1];
}

/** The `page.*` default image of each chapter: its hero, menu card and teaser. */
export function chapterImage(href: ChapterHref): DefaultSlot {
  return `page.${href.slice(1)}` as DefaultSlot;
}

/** Every public page, in the order the footer's site map lists them. */
export const fullNav: NavItem[] = [...chapters];

/** The desktop menu's image cards; the rest are its small links. */
export const menuCards: NavItem[] = chapters.slice(0, 6);
export const menuSmallLinks: NavItem[] = chapters.slice(6);

export const privacyLink = item("privacy", "/mexfilik-siyaseti");

/** Whether a link points at the current page or one of its children. */
export function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
