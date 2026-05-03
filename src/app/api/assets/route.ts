import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import {
  ASSET_LIST_COLUMNS,
  ASSET_LIST_COLUMNS_LEGACY,
  ASSET_LIST_COLUMNS_MINIMAL,
} from '@/lib/supabase-list-columns';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_COLUMN } from '@/lib/constants/postgres-errors';
import { fail, ok } from '@/lib/api/respond';
import { createRequestId } from '@/lib/errors/app-error';

const PAGE_SIZE = 100;

type AssetLifecycleRow = {
  deleted_at?: string | null;
  is_deleted?: boolean | null;
  missing_in_storage?: boolean | null;
  sync_status?: string | null;
};

type AssetFolderFallbackRow = AssetLifecycleRow & {
  file_path?: string | null;
  storage_path?: string | null;
  storage_key?: string | null;
  file_key?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  view_url?: string | null;
  download_url?: string | null;
  client_id?: string | null;
  main_category?: string | null;
  sub_category?: string | null;
  month_key?: string | null;
};

function isActiveAsset(row: AssetLifecycleRow): boolean {
  const isDeleted = row.is_deleted ?? false;
  const deletedAt = row.deleted_at ?? null;
  const missingInStorage = row.missing_in_storage ?? false;
  const syncStatus = (row.sync_status ?? 'synced').toLowerCase();
  return (
    !isDeleted &&
    !deletedAt &&
    !missingInStorage &&
    syncStatus !== 'deleted' &&
    syncStatus !== 'missing'
  );
}

function extractStoragePath(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const decoded = decodeURIComponent(value);
    const marker = '/workspaces/';
    const markerIndex = decoded.indexOf(marker);
    if (markerIndex >= 0) return decoded.slice(markerIndex + 1);
    const plainMarkerIndex = decoded.indexOf('workspaces/');
    if (plainMarkerIndex >= 0) return decoded.slice(plainMarkerIndex);
    return decoded;
  } catch {
    return value;
  }
}

function deriveFolderFieldsFromPath(row: AssetFolderFallbackRow): Partial<AssetFolderFallbackRow> {
  const rawPath =
    row.file_path ??
    row.storage_path ??
    row.storage_key ??
    row.file_key ??
    row.public_url ??
    row.file_url ??
    row.view_url ??
    row.download_url ??
    '';
  const path = extractStoragePath(rawPath);
  const match = path.match(
    /workspaces\/([^/]+)\/clients\/([^/]+)\/([^/]+)\/(\d{4})\/(\d{2})\/([^/]+)\//,
  );

  if (!match) return {};

  const [, , clientSegment, mainCategory, year, month, subCategory] = match;
  return {
    client_id: row.client_id ?? (clientSegment !== 'uncategorized' ? clientSegment : null),
    main_category: row.main_category ?? mainCategory,
    sub_category: row.sub_category ?? subCategory,
    month_key: row.month_key ?? `${year}-${month}`,
  };
}

/**
 * GET /api/assets
 *
 * Returns paginated assets from the database.
 * - admin / team: all assets
 * - client: only assets belonging to their client_id
 *
 * Query params:
 *   page          – 0-indexed page number (default: 0)
 *   client_id     – filter by client UUID
 *   client_name   – filter by client display name
 *   main_category – filter by main category slug
 *   sub_category  – filter by subcategory slug
 *   year          – filter by year (e.g. "2026")
 *   month_key     – filter by month key "YYYY-MM"
 *   file_type     – filter by MIME type prefix (e.g. "image")
 *   search        – full-text search on name / client_name
 */
export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return fail(401, 'UNAUTHORIZED', 'Unauthorized', undefined, requestId);
    }
    const { profile } = auth;

    const { searchParams } = new URL(req.url);
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
    const clientId = searchParams.get('client_id') ?? '';
    const clientName = searchParams.get('client_name') ?? '';
    const mainCategory = searchParams.get('main_category') ?? '';
    const subCategory = searchParams.get('sub_category') ?? '';
    const year = searchParams.get('year') ?? '';
    const monthKey = searchParams.get('month_key') ?? '';
    const fileType = searchParams.get('file_type') ?? '';
    const search = searchParams.get('search') ?? '';
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Client role: profiles no longer carry client_id, so we cannot scope
    // results to a specific client — return an empty list to avoid exposing
    // all assets until RLS policies are tightened.
    if (profile.role === 'client') {
      return ok({ assets: [], page, hasMore: false, requestId });
    }

    const supabase = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      supabase,
      profile.id,
      { allowWorkspaceFallbackWithoutMembership: profile.role === 'owner' },
    );
    if (!workspaceId) {
      return fail(
        500,
        'WORKSPACE_RESOLUTION_FAILED',
        workspaceError ?? 'Workspace not found',
        { step: 'workspace_resolution' },
        requestId,
      );
    }

    let query = supabase
      .from('assets')
      .select(ASSET_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .or('sync_status.is.null,sync_status.neq.deleted')
      .or('missing_in_storage.is.null,missing_in_storage.eq.false')
      .order('created_at', { ascending: false });

    if (clientId) query = query.eq('client_id', clientId);
    if (clientName) query = query.eq('client_name', clientName);
    if (mainCategory) query = query.eq('main_category', mainCategory);
    if (subCategory) query = query.eq('sub_category', subCategory);
    if (monthKey) query = query.eq('month_key', monthKey);
    if (year) query = query.like('month_key', `${year}-%`);
    if (fileType) query = query.like('file_type', `${fileType}%`);
    if (search) query = query.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

    let result = await query.range(from, to);

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      let fallback = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .or('sync_status.is.null,sync_status.neq.deleted')
        .order('created_at', { ascending: false });

      if (clientId) fallback = fallback.eq('client_id', clientId);
      if (clientName) fallback = fallback.eq('client_name', clientName);
      if (mainCategory) fallback = fallback.eq('main_category', mainCategory);
      if (subCategory) fallback = fallback.eq('sub_category', subCategory);
      if (monthKey) fallback = fallback.eq('month_key', monthKey);
      if (year) fallback = fallback.like('month_key', `${year}-%`);
      if (fileType) fallback = fallback.like('file_type', `${fileType}%`);
      if (search) fallback = fallback.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await fallback.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      let legacy = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_LEGACY)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (clientId) legacy = legacy.eq('client_id', clientId);
      if (clientName) legacy = legacy.eq('client_name', clientName);
      if (mainCategory) legacy = legacy.eq('main_category', mainCategory);
      if (subCategory) legacy = legacy.eq('sub_category', subCategory);
      if (monthKey) legacy = legacy.eq('month_key', monthKey);
      if (year) legacy = legacy.like('month_key', `${year}-%`);
      if (fileType) legacy = legacy.like('file_type', `${fileType}%`);
      if (search) legacy = legacy.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await legacy.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      let mini = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_MINIMAL)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (clientId) mini = mini.eq('client_id', clientId);
      if (clientName) mini = mini.eq('client_name', clientName);
      if (monthKey) mini = mini.eq('month_key', monthKey);
      if (year) mini = mini.like('month_key', `${year}-%`);
      if (fileType) mini = mini.like('file_type', `${fileType}%`);
      if (search) mini = mini.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await mini.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      let legacyWs = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) legacyWs = legacyWs.eq('client_id', clientId);
      if (clientName) legacyWs = legacyWs.eq('client_name', clientName);
      if (monthKey) legacyWs = legacyWs.eq('month_key', monthKey);
      if (year) legacyWs = legacyWs.like('month_key', `${year}-%`);
      if (fileType) legacyWs = legacyWs.like('file_type', `${fileType}%`);
      if (search) legacyWs = legacyWs.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await legacyWs.range(from, to);
    }

    const { data, error } = result;

    if (error) {
      if (error.code === PG_UNDEFINED_COLUMN) {
        return fail(
          503,
          'ASSET_COLUMNS_MISSING',
          `Assets cannot load: the database is missing required columns (${error.message}). Apply Supabase migrations (e.g. workspace + assets patches in supabase/migrations), then retry.`,
          { dbHint: error.hint ?? null },
          requestId,
        );
      }
      console.error('[GET /api/assets] Supabase error:', error.message, error.details ?? '');
      return fail(
        500,
        'ASSET_FETCH_FAILED',
        `Failed to fetch assets: ${error.message}${error.details ? ` — ${error.details}` : ''}`,
        error,
        requestId,
      );
    }

    const assets = ((data ?? []) as AssetFolderFallbackRow[])
      .filter(isActiveAsset)
      .map((asset) => ({ ...deriveFolderFieldsFromPath(asset), ...asset }));

    return ok({
      assets,
      page,
      hasMore: assets.length === PAGE_SIZE,
      requestId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/assets] unexpected error:', msg);
    return fail(
      500,
      'ASSET_UNEXPECTED_ERROR',
      `Unexpected server error: ${msg}`,
      undefined,
      requestId,
    );
  }
}
