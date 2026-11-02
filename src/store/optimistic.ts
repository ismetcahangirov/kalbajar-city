/** What `api.util.updateQueryData` returns when dispatched. */
export type CachePatch = { undo: () => void };

/**
 * An optimistic update: the patches are already applied to the cache, so the
 * screen shows the change at once; if the request fails they are undone, in
 * reverse order. Use it in `onQueryStarted` only where the server cannot end
 * up with something else than the patch shows (a status change, not a slug
 * the server derives), and keep `invalidatesTags`, so the refetch settles the
 * truth either way.
 */
export async function undoOnFailure(
  queryFulfilled: Promise<unknown>,
  patches: CachePatch[],
): Promise<void> {
  try {
    await queryFulfilled;
  } catch {
    for (const patch of [...patches].reverse()) patch.undo();
  }
}
