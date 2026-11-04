/** A shallow copy of `object` without `keys`: the rest props of a polymorphic component. */
export function omit<T extends object, K extends keyof T>(
  object: T,
  keys: readonly K[],
): Omit<T, K> {
  const copy: Partial<T> = { ...object };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}
