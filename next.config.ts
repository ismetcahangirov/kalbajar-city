import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { legacyRedirects } from "./src/config/legacy-redirects";
import { contentSecurityPolicy as buildContentSecurityPolicy } from "./src/lib/security/csp";

const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Pages outside the console. The console's pages get the same policy plus the
 * object store's origin from `src/proxy.ts` at request time (#25), so this
 * one is not sent there: two policies would both apply, and the stricter
 * `connect-src` would block uploads.
 */
const contentSecurityPolicy = buildContentSecurityPolicy({
  dev: isDev,
  https: isHttps,
  analytics: true,
});

/** Every response. */
const transportHeaders = [
  // Two years. Preloading is the domain owner's call, so it is not requested.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

/**
 * These mean something only on a document. Scripts, styles, fonts and images
 * are exempt: a page's first load is some twenty of them, and each would carry
 * about 700 bytes of headers that no browser reads (#30).
 */
const documentHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

/** sharp's platform packages (`@img/sharp-<os>-<cpu>`, `@img/sharp-libvips-<os>-<cpu>`). */
const sharpNativeFiles = "./node_modules/.pnpm/@img+sharp-*/node_modules/@img/*/lib/**/*";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Crawlers get metadata in the initial HTML instead of a streamed <head>.
  htmlLimitedBots: /.*/,
  // The media routes run sharp (#11). File tracing copies its .node addon into
  // the standalone output but not the libvips library beside it, which the
  // addon loads at runtime; without it every media route fails to start.
  outputFileTracingIncludes: {
    "/api/v1/admin/media": [sharpNativeFiles],
    "/api/v1/admin/media/*": [sharpNativeFiles],
    "/api/v1/admin/media/*/*": [sharpNativeFiles],
    // The Open Graph cards read their fonts and colours from disk (src/lib/seo/og.tsx).
    "/**/opengraph-image*": ["./src/fonts/alethia-next/og/*.otf", "./src/styles/tokens.css"],
  },
  experimental: {
    // The root layout sits under [locale], so unmatched URLs need a 404 that
    // does not depend on a layout.
    globalNotFound: true,
    // forbidden() answers 403 on console pages a role may not open.
    authInterrupts: true,
    // Fewer, larger client chunks (#30). Home's first view loaded eleven
    // scripts, several of them under 5 KB; on a slow phone each one waits for
    // a free connection behind the fonts and the hero image, which is what
    // kept home's mobile LCP over budget. Merging the small app chunks brings
    // it to eight. React and the Next runtime stay separate chunks: merged,
    // they evaluate as one longer task, which raised Total Blocking Time on
    // every page. No route ships more code (`pnpm budget:js`).
    turbopackChunking: {
      minChunkSize: 150000,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The old site's indexed URLs (src/config/legacy-redirects.ts). A 301, not
  // the 308 `permanent: true` gives, which every crawler and client knows.
  async redirects() {
    return legacyRedirects.map(({ from, to }) => ({
      source: from,
      destination: to,
      statusCode: 301 as const,
    }));
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: transportHeaders },
      { source: "/((?!_next/static/|defaults/).*)", headers: documentHeaders },
      {
        source: "/((?!admin$|admin/|_next/static/|defaults/).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
      { source: "/admin/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./src/i18n/messages/az.json",
    // Compiles ICU messages at build time, so the client ships no parser.
    messages: {
      path: "./src/i18n/messages",
      format: "json",
      locales: "infer",
      precompile: true,
    },
  },
});

export default withNextIntl(nextConfig);
