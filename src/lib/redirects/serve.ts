import { eq, sql } from "drizzle-orm";
import type { NextFetchEvent } from "next/server";

import { connect, type Database } from "@/db/client";
import { redirects } from "@/db/schema";
import { normalizePath } from "@/shared/redirects";

/*
 * Serves the console's redirects (#27) from `src/proxy.ts`, so a redirect
 * added in the console works without a deploy.
 *
 * Public pages must stay fast, so the proxy never queries the database on
 * the request path. Each server process keeps the whole table (a few dozen
 * rows) in memory and looks the path up in a Map. The copy is refreshed in
 * the background once it is older than `refreshAfterMs`: the request that
 * notices is answered from the old copy and the reload runs in `waitUntil`.
 * Only a process's very first request waits for the load, at most
 * `firstLoadTimeoutMs`. A console save therefore reaches visitors within a
 * few seconds on every instance, with no cross-process signalling; the hit
 * counter is written after the response, also in `waitUntil`.
 *
 * The proxy does not share module state with route handlers (Next's proxy
 * docs), so the console cannot clear this copy directly; the refresh
 * interval is the bound instead. If the database is unreachable the proxy
 * keeps the last copy it had (or none) and the site carries on.
 */

export type RedirectTarget = { id: string; to: string; status: number };

export type RedirectTable = ReadonlyMap<string, RedirectTarget>;

export const refreshAfterMs = 5_000;
const firstLoadTimeoutMs = 1_500;

/**
 * Where `url` should go, or `null`. A destination without a query string
 * keeps the request's (`/kohne?utm_source=x` → `/yeni?utm_source=x`). A path
 * on this site comes back relative; `redirectFor` resolves it against the
 * request URL, as Next requires an absolute `Location` from the proxy.
 */
export function resolveRedirect(
  table: RedirectTable,
  url: Pick<URL, "pathname" | "search">,
): { id: string; location: string; status: number } | null {
  const target = table.get(normalizePath(url.pathname));
  if (!target) return null;
  const carry = url.search && !/[?#]/.test(target.to);
  if (target.to.startsWith("/")) {
    const location = new URL(target.to, "http://site.invalid");
    return {
      id: target.id,
      location: `${location.pathname}${carry ? url.search : location.search}${location.hash}`,
      status: target.status,
    };
  }
  const location = new URL(target.to);
  if (carry) location.search = url.search;
  return { id: target.id, location: location.toString(), status: target.status };
}

type State = {
  table: RedirectTable | null;
  loadedAt: number;
  loading: Promise<void> | null;
  db: Database | null;
};

const state: State = { table: null, loadedAt: 0, loading: null, db: null };

function database(): Database | null {
  if (state.db) return state.db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  state.db = connect(url, { max: 2 }).db;
  return state.db;
}

async function load(): Promise<void> {
  try {
    const db = database();
    if (!db) {
      state.table = new Map();
      return;
    }
    const rows = await db
      .select({
        id: redirects.id,
        from: redirects.fromPath,
        to: redirects.toPath,
        status: redirects.statusCode,
      })
      .from(redirects);
    state.table = new Map(
      rows.map((row) => [normalizePath(row.from), { id: row.id, to: row.to, status: row.status }]),
    );
  } catch (error) {
    console.error("Redirects could not be loaded; serving the last copy.", error);
    state.table ??= new Map();
  } finally {
    state.loadedAt = Date.now();
    state.loading = null;
  }
}

async function currentTable(event: NextFetchEvent): Promise<RedirectTable> {
  if (!state.table) {
    state.loading ??= load();
    await Promise.race([
      state.loading,
      new Promise((resolve) => setTimeout(resolve, firstLoadTimeoutMs)),
    ]);
    return state.table ?? new Map();
  }
  if (Date.now() - state.loadedAt > refreshAfterMs && !state.loading) {
    state.loading = load();
    event.waitUntil(state.loading);
  }
  return state.table;
}

async function recordHit(id: string): Promise<void> {
  try {
    await database()
      ?.update(redirects)
      // A visit is not an edit: `updated_at` stays as the console left it.
      .set({
        hits: sql`${redirects.hits} + 1`,
        lastHitAt: new Date(),
        updatedAt: sql`${redirects.updatedAt}`,
      })
      .where(eq(redirects.id, id));
  } catch (error) {
    console.error("A redirect hit could not be counted.", error);
  }
}

/**
 * The redirect response for the request, or `null` to carry on. `url` is
 * the proxy's `request.nextUrl`, whose origin is the one the visitor asked
 * for, the same base next-intl's own redirects use.
 */
export async function redirectFor(
  url: Pick<URL, "pathname" | "search" | "href">,
  event: NextFetchEvent,
): Promise<Response | null> {
  const match = resolveRedirect(await currentTable(event), url);
  if (!match) return null;
  event.waitUntil(recordHit(match.id));
  return new Response(null, {
    status: match.status,
    headers: { Location: new URL(match.location, url.href).toString() },
  });
}
