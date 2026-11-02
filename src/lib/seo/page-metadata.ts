import "server-only";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { getSeoOverride } from "@/lib/public/seo";

import { buildPageMetadata, overrideKey, type PageSeo } from "./metadata";
import { siteOrigin } from "./url";

/**
 * Every public page's `generateMetadata` ends here. It renders per request,
 * so the origin in the canonical and alternate links is the one the server
 * runs with, not the one the build saw.
 */
export async function pageMetadata(page: PageSeo): Promise<Metadata> {
  await connection();
  const [override, t] = await Promise.all([
    getSeoOverride(overrideKey(page.href), page.locale),
    getTranslations({ locale: page.locale, namespace: "Metadata" }),
  ]);
  return buildPageMetadata(page, { origin: siteOrigin(), siteName: t("title"), override });
}
