import "server-only";

import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { settings } from "@/db/schema";
import { forbiddenError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import {
  changedPlaceholders,
  homeSectionScope,
  placeholdersSchema,
  scopeOf,
} from "@/shared/placeholders";
import { editableSettingsKeys } from "@/shared/settings";

/** The paths still flagged as stand-ins (`settings.placeholders`); none when the row is missing. */
export async function getPlaceholders(db: Executor): Promise<string[]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "placeholders"));
  return placeholdersSchema.safeParse(row?.value).data?.paths ?? [];
}

type Actor = { user: SessionUser; headers: Headers };

/** Locks the row, writes the remaining paths and audits the change. */
async function writePlaceholders(
  tx: Executor,
  remove: (paths: string[]) => string[],
  { user, headers, action }: Actor & { action: string },
): Promise<string[]> {
  const [row] = await tx
    .select()
    .from(settings)
    .where(eq(settings.key, "placeholders"))
    .for("update");
  const before = placeholdersSchema.safeParse(row?.value).data?.paths ?? [];
  const removed = new Set(remove(before));
  if (!removed.size) return before;

  const value = { paths: before.filter((path) => !removed.has(path)) };
  await tx
    .update(settings)
    .set({ value, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(settings.key, "placeholders"));
  await audit(tx, {
    actorId: user.id,
    action,
    entityType: "settings",
    entityId: "placeholders",
    before: { value: { paths: before } },
    after: { value },
    headers,
  });
  return value.paths;
}

/**
 * Drops the flag of every stand-in in `scope` that a save changed, in the
 * save's own transaction: once someone writes a value of their own, it is no
 * longer a placeholder. Fields the save left as they were stay flagged.
 */
export function clearChangedPlaceholders(
  tx: Executor,
  { scope, before, after, ...actor }: Actor & { scope: string; before: unknown; after: unknown },
): Promise<string[]> {
  return writePlaceholders(tx, (paths) => changedPlaceholders(paths, scope, before, after), {
    ...actor,
    action: "settings.update",
  });
}

/** Whether the user may change the values in a placeholder's scope. */
function mayChange(user: SessionUser, path: string): boolean {
  const scope = scopeOf(path);
  if (editableSettingsKeys.some((key) => key === scope)) {
    return can(user.role, { settings: ["update"] });
  }
  if (scope === homeSectionScope("location")) return can(user.role, { content: ["update"] });
  return false;
}

/**
 * Accepts stand-ins as real values without changing them: the owner checked
 * the hours and they are right. Each path needs the permission that saving its
 * value needs; paths that are not flagged are ignored. Answers the paths
 * still flagged.
 */
export async function confirmPlaceholders(
  db: Executor,
  { paths, ...actor }: Actor & { paths: string[] },
): Promise<string[]> {
  const forbidden = paths.filter((path) => !mayChange(actor.user, path));
  if (forbidden.length) throw forbiddenError();
  return db.transaction((tx) =>
    writePlaceholders(tx, (flagged) => flagged.filter((path) => paths.includes(path)), {
      ...actor,
      action: "settings.placeholder_confirm",
    }),
  );
}
