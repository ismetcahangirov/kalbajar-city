import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { robotsRules } from "@/lib/seo/robots";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

/**
 * The public site is open to search engines and AI answer crawlers; the
 * console and the API are not (`src/lib/seo/robots.ts`).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const origin = siteOrigin();
  return {
    rules: robotsRules(),
    sitemap: absoluteUrl("/sitemap.xml", origin),
    host: origin,
  };
}
