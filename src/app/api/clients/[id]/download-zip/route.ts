/**
 * GET /api/clients/[id]/download-zip
 *
 * Streams all R2-hosted assets for a client as a single ZIP archive.
 *
 * ZIP folder structure:
 *   {clientName}/
 *     {main_category}/
 *       {year}/
 *         {month}/
 *           {sub_category}/
 *             {filename}
 *
 * Path is derived from `storage_key` when available (authoritative), otherwise
 * reconstructed from `main_category`, `month_key`, `sub_category`, and `name`.
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

const PAGE_SIZE = 500;
const OPENY_OS_KEY_PREFIX_SEGMENTS = 4; // openy-assets/os/{section}/{entityId}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitise a path segment so it cannot contain path traversal characters.
 */
function sanitiseSegment(segment: string): string {
  return segment.replace(/[/\\:*?"<>|]/g, '_').trim() || '_';
}

/**
 * Derive the path inside the ZIP for an asset.
 *
 * Priority:
 * 1. Parse from `storage_key` — strip the leading `clients/{slug}/` prefix,
 *    keep everything after it (category/year/month/subcat/file).
 * 2. Reconstruct from individual fields.
 *
 * The returned path always starts with {clientName}/.
 */
function buildZipPath(
  clientName: string,
  asset: {
    name: string;
    storage_key?: string | null;
    main_category?: string | null;
    sub_category?: string | null;
    month_key?: string | null;
  },
): string {
  const root = sanitiseSegment(clientName);

  // ── Option 1: derive from storage_key ────────────────────────────────────
  if (asset.storage_key) {
    // storage_key: clients/{slug}/{rest…}
    const parts = asset.storage_key.split('/');
    // Drop "clients" and the slug (first two segments).
    if (parts.length > 2 && parts[0] === 'clients') {
      const rel = parts.slice(2).join('/');
      return `${root}/${rel}`;
    }
    if (parts.length > 4 && parts[0] === 'openy-assets' && parts[1] === 'os') {
      const rel = parts.slice(OPENY_OS_KEY_PREFIX_SEGMENTS).join('/');
      return `${root}/${rel}`;
    }
  }

  // ── Option 2: reconstruct from fields ────────────────────────────────────
  const cat   = sanitiseSegment(asset.main_category ?? 'Other');
  const subCat = sanitiseSegment(asset.sub_category ?? 'General');
  const fileName = sanitiseSegment(asset.name);

  // month_key format: "YYYY-MM"
  let year  = 'Unknown';
  let month = 'Unknown';
  if (asset.month_key && /^\d{4}-\d{2}$/.test(asset.month_key)) {
    [year, month] = asset.month_key.split('-');
  }

  return `${root}/${cat}/${year}/${month}/${subCat}/${fileName}`;
}

/**
 * Fetch ALL assets for a client across multiple pages.
 */
async function fetchAllAssets(clientId: string) {
  const supabase = getServiceClient();
  const all: Array<{
    id: string;
    name: string;
    storage_key?: string | null;
    storage_provider?: string | null;
    file_path?: string | null;
    main_category?: string | null;
    sub_category?: string | null;
    month_key?: string | null;
  }> = [];

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('assets')
      .select('id,name,storage_key,storage_provider,file_path,main_category,sub_category,month_key')
      .eq('client_id', clientId)
      .neq('is_deleted', true)
      .range(from, to);

    if (error) throw new Error(`DB error fetching assets: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

/**
 * Resolve the R2 object key for an asset.
 *
 * Priority:
 * 1. `storage_key` — canonical key set at upload time.
 * 2. `file_path`   — legacy key, only trusted when `storage_provider` is 'r2'.
 * Returns null when no reliable key can be determined.
 */
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await getApiUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  }

  // ── Client lookup ─────────────────────────────────────────────────────────
  const supabase = getServiceClient();
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single();

  if (clientErr || !clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const clientName: string = clientRow.name as string;

  // ── Fetch assets ──────────────────────────────────────────────────────────
  let allAssets;
  try {
    allAssets = await fetchAllAssets(clientId);
  } catch (err) {
    console.error('[download-zip] asset fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }

  // Filter to R2-hosted assets only (storage_key present OR provider is r2).
  const r2Assets = allAssets.filter(
    a =>
      a.storage_provider === 'r2' ||
      (a.storage_key && (
        a.storage_key.startsWith('openy-assets/os/') ||
        a.storage_key.startsWith('clients/')
      )),
  );

  if (r2Assets.length === 0) {
    return NextResponse.json(
      { error: 'No R2-hosted assets found for this client' },
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
  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('[download-zip] archiver error', err);
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);

  // Process files sequentially and append to archive, then finalise — all in
  // a detached async IIFE so the HTTP response body starts streaming immediately.
  let filesAdded = 0;
  let filesSkipped = 0;

  (async () => {
    for (const asset of r2Assets) {
      // Prefer the canonical storage_key. Fall back to file_path only when the
      // asset is explicitly r2-hosted (consistent with the DELETE route pattern).
      const key = getAssetStorageKey(asset);
      if (!key) {
        filesSkipped++;
        continue;
      }

      const zipPath = buildZipPath(clientName, asset);

      try {
        const { body } = await getFileObject(key);
        if (!body) {
          console.warn(`[download-zip] empty body for key: ${key}`);
          filesSkipped++;
          continue;
        }

        // AWS SDK v3 returns a SdkStreamMixin; in Node.js it is also a Readable.
        archive.append(body as Readable, { name: zipPath });
        filesAdded++;
      } catch (err: unknown) {
        const code =
          (err as { name?: string })?.name ?? '';
        if (code === 'NoSuchKey' || code === 'NotFound') {
          console.warn(`[download-zip] file missing in R2: ${key}`);
        } else {
          console.error(`[download-zip] error fetching ${key}:`, err);
        }
        filesSkipped++;
      }
    }

    console.log(
      `[download-zip] client=${clientName} added=${filesAdded} skipped=${filesSkipped}`,
    );

    archive.finalize().catch((err: unknown) => {
      console.error('[download-zip] finalize error', err);
      passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    });
  })().catch((err: unknown) => {
    console.error('[download-zip] streaming error', err);
    archive.abort();
    passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
  });

  // Convert Node.js Readable → Web ReadableStream (Node.js ≥ 18).
  const webStream = Readable.toWeb(passThrough) as ReadableStream;

  const safeFilename = clientName.replace(/[^a-z0-9_\- ]/gi, '_');

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${safeFilename}.zip"`,
      // Disable buffering on Vercel / nginx so bytes stream to the client.
      'X-Accel-Buffering':   'no',
      'Cache-Control':       'no-store',
    },
  });
}
