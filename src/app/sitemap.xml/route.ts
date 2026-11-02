import { connection } from "next/server";

import { sitemapIndexXml } from "@/lib/seo/sitemap";
import { siteOrigin } from "@/lib/seo/url";

/** The sitemap index robots.txt points at: the per-locale sitemaps (`src/app/sitemap/[file]`). */
export async function GET() {
  await connection();
  return new Response(sitemapIndexXml(siteOrigin()), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
