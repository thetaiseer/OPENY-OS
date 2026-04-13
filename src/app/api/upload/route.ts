import { NextRequest, NextResponse } from 'next/server';

// ── Runtime config ────────────────────────────────────────────────────────────
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload  — DEPRECATED (returns HTTP 410 Gone)
 *
 * This route previously accepted full file bodies and uploaded them server-side
 * to Cloudflare R2.  Sending file bytes through the Next.js / Vercel server
 * causes:
 *   - Hard 60-second timeouts on Vercel Hobby/Free plans
 *   - Unnecessary bandwidth consumption through the function
 *   - Unreliable large-file handling (>50 MB files hang or fail)
 *
 * The correct upload flow is:
 *   1. POST /api/upload/presign   → get a short-lived presigned PUT URL
 *   2. PUT  <presigned URL>       → browser → R2 directly (no server proxy)
 *   3. POST /api/upload/complete  → save asset metadata to the database
 *
 * For large files (> 50 MB) the multipart path is used automatically:
 *   1. POST /api/upload/multipart-init
 *   2. POST /api/upload/multipart-part  (per chunk, returns presigned URL)
 *   3. PUT  <part URL>                   (browser → R2, per chunk)
 *   4. POST /api/upload/multipart-complete
 *   5. POST /api/upload/complete
 *
 * See src/lib/upload-context.tsx for the full client-side implementation.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint no longer accepts file uploads. ' +
        'Use POST /api/upload/presign to obtain a presigned URL, ' +
        'then PUT the file directly to R2, ' +
        'then POST /api/upload/complete to save metadata.',
      presignEndpoint:   '/api/upload/presign',
      completeEndpoint:  '/api/upload/complete',
      docs: 'See src/lib/upload-context.tsx for the reference implementation.',
    },
    { status: 410 }, // 410 Gone
  );
}
