import { z } from "zod";

/*
 * Redirects managed in the console (#27). The endpoints parse with these
 * schemas and the console's form validates with the same ones. Refinement
 * messages are console catalogue keys (`@/lib/admin/messages`), which the
 * form shows in Azerbaijani.
 */

export const redirectStatusCodes = [301, 302] as const;

export type RedirectStatus = (typeof redirectStatusCodes)[number];

/**
 * A path as the proxy compares it: decoded (`/köhnə`, not `/k%C3%B6hn%C9%99`)
 * and without a trailing slash, except the root itself.
 */
export function normalizePath(value: string): string {
  let path = value.trim();
  try {
    path = decodeURI(path);
  } catch {
    // A malformed escape stays as typed; it simply matches nothing.
  }
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

/**
 * Whether `src/proxy.ts` sees a request for the path at all. Its matcher
 * leaves out paths starting with `api`, `admin`, `_next` or `_vercel` and any
 * path with a dot (files), so a redirect from one of them would never fire.
 */
export function proxySeesPath(path: string): boolean {
  return !/^\/(api|admin|_next|_vercel)/.test(path) && !path.includes(".");
}

const unsafe = /[\s\\]/;

/** Where a source may point: a path on this site or an absolute http(s) URL. */
export function isValidDestination(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !unsafe.test(value);
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !unsafe.test(value);
  } catch {
    return false;
  }
}

/**
 * The normalised path a destination leads to on this site, or `null` for an
 * external URL. The query and fragment do not take part in matching.
 */
export function internalPath(destination: string): string | null {
  if (!destination.startsWith("/") || destination.startsWith("//")) return null;
  return normalizePath(destination.split(/[?#]/)[0] ?? "/");
}

/** A destination as stored: a path loses its trailing slash, a URL stays as typed. */
export function normalizeDestination(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return trimmed;
  const at = trimmed.search(/[?#]/);
  if (at === -1) return normalizePath(trimmed);
  return `${normalizePath(trimmed.slice(0, at))}${trimmed.slice(at)}`;
}

export const redirectSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "redirects.error.slash")
  .refine((value) => !/[?#]/.test(value) && !unsafe.test(value), "redirects.error.sourceQuery")
  .transform(normalizePath)
  .refine((value) => value !== "/", "redirects.error.home")
  .refine(proxySeesPath, "redirects.error.reserved");

export const redirectDestinationSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(isValidDestination, "redirects.error.destination")
  .transform(normalizeDestination);

const statusSchema = z
  .union([z.literal(301), z.literal(302), z.literal("301"), z.literal("302")])
  .transform((value) => Number(value) as RedirectStatus);

export const redirectCreateSchema = z.object({
  fromPath: redirectSourceSchema,
  toPath: redirectDestinationSchema,
  statusCode: statusSchema,
  /**
   * When the redirect would form a chain (A → B → C), point every redirect
   * of it at the final destination instead of refusing with `REDIRECT_CHAIN`.
   */
  resolveChains: z.boolean().optional(),
});

export type RedirectCreate = z.input<typeof redirectCreateSchema>;
export type RedirectCreateParsed = z.output<typeof redirectCreateSchema>;

export const redirectUpdateSchema = redirectCreateSchema;

export const redirectIdParamsSchema = z.object({ id: z.uuid() });

/** A redirect as the console lists it. */
export type AdminRedirect = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: RedirectStatus;
  hits: number;
  lastHitAt: string | null;
  updatedAt: string;
  /** Its destination is itself redirected: visitors take more than one hop. */
  chained: boolean;
};

/** The details of a `REDIRECT_CHAIN` error. */
export type RedirectChainDetails = {
  /** The hops from the new source on: `[source, destination, next, …]`. */
  hops: string[];
  /** Sources that already point at the new source. */
  incoming: string[];
  /** Where every one of them would point once the chain is resolved. */
  final: string;
};

/** The details of a `REDIRECT_LOOP` error: the paths, back to where it started. */
export type RedirectLoopDetails = { cycle: string[] };

export type RedirectEdge = {
  from: string;
  to: string;
  /** Set for database rows; legacy redirects from `next.config.ts` have none. */
  id?: string;
};

export type RedirectAnalysis =
  | { kind: "loop"; cycle: string[] }
  | {
      kind: "ok";
      /** `[source, destination, …]`; longer than two when the destination is redirected. */
      hops: string[];
      /** The destination visitors finally land on, as stored. */
      final: string;
      /** Database redirects that point at the candidate's source. */
      incoming: RedirectEdge[];
    };

/**
 * Follows `candidate` through the other redirects. A loop is any walk that
 * comes back to a path it has visited; a chain is a destination that is
 * itself a source, or other redirects pointing at the candidate's source.
 * `candidate.id` replaces the row it names (an edit).
 */
export function analyzeRedirect(edges: RedirectEdge[], candidate: RedirectEdge): RedirectAnalysis {
  const others = edges.filter((edge) => !candidate.id || edge.id !== candidate.id);
  const bySource = new Map<string, RedirectEdge>();
  for (const edge of others) bySource.set(normalizePath(edge.from), edge);
  const source = normalizePath(candidate.from);
  bySource.set(source, candidate);

  const path = [source];
  let destination = candidate.to;
  let next = internalPath(destination);
  while (next !== null) {
    if (path.includes(next)) return { kind: "loop", cycle: [...path, next] };
    const edge = bySource.get(next);
    if (!edge) break;
    path.push(next);
    destination = edge.to;
    next = internalPath(destination);
  }

  const incoming = others.filter(
    (edge) => edge.id !== undefined && internalPath(edge.to) === source,
  );
  return { kind: "ok", hops: [...path, destination], final: destination, incoming };
}
