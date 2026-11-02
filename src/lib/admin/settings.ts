import "server-only";

import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { settings } from "@/db/schema";
import { HttpError, notFound } from "@/lib/api/errors";
import { fieldErrors } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import {
  settingsSchemas,
  type AdminSetting,
  type EditableSettingsKey,
  type SettingsKey,
  type SettingsValue,
} from "@/shared/settings";

import { clearChangedPlaceholders } from "./placeholders";

/** One settings row, as stored; the seed writes every key. */
export async function getSetting<K extends SettingsKey>(
  db: Executor,
  key: K,
): Promise<AdminSetting<K>> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) throw notFound("No such setting.");
  return {
    key,
    value: row.value as SettingsValue<K>,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Replaces a settings value with one that matches its key's schema, audited in
 * the same transaction, then revalidates every public page that reads
 * settings (contacts, the facts, the map). The stand-ins the save changed lose
 * their placeholder flag in the same transaction (#27).
 */
export async function updateSetting<K extends EditableSettingsKey>(
  db: Executor,
  { key, value, user, headers }: { key: K; value: unknown; user: SessionUser; headers: Headers },
): Promise<AdminSetting<K>> {
  const parsed = settingsSchemas[key].safeParse(value);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "VALIDATION_FAILED",
      "The request has invalid fields.",
      fieldErrors(parsed.error),
    );
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(settings).where(eq(settings.key, key)).for("update");
    const [after] = await tx
      .insert(settings)
      .values({ key, value: parsed.data, updatedBy: user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed.data, updatedBy: user.id, updatedAt: new Date() },
      })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "settings.update",
      entityType: "settings",
      entityId: key,
      before: before ? { value: before.value } : null,
      after: { value: after!.value },
      headers,
    });
    await clearChangedPlaceholders(tx, {
      scope: key,
      before: before?.value,
      after: after!.value,
      user,
      headers,
    });
    return getSetting(tx, key);
  });

  revalidatePublic(publicTags.settings);
  return result;
}
