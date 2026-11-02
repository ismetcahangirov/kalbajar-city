import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

/** The public site is open to crawlers; the console and the API are not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: absoluteUrl("/sitemap.xml", origin),
    host: origin,
  };
}
