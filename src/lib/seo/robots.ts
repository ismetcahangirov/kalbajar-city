import type { MetadataRoute } from "next";

/**
 * Search engines and the crawlers AI assistants use to answer a question
 * with a live page (#29). They are named so the welcome is explicit: a
 * crawler that finds its own group reads only that group, so each one also
 * carries the console and API exclusions. Everything else falls under `*`,
 * which allows the same.
 */
export const answerCrawlers = [
  // Search
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "DuckDuckBot",
  "Applebot",
  // AI search and answers
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
] as const;

/** Never crawled: the console and the API (they also send `X-Robots-Tag: noindex`). */
export const disallowedPaths = ["/admin", "/api"] as const;

/** The public site is open to every crawler; the console and the API are not. */
export function robotsRules(): MetadataRoute.Robots["rules"] {
  const rule = { allow: "/", disallow: [...disallowedPaths] };
  return [
    { userAgent: [...answerCrawlers], ...rule },
    { userAgent: "*", ...rule },
  ];
}
