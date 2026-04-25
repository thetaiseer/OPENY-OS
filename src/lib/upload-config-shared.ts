/**
 * Upload size thresholds shared by browser and server (no server-only imports).
 */

export function getMultipartThresholdBytesFromEnv(): number {
  const raw =
    (typeof process !== 'undefined' &&
      (process.env.UPLOAD_MULTIPART_THRESHOLD_MB ??
        process.env.NEXT_PUBLIC_UPLOAD_MULTIPART_THRESHOLD_MB)) ??
    '4';
  const mb = Number(String(raw).trim());
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 4;
  return Math.max(1, safe) * 1024 * 1024;
}
