import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';


const PAGE_SIZE = 100;

/**
 * GET /api/assets
 *
 * Returns paginated assets from the database.
 * - admin / team: all assets
 * - client: only assets belonging to their client_id
 *
 * Query params:
 *   page – 0-indexed page number (default: 0)
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
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    // Client role: profiles no longer carry client_id, so we cannot scope
    // results to a specific client — return an empty list to avoid exposing
    // all assets until RLS policies are tightened.
    if (profile.role === 'client') {
      return NextResponse.json({ success: true, assets: [], page, hasMore: false });
    }

    const supabase = getServiceClient();

    // Try with is_deleted filter first; if the column doesn't exist yet (error
    // code 42703) fall back to a query without it so the page still loads.
    // The root fix is to run supabase-migration-missing-columns.sql.
    let result = await supabase
      .from('assets')
      .select('*')
      .neq('is_deleted', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (result.error?.code === '42703') {
      console.warn(
        '[GET /api/assets] Column "is_deleted" does not exist — falling back to unfiltered query. ' +
        'Run supabase-migration-missing-columns.sql to add the missing column.',
      );
      result = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
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
