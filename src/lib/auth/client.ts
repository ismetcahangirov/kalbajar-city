import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { t, type MessageKey } from "@/lib/admin/messages";

import { authBasePath } from "./paths";
import { lockMinutes } from "./throttle-config";

export const authClient = createAuthClient({ basePath: authBasePath, plugins: [adminClient()] });

const errorMessages: Record<string, MessageKey> = {
  INVALID_EMAIL_OR_PASSWORD: "error.invalidCredentials",
  BANNED_USER: "error.banned",
  INVALID_TOKEN: "error.invalidToken",
};

/** The console message for a Better Auth error. */
export function authErrorMessage(error: { code?: string; status?: number } | null): string {
  if (error?.code === "ACCOUNT_LOCKED") return t("error.locked", { minutes: lockMinutes });
  if (error?.status === 429) return t("error.rateLimited");
  const key = error?.code ? errorMessages[error.code] : undefined;
  return t(key ?? "error.generic");
}
