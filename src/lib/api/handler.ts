import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import type { Permission } from "@/lib/auth/permissions";
import { authorize, type SessionUser } from "@/lib/auth/session";

import { apiError, HttpError } from "./errors";

/**
 * Who may call the endpoint: any signed-in console user (`"user"`), or one
 * whose role grants the permission. Leave it out for public endpoints.
 */
export type Auth = Permission | "user";

type Schema = z.ZodType | undefined;

type Out<S> = S extends z.ZodType ? z.output<S> : undefined;

export type HandlerContext<A, P, Q, B> = {
  request: Request;
  params: Out<P>;
  query: Out<Q>;
  body: Out<B>;
  user: A extends Auth ? SessionUser : null;
};

export type HandlerSpec<A, P, Q, B> = {
  auth?: A;
  /** The route's dynamic segments. A segment that fails it answers 404. */
  params?: P;
  /** The query string; repeated keys arrive as arrays. Failing it answers 400. */
  query?: Q;
  /** A JSON body. Failing it answers 422 with the invalid fields. */
  body?: B;
  /** The status of a successful answer; 200 unless set. */
  status?: number;
};

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

const noStore = { "Cache-Control": "no-store" };

/**
 * Wraps a route handler under `/api/v1` (#10). In order, it checks the
 * session and role, parses params, query and body with zod, runs `fn`, and
 * answers with what it returns: a `Response` as is, `undefined` as 204, and
 * anything else as JSON. Every failure, thrown or found, leaves in the shared
 * error shape (`@/lib/api/errors`).
 *
 * Bodies must be `application/json`: a cross-site page cannot send that
 * without a CORS preflight, which these routes never grant, so together with
 * the `SameSite=Lax` session cookie it keeps console writes safe from CSRF.
 */
export function handler<
  A extends Auth | undefined = undefined,
  P extends Schema = undefined,
  Q extends Schema = undefined,
  B extends Schema = undefined,
>(
  spec: HandlerSpec<A, P, Q, B>,
  fn: (context: HandlerContext<A, P, Q, B>) => unknown,
): (request: Request, context?: RouteContext) => Promise<Response> {
  return async (request, context) => {
    try {
      let user: SessionUser | null = null;
      if (spec.auth) {
        const result = await authorize(request, spec.auth === "user" ? undefined : spec.auth);
        if (result.response) return result.response;
        user = result.user;
      }

      const params = spec.params
        ? spec.params.safeParse((await context?.params) ?? {})
        : { success: true as const, data: undefined };
      if (!params.success) return apiError(404, "NOT_FOUND", "Not found.");

      const query = spec.query
        ? spec.query.safeParse(searchParams(new URL(request.url)))
        : { success: true as const, data: undefined };
      if (!query.success) {
        return apiError(
          400,
          "INVALID_QUERY",
          "The query string is invalid.",
          fieldErrors(query.error),
        );
      }

      const body = spec.body
        ? spec.body.safeParse(await readJson(request))
        : { success: true as const, data: undefined };
      if (!body.success) {
        return apiError(
          422,
          "VALIDATION_FAILED",
          "The request has invalid fields.",
          fieldErrors(body.error),
        );
      }

      const result = await fn({
        request,
        params: params.data,
        query: query.data,
        body: body.data,
        user,
      } as HandlerContext<A, P, Q, B>);

      if (result instanceof Response) return result;
      if (result === undefined) return new Response(null, { status: 204, headers: noStore });
      return Response.json(result, { status: spec.status ?? 200, headers: noStore });
    } catch (error) {
      // Next's own control flow (prerender bail-outs, `notFound()`) must reach Next.
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

/** The query string as an object; a key given more than once becomes an array. */
export function searchParams(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : values;
  }
  return result;
}

/** zod issues by the field's dotted path; issues about the whole value go under `root`. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "root";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the body as application/json.");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "MALFORMED_JSON", "The body is not valid JSON.");
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return error.toResponse();
  const code = postgresCode(error);
  // A write that raced another (unique) or would orphan rows (foreign key).
  if (code === "23505") return apiError(409, "CONFLICT", "That value is already taken.");
  if (code === "23503") return apiError(409, "CONFLICT", "Other records still refer to this.");
  console.error(error);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

/** The SQLSTATE of a Postgres error, which Drizzle wraps in `cause`. */
function postgresCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate.code;
    }
    current = candidate.cause;
  }
  return undefined;
}
