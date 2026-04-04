import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteFromDrive, DriveFileNotFoundError, cleanupEmptyFoldersFromLeaf } from '@/lib/google-drive';

// ── Supabase service-role client (server only) ────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  const supabase = getSupabase();

  // ── 1. Fetch asset row to get drive_file_id and drive_folder_id ─────────────
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, drive_file_id, drive_folder_id, name, storage_provider')
    .eq('id', id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { error: `Asset not found: ${fetchError?.message ?? 'unknown'}` },
      { status: 404 },
    );
  }

  console.log('[asset-delete] starting delete', {
    assetId: asset.id,
    driveFileId: asset.drive_file_id ?? null,
    driveFolderId: asset.drive_folder_id ?? null,
    storageProvider: asset.storage_provider,
  });

  // ── 2. Delete from Google Drive (only if stored there) ───────────────────
  let warning: string | undefined;

  if (asset.storage_provider === 'google_drive' && asset.drive_file_id) {
    try {
      await deleteFromDrive(asset.drive_file_id as string);
      console.log('[asset-delete] Drive delete succeeded', { assetId: asset.id, driveFileId: asset.drive_file_id });
    } catch (err: unknown) {
      if (err instanceof DriveFileNotFoundError) {
        // File already gone from Drive – treat as orphaned record and continue
        warning = 'Asset record deleted. Remote file was already missing.';
        console.warn('[asset-delete] Drive file not found – treating as orphaned', {
          assetId: asset.id,
          driveFileId: asset.drive_file_id,
          driveError: err.message,
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[asset-delete] Drive delete failed', { assetId: asset.id, driveFileId: asset.drive_file_id, error: msg });
        return NextResponse.json(
          { error: `Google Drive delete failed: ${msg}` },
          { status: 502 },
        );
      }
    }
  }

  // ── 3. Delete row from assets table ──────────────────────────────────────
  const { error: dbError } = await supabase.from('assets').delete().eq('id', id);
  if (dbError) {
    console.error('[asset-delete] DB delete failed', { assetId: asset.id, error: dbError.message });
    return NextResponse.json(
      { error: `Database delete failed: ${dbError.message}` },
      { status: 500 },
    );
  }

  console.log('[asset-delete] DB delete succeeded', { assetId: asset.id });

  // ── 4. Clean up empty parent folders in Google Drive ─────────────────────
  // Errors here must not fail the overall delete — they are logged only.
  if (asset.storage_provider === 'google_drive' && asset.drive_folder_id) {
    try {
      console.log('[asset-delete] starting folder cleanup from leaf', {
        assetId: asset.id,
        monthFolderId: asset.drive_folder_id,
      });
      await cleanupEmptyFoldersFromLeaf(asset.drive_folder_id as string);
      console.log('[asset-delete] folder cleanup completed', { assetId: asset.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[asset-delete] folder cleanup error (non-fatal)', {
        assetId: asset.id,
        driveFolderId: asset.drive_folder_id,
        error: msg,
      });
    }
  }

  const successMessage = warning ?? 'Asset deleted successfully.';
  return NextResponse.json({ success: true, message: successMessage, ...(warning ? { warning } : {}) });
}
