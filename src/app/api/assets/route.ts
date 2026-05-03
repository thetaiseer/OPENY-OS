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
  workspace_id?: string | null;
  file_path?: string | null;
  storage_path?: string | null;
  storage_key?: string | null;
  file_key?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  view_url?: string | null;
  download_url?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  main_category?: string | null;
  sub_category?: string | null;
  month_key?: string | null;
  file_type?: string | null;
  name?: string | null;
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

  const newOrder = path.match(
    /workspaces\/([^/]+)\/clients\/([^/]+)\/([^/]+)\/([^/]+)\/(\d{4})\/(\d{2})\//,
  );
  if (newOrder) {
    const [, workspaceId, clientSegment, mainCategory, subCategory, year, month] = newOrder;
    return {
      workspace_id: row.workspace_id ?? workspaceId,
      client_id: row.client_id ?? (clientSegment !== 'uncategorized' ? clientSegment : null),
      main_category: row.main_category ?? mainCategory,
      sub_category: row.sub_category ?? subCategory,
      month_key: row.month_key ?? `${year}-${month}`,
    };
  }

  const legacyOrder = path.match(
    /workspaces\/([^/]+)\/clients\/([^/]+)\/([^/]+)\/(\d{4})\/(\d{2})\/([^/]+)\//,
  );
  if (!legacyOrder) return {};

  const [, workspaceId, clientSegment, mainCategory, year, month, subCategory] = legacyOrder;
  return {
    workspace_id: row.workspace_id ?? workspaceId,
    client_id: row.client_id ?? (clientSegment !== 'uncategorized' ? clientSegment : null),
    main_category: row.main_category ?? mainCategory,
    sub_category: row.sub_category ?? subCategory,
    month_key: row.month_key ?? `${year}-${month}`,
  };
}

function normalizeAsset(row: AssetFolderFallbackRow): AssetFolderFallbackRow {
  return { ...row, ...deriveFolderFieldsFromPath(row) };
}

function matchesRequestedFilters(
  row: AssetFolderFallbackRow,
  filters: {
    workspaceId: string;
    clientId: string;
    clientName: string;
    mainCategory: string;
    subCategory: string;
    year: string;
    monthKey: string;
    fileType: string;
    search: string;
  },
): boolean {
  if (row.workspace_id && row.workspace_id !== filters.workspaceId) return false;
  if (filters.clientId && row.client_id !== filters.clientId) return false;
  if (filters.clientName && row.client_name !== filters.clientName) return false;
  if (filters.mainCategory && row.main_category !== filters.mainCategory) return false;
  if (filters.subCategory && row.sub_category !== filters.subCategory) return false;
  if (filters.monthKey && row.month_key !== filters.monthKey) return false;
  if (filters.year && !(row.month_key ?? '').startsWith(`${filters.year}-`)) return false;
  if (filters.fileType && !(row.file_type ?? '').startsWith(filters.fileType)) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const name = (row.name ?? '').toLowerCase();
    const client = (row.client_name ?? '').toLowerCase();
    if (!name.includes(q) && !client.includes(q)) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  try {
    const auth = await getApiUser(req);
    if (!auth) return fail(401, 'UNAUTHORIZED', 'Unauthorized', undefined, requestId);

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

    if (profile.role === 'client') return ok({ assets: [], page, hasMore: false, requestId });

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
        .select(ASSET_LIST_COLUMNS_LEGACY)
        .eq('workspace_id', workspaceId)
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
      let minimal = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_MINIMAL)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (clientId) minimal = minimal.eq('client_id', clientId);
      if (clientName) minimal = minimal.eq('client_name', clientName);
      if (fileType) minimal = minimal.like('file_type', `${fileType}%`);
      if (search) minimal = minimal.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await minimal.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      result = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    const { data, error } = result;

    if (error) {
      console.error('[GET /api/assets] Supabase error:', error.message, error.details ?? '');
      return fail(
        500,
        'ASSET_FETCH_FAILED',
        `Failed to fetch assets: ${error.message}${error.details ? ` — ${error.details}` : ''}`,
        error,
        requestId,
      );
    }

    const filters = {
      workspaceId,
      clientId,
      clientName,
      mainCategory,
      subCategory,
      year,
      monthKey,
      fileType,
      search,
    };
    const assets = ((data ?? []) as AssetFolderFallbackRow[])
      .filter(isActiveAsset)
      .map(normalizeAsset)
      .filter((asset) => matchesRequestedFilters(asset, filters));

    return ok({ assets, page, hasMore: assets.length === PAGE_SIZE, requestId });
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
