import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
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
