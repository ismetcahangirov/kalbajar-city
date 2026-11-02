import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps, translatable, userId } from "./columns";
import { media } from "./media";

/** Key/value settings; each key's value shape is `settingsSchemas[key]` in `@/shared/settings`. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: userId("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Per-page metadata overrides, keyed by the Azerbaijani path without a locale prefix. */
export const seoOverrides = pgTable(
  "seo_overrides",
  {
    id: id(),
    path: text("path").notNull().unique(),
    title: translatable("title"),
    description: translatable("description"),
    ogMediaId: uuid("og_media_id").references(() => media.id, { onDelete: "restrict" }),
    noindex: boolean("noindex").notNull().default(false),
    ...timestamps,
  },
  (t) => [check("seo_overrides_path", sql`${t.path} like '/%'`)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    statusCode: smallint("status_code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("redirects_status_code", sql`${t.statusCode} in (301, 302, 307, 308)`),
    check("redirects_from_path", sql`${t.fromPath} like '/%'`),
    check("redirects_not_self", sql`${t.fromPath} <> ${t.toPath}`),
  ],
);

/**
 * Every privileged write (`CLAUDE.md` §4). Rows are only ever inserted; the
 * console reads them.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: userId("actor_id", "restrict"),
    /** `<entity>.<verb>`, e.g. `apartment.update`. */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);
