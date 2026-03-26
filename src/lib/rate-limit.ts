/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-process deployments (dev + single-instance prod).
 * For multi-instance prod, swap the store for Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Prune expired buckets periodically to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (only set when allowed=false) */
  retryAfter: number;
}

/**
 * @param key      Unique identifier for the action (e.g. "login:1.2.3.4")
 * @param max      Maximum requests allowed within the window
 * @param windowMs Window length in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}
