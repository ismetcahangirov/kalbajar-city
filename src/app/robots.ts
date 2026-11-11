import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { siteIndexable } from "@/lib/seo/indexing";
import { blockAllRules, robotsRules } from "@/lib/seo/robots";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

/**
 * The public site is open to search engines and AI answer crawlers; the
 * console and the API are not (`src/lib/seo/robots.ts`). A deployment with
 * `SITE_NOINDEX` set (staging) disallows everything and names no sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  if (!siteIndexable()) return { rules: blockAllRules() };
  const origin = siteOrigin();
  return {
    rules: robotsRules(),
    sitemap: absoluteUrl("/sitemap.xml", origin),
    host: origin,
  };
}
