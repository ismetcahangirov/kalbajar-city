// Anonymises leads whose last activity is older than the retention period in
// the console's settings (settings.leads.retentionMonths, 24 by default).
//
//   pnpm leads:retention --dry-run   lists what would be anonymised
//   pnpm leads:retention             anonymises, audited as the system
//
// Safe to run again: anonymised leads are never touched twice. Production
// runs it on a schedule (daily is plenty); see the deployment notes (#13).
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

import { connect, databaseUrl } from "../src/db/client";
import { anonymiseStaleLeads } from "../src/lib/leads/retention";

if (existsSync(".env")) process.loadEnvFile(".env");

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const dryRun = values["dry-run"] ?? false;

const { db, close } = connect(databaseUrl());
try {
  const report = await anonymiseStaleLeads(db, { dryRun });
  const cutoff = report.cutoff.toISOString();
  console.log(`Retention: ${report.retentionMonths} months; leads last active before ${cutoff}.`);
  console.log(
    dryRun
      ? `Dry run: ${report.ids.length} lead(s) would be anonymised. Nothing was changed.`
      : `Anonymised ${report.ids.length} lead(s).`,
  );
  for (const id of report.ids) console.log(`  ${id}`);
} finally {
  await close();
}
