import { afterAll, inject } from "vitest";

import { connect, type Database } from "@/db/client";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const { db, close } = connect(inject("databaseUrl"));

afterAll(close);

class Rollback extends Error {}

/**
 * Runs a test inside a transaction that is always rolled back, so every test
 * starts from the empty, migrated database and creates its own fixtures.
 */
export async function inRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/**
 * Asserts that the statement fails on the named constraint. It runs in a
 * savepoint, so the surrounding test transaction stays usable.
 */
export async function violates(
  tx: Tx,
  constraint: string,
  statement: (sp: Tx) => Promise<unknown>,
): Promise<void> {
  let caught: unknown;
  try {
    await tx.transaction(async (sp) => {
      await statement(sp);
    });
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error(`Expected a violation of ${constraint}, but the write succeeded`);
  const name = constraintOf(caught);
  if (name !== constraint) {
    throw new Error(`Expected a violation of ${constraint}, got ${name ?? String(caught)}`);
  }
}

function constraintOf(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const candidate = current as { constraint_name?: unknown; code?: unknown; cause?: unknown };
    if (typeof candidate.constraint_name === "string") return candidate.constraint_name;
    // Invalid enum input has no constraint name; report the SQLSTATE instead.
    if (candidate.code === "22P02") return "invalid_enum_value";
    current = candidate.cause;
  }
  return undefined;
}
