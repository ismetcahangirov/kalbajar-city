import "server-only";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { getSeoOverride } from "@/lib/public/seo";
import { getSiteContacts } from "@/lib/public/site";

import { confirmedContacts } from "./confirmed-contacts";
import { buildPageMetadata, geoMeta, overrideKey, type PageSeo } from "./metadata";
import { siteOrigin } from "./url";

/**
 * Every public page's `generateMetadata` ends here. It renders per request,
 * so the origin in the canonical and alternate links is the one the server
 * runs with, not the one the build saw. Every page carries the local-search
 * geo meta, with the coordinates from the settings once they are confirmed
 * (a seeded stand-in is left out).
 */
export async function pageMetadata(page: PageSeo): Promise<Metadata> {
  await connection();
  const [override, t, shell, contacts] = await Promise.all([
    getSeoOverride(overrideKey(page.href), page.locale),
    getTranslations({ locale: page.locale, namespace: "Metadata" }),
    getTranslations({ locale: page.locale, namespace: "Shell" }),
    getSiteContacts(page.locale),
  ]);
  const other = {
    ...geoMeta(confirmedContacts(contacts).coordinates, shell("place")),
    ...page.other,
  };
  return buildPageMetadata(
    { ...page, other },
    { origin: siteOrigin(), siteName: t("title"), override },
  );
}
