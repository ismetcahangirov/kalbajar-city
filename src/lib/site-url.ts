/**
 * An absolute URL on the public site, for canonical links. The origin is
 * `NEXT_PUBLIC_SITE_URL` (inlined at build time); a relative canonical would
 * need a `metadataBase` and otherwise resolves against localhost.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010").toString();
}
