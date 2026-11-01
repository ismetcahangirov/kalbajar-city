import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/** The database or a transaction on it: what a function that only runs queries needs. */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/**
 * A connection for scripts and tests. The application goes through `getDb()`
 * in `@/db`, which is server-only and reuses one pool per process.
 */
export function connect(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 1, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as Database, close: () => client.end() };
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return url;
}
