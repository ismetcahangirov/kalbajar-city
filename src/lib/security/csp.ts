/** Where GA4 and the Meta Pixel load their scripts from and send their hits to. */
export const analyticsOrigins = {
  script: ["https://www.googletagmanager.com", "https://connect.facebook.net"],
  connect: [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://www.facebook.com",
  ],
} as const;

/**
 * The Content Security Policy, in one place for the two that serve it:
 * `next.config.ts` for every page but the console (fixed at build time), and
 * `src/proxy.ts` for the console's pages, at request time, because the
 * console uploads straight to the object store, whose origin is a runtime
 * setting (`S3_ENDPOINT`, #25).
 *
 * Without nonces: a nonce would render every page per request and rule out
 * the cached, prerendered public pages, so Next's inline bootstrap scripts
 * need 'unsafe-inline'. The policy still blocks scripts from other origins,
 * plugins, <base> hijacking, foreign form targets and framing. Images and
 * video may come from any https origin because the object store's public URL
 * is a runtime setting (#11); local http storage is allowed off https only.
 * The one third-party frame is the OpenStreetMap embed, which the location
 * and contact pages load only when the visitor asks for the map (#20).
 * Public pages also allow GA4 and the Meta Pixel (`analyticsOrigins`); they
 * load only once the console has set their IDs (#29).
 */
export function contentSecurityPolicy({
  dev,
  https,
  connect = [],
  analytics = false,
}: {
  dev: boolean;
  https: boolean;
  /** Origins the page may `fetch` or `XMLHttpRequest` besides its own. */
  connect?: readonly string[];
  /** Public pages: GA4 and the Meta Pixel, once the console sets their IDs (#29). */
  analytics?: boolean;
}): string {
  const scripts = analytics ? analyticsOrigins.script : [];
  const beacons = analytics ? analyticsOrigins.connect : [];
  return [
    "default-src 'self'",
    [`script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`, ...scripts].join(" "),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https:${https ? "" : " http:"}`,
    `media-src 'self' blob: https:${https ? "" : " http:"}`,
    "font-src 'self'",
    ["connect-src 'self'", ...connect, ...beacons].join(" "),
    "frame-src https://www.openstreetmap.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * The origin of a URL from the environment, or null when it is missing or not
 * an http(s) URL, so a typo never widens the policy.
 */
export function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** The console's policy: the site's own plus the object store, read now. */
export function consoleContentSecurityPolicy(env: Record<string, string | undefined>): string {
  const storage = originOf(env.S3_ENDPOINT);
  return contentSecurityPolicy({
    dev: env.NODE_ENV === "development",
    https: (env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    connect: storage ? [storage] : [],
  });
}
