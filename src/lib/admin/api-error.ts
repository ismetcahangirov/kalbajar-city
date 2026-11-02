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
  IN_USE: "error.inUseGeneric",
  IMPORT_INVALID: "error.importInvalid",
  LEADS_LINKED: "error.leadsLinked",
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
  if (body.code === "IN_USE") {
    const items = dependentsOf(body);
    if (items) return t("error.inUse", { items });
  }
  const key = byCode[body.code];
  return t(key ?? "error.generic");
}

const dependentKeys = {
  blocks: "inUse.blocks",
  floors: "inUse.floors",
  apartments: "inUse.apartments",
} as const satisfies Record<string, MessageKey>;

/** `IN_USE`'s `dependents` in words: `4 mərtəbə`. */
function dependentsOf(body: object): string | null {
  const dependents = (body as { dependents?: Record<string, unknown> }).dependents ?? {};
  const words = Object.entries(dependents).flatMap(([key, count]) =>
    key in dependentKeys && typeof count === "number"
      ? [t(dependentKeys[key as keyof typeof dependentKeys], { count })]
      : [],
  );
  return words.length ? words.join(", ") : null;
}
