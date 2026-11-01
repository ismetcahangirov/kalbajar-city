import "server-only";

import { connect, databaseUrl, type Database } from "./client";

const globalForDb = globalThis as unknown as { db?: Database };

/**
 * The application's database. Call it inside a component or handler that has
 * already awaited `connection()`, never at module scope, so `next build` never
 * needs a database (`CLAUDE.md` §4).
 */
export function getDb(): Database {
  globalForDb.db ??= connect(databaseUrl(), { max: 10 }).db;
  return globalForDb.db;
}

export type { Database };
