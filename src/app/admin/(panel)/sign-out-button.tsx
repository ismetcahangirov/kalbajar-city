"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/admin/messages";
import { authClient } from "@/lib/auth/client";
import { adminPaths } from "@/lib/auth/paths";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace(adminPaths.login);
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" onClick={signOut} disabled={pending}>
      {t("panel.signOut")}
    </Button>
  );
}
