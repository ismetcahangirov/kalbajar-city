import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { forbidden as forbiddenResponse, unauthorized } from "@/lib/api/errors";

import { getAuth } from ".";
import { adminPaths } from "./paths";
import { can, isUserRole, type Permission, type UserRole } from "./permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/** The signed-in, active user behind these request headers, or `null`. */
export async function userFromHeaders(requestHeaders: Headers): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  const role: unknown = session?.user.role;
  if (!session || session.user.banned || !isUserRole(role)) return null;
  const { id, name, email } = session.user;
  return { id, name, email, role };
}

/** The current console user, read once per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> =>
  userFromHeaders(await headers()),
);

/**
 * For console pages: sends a signed-out visitor to the sign-in page and
 * answers 403 when the user's role lacks `permission`.
 */
export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(adminPaths.login);
  if (permission && !can(user.role, permission)) forbidden();
  return user;
}

/**
 * For `/api/v1/admin/*` handlers: the user, or the 401/403 response to return.
 * `proxy.ts` only checks that a session cookie exists; this checks the session.
 */
export async function authorize(
  request: Request,
  permission?: Permission,
): Promise<{ user: SessionUser; response?: never } | { user?: never; response: Response }> {
  const user = await userFromHeaders(request.headers);
  if (!user) return { response: unauthorized() };
  if (permission && !can(user.role, permission)) return { response: forbiddenResponse() };
  return { user };
}
