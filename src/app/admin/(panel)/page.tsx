import type { Metadata } from "next";

import { roleLabel, t } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: t("panel.title") };

export const instant = false;

// The console home. The shell, navigation and dashboard arrive with #23.
export default async function AdminHomePage() {
  const user = await requireUser();
  return (
    <main className="mx-auto flex min-h-svh max-w-page flex-col gap-4 px-gutter py-section">
      <h1 className="text-heading">{t("panel.title")}</h1>
      <p>{t("panel.welcome", { name: user.name })}</p>
      <p className="text-text-muted">{t("panel.role", { role: roleLabel(user.role) })}</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
