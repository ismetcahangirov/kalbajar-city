import { connection } from "next/server";

import { getSitemapData } from "@/lib/public/sitemap";
import { sitemapEntries, sitemapIds, sitemapXml } from "@/lib/seo/sitemap";
import { siteOrigin } from "@/lib/seo/url";

/**
 * `/sitemap/<locale>.xml`: every indexable page in one locale, listed in the
 * index at `/sitemap.xml`. A route rather than `sitemap.ts`, whose
 * `generateSitemaps` claims `/sitemap.xml` and leaves no room for the index.
 */
export async function GET(_request: Request, { params }: RouteContext<"/sitemap/[file]">) {
  // Per request: the origin is the server's, and the data changes with the console.
  await connection();
  const { file } = await params;
  const locale = sitemapIds.find((id) => file === `${id}.xml`);
  if (!locale) return new Response("Not Found", { status: 404 });
  const xml = sitemapXml(sitemapEntries(await getSitemapData(), locale, siteOrigin()));
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
