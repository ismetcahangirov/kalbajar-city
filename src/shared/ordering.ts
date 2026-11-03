import { z } from "zod";

/**
 * `PUT .../order`: every row of an ordered list, by id, in the new order. The
 * list must name each row exactly once, so a reorder sent from a stale screen
 * is refused instead of silently dropping a row someone else added.
 */
export const orderSchema = z.object({
  ids: z
    .array(z.uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "An item may appear only once"),
});

export type Order = z.input<typeof orderSchema>;

/** `items` with the one at `from` moved to `to`, as a new array. */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Whether `ids` names exactly the rows in `current`, each once. */
export function sameMembers(current: readonly string[], ids: readonly string[]): boolean {
  if (current.length !== ids.length) return false;
  const known = new Set(current);
  return ids.every((id) => known.has(id));
}
