import createMiddleware from "next-intl/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { guardAdmin, isAdminRequest } from "./lib/auth/guard";
import { redirectFor } from "./lib/redirects/serve";
import { siteIndexable, siteNoindexHeader } from "./lib/seo/indexing";

// Rewrites unprefixed paths to the default locale (`/menziller` → az) and
// redirects `/az/...` to its unprefixed form. It never redirects by
// Accept-Language (routing.localeDetection is off).
const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isAdminRequest(request.nextUrl.pathname)) return guardAdmin(request);
  // Redirects from the console (#27): an in-memory lookup, see `./lib/redirects/serve`.
  const redirect = await redirectFor(request.nextUrl, event);
  if (redirect) return redirect;
  const response = intl(request);
  // Staging (#13): every page says noindex in its headers too, including the
  // few that set no metadata. The console and the API send it from next.config.
  if (!siteIndexable()) response.headers.set("X-Robots-Tag", siteNoindexHeader);
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/v1/admin/:path*",
    // Every public page: not the API, the console, Next internals or files.
    // `proxySeesPath` in `src/shared/redirects.ts` mirrors this pattern.
    "/((?!api|admin|_next|_vercel|.*\\..*).*)",
  ],
};
