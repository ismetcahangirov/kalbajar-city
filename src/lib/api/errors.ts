import type { ApiErrorBody } from "@/shared/api";

/**
 * The one error shape every `/api/v1` handler returns (#10):
 * `{ error: { code, message, fields? } }`.
 */
export type ApiError = ApiErrorBody;

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): Response {
  const body: ApiError = { error: { code, message, ...(fields ? { fields } : {}) } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const unauthorized = () => apiError(401, "UNAUTHORIZED", "Sign in to continue.");

export const forbidden = () => apiError(403, "FORBIDDEN", "Your role does not allow this action.");

/**
 * Thrown inside a `handler()` to answer with an error; the wrapper turns it
 * into the shared shape.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
  }

  toResponse(): Response {
    return apiError(this.status, this.code, this.message, this.fields);
  }
}

export const notFound = (message = "Not found.") => new HttpError(404, "NOT_FOUND", message);

export const forbiddenError = () =>
  new HttpError(403, "FORBIDDEN", "Your role does not allow this action.");

/** A 422 for one field, for rules the schema cannot see (a slug that names nothing). */
export const invalidField = (field: string, message: string) =>
  new HttpError(422, "VALIDATION_FAILED", "The request has invalid fields.", {
    [field]: [message],
  });
