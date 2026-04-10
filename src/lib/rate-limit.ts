/**
 * src/lib/rate-limit.ts
 *
 * Lightweight in-memory sliding-window rate limiter for Next.js API routes.
 * Designed for serverless/Vercel deployments where each worker process is
 * isolated — the limit is per-worker, which is appropriate for burst
 * protection rather than exact global throttling.
 *
 * Usage:
 *   const result = checkRateLimit('user:' + userId, { limit: 20, windowMs: 60_000 });
 *   if (!result.allowed) {
 *     return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
 *   }
 */

interface RateLimitEntry {
  timestamps: number[];
}

// Global store — shared across all invocations in the same worker process
const store = new Map<string, RateLimitEntry>();

// Cleanup runs every ~5 minutes to avoid unbounded growth
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests remain in the current window. */
  remaining: number;
  /** Timestamp (ms) when the oldest request in the window expires. */
  resetAt: number;
}

/**
 * Check whether the given key has exceeded the rate limit.
 * Mutates the store — call once per request.
 *
 * @param key   Unique identifier for the rate-limit bucket.
 *              Suggested patterns:
 *                - 'ai:user:<userId>'
 *                - 'upload:user:<userId>'
 *                - 'ai:ip:<ip>'
 * @param opts  Rate limit configuration.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const { limit, windowMs = 60_000 } = opts;
  const now = Date.now();

  cleanup(windowMs);

  const entry = store.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  const allowed = entry.timestamps.length < limit;

  if (allowed) {
    entry.timestamps.push(now);
    store.set(key, entry);
  }

  const resetAt =
    entry.timestamps.length > 0
      ? entry.timestamps[0] + windowMs
      : now + windowMs;

  return {
    allowed,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetAt,
  };
}

/**
 * Extract the best available client IP from a Next.js request.
 * Vercel sets 'x-forwarded-for'; falls back to 'x-real-ip'.
 */
export function getClientIp(request: { headers: { get: (name: string) => string | null } }): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
