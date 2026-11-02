/** Baku is UTC+4 all year; Azerbaijan dropped daylight saving time in 2016. */
const bakuOffset = 4 * 60 * 60 * 1000;

/** Monday 00:00 in Baku of the week `now` falls in: the start of "this week". */
export function weekStart(now: Date): Date {
  const baku = new Date(now.getTime() + bakuOffset);
  const sinceMonday = (baku.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(baku.getUTCFullYear(), baku.getUTCMonth(), baku.getUTCDate());
  return new Date(midnight - sinceMonday * 24 * 60 * 60 * 1000 - bakuOffset);
}
