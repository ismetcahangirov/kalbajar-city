/**
 * The one error shape every `/api/v1` handler returns (#10):
 * `{ error: { code, message, fields? } }`.
 */
export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
};

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
