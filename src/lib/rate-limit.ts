/**
 * A fixed-window rate limiter held in memory. Production runs one standalone
 * Node process, so one map sees every request; more than one process (or
 * instance) would each count on their own and need a shared store instead.
 *
 * The key is usually the client's IP from `clientIp()`, which trusts the
 * first `X-Forwarded-For` entry: the reverse proxy in front of the app must
 * overwrite that header, never append a client-supplied one (see #13).
 */

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; /** Whole seconds until the window resets. */ retryAfter: number };

export type RateLimiter = {
  /** Counts one request for `key` and says whether it may go ahead. */
  hit(key: string, now?: number): RateLimitResult;
  /** Forgets every key, for tests. */
  reset(): void;
  readonly size: number;
};

type Window = { start: number; count: number };

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  /** The map never holds more keys, so a flood of addresses cannot exhaust memory. */
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  function evict(now: number) {
    for (const [key, window] of windows) {
      if (now - window.start >= windowMs) windows.delete(key);
    }
    // Still full: drop the oldest windows. Map keeps insertion order, and a
    // window is re-inserted when it starts again, so the first is the oldest.
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    hit(key, now = Date.now()) {
      let window = windows.get(key);
      if (!window || now - window.start >= windowMs) {
        windows.delete(key);
        if (windows.size >= maxKeys) evict(now);
        window = { start: now, count: 0 };
        windows.set(key, window);
      }
      window.count += 1;
      if (window.count > limit) {
        return {
          ok: false,
          retryAfter: Math.max(1, Math.ceil((window.start + windowMs - now) / 1000)),
        };
      }
      return { ok: true, remaining: limit - window.count };
    },
    reset() {
      windows.clear();
    },
    get size() {
      return windows.size;
    },
  };
}
