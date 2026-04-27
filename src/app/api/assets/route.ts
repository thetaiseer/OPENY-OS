import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import {
  ASSET_LIST_COLUMNS,
  ASSET_LIST_COLUMNS_LEGACY,
  ASSET_LIST_COLUMNS_MINIMAL,
} from '@/lib/supabase-list-columns';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { PG_UNDEFINED_COLUMN } from '@/lib/constants/postgres-errors';

const PAGE_SIZE = 100;

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
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ success: true, assets: [], page, hasMore: false });
    }

    const supabase = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      supabase,
      profile.id,
      { allowWorkspaceFallbackWithoutMembership: profile.role === 'owner' },
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          step: 'workspace_resolution',
          error: workspaceError ?? 'Workspace not found',
        },
        { status: 500 },
      );
    }

    // Build query with optional filters
    let query = supabase
      .from('assets')
      .select(ASSET_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .neq('is_deleted', true)
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
      // Retry #1: same projection without `is_deleted` filter (older schemas).
      let fallback = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS)
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
      // Retry #2: legacy projection for envs missing `file_path` (and similar).
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
      // Retry #3: minimal column list (drops tags / categories / storage_key / file_path).
      let mini = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_MINIMAL)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (clientId) mini = mini.eq('client_id', clientId);
      if (clientName) mini = mini.eq('client_name', clientName);
      if (mainCategory) mini = mini.eq('main_category', mainCategory);
      if (subCategory) mini = mini.eq('sub_category', subCategory);
      if (monthKey) mini = mini.eq('month_key', monthKey);
      if (year) mini = mini.like('month_key', `${year}-%`);
      if (fileType) mini = mini.like('file_type', `${fileType}%`);
      if (search) mini = mini.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await mini.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      // Retry #4: minimal + workspace, but omit category filters (older tables).
      let mini2 = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_MINIMAL)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (clientId) mini2 = mini2.eq('client_id', clientId);
      if (clientName) mini2 = mini2.eq('client_name', clientName);
      if (monthKey) mini2 = mini2.eq('month_key', monthKey);
      if (year) mini2 = mini2.like('month_key', `${year}-%`);
      if (fileType) mini2 = mini2.like('file_type', `${fileType}%`);
      if (search) mini2 = mini2.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await mini2.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      // Retry #5: legacy single-tenant DBs without `workspace_id` on assets.
      let legacyWs = supabase
        .from('assets')
        .select(ASSET_LIST_COLUMNS_MINIMAL)
        .order('created_at', { ascending: false });

      if (clientId) legacyWs = legacyWs.eq('client_id', clientId);
      if (clientName) legacyWs = legacyWs.eq('client_name', clientName);
      if (monthKey) legacyWs = legacyWs.eq('month_key', monthKey);
      if (year) legacyWs = legacyWs.like('month_key', `${year}-%`);
      if (fileType) legacyWs = legacyWs.like('file_type', `${fileType}%`);
      if (search) legacyWs = legacyWs.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await legacyWs.range(from, to);
    }

    if (result.error?.code === PG_UNDEFINED_COLUMN) {
      // Retry #6: last resort — full rows, no filters (avoids unknown WHERE columns).
      console.warn(
        '[GET /api/assets] Using select(*) without filters — apply migrations for workspace-scoped assets.',
      );
      result = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    const { data, error } = result;

    if (error) {
      if (error.code === PG_UNDEFINED_COLUMN) {
        return NextResponse.json(
          {
            success: false,
            error: `Assets cannot load: the database is missing required columns (${error.message}). Apply Supabase migrations (e.g. workspace + assets patches in supabase/migrations), then retry.`,
            dbHint: error.hint ?? null,
          },
          { status: 503 },
        );
      }
      console.error('[GET /api/assets] Supabase error:', error.message, error.details ?? '');
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch assets: ${error.message}${error.details ? ` — ${error.details}` : ''}`,
        },
        { status: 500 },
      );
    }

    const assets = data ?? [];
    return NextResponse.json({
      success: true,
      assets,
      page,
      hasMore: assets.length === PAGE_SIZE,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/assets] unexpected error:', msg);
    return NextResponse.json(
      { success: false, error: `Unexpected server error: ${msg}` },
      { status: 500 },
    );
  }
}
