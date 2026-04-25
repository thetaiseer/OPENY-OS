/**
 * Central upload limits for R2-backed flows (API routes + docs).
 *
 * Cloudflare R2 itself does not enforce a small object cap; limits here are
 * only for platform safety (request body size) and optional org policy.
 */

import { checkRateLimit, type RateLimitResult } from '@/lib/rate-limit';
import { getMultipartThresholdBytesFromEnv } from '@/lib/upload-config-shared';

const HOUR_MS = 60 * 60_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/**
 * Maximum upload size in bytes. 0 = no limit (multipart can stream arbitrarily
 * large objects subject to R2 / platform timeouts).
 */
export function getMaxUploadBytes(): number {
  const gb = parsePositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_GB, 0);
  if (gb === 0) return 0;
  return gb * 1024 ** 3;
}

/** Same threshold as the browser upload queue (see `upload-config-shared`). */
export function getMultipartThresholdBytes(): number {
  return getMultipartThresholdBytesFromEnv();
}

/**
 * Per-user sliding-window cap on presign + multipart-init combined, per hour.
 * Set to 0 to disable (recommended only behind your own edge protection).
 * Default 10_000 — high enough for normal bulk uploads without hitting 60/hour.
 */
export function checkUploadHourlyLimit(userId: string): RateLimitResult {
  const raw = process.env.UPLOAD_RATE_LIMIT_PER_HOUR?.trim();
  const limit = raw === undefined || raw === '' ? 10_000 : parsePositiveInt(raw, 10_000);
  if (limit <= 0) {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: Date.now() + HOUR_MS,
    };
  }
  return checkRateLimit(`upload:user:${userId}`, { limit, windowMs: HOUR_MS });
}

export function uploadSizeExceededMessage(maxBytes: number): string {
  const gb = maxBytes / 1024 ** 3;
  return `File exceeds the configured maximum size (${gb.toFixed(0)} GB). Raise UPLOAD_MAX_FILE_SIZE_GB or set it to 0 for no cap.`;
}
