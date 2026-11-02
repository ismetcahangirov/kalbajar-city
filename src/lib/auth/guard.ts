import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { unauthorized } from "@/lib/api/errors";

import { adminApiPath, adminPaths, isUnder, publicAdminPaths } from "./paths";

/** Whether `proxy.ts` hands the request to `guardAdmin`. */
export function isAdminRequest(pathname: string): boolean {
  return isUnder(pathname, adminPaths.home) || isUnder(pathname, adminApiPath);
}

/**
 * Sends signed-out visitors away from the console before anything renders.
 * It only sees whether a session cookie exists; pages and handlers check the
 * session and the role themselves (`@/lib/auth/session`).
 */
export function guardAdmin(request: NextRequest): NextResponse | Response {
  const { pathname, search } = request.nextUrl;
  const signedIn = getSessionCookie(request) !== null;

  if (isUnder(pathname, adminApiPath)) {
    return signedIn ? NextResponse.next() : unauthorized();
  }
  if (signedIn || publicAdminPaths.some((path) => isUnder(pathname, path))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = adminPaths.login;
  url.search = pathname === adminPaths.home ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}
