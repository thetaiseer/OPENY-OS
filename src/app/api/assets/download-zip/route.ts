/**
 * GET /api/assets/download-zip
 *
 * Streams one or more R2-hosted assets as a single ZIP archive.
 *
 * Query params:
 *   ids – required, comma-separated asset UUIDs
 *
 * ZIP folder structure mirrors the storage hierarchy:
 *   {clientName}/{main_category}/{year}/{month}/{sub_category}/{filename}
 *
 * Files missing in R2 are skipped with a warning; a single broken file does
 * not abort the entire archive.
 */

import { type NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { getFileObject, getStorageConfigStatus } from '@/lib/storage';

// Use Node.js runtime — required for Node stream APIs and archiver.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow up to 5 minutes for large archives on Vercel Pro / Enterprise.
export const maxDuration = 300;

const MAX_ASSETS = 500;
const OPENY_OS_KEY_PREFIX_SEGMENTS = 4; // openy-assets/os/{section}/{entityId}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitiseSegment(segment: string): string {
  return segment.replace(/[/\\:*?"<>|]/g, '_').trim() || '_';
}

/**
 * Derive the path inside the ZIP for an asset.
 *
 * Priority:
 * 1. Parse from `storage_key` — strip the leading `clients/{slug}/` prefix.
 * 2. Reconstruct from individual metadata fields.
 *
 * The returned path always starts with {clientName}/.
 */
function buildZipPath(
  asset: {
    name: string;
    client_name?: string | null;
    storage_key?: string | null;
    main_category?: string | null;
    sub_category?: string | null;
    month_key?: string | null;
  },
): string {
  const root = sanitiseSegment(asset.client_name ?? 'Unknown Client');

  // ── Option 1: derive from storage_key ────────────────────────────────────
  if (asset.storage_key) {
    const parts = asset.storage_key.split('/');
    // Drop "clients" and the slug (first two segments).
    if (parts.length > 2 && parts[0] === 'clients') {
      const rel = parts.slice(2).join('/');
      return `${root}/${rel}`;
    }
    if (parts.length > OPENY_OS_KEY_PREFIX_SEGMENTS && parts[0] === 'openy-assets' && parts[1] === 'os') {
      const rel = parts.slice(OPENY_OS_KEY_PREFIX_SEGMENTS).join('/');
      return `${root}/${rel}`;
    }
  }

  // ── Option 2: reconstruct from fields ────────────────────────────────────
  const cat      = sanitiseSegment(asset.main_category ?? 'Other');
  const subCat   = sanitiseSegment(asset.sub_category ?? 'General');
  const fileName = sanitiseSegment(asset.name);

  let year  = 'Unknown';
  let month = 'Unknown';
  if (asset.month_key && /^\d{4}-\d{2}$/.test(asset.month_key)) {
    [year, month] = asset.month_key.split('-');
  }

  return `${root}/${cat}/${year}/${month}/${subCat}/${fileName}`;
}

function getAssetStorageKey(asset: {
  storage_key?: string | null;
  file_path?: string | null;
  storage_provider?: string | null;
}): string | null {
  if (asset.storage_key) return asset.storage_key;
  if (asset.storage_provider === 'r2' && asset.file_path) return asset.file_path;
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await getApiUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids') ?? '';

  if (!idsParam.trim()) {
    return NextResponse.json({ error: 'Missing required query param: ids' }, { status: 400 });
  }

  const ids = idsParam
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ASSETS);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No valid asset IDs provided' }, { status: 400 });
  }

  // ── Fetch assets from DB ──────────────────────────────────────────────────
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('assets')
    .select('id,name,client_name,storage_key,storage_provider,file_path,main_category,sub_category,month_key')
    .in('id', ids)
    .neq('is_deleted', true);

  if (error) {
    console.error('[assets/download-zip] DB error', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }

  const allAssets = data ?? [];

  // Filter to R2-hosted assets only.
  const r2Assets = allAssets.filter(
    a =>
      a.storage_provider === 'r2' ||
      (a.storage_key && (
        (a.storage_key as string).startsWith('openy-assets/os/') ||
        (a.storage_key as string).startsWith('clients/')
      )),
  );

  if (r2Assets.length === 0) {
    return NextResponse.json(
      { error: 'No downloadable files found for the selected assets' },
      { status: 404 },
    );
  }

  // ── R2 client ─────────────────────────────────────────────────────────────
  const { configured } = getStorageConfigStatus();
  if (!configured) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  // ── Stream ZIP ────────────────────────────────────────────────────────────
  const passThrough = new PassThrough();
  const archive     = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('[assets/download-zip] archiver error', err);
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);

  let filesAdded   = 0;
  let filesSkipped = 0;

  (async () => {
    for (const asset of r2Assets) {
      const key = getAssetStorageKey(asset);
      if (!key) {
        filesSkipped++;
        continue;
      }

      const zipPath = buildZipPath(asset);

      try {
        const { body } = await getFileObject(key);
        if (!body) {
          console.warn(`[assets/download-zip] empty body for key: ${key}`);
          filesSkipped++;
          continue;
        }

        archive.append(body as Readable, { name: zipPath });
        filesAdded++;
      } catch (err: unknown) {
        const code = (err as { name?: string })?.name ?? '';
        if (code === 'NoSuchKey' || code === 'NotFound') {
          console.warn(`[assets/download-zip] file missing in R2: ${key}`);
        } else {
          console.error(`[assets/download-zip] error fetching ${key}:`, err);
        }
        filesSkipped++;
      }
    }

    archive.finalize().catch((err: unknown) => {
      console.error('[assets/download-zip] finalize error', err);
      passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    });
  })().catch((err: unknown) => {
    console.error('[assets/download-zip] streaming error', err);
    archive.abort();
    passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
  });

  // Convert Node.js Readable → Web ReadableStream (Node.js ≥ 18).
  const webStream = Readable.toWeb(passThrough) as ReadableStream;

  const archiveName = ids.length === 1 && r2Assets[0]
    ? `${sanitiseSegment(r2Assets[0].name)}.zip`
    : `assets-${ids.length}.zip`;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${archiveName}"`,
      'X-Accel-Buffering':   'no',
      'Cache-Control':       'no-store',
    },
  });
}
