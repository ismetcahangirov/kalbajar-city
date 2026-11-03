import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { redirects } from "@/db/schema";
import { legacyRedirects } from "@/config/legacy-redirects";
import { HttpError, invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { siteOrigin } from "@/lib/seo/url";
import {
  analyzeRedirect,
  internalPath,
  normalizeDestination,
  normalizePath,
  type AdminRedirect,
  type RedirectChainDetails,
  type RedirectCreateParsed,
  type RedirectEdge,
  type RedirectLoopDetails,
  type RedirectStatus,
} from "@/shared/redirects";

/*
 * Redirects are served by `src/proxy.ts` from its own short-lived copy of the
 * table (`@/lib/redirects/serve`), not from a cached page, so a write here
 * has no server `cacheTag` to revalidate: the proxy picks it up within its
 * refresh interval.
 */

type Write = { user: SessionUser; headers: Headers };

type Row = typeof redirects.$inferSelect;

function toAdmin(row: Row, sources: ReadonlySet<string>): AdminRedirect {
  const next = internalPath(row.toPath);
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    statusCode: row.statusCode as RedirectStatus,
    hits: row.hits,
    lastHitAt: row.lastHitAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    chained: next !== null && sources.has(next),
  };
}

const legacySources = new Set(legacyRedirects.map(({ from }) => normalizePath(from)));

/** The redirects `next.config.ts` serves; they take part in loop detection. */
const legacyEdges: RedirectEdge[] = legacyRedirects.map(({ from, to }) => ({ from, to }));

export async function listRedirects(db: Executor): Promise<AdminRedirect[]> {
  const rows = await db.select().from(redirects).orderBy(asc(redirects.fromPath));
  const sources = new Set([...rows.map((row) => row.fromPath), ...legacySources]);
  return rows.map((row) => toAdmin(row, sources));
}

async function getRedirect(db: Executor, id: string): Promise<AdminRedirect> {
  const item = (await listRedirects(db)).find((row) => row.id === id);
  if (!item) throw notFound("No such redirect.");
  return item;
}

/** An absolute URL on this very site is stored as its path, so loops through it are seen. */
function sameSite(destination: string): string {
  if (destination.startsWith("/")) return destination;
  const url = new URL(destination);
  if (url.origin !== new URL(siteOrigin()).origin) return destination;
  return normalizeDestination(`${url.pathname}${url.search}${url.hash}`);
}

/**
 * Creates (`id` absent) or replaces a redirect. Refuses a loop with 422
 * `REDIRECT_LOOP` and a chain with 409 `REDIRECT_CHAIN`, unless
 * `resolveChains` asks to point the chain's redirects at its final
 * destination instead. The table is locked for the check, so two saves cannot
 * build a loop between them.
 */
export async function saveRedirect(
  db: Executor,
  { id, input, user, headers }: Write & { id?: string; input: RedirectCreateParsed },
): Promise<AdminRedirect> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
    const rows = await tx.select().from(redirects);
    const before = id ? rows.find((row) => row.id === id) : undefined;
    if (id && !before) throw notFound("No such redirect.");

    const fromPath = input.fromPath;
    let toPath = sameSite(input.toPath);
    if (legacySources.has(fromPath)) throw invalidField("fromPath", "redirects.error.legacy");
    if (rows.some((row) => row.fromPath === fromPath && row.id !== id)) {
      throw invalidField("fromPath", "redirects.error.taken");
    }
    if (internalPath(toPath) === fromPath) throw invalidField("toPath", "redirects.error.self");

    const edges: RedirectEdge[] = [
      ...legacyEdges,
      ...rows.map((row) => ({ id: row.id, from: row.fromPath, to: row.toPath })),
    ];
    const analysis = analyzeRedirect(edges, { id, from: fromPath, to: toPath });
    if (analysis.kind === "loop") {
      const details: RedirectLoopDetails = { cycle: analysis.cycle };
      throw new HttpError(
        422,
        "REDIRECT_LOOP",
        "The redirect would send visitors round in a loop.",
        { toPath: ["redirects.error.loop"] },
        details,
      );
    }

    const chained = analysis.hops.length > 2 || analysis.incoming.length > 0;
    if (chained && !input.resolveChains) {
      const details: RedirectChainDetails = {
        hops: analysis.hops,
        incoming: analysis.incoming.map((edge) => edge.from),
        final: analysis.final,
      };
      throw new HttpError(
        409,
        "REDIRECT_CHAIN",
        "The redirect would form a chain; resend with resolveChains to point it at the final destination.",
        undefined,
        details,
      );
    }
    if (chained) toPath = analysis.final;

    const values = { fromPath, toPath, statusCode: input.statusCode };
    const [after] = before
      ? await tx.update(redirects).set(values).where(eq(redirects.id, before.id)).returning()
      : await tx.insert(redirects).values(values).returning();
    await audit(tx, {
      actorId: user.id,
      action: before ? "redirect.update" : "redirect.create",
      entityType: "redirect",
      entityId: after!.id,
      before: before ? pick(before) : null,
      after: pick(after!),
      headers,
    });

    // The redirects that led to the old source now lead straight to the end.
    for (const edge of chained ? analysis.incoming : []) {
      const old = rows.find((row) => row.id === edge.id)!;
      const [updated] = await tx
        .update(redirects)
        .set({ toPath })
        .where(eq(redirects.id, old.id))
        .returning();
      await audit(tx, {
        actorId: user.id,
        action: "redirect.update",
        entityType: "redirect",
        entityId: old.id,
        before: pick(old),
        after: pick(updated!),
        headers,
      });
    }

    return getRedirect(tx, after!.id);
  });
}

export async function deleteRedirect(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.delete(redirects).where(eq(redirects.id, id)).returning();
    if (!before) throw notFound("No such redirect.");
    await audit(tx, {
      actorId: user.id,
      action: "redirect.delete",
      entityType: "redirect",
      entityId: id,
      before: pick(before),
      after: null,
      headers,
    });
  });
}

/** What the audit log keeps of a redirect: not its counters, which change on every visit. */
function pick(row: Row) {
  return { fromPath: row.fromPath, toPath: row.toPath, statusCode: row.statusCode };
}
