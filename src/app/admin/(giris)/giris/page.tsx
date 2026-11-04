import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { t } from "@/lib/admin/messages";
import { safeAdminRedirect } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t("login.title") };

// Reads the session cookie, so it renders per request and arrives complete.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/admin/giris">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : undefined;
  if (await getSessionUser()) redirect(safeAdminRedirect(target));
  return (
    <>
      <h1 className="text-legacy-title">{t("login.title")}</h1>
      <p className="mt-2 mb-6 text-small text-text-muted">{t("login.lead")}</p>
      <LoginForm next={target} />
    </>
  );
}
