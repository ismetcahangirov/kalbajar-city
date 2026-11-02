import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Without nonces: a nonce would render every page per request and rule out
 * the cached, prerendered public pages, so Next's inline bootstrap scripts
 * need 'unsafe-inline'. The policy still blocks scripts from other origins,
 * plugins, <base> hijacking, foreign form targets and framing. Images and
 * video may come from any https origin because the object store's public URL
 * is a runtime setting (#11); local http storage is allowed off https only.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https:${isHttps ? "" : " http:"}`,
  `media-src 'self' blob: https:${isHttps ? "" : " http:"}`,
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Two years. Preloading is the domain owner's call, so it is not requested.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Crawlers get metadata in the initial HTML instead of a streamed <head>.
  htmlLimitedBots: /.*/,
  experimental: {
    // The root layout sits under [locale], so unmatched URLs need a 404 that
    // does not depend on a layout.
    globalNotFound: true,
    // forbidden() answers 403 on console pages a role may not open.
    authInterrupts: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: securityHeaders },
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
