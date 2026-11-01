import { defineRouting } from "next-intl/routing";

export const locales = ["az", "en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "az";

/**
 * Every public route, by its internal path. Route segments are Azerbaijani in
 * every locale (CLAUDE.md → Languages and URLs), so each path maps to itself;
 * listing them still gives `Link`, `redirect` and `getPathname` typed hrefs,
 * and a unit test keeps this list and `src/app/[locale]` in step.
 */
export const pathnames = {
  "/": "/",
  "/menziller": "/menziller",
  "/menziller/[slug]": "/menziller/[slug]",
  "/primitivler": "/primitivler",
} as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  // No redirect by Accept-Language or cookie: crawlers and shared links see
  // the locale in the URL. A dismissible suggestion handles the rest.
  localeDetection: false,
  localeCookie: false,
  pathnames,
});
