import { existsSync } from "node:fs";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

import { connect } from "../../src/db/client";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Database tests run against their own database, `<name>_test` next to
 * `DATABASE_URL` (or `TEST_DATABASE_URL`), so they never touch development
 * data. It is created when missing and migrated from scratch on every run.
 */
export default async function setup(project: TestProject) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const base = process.env.DATABASE_URL;
  if (!process.env.TEST_DATABASE_URL && !base) {
    throw new Error("Set DATABASE_URL or TEST_DATABASE_URL to run the database tests");
  }
  const url = new URL(process.env.TEST_DATABASE_URL ?? base!);
  if (!process.env.TEST_DATABASE_URL) url.pathname = `${url.pathname}_test`;
  const name = decodeURIComponent(url.pathname.slice(1));

  const admin = postgres({ ...parse(url), database: "postgres", max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const { db, close } = connect(url.toString());
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await close();
  }

  project.provide("databaseUrl", url.toString());
}

function parse(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
