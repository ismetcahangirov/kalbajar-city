import { existsSync } from "node:fs";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { connect, databaseUrl } from "../src/db/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db, close } = connect(databaseUrl());

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied");
} finally {
  await close();
}
