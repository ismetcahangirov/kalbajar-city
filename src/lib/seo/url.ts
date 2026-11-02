/** The origin pages fall back to when no site URL is configured: the dev server. */
const devOrigin = "http://localhost:3010";

/** Read by name, so the bundler cannot inline the build's value (see `siteOrigin`). */
const originVariables = ["NEXT_PUBLIC_SITE_URL"];

/**
 * The public site's origin, without a trailing slash, read at run time: a
 * literal `process.env.NEXT_PUBLIC_*` is inlined at build time, and the image
 * is built once and configured per environment. Callers that put it into a
 * page must render per request (`await connection()`), or the build's value
 * ends up in the prerendered HTML.
 */
export function siteOrigin(): string {
  for (const name of originVariables) {
    const value = process.env[name]?.trim();
    if (value) return value.replace(/\/+$/, "");
  }
  return devOrigin;
}

/**
 * An absolute URL on the public site, for canonical and alternate links,
 * sitemaps and JSON-LD. The home page is the bare origin, the form Next
 * prints in `<link rel="canonical">`, so every list names it the same way.
 */
export function absoluteUrl(path: string, origin = siteOrigin()): string {
  const url = new URL(path, `${origin}/`);
  return url.pathname === "/" && !url.search && !url.hash ? url.origin : url.toString();
}
