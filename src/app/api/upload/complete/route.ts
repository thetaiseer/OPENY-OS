import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { ASSET_LIST_COLUMNS } from '@/lib/supabase-list-columns';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { insertWithColumnFallback, serializeDbError } from '@/lib/asset-db';
import { notifyAssetUploaded } from '@/lib/notification-service';
import { deleteFile, getFileUrl, getStorageBucketName, R2ConfigError } from '@/lib/storage';
import { saveStoredFileMetadata } from '@/lib/storage/metadata';
import { processEvent } from '@/lib/event-engine';
import { resolveUploadClientDisplayName } from '@/lib/upload-resolve-client-name';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function fileExtensionFromDisplayName(name: string): string | null {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i >= name.length - 1) return null;
  const ext = name
    .slice(i + 1)
    .trim()
    .toLowerCase();
  return ext.length > 0 && ext.length <= 32 ? ext : null;
}

/**
 * POST /api/upload/complete
 *
 * Called by the frontend after a successful server-side upload to R2.
 * This endpoint only saves asset metadata to the database — no file
 * bytes are accepted or processed here.
 *
 * Request body (JSON):
 *   storageKey           – R2 object key returned by /api/upload/presign (required)
 *   displayName          – display name for the asset (required)
 *   clientName           – client display name (required unless clientId resolves to a client)
 *   clientId             – Supabase client UUID (optional; used to fill clientName when missing)
 *   fileType             – MIME type (required)
 *   fileSize             – file size in bytes (required)
 *   mainCategory         – main category slug (required)
 *   subCategory          – subcategory slug (optional)
 *   monthKey             – "YYYY-MM" (required)
 *   uploadedBy           – uploader name/email for activity log (optional)
 *   thumbnailStorageKey  – R2 key of the pre-uploaded thumbnail image (optional)
 *
 * Response:
 *   { success: true,  stage: 'completed', asset }
 *   { success: false, stage: 'failed_db', error }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const storageKey = (body.storageKey as string | undefined)?.trim() ?? '';
  const displayName = (body.displayName as string | undefined)?.trim() ?? '';
  const originalName =
    (body.originalName as string | undefined)?.trim() || displayName || 'uploaded-file';
  let resolvedClientName = (body.clientName as string | undefined)?.trim() ?? '';
  const clientId = (body.clientId as string | undefined)?.trim() || null;
  const fileType = (body.fileType as string | undefined)?.trim() ?? 'application/octet-stream';
  const fileSize = Number(body.fileSize ?? 0) || null;
  const mainCategory = (body.mainCategory as string | undefined)?.trim() || null;
  const subCategory = (body.subCategory as string | undefined)?.trim() || null;
  const monthKey = (body.monthKey as string | undefined)?.trim() ?? '';
  const uploadedBy = (body.uploadedBy as string | undefined)?.trim() || null;
  const thumbnailStorageKey = (body.thumbnailStorageKey as string | undefined)?.trim() || null;
  const previewStorageKey = (body.previewStorageKey as string | undefined)?.trim() || null;
  const providedPublicUrl = (body.publicUrl as string | undefined)?.trim() || '';
  const storageProvider = 'r2';
  const bucketName = getStorageBucketName();
  const durationSecondsRaw =
    typeof body.durationSeconds === 'number' && isFinite(body.durationSeconds as number)
      ? (body.durationSeconds as number)
      : null;
  const durationSeconds = durationSecondsRaw !== null ? Math.round(durationSecondsRaw) : null;

  if (!storageKey)
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: 'storageKey is required' },
      { status: 400 },
    );
  if (!displayName)
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: 'displayName is required' },
      { status: 400 },
    );
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: 'monthKey must be in YYYY-MM format' },
      { status: 400 },
    );
  }

  let publicUrl = providedPublicUrl;
  if (!publicUrl) {
    try {
      publicUrl = getFileUrl(storageKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConfigErr = err instanceof R2ConfigError;
      console.error('[upload/complete] upload failure', {
        provider: storageProvider,
        bucketName,
        storageKey,
        error: msg,
      });
      return NextResponse.json(
        { success: false, stage: 'failed_db', error: msg },
        { status: isConfigErr ? 500 : 502 },
      );
    }
  }

  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Supabase configuration error';
    return NextResponse.json({ success: false, stage: 'failed_db', error: msg }, { status: 500 });
  }

  const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
    req,
    supabase,
    auth.profile.id,
  );
  if (!workspaceId) {
    return NextResponse.json(
      {
        success: false,
        stage: 'failed_db',
        error: workspaceError ?? 'Unable to resolve workspace from session',
      },
      { status: 403 },
    );
  }

  resolvedClientName = await resolveUploadClientDisplayName(
    supabase,
    workspaceId,
    resolvedClientName,
    clientId,
  );

  if (!resolvedClientName) {
    return NextResponse.json(
      {
        success: false,
        stage: 'failed_db',
        error:
          'clientName is required, or pass a valid clientId in this workspace so the name can be resolved.',
      },
      { status: 400 },
    );
  }

  const fileExtension = fileExtensionFromDisplayName(displayName);

  // ── Deduplication check ────────────────────────────────────────────────────
  {
    let dedupe = supabase
      .from('assets')
      .select(ASSET_LIST_COLUMNS)
      .eq('file_path', storageKey)
      .eq('workspace_id', workspaceId);

    const { data: existing, error: dedupeErr } = await dedupe.maybeSingle();

    if (dedupeErr?.code === '42703' || dedupeErr?.code === 'PGRST204') {
      dedupe = supabase.from('assets').select(ASSET_LIST_COLUMNS).eq('file_path', storageKey);
      const { data: existingLegacy } = await dedupe.maybeSingle();
      if (existingLegacy) {
        return NextResponse.json(
          { success: true, stage: 'completed', asset: existingLegacy, r2_key: storageKey },
          { status: 200 },
        );
      }
    } else if (existing) {
      return NextResponse.json(
        { success: true, stage: 'completed', asset: existing, r2_key: storageKey },
        { status: 200 },
      );
    }
  }

  // ── Parse month/year ───────────────────────────────────────────────────────
  const [year, monthNum] = monthKey.split('-');
  const monthName = new Date(
    Date.UTC(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1),
  ).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  // ── Resolve thumbnail and preview URLs ────────────────────────────────────
  // thumbnail_url — the card thumbnail image:
  //   Images  → the file itself
  //   Videos  → the separately-uploaded frame grab (thumbnailStorageKey)
  //   Others  → null
  // preview_url — the larger preview / cover image:
  //   Images  → the file itself
  //   PDFs    → the separately-uploaded first-page render (previewStorageKey)
  //   Others  → null
  const isImage = fileType.startsWith('image/');
  let thumbnailUrl: string | null = null;
  let resolvedPreviewUrl: string | null = null;
  if (thumbnailStorageKey) {
    try {
      thumbnailUrl = getFileUrl(thumbnailStorageKey);
    } catch {
      /* ignore */
    }
  } else if (isImage) {
    thumbnailUrl = publicUrl;
  }
  if (previewStorageKey) {
    try {
      resolvedPreviewUrl = getFileUrl(previewStorageKey);
    } catch {
      /* ignore */
    }
  } else if (isImage) {
    resolvedPreviewUrl = publicUrl;
  }

  // ── Insert metadata (column names aligned with public.assets migrations) ───
  const insertRow: Record<string, unknown> = {
    workspace_id: workspaceId,
    name: displayName,
    file_name: displayName,
    display_name: displayName,
    original_name: originalName,
    original_filename: originalName,
    ...(fileExtension ? { file_extension: fileExtension } : {}),
    file_path: storageKey,
    storage_path: storageKey,
    storage_key: storageKey,
    file_key: storageKey,
    file_url: publicUrl,
    public_url: publicUrl,
    size_bytes: fileSize,
    view_url: publicUrl,
    download_url: publicUrl,
    file_type: fileType,
    mime_type: fileType,
    file_size: fileSize,
    bucket_name: bucketName,
    storage_bucket: bucketName,
    storage_provider: storageProvider,
    sync_status: 'synced',
    missing_in_storage: false,
    deleted_at: null,
    client_name: resolvedClientName,
    client_folder_name: resolvedClientName,
    month_key: monthKey,
    main_category: mainCategory,
    sub_category: subCategory,
    preview_url: resolvedPreviewUrl,
    thumbnail_url: thumbnailUrl,
    web_view_link: publicUrl,
    status: 'ready',
    is_deleted: false,
    ...(durationSeconds !== null ? { duration_seconds: durationSeconds } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    // Canonical uploader identity for DB relations/auditing (UUID from auth profile).
    ...(auth.profile.id ? { uploaded_by: auth.profile.id } : {}),
    // Optional display label from client UI; kept separate from the canonical UUID above.
    ...(uploadedBy ? { uploaded_by_name: uploadedBy } : {}),
  };

  const {
    data: inserted,
    error: dbError,
    finalRow,
  } = await insertWithColumnFallback(
    (row) => supabase.from('assets').insert(row).select().single(),
    insertRow,
    '[upload/complete]',
  );

  if (dbError) {
    try {
      await deleteFile(storageKey);
    } catch (rbErr) {
      console.warn('[upload/complete] R2 rollback after DB insert failure:', rbErr);
    }
    console.error(
      '[upload/complete] DB insert failed:',
      serializeDbError(dbError),
      '| key:',
      storageKey,
      '| attemptedRow:',
      JSON.stringify(finalRow, null, 2),
    );
    return NextResponse.json(
      {
        success: false,
        stage: 'failed_db',
        r2_key: storageKey,
        r2_bucket: bucketName,
        r2_filename: displayName,
        error: dbError,
        attempted_payload: finalRow,
      },
      { status: 200 },
    );
  }
  try {
    await saveStoredFileMetadata({
      module: 'os',
      section: 'assets',
      entityId: clientId,
      originalName: displayName,
      storedName: storageKey.split('/').pop() ?? displayName,
      mimeType: fileType,
      sizeBytes: Number(fileSize ?? 0),
      r2Key: storageKey,
      fileUrl: publicUrl,
      uploadedBy: auth.profile.id,
      visibility: 'public',
    });
  } catch (error) {
    let rollbackSucceeded = false;
    if (inserted?.id) {
      const { error: rollbackError } = await supabase.from('assets').delete().eq('id', inserted.id);
      if (rollbackError) {
        console.error('[upload/complete] failed to rollback asset after metadata failure', {
          assetId: inserted.id,
          rollbackError: rollbackError.message,
        });
      } else {
        rollbackSucceeded = true;
      }
    } else {
      console.error(
        '[upload/complete] metadata failed and no inserted asset id was available for rollback',
      );
    }
    console.error(
      rollbackSucceeded
        ? '[upload/complete] rolled back asset insert after metadata persistence failure'
        : '[upload/complete] metadata persistence failure without confirmed rollback',
      error,
    );
    return NextResponse.json(
      {
        success: false,
        stage: 'failed_db',
        error: 'Failed to persist unified storage metadata.',
      },
      { status: 500 },
    );
  }

  // ── Activity log (fire-and-forget) ─────────────────────────────────────────
  void supabase
    .from('activities')
    .insert({
      type: 'asset',
      description: `Asset "${displayName}" uploaded (${resolvedClientName}/${year}/${monthName})${uploadedBy ? ` by ${uploadedBy}` : ''}`,
      entity_type: 'asset',
      entity_id: (inserted?.id as string | undefined) ?? null,
      ...(clientId ? { client_id: clientId } : {}),
    })
    .then(({ error }) => {
      if (error) console.warn('[upload/complete] activity log failed:', error.message);
    });

  // ── Notify (fire-and-forget) ───────────────────────────────────────────────
  if (inserted) {
    void processEvent({
      event_type: 'asset.uploaded',
      actor_id: auth.profile.id,
      entity_type: 'asset',
      entity_id: inserted.id as string,
      client_id: clientId ?? null,
      payload: {
        assetName: displayName,
        clientName: resolvedClientName,
      },
    });

    void (async () => {
      try {
        const { data: members } = await supabase
          .from('team_members')
          .select('profile_id')
          .eq('status', 'active');

        const teamMemberUserIds = (members ?? [])
          .map((m: { profile_id?: string | null }) => m.profile_id)
          .filter((v): v is string => Boolean(v));

        await notifyAssetUploaded({
          assetId: inserted.id as string,
          assetName: displayName,
          clientId: clientId ?? null,
          uploadedById: auth.profile.id,
          teamMemberUserIds,
        });
      } catch (err) {
        console.warn(
          '[upload/complete] notifyAssetUploaded failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }

  return NextResponse.json(
    {
      success: true,
      stage: 'completed',
      location: publicUrl,
      asset: inserted,
      r2_key: storageKey,
      r2_bucket: bucketName,
    },
    { status: 201 },
  );
}
