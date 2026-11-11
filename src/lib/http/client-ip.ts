import { z } from "zod";

/**
 * The one rule for the client's IP address, used by the lead rate limit, the
 * audit log and Better Auth (its rate limit and the sessions' IP).
 *
 * Production runs behind Cloudflare, then Coolify's proxy. Cloudflare appends
 * to an `X-Forwarded-For` the client sent, so its first entry is whatever the
 * client chose. `TRUSTED_CLIENT_IP_HEADER` names the one header the edge sets
 * itself (`cf-connecting-ip`). When it is set, only that header is read: a
 * request without it, or with a value that is not one IP address, has an
 * unknown client, never one taken from a header the client controls. That
 * header is trustworthy only while Cloudflare is the only way to the origin
 * (docs/runbooks/deploy.md §9).
 *
 * Unset (development, CI), the first `X-Forwarded-For` entry is read, then
 * `X-Real-IP`, as before.
 */

/** An HTTP header name (RFC 9110 token), stored lower-case as `Headers` does. */
const headerName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9!#$%&'*+.^_`|~-]+$/, "must be an HTTP header name, e.g. cf-connecting-ip");

const envSchema = z.object({
  TRUSTED_CLIENT_IP_HEADER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    headerName.optional(),
  ),
});

const ipAddress = z.union([z.ipv4(), z.ipv6()]);

type Env = Record<string, string | undefined>;

/**
 * The header that alone carries the client's IP, or `null` when none is
 * configured. Throws when `TRUSTED_CLIENT_IP_HEADER` is not a header name.
 */
export function trustedClientIpHeader(env: Env = process.env): string | null {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? "invalid";
    throw new Error(`TRUSTED_CLIENT_IP_HEADER is invalid: ${issue} (see .env.example)`);
  }
  return parsed.data.TRUSTED_CLIENT_IP_HEADER ?? null;
}

function asIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && ipAddress.safeParse(trimmed).success ? trimmed : null;
}

let missingHeaderWarned = false;

/**
 * The client's IP address, or `null` when it cannot be known. Callers that
 * need a key (a rate limit) use `clientKey()`, which never lets an unknown
 * client go uncounted.
 */
export function clientIp(
  headers: Headers | null | undefined,
  env: Env = process.env,
): string | null {
  const trusted = trustedClientIpHeader(env);
  if (!headers) return null;
  if (trusted) {
    const ip = asIp(headers.get(trusted));
    if (!ip && !missingHeaderWarned) {
      missingHeaderWarned = true;
      console.warn(
        `No valid ${trusted} header on a request: the client IP is unknown. Is every request coming through the edge?`,
      );
    }
    return ip;
  }
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0];
  return asIp(forwarded) ?? asIp(headers.get("x-real-ip"));
}

/** The rate-limit key every client without a known IP shares. */
export const unknownClientKey = "unknown";

/**
 * A rate-limit key for the request: its IP, or one bucket shared by every
 * client whose IP is unknown, so a missing header limits rather than exempts.
 */
export function clientKey(headers: Headers | null | undefined, env: Env = process.env): string {
  return clientIp(headers, env) ?? unknownClientKey;
}
