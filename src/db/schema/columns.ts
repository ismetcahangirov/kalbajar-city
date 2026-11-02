import { jsonb, numeric, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { Translatable } from "@/i18n/content";
import type { TranslatableRichText } from "@/shared/rich-text";

import { users } from "./auth";

export const publishStatus = pgEnum("publish_status", ["draft", "published"]);

export const id = () => uuid("id").primaryKey().defaultRandom();

/** Translatable text, `{ az, en, ru }` (`CLAUDE.md` §3). */
export const translatable = (name: string) => jsonb(name).$type<Translatable>();

export const translatableRichText = (name: string) => jsonb(name).$type<TranslatableRichText>();

/** Azerbaijani slug, unique per entity. */
export const slug = () => text("slug").notNull().unique();

/** Areas are `numeric(8,2)` (`CLAUDE.md` §4). Drizzle returns them as strings. */
export const area = (name: string) => numeric(name, { precision: 8, scale: 2 });

/**
 * A user, by Better Auth's text id. Removing the user clears the column, except
 * where the history must keep its author: the audit log passes `restrict`, so
 * an account that has acted can only be deactivated.
 */
export const userId = (name: string, onDelete: "set null" | "restrict" = "set null") =>
  text(name).references(() => users.id, { onDelete });

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
