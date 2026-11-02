import type { ApiErrorBody } from "@/shared/api";

/**
 * The shared error body of a failed query or mutation, or `null` for a
 * network failure or an answer in another shape.
 */
export function apiErrorOf(error: unknown): ApiErrorBody["error"] | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const { data } = error;
  if (!data || typeof data !== "object" || !("error" in data)) return null;
  const body = data.error;
  if (!body || typeof body !== "object") return null;
  const { code, message } = body as Partial<ApiErrorBody["error"]>;
  return typeof code === "string" && typeof message === "string"
    ? (body as ApiErrorBody["error"])
    : null;
}
