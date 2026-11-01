"use client";

import { useParams } from "next/navigation";

import { getPathname, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * Returns a function that gives the current page's URL in another locale,
 * keeping its route parameters (such as an apartment slug) and the query
 * string passed in.
 */
export function useLocaleHref(): (locale: Locale, search?: string) => string {
  const pathname = usePathname();
  // Every route parameter except the root `locale`, which `getPathname` sets.
  const params = Object.fromEntries(
    Object.entries(useParams<Record<string, string | string[]>>()).filter(
      ([key]) => key !== "locale",
    ),
  );

  return (locale, search = "") => {
    // `pathname` is the internal template (`/menziller/[slug]`) and `params`
    // fills it; the pair is valid by construction, which the union type of
    // `href` cannot express.
    const href = { pathname, params } as unknown as Href;
    const path = getPathname({ href, locale });
    return search ? `${path}${search.startsWith("?") ? "" : "?"}${search}` : path;
  };
}
