/** Better Auth's endpoints, under the versioned API like every other handler. */
export const authBasePath = "/api/v1/auth";

/** The console's routes are Azerbaijani like the public site's (`CLAUDE.md` §3). */
export const adminPaths = {
  home: "/admin",
  login: "/admin/giris",
  resetPassword: "/admin/sifre-berpa",
} as const;

/** Console pages a signed-out visitor may open. */
export const publicAdminPaths: readonly string[] = [adminPaths.login, adminPaths.resetPassword];

export const adminApiPath = "/api/v1/admin";

export const passwordLength = { min: 12, max: 128 } as const;

export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Where to go after signing in: the console page the visitor asked for, or the
 * console home. Anything outside `/admin`, protocol-relative or pointing back
 * to a sign-in page falls back to the home.
 */
export function safeAdminRedirect(value: string | null | undefined): string {
  if (!value || !isUnder(value.split(/[?#]/)[0] ?? "", adminPaths.home)) return adminPaths.home;
  if (value.startsWith("//") || value.includes("\\")) return adminPaths.home;
  const path = value.split(/[?#]/)[0] ?? "";
  if (publicAdminPaths.some((publicPath) => isUnder(path, publicPath))) return adminPaths.home;
  return value;
}
