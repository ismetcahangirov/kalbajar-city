"use client";

import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/admin/api-error";

export { toast };

/** A failed request as a toast, in Azerbaijani (`apiErrorMessage`). */
export function toastApiError(error: unknown) {
  toast.error(apiErrorMessage(error));
}
