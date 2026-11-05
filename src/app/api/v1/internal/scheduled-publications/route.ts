import { createHash, timingSafeEqual } from "node:crypto";

import { getDb } from "@/db";
import { publishScheduled } from "@/lib/admin/scheduled";
import { handler } from "@/lib/api/handler";
import { apiError } from "@/lib/api/errors";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Whether the request carries `Authorization: Bearer <CRON_SECRET>`. Without
 * a configured secret nothing is accepted. Compared in constant time.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return token !== "" && timingSafeEqual(digest(token), digest(secret));
}

/**
 * Publishes the news and construction updates whose scheduled time has come
 * and revalidates the cached public pages (#25). A cron calls it every few
 * minutes: Vercel Cron sends `GET` with `Authorization: Bearer $CRON_SECRET`,
 * any other scheduler can send the same as `GET` or `POST`, e.g.
 * `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/v1/internal/scheduled-publications`.
 * Answers with the ids it published.
 */
const run = handler({}, ({ request }) => {
  if (!authorized(request))
    return apiError(401, "UNAUTHORIZED", "A valid cron secret is required.");
  return publishScheduled(getDb(), { headers: request.headers });
});

export const GET = run;
export const POST = run;
