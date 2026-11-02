import { apiErrorOf } from "@/store/errors";

import { t, type MessageKey } from "./messages";

const byCode: Record<string, MessageKey> = {
  VALIDATION_FAILED: "error.validation",
  INVALID_QUERY: "error.validation",
  FORBIDDEN: "error.forbidden",
  UNAUTHORIZED: "error.unauthorized",
  NOT_FOUND: "error.notFound",
  CONFLICT: "error.conflict",
  RATE_LIMITED: "error.rateLimited",
};

/**
 * What to tell the user about a failed query or mutation, in Azerbaijani.
 * The API's own messages are English and meant for developers, so the
 * console speaks from the error code; a network failure has no body.
 */
export function apiErrorMessage(error: unknown): string {
  const body = apiErrorOf(error);
  if (!body) {
    const status = (error as { status?: unknown } | null)?.status;
    return t(status === "FETCH_ERROR" ? "error.network" : "error.generic");
  }
  const key = byCode[body.code];
  return t(key ?? "error.generic");
}
