import { t, type MessageKey } from "@/lib/admin/messages";
import { passwordLength } from "@/lib/auth/paths";

/** Translates a field error key from `@/shared/auth`. */
export function formError(key: string | undefined): string | undefined {
  return key ? t(key as MessageKey, passwordLength) : undefined;
}
