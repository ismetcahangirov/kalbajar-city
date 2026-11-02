import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { guardAdmin, isAdminRequest } from "./lib/auth/guard";

// Rewrites unprefixed paths to the default locale (`/menziller` → az) and
// redirects `/az/...` to its unprefixed form. It never redirects by
// Accept-Language (routing.localeDetection is off).
const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  if (isAdminRequest(request.nextUrl.pathname)) return guardAdmin(request);
  return intl(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/v1/admin/:path*",
    // Every public page: not the API, the console, Next internals or files.
    "/((?!api|admin|_next|_vercel|.*\\..*).*)",
  ],
};
