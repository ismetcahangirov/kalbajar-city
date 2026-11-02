/**
 * Every URL of the old kalbajarcity.com that search engines know, and the
 * page that replaces it. The old site's sitemap (fetched 2026-11-02) lists
 * two pages, `/` and `/laq` ("Əlaqə", the contact page), and it answers
 * `/index` and `/index.html` with redirects to `/`; nothing else it served
 * was a page (`/about`, `/news` and the like were already 404). The new site
 * answers these with a 301 from `next.config.ts` once it replaces the old one
 * on the same domain. The home page keeps its URL, so it needs no entry.
 */
export const legacyRedirects: ReadonlyArray<{ from: string; to: string }> = [
  { from: "/laq", to: "/elaqe" },
  { from: "/index", to: "/" },
  { from: "/index.html", to: "/" },
];
