import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser, requireRole } from '@/lib/api-auth';


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
    const page         = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
    const clientId     = searchParams.get('client_id')     ?? '';
    const clientName   = searchParams.get('client_name')   ?? '';
    const mainCategory = searchParams.get('main_category') ?? '';
    const subCategory  = searchParams.get('sub_category')  ?? '';
    const year         = searchParams.get('year')          ?? '';
    const monthKey     = searchParams.get('month_key')     ?? '';
    const fileType     = searchParams.get('file_type')     ?? '';
    const search       = searchParams.get('search')        ?? '';
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    // Client role: profiles no longer carry client_id, so we cannot scope
    // results to a specific client — return an empty list to avoid exposing
    // all assets until RLS policies are tightened.
    if (profile.role === 'client') {
      return NextResponse.json({ success: true, assets: [], page, hasMore: false });
    }

    const supabase = getServiceClient();

    // Build query with optional filters
    let query = supabase
      .from('assets')
      .select('*')
      .neq('is_deleted', true)
      .order('created_at', { ascending: false });

    if (clientId)     query = query.eq('client_id', clientId);
    if (clientName)   query = query.eq('client_name', clientName);
    if (mainCategory) query = query.eq('main_category', mainCategory);
    if (subCategory)  query = query.eq('sub_category', subCategory);
    if (monthKey)     query = query.eq('month_key', monthKey);
    if (year)         query = query.like('month_key', `${year}-%`);
    if (fileType)     query = query.like('file_type', `${fileType}%`);
    if (search)       query = query.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

    let result = await query.range(from, to);

    if (result.error?.code === '42703') {
      console.warn(
        '[GET /api/assets] Column "is_deleted" does not exist — falling back without is_deleted filter. ' +
        'Run supabase-migration-missing-columns.sql to add the missing column.',
      );
      // Rebuild the same query without the is_deleted filter
      let fallback = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId)     fallback = fallback.eq('client_id', clientId);
      if (clientName)   fallback = fallback.eq('client_name', clientName);
      if (mainCategory) fallback = fallback.eq('main_category', mainCategory);
      if (subCategory)  fallback = fallback.eq('sub_category', subCategory);
      if (monthKey)     fallback = fallback.eq('month_key', monthKey);
      if (year)         fallback = fallback.like('month_key', `${year}-%`);
      if (fileType)     fallback = fallback.like('file_type', `${fileType}%`);
      if (search)       fallback = fallback.or(`name.ilike.%${search}%,client_name.ilike.%${search}%`);

      result = await fallback.range(from, to);
    }

    const { data, error } = result;

    if (error) {
      console.error('[GET /api/assets] Supabase error:', error.message, error.details ?? '');
      return NextResponse.json(
        { success: false, error: `Failed to fetch assets: ${error.message}${error.details ? ` — ${error.details}` : ''}` },
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

/**
 * POST /api/assets
 *
 * Creates a lightweight asset row (URL-based quick add).
 * If `file_path` is omitted, it falls back to `file_url`.
 * Auth: admin | manager | team_member
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const fileUrl = typeof body.file_url === 'string' ? body.file_url.trim() : '';
  if (!name) {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }
  if (!fileUrl) {
    return NextResponse.json({ success: false, error: 'file_url is required' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    name,
    file_url: fileUrl,
    file_path: typeof body.file_path === 'string' ? body.file_path.trim() : fileUrl,
    file_type: typeof body.file_type === 'string' ? body.file_type.trim() : null,
    content_type: typeof body.content_type === 'string' ? body.content_type.trim() : null,
    client_id: typeof body.client_id === 'string' && body.client_id.trim() ? body.client_id.trim() : null,
    client_name: typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim() : null,
    storage_provider: typeof body.storage_provider === 'string' && body.storage_provider.trim()
      ? body.storage_provider.trim()
      : 'external',
    uploaded_by: auth.profile.email ?? null,
  };

  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from('assets')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    void db.from('activities').insert({
      type: 'asset',
      description: `Asset \"${name}\" created`,
      user_id: auth.profile.id,
      user_uuid: auth.profile.id,
      client_id: payload.client_id as string | null,
      entity_type: 'asset',
      entity_id: data?.id ?? null,
    }).then(({ error: activityError }) => {
      if (activityError) {
        console.warn('[POST /api/assets] activity log failed:', activityError.message);
      }
    });

    return NextResponse.json({ success: true, asset: data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
