import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Rewrites unprefixed paths to the default locale (`/menziller` → az) and
// redirects `/az/...` to its unprefixed form. It never redirects by
// Accept-Language (routing.localeDetection is off).
export default createMiddleware(routing);

export const config = {
  // Everything except the API, the console, Next internals and files.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
