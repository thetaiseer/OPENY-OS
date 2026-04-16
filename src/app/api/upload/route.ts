import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload  — DEPRECATED (returns HTTP 410 Gone)
 *
 * The current upload flow uses a different set of endpoints.
 *
 * Standard upload flow:
 *   1. POST /api/upload/presign   (multipart/form-data with file bytes)
 *                                 → server uploads to R2, returns storageKey + publicUrl
 *   2. POST /api/upload/complete  → save asset metadata to the database
 *
 * For large files (> 50 MB) the multipart path is used:
 *   1. POST /api/upload/multipart-init
 *   2. POST /api/upload/multipart-part (binary body per chunk, server uploads to R2)
 *   3. POST /api/upload/multipart-complete
 *   4. POST /api/upload/complete
 *
 * See src/lib/upload-context.tsx for the full client-side implementation.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint no longer accepts file uploads. ' +
        'POST multipart/form-data to /api/upload/presign to upload the file, ' +
        'then POST /api/upload/complete to save metadata.',
      presignEndpoint:  '/api/upload/presign',
      completeEndpoint: '/api/upload/complete',
      docs: 'See src/lib/upload-context.tsx for the reference implementation.',
    },
    { status: 410 },
  );
}
