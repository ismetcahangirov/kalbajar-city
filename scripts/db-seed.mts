import { existsSync } from "node:fs";

import { connect, databaseUrl } from "../src/db/client";
import { seed } from "../src/db/seed";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db, close } = connect(databaseUrl());

try {
  const report = await seed(db);
  console.log("Seeded (rows inserted, 0 means already present):");
  console.table(report);
} finally {
  await close();
}
